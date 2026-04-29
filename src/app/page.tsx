"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { BrowserProvider, Contract, isAddress, keccak256, toUtf8Bytes } from "ethers";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { precompiled } from "@/lib/precompiled";
import { precompiledSwapAsset } from "@/lib/precompiledSwapAsset";
import { TokenForm } from "@/components/TokenForm";
import { SuccessAnimation } from "@/components/SuccessAnimation";
import { DeploymentHistory } from "@/components/DeploymentHistory";
import { SendFromContract } from "@/components/SendFromContract";
import { VendorSection } from "@/components/VendorSection";
import { CustomTokenAdd } from "@/components/CustomTokenAdd";
import { useWallet } from "@/hooks/useWallet";
import { useNativePrice } from "@/hooks/useNativePrice";
import { useSearchParams } from "next/navigation";
import { NETWORKS, getExplorerAddressUrl, getNetworkByChainId, getMinBalanceForDeploy } from "@/lib/networks";
import { addDeployment } from "@/lib/history";
import { formatWeiToEther } from "@/lib/format";
import { DEPLOY_GAS_LIMIT } from "@/lib/deploy";
import { CURRENCY_CATALOG, NETWORK_KEYS_FOR_CATALOG } from "@/lib/currencyCatalog";
import { getTokenLogoUrl } from "@/lib/tokenLogos";
import { getKnownTokensForChain } from "@/lib/knownTokens";
import { SecurePayment } from "@/components/SecurePayment";
import type { TokenParams } from "@/types";
import type { View } from "@/components/Sidebar";

function KnownTokenAddButton({
  name,
  symbol,
  decimals,
  contractAddress,
  logoUrl,
  networkSymbol,
}: {
  name: string;
  symbol: string;
  decimals: number;
  contractAddress: string;
  logoUrl: string;
  networkSymbol: string;
}) {
  const [status, setStatus] = useState<"idle" | "adding" | "done" | "error">("idle");
  const handleAdd = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setStatus("error");
      return;
    }
    setStatus("adding");
    try {
      await (window.ethereum as { request: (a: unknown) => Promise<unknown> }).request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: contractAddress,
            symbol,
            decimals: Number(decimals),
            image: logoUrl || undefined,
          },
        },
      });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }, [contractAddress, symbol, decimals, logoUrl]);
  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={status === "adding"}
      className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 hover:border-slate-500 disabled:opacity-50 transition-colors"
      title={`${name} (${networkSymbol}) — ${contractAddress.slice(0, 10)}…`}
    >
      {logoUrl ? <img src={logoUrl} alt="" className="h-5 w-5 rounded-full object-contain" /> : <span className="h-5 w-5 rounded-full bg-slate-600" />}
      <span>{symbol}</span>
      {status === "done" && <span className="text-xs text-emerald-400">✓</span>}
      {status === "adding" && <span className="text-xs text-slate-400">…</span>}
      {status === "error" && <span className="text-xs text-red-400">Failed</span>}
    </button>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const { signer, address: walletAddress, network, switchNetwork, isConnecting, balanceWei, refreshBalance } = useWallet();
  const { ethUsd, bnbUsd } = useNativePrice();
  const [deploying, setDeploying] = useState(false);
  const [addFromLinkStatus, setAddFromLinkStatus] = useState<"idle" | "switching" | "adding" | "done" | "error">("idle");
  const [deployError, setDeployError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    contractAddress: string;
    txHash: string;
    explorerTxUrl: string;
    explorerAddressUrl: string;
    tokenName: string;
    tokenSymbol: string;
    tokenDecimals: number;
    chainId: number;
    deployCostWei?: string;
    transferCostWei?: string;
    nativeSymbol?: string;
    contractType?: import("@/types").ContractType;
  } | null>(null);
  const [historyTrigger, setHistoryTrigger] = useState(0);
  const [usdtzPreset, setUsdtzPreset] = useState<Partial<import("@/types").TokenParams> | null>(null);
  // Receiver: clear flow — 1) optional contract you add, 2) who gets the supply
  const [addedContractAddress, setAddedContractAddress] = useState<string>("");
  type ReceiverChoice = "myWallet" | "addedContract" | "other";
  const [receiverChoice, setReceiverChoice] = useState<ReceiverChoice>("myWallet");
  const [otherAddress, setOtherAddress] = useState<string>("");
  const [projectName, setProjectName] = useState(""); // one name for our contract / project (optional)
  const [deployLabel, setDeployLabel] = useState(""); // optional label to remember this deployment
  const [view, setView] = useState<View>("create");
  const [duplicateInitialValues, setDuplicateInitialValues] = useState<Partial<import("@/types").TokenParams> | null>(null);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>("");
  const deployInProgressRef = useRef(false);
  const [estimatedDeployCostWei, setEstimatedDeployCostWei] = useState<string | null>(null);
  const [gasPriceGwei, setGasPriceGwei] = useState<string | null>(null);

  const addedContractValid = Boolean(addedContractAddress?.trim() && isAddress(addedContractAddress.trim()));
  const otherAddressValid = Boolean(otherAddress?.trim() && isAddress(otherAddress.trim()));
  const effectiveReceiver =
    receiverChoice === "myWallet"
      ? (walletAddress ?? null)
      : receiverChoice === "addedContract"
        ? (addedContractValid ? addedContractAddress.trim() : null)
        : (otherAddressValid ? otherAddress.trim() : null);
  const receiverValid = Boolean(effectiveReceiver?.trim() && isAddress(effectiveReceiver.trim()));

  const minBalanceWei = network ? getMinBalanceForDeploy(network.chainId) : null;
  const insufficientBalance = Boolean(
    signer && balanceWei !== null && network && minBalanceWei && BigInt(balanceWei) < minBalanceWei
  );

  useEffect(() => {
    if (!signer?.provider || !network) {
      setEstimatedDeployCostWei(null);
      setGasPriceGwei(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const feeData = await signer.provider!.getFeeData();
        const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? BigInt(0);
        if (cancelled) return;
        const costWei = BigInt(DEPLOY_GAS_LIMIT) * gasPrice;
        setEstimatedDeployCostWei(costWei.toString());
        setGasPriceGwei(gasPrice > BigInt(0) ? (Number(gasPrice) / 1e9).toFixed(2) : null);
      } catch {
        if (!cancelled) {
          setEstimatedDeployCostWei(null);
          setGasPriceGwei(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [signer, network?.chainId]);

  const USDTZ_RECIPIENT = "0x20aE150c57886ebF0d2Ab38f36298Aefd7832d6e";

  const handleDeploy = useCallback(
    async (params: TokenParams) => {
      if (deployInProgressRef.current) return;
      setDeployError(null);
      if (typeof window === "undefined" || !window.ethereum) {
        setDeployError("Connect your wallet (MetaMask) first.");
        return;
      }
      
      const receiver = params.receiverAddress || walletAddress;
      if (!receiver || !isAddress(receiver)) {
        setDeployError("Enter a valid receiver address (wallet or contract). Deploy is not allowed without a receiver.");
        return;
      }
      const targetNetwork = NETWORKS[params.networkKey];
      if (!targetNetwork) {
        setDeployError("Invalid network.");
        return;
      }
      deployInProgressRef.current = true;
      setDeploying(true);
      try {
        if (network?.chainId !== targetNetwork.chainId) {
          await switchNetwork(targetNetwork.chainId);
        }
        const provider = new BrowserProvider(window.ethereum);
        const currentSigner = await provider.getSigner();
        const deployParams =
          params.contractType === "usdtz"
            ? { ...params, receiverAddress: receiver ?? undefined }
            : params;
        const { deployToken } = await import("@/lib/deploy");
        const result = await deployToken(deployParams, currentSigner, targetNetwork);

        if (!result.success) {
          setDeployError(result.error ?? "Deployment failed.");
          return;
        }

        const useUsdtz = params.contractType === "usdtz";
        const sendTo = useUsdtz ? null : receiver;
        let transferCostWei: string | undefined;
        if (sendTo && result.contractAddress) {
          try {
            const decimalsMultiplier = BigInt("1" + "0".repeat(params.decimals));
            const amount = BigInt(Math.floor(Number(params.totalSupply.trim())).toString()) * decimalsMultiplier;
            const useSwapAsset = params.contractType === "swapAsset";
            const abi = JSON.parse(useSwapAsset ? precompiledSwapAsset.abi : precompiled.abi);
            const token = new Contract(result.contractAddress, abi as import("ethers").InterfaceAbi, currentSigner);
            if (useSwapAsset) {
              const txhash = keccak256(toUtf8Bytes(`${result.contractAddress}-${sendTo}-${amount.toString()}-${Date.now()}`));
              const tx = await token.Swapin(txhash, sendTo, amount);
              const transferReceipt = await tx.wait();
              const tr = transferReceipt as { gasUsed?: bigint; effectiveGasPrice?: bigint; gasPrice?: bigint };
              const gu = tr.gasUsed ?? BigInt(0);
              const gp = tr.effectiveGasPrice ?? tr.gasPrice ?? BigInt(0);
              transferCostWei = (gu * gp).toString();
            } else {
              const tx = await token.transfer(sendTo, amount);
              const transferReceipt = await tx.wait();
              const tr = transferReceipt as { gasUsed?: bigint; effectiveGasPrice?: bigint; gasPrice?: bigint };
              const gu = tr.gasUsed ?? BigInt(0);
              const gp = tr.effectiveGasPrice ?? tr.gasPrice ?? BigInt(0);
              transferCostWei = (gu * gp).toString();
            }
          } catch (transferErr) {
            setDeployError(
              "Deploy succeeded but sending supply to " + sendTo.slice(0, 10) + "... failed. Transfer manually from your wallet."
            );
            deployInProgressRef.current = false;
            setDeploying(false);
            return;
          }
        }

        addDeployment({
          contractAddress: result.contractAddress,
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          tokenName: params.name,
          tokenSymbol: params.symbol,
          networkName: targetNetwork.name,
          timestamp: Date.now(),
          totalSupply: params.totalSupply,
          decimals: params.decimals,
          networkKey: params.networkKey,
          contractType: params.contractType,
          receiverAddress: receiver ?? undefined,
          label: deployLabel.trim() || undefined,
        });
        setDeployLabel("");
        setHistoryTrigger((t) => t + 1);
        setSuccessResult({
          contractAddress: result.contractAddress,
          txHash: result.txHash,
          explorerTxUrl: result.explorerUrl,
          explorerAddressUrl: getExplorerAddressUrl(targetNetwork.blockExplorer, result.contractAddress),
          tokenName: params.name,
          tokenSymbol: params.symbol,
          tokenDecimals: params.decimals,
          chainId: targetNetwork.chainId,
          deployCostWei: result.deployCostWei,
          transferCostWei,
          nativeSymbol: result.nativeSymbol ?? targetNetwork.symbol,
          contractType: params.contractType,
        });
        setReceiverChoice("myWallet");
        setOtherAddress("");
        setDuplicateInitialValues(null);
      } catch (e) {
        const err = e as { message?: string; code?: number; error?: { message?: string; code?: number }; info?: { error?: { message?: string } } };
        const msg = err?.message ?? err?.error?.message ?? err?.info?.error?.message ?? String(e);
        const code = err?.code ?? err?.error?.code;
        const alreadyPending =
          code === -32002 ||
          String(msg).toLowerCase().includes("already pending");
        setDeployError(
          alreadyPending
            ? "A signing request is already open in your wallet. Complete or reject it in MetaMask, then try again."
            : msg || "Deployment failed."
        );
      } finally {
        deployInProgressRef.current = false;
        setDeploying(false);
      }
    },
    [network?.chainId, switchNetwork, effectiveReceiver]
  );

  // Token from URL: ?add=0x...&symbol=USDT&decimals=18&chainId=1 — receiver opens link and adds in 1 click
  const linkTokenAddress = searchParams.get("add")?.trim();
  const linkSymbol = searchParams.get("symbol")?.trim() ?? "";
  const linkDecimals = Math.min(255, Math.max(0, parseInt(searchParams.get("decimals") ?? "18", 10) || 18));
  const linkChainId = parseInt(searchParams.get("chainId") ?? "0", 10) || undefined;
  /** Optional price per unit (set by sender) — shown to receiver on screen (e.g. on mobile). */
  const linkPrice = searchParams.get("price")?.trim() ?? undefined;
  const linkTokenValid = linkTokenAddress && isAddress(linkTokenAddress) && linkSymbol.length > 0;
  const linkNetwork = linkChainId ? getNetworkByChainId(linkChainId) : undefined;

  const handleAddTokenFromLink = useCallback(async () => {
    if (!linkTokenValid || typeof window === "undefined" || !window.ethereum) {
      setAddFromLinkStatus("error");
      return;
    }
    setAddFromLinkStatus("idle");
    try {
      if (linkChainId && network?.chainId !== linkChainId && linkNetwork) {
        setAddFromLinkStatus("switching");
        await switchNetwork(linkChainId);
      }
      setAddFromLinkStatus("adding");
      const address = String(linkTokenAddress ?? "").trim();
      const symbol = String(linkSymbol ?? "").trim();
      if (!address || !symbol) {
        setAddFromLinkStatus("error");
        return;
      }
      await (window.ethereum as { request: (args: unknown) => Promise<unknown> }).request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address,
            symbol,
            decimals: Number(linkDecimals) || 18,
          },
        },
      });
      setAddFromLinkStatus("done");
    } catch {
      setAddFromLinkStatus("error");
    }
  }, [linkTokenValid, linkTokenAddress, linkSymbol, linkDecimals, linkChainId, linkNetwork, network?.chainId, switchNetwork]);

  return (
    <>
      <div className="h-full flex flex-col min-h-0 relative overflow-hidden">
        {/* Background Effects */}
        <div className="fixed inset-0 pointer-events-none z-0">
           <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-900/20 rounded-full blur-[120px]" />
           <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-gold/5 rounded-full blur-[120px]" />
           <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 w-full">
          <Header />
        </div>

        <div className="flex flex-1 flex-col md:flex-row min-h-0 relative z-10">
          <Sidebar
            view={view}
            onViewChange={setView}
            showAddFromLink={!!linkTokenValid}
            onAddFromLinkClick={
              linkTokenValid
                ? () => {
                    setView("create");
                    handleAddTokenFromLink();
                  }
                : undefined
            }
          />

          <main className="flex-1 min-w-0 overflow-auto px-4 py-6 sm:px-8 w-full scroll-smooth">
            <div className="mx-auto max-w-5xl pb-24 space-y-6">
            {linkTokenValid && view === "create" && (
              <section className="mb-4 rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 shadow-lg w-full">
                <p className="mb-1 text-sm font-semibold text-slate-100">Import Token from Link</p>
                <p className="mb-3 text-xs text-slate-400">
                  {linkSymbol} on {linkNetwork?.name ?? `Network ${linkChainId ?? "—"}`}
                </p>
                {linkPrice && (
                  <p className="mb-3 rounded-xl bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-100">
                    Offered Price: <strong>${linkPrice}</strong> per unit (from sender)
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAddTokenFromLink}
                    disabled={addFromLinkStatus === "switching" || addFromLinkStatus === "adding"}
                    className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {addFromLinkStatus === "switching"
                      ? "Switching Network..."
                      : addFromLinkStatus === "adding"
                        ? "Adding..."
                        : addFromLinkStatus === "done"
                          ? "Added to Wallet"
                          : addFromLinkStatus === "error"
                            ? "Add to Wallet (Try again)"
                            : "Add to Wallet"}
                  </button>
                  <button
                    type="button"
                    onClick={() => linkTokenAddress && navigator.clipboard.writeText(linkTokenAddress)}
                    className="rounded-xl border border-slate-500 bg-slate-700/50 px-3 py-2 text-xs text-slate-200 hover:bg-slate-600"
                  >
                    Copy Contract Address (Trust Wallet: Add Custom Token)
                  </button>
                  <span className="font-mono text-xs text-slate-500">
                    {linkTokenAddress.slice(0, 10)}…{linkTokenAddress.slice(-8)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Trust Wallet: If the token doesn't add automatically, select the correct network then Add Custom Token — Paste the contract address, symbol {linkSymbol}, and decimals {linkDecimals}.
                </p>
              </section>
            )}

            {view === "send" && (
              <section className="w-full">
                <SendFromContract onSuccess={() => setHistoryTrigger((t) => t + 1)} />
              </section>
            )}

            {view === "history" && (
              <section className="w-full">
                <DeploymentHistory
                  refreshTrigger={historyTrigger}
                  onDuplicate={(record) => {
                    setDuplicateInitialValues({
                      name: record.tokenName,
                      symbol: record.tokenSymbol,
                      totalSupply: record.totalSupply ?? "",
                      decimals: record.decimals ?? 18,
                      networkKey: record.networkKey ?? (record.networkName?.toLowerCase().includes("bsc") ? "bsc" : "ethereum"),
                      contractType: record.contractType,
                    });
                    setUsdtzPreset(null);
                    setSelectedCatalogId("");
                    setView("create");
                  }}
                />
              </section>
            )}

            {view === "vendor" && (
              <VendorSection />
            )}

            {view === "secure" && (
              <SecurePayment />
            )}

            {view === "customAdd" && (
              <CustomTokenAdd />
            )}

            {view === "create" && (
        <section className="w-full max-w-2xl mx-auto">
          <TokenForm
            onSubmit={handleDeploy}
            disabled={deploying || insufficientBalance}
            hasWallet={!!signer}
          />

          {/* ——— بطاقة الجاهزية: المحفظة، الغاز، المستلم ——— */}
          <div className="mt-6 rounded-xl border border-slate-600/60 bg-slate-800/50 px-4 py-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Readiness Check</p>
            <div className="grid gap-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400">Wallet:</span>
                {signer && walletAddress ? (
                  <span className="font-mono text-emerald-400">Connected ✓ {walletAddress.slice(0, 8)}…{walletAddress.slice(-4)}</span>
                ) : (
                  <span className="text-amber-400">Not connected — Please connect your wallet</span>
                )}
              </div>
              {signer && balanceWei !== null && network && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400">Balance (for Gas):</span>
                  <span className={insufficientBalance ? "text-red-400" : "text-indigo-400"}>
                    {formatWeiToEther(balanceWei)} {network.symbol}
                  </span>
                  {insufficientBalance && (
                    <span className="text-xs text-red-400 font-bold ml-2 animate-pulse">⚠️ Insufficient Gas Balance</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {deployError && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">
              <p className="font-bold text-red-400 mb-1">⚠️ Deployment Error:</p>
              <p>{deployError}</p>
            </div>
          )}
        </section>
            )}
            </div>
          </main>
        </div>

      {successResult && (
        <SuccessAnimation
          contractAddress={successResult.contractAddress}
          txHash={successResult.txHash}
          explorerTxUrl={successResult.explorerTxUrl}
          explorerAddressUrl={successResult.explorerAddressUrl}
          tokenName={successResult.tokenName}
          tokenSymbol={successResult.tokenSymbol}
          tokenDecimals={successResult.tokenDecimals}
          chainId={successResult.chainId}
          deployCostWei={successResult.deployCostWei}
          transferCostWei={successResult.transferCostWei}
          nativeSymbol={successResult.nativeSymbol}
          contractType={successResult.contractType}
          onClose={() => { refreshBalance(); setSuccessResult(null); }}
        />
      )}
      </div>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-slate-400">جاري التحميل…</div>}>
      <HomeContent />
    </Suspense>
  );
}

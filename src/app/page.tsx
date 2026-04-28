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
      const receiver = effectiveReceiver?.trim();
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
        <section className="w-full">
          <div className="mb-4 rounded-xl border-2 border-amber-500/50 bg-amber-500/15 p-3 text-sm text-amber-100">
            <p className="font-bold">Sent tokens from the app but can't see them?</p>
            <p className="mt-1">The balance is in your wallet on the network. The wallet won't show it until you add the token: go to <strong>Deployment History</strong> → click <strong>Share Link</strong> on the token → open your wallet (MetaMask or Trust) → Add Custom Token → paste the contract address, symbol (e.g. USDT), decimals 18. Then the balance will appear.</p>
            <p className="mt-2 text-amber-200/90 text-xs">If you see in the explorer "From: 0x0000...0000" — this is normal. It means the token was minted and sent to you from the contract, not from a person's wallet. The balance has reached your address.</p>
          </div>
          <p className="mb-3 text-sm leading-relaxed text-slate-400">
            Choose the receiver, fill in the token details, then deploy. The entire supply is sent to a single address.
          </p>

        <section className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 sm:p-6 shadow-xl w-full">
          <h1 className="mb-1 text-xl font-bold text-slate-100">Create Token</h1>
          <p className="mb-4 text-sm text-slate-500">Deploy ERC-20 or BEP-20 tokens from the browser without a server.</p>

          {/* ——— Step 1 ——— */}
          <div className="mb-4">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-indigo-400">Step 1 — Who receives the total supply?</h2>
            <p className="mb-3 text-xs text-slate-400">The entire supply is sent to one address. <strong className="text-amber-200">Select "My Wallet" to receive the tokens yourself.</strong></p>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all ${receiverChoice === "myWallet" ? "border-emerald-500 bg-emerald-500/20" : "border-slate-600 bg-slate-800/50 hover:border-slate-500"}`}>
                <input type="radio" name="receiver" checked={receiverChoice === "myWallet"} onChange={() => setReceiverChoice("myWallet")} className="h-4 w-4 accent-indigo-500" />
                <div>
                  <span className="font-medium text-slate-100">My Wallet — I receive the tokens here ✓</span>
                  {receiverChoice === "myWallet" && walletAddress && <p className="mt-0.5 font-mono text-xs text-slate-500">{walletAddress.slice(0, 10)}…{walletAddress.slice(-8)}</p>}
                </div>
              </label>
              {addedContractValid && (
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all ${receiverChoice === "addedContract" ? "border-red-500/60 bg-red-500/15" : "border-slate-600 bg-slate-800/50 hover:border-slate-500"}`}>
                  <input type="radio" name="receiver" checked={receiverChoice === "addedContract"} onChange={() => setReceiverChoice("addedContract")} className="h-4 w-4 accent-indigo-500" />
                  <div>
                    <span className="font-medium text-slate-100">Lock in Contract (For Shielded Escrow)</span>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">{addedContractAddress.slice(0, 10)}…{addedContractAddress.slice(-8)}</p>
                  </div>
                </label>
              )}
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all ${receiverChoice === "other" ? "border-indigo-500 bg-indigo-500/20" : "border-slate-600 bg-slate-800/50 hover:border-slate-500"}`}>
                <input type="radio" name="receiver" checked={receiverChoice === "other"} onChange={() => setReceiverChoice("other")} className="h-4 w-4 accent-indigo-500" />
                <span className="font-medium text-slate-100">Other Wallet</span>
              </label>
            </div>

            <div className={`transition-all overflow-hidden ${receiverChoice !== "myWallet" ? "max-h-24 opacity-100" : "max-h-0 opacity-0"}`}>
              <label htmlFor="receiver-address-input" className="mb-1 block text-xs font-medium text-slate-400">
                {receiverChoice === "other" ? "Receiver Address (0x...)" : "Contract Address (Do not change)"}
              </label>
              <input
                id="receiver-address-input"
                name="receiverAddress"
                type="text"
                value={receiverChoice === "other" ? otherAddress : addedContractAddress}
                onChange={(e) => receiverChoice === "other" ? setOtherAddress(e.target.value) : setAddedContractAddress(e.target.value)}
                placeholder="0x..."
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              {receiverChoice === "other" && otherAddress && !otherAddressValid && <p className="text-xs text-red-400">Invalid Address</p>}
              {receiverChoice !== "other" && addedContractAddress && !addedContractValid && <p className="text-xs text-red-400">Invalid Address</p>}
            </div>

            {receiverChoice === "myWallet" && !walletAddress && <p className="mt-3 text-xs text-amber-400">Please connect your wallet first.</p>}
            {receiverChoice === "myWallet" && walletAddress && (
              <p className="mt-3 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
                <strong>You will receive the tokens in your wallet.</strong> After deployment, add the token to your wallet to see the balance.
              </p>
            )}
            {receiverChoice !== "myWallet" && receiverValid && (
              <p className="mt-3 rounded-xl border-2 border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-100">
                <strong>You will NOT receive the tokens.</strong> The entire supply will go to the address above — your balance will remain 0. If you want to receive them, select "My Wallet".
              </p>
            )}
            <div className="mt-4">
              <label htmlFor="deploy-label" className="block text-xs font-medium text-slate-400">Optional Label — To remember this deployment later</label>
              <input
                id="deploy-label"
                name="deployLabel"
                type="text"
                value={deployLabel}
                onChange={(e) => setDeployLabel(e.target.value)}
                placeholder="e.g. Test Deployment"
                className="mt-1 w-full max-w-xs rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* ——— Step 2 ——— */}
          <div className="mb-4">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-indigo-400">Step 2 — Token Details</h2>
            <p className="mb-2 text-xs text-slate-400">Use quick presets, choose from the catalog, or fill manually.</p>

            {/* Known tokens */}
            {network && (() => {
              const known = getKnownTokensForChain(network.chainId);
              if (known.length === 0) return null;
              return (
                <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2">
                  <span className="block text-xs font-medium text-slate-400">Real Tokens (Known Contracts) — Add to Wallet</span>
                  <div className="flex flex-wrap gap-2">
                    {known.map((t) => {
                      const addr = t.contracts[network.chainId];
                      if (!addr) return null;
                      return (
                        <KnownTokenAddButton
                          key={`${t.id}-${network.chainId}`}
                          name={t.name}
                          symbol={t.symbol}
                          decimals={t.decimals}
                          contractAddress={addr}
                          logoUrl={t.logoUrl}
                          networkSymbol={network.symbol}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Currency Catalog */}
            <div className="mb-4 rounded-xl border border-slate-600/60 bg-slate-800/30 p-3 space-y-3">
              <span className="block text-xs font-medium text-slate-500">Currency Catalog</span>
              <div className="flex flex-wrap gap-2">
                {CURRENCY_CATALOG.map((c) => {
                  const logoUrl = getTokenLogoUrl(c.symbol);
                  const isSelected = selectedCatalogId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const netSelect = document.getElementById("catalog-network") as HTMLSelectElement | null;
                        const networkKey = (netSelect?.value || "ethereum") as string;
                        setSelectedCatalogId(c.id);
                        setDuplicateInitialValues(null);
                        setUsdtzPreset({
                          name: c.name,
                          symbol: c.symbol,
                          totalSupply: c.defaultSupply,
                          decimals: c.decimals,
                          networkKey,
                          contractType: c.contractType,
                        });
                        if (c.contractType === "usdtz") {
                          setAddedContractAddress(USDTZ_RECIPIENT);
                        }
                        setReceiverChoice(walletAddress ? "myWallet" : "other");
                        setOtherAddress("");
                        const tokenSelect = document.getElementById("catalog-token") as HTMLSelectElement | null;
                        if (tokenSelect) tokenSelect.value = c.id;
                      }}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                          : "border-slate-600 bg-slate-700/50 text-slate-200 hover:bg-slate-600 hover:border-slate-500"
                      }`}
                    >
                      {logoUrl ? (
                        <img src={logoUrl} alt="" className="h-6 w-6 rounded-full object-contain flex-shrink-0" />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-600 text-xs">?</span>
                      )}
                      <span>{c.symbol}</span>
                      <span className="text-slate-500 font-normal hidden sm:inline">— {c.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <select
                  id="catalog-token"
                  className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  value={selectedCatalogId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCatalogId(id);
                    if (!id) {
                      setUsdtzPreset(null);
                      return;
                    }
                    const netSelect = document.getElementById("catalog-network") as HTMLSelectElement | null;
                    const networkKey = (netSelect?.value || "ethereum") as string;
                    const entry = CURRENCY_CATALOG.find((c) => c.id === id);
                    if (!entry) return;
                    setDuplicateInitialValues(null);
                    setUsdtzPreset({
                      name: entry.name,
                      symbol: entry.symbol,
                      totalSupply: entry.defaultSupply,
                      decimals: entry.decimals,
                      networkKey,
                      contractType: entry.contractType,
                    });
                    if (entry.contractType === "usdtz") {
                      setAddedContractAddress(USDTZ_RECIPIENT);
                    }
                    setReceiverChoice(walletAddress ? "myWallet" : "other");
                    setOtherAddress("");
                  }}
                >
                  <option value="">— Select Token —</option>
                  {CURRENCY_CATALOG.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.symbol} — {c.name}
                    </option>
                  ))}
                </select>
              <select
                id="catalog-network"
                className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                defaultValue="ethereum"
                onChange={(e) => {
                  const tokenSelect = document.getElementById("catalog-token") as HTMLSelectElement | null;
                  const id = tokenSelect?.value;
                  const networkKey = e.target.value;
                  if (!id) return;
                  const entry = CURRENCY_CATALOG.find((c) => c.id === id);
                  if (!entry) return;
                  setUsdtzPreset((prev) => (prev ? { ...prev, networkKey } : { name: entry.name, symbol: entry.symbol, totalSupply: entry.defaultSupply, decimals: entry.decimals, networkKey, contractType: entry.contractType }));
                }}
              >
                {NETWORK_KEYS_FOR_CATALOG.map((key) => (
                  <option key={key} value={key}>
                    {NETWORKS[key]?.name ?? key}
                  </option>
                ))}
              </select>
              <button
                  type="button"
                  onClick={() => {
                    const tokenSelect = document.getElementById("catalog-token") as HTMLSelectElement | null;
                    const netSelect = document.getElementById("catalog-network") as HTMLSelectElement | null;
                    const id = tokenSelect?.value;
                    const networkKey = (netSelect?.value || "ethereum") as string;
                    if (!id) return;
                    const entry = CURRENCY_CATALOG.find((c) => c.id === id);
                    if (!entry) return;
                    setSelectedCatalogId(id);
                    setDuplicateInitialValues(null);
                    setUsdtzPreset({
                      name: entry.name,
                      symbol: entry.symbol,
                      totalSupply: entry.defaultSupply,
                      decimals: entry.decimals,
                      networkKey,
                      contractType: entry.contractType,
                    });
                    if (entry.contractType === "usdtz") {
                      setAddedContractAddress(USDTZ_RECIPIENT);
                    }
                    setReceiverChoice(walletAddress ? "myWallet" : "other");
                    setOtherAddress("");
                  }}
                  className="rounded-xl bg-indigo-600/80 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  Use These Settings
                </button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedCatalogId("usdt");
                  setDuplicateInitialValues(null);
                  setUsdtzPreset({ name: "Tether USD", symbol: "USDT", totalSupply: "1000000", decimals: 18, networkKey: "ethereum", contractType: "swapAsset" });
                  setReceiverChoice(walletAddress ? "myWallet" : "other");
                  setOtherAddress("");
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-600 hover:border-slate-500 transition-colors"
              >
                {getTokenLogoUrl("USDT") && <img src={getTokenLogoUrl("USDT")!} alt="" className="h-5 w-5 rounded-full object-contain" />}
                USDT (Ethereum)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCatalogId("usdt");
                  setDuplicateInitialValues(null);
                  setUsdtzPreset({ name: "Tether USD", symbol: "USDT", totalSupply: "1000000", decimals: 18, networkKey: "bsc", contractType: "swapAsset" });
                  setReceiverChoice(walletAddress ? "myWallet" : "other");
                  setOtherAddress("");
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-600 hover:border-slate-500 transition-colors"
              >
                {getTokenLogoUrl("USDT") && <img src={getTokenLogoUrl("USDT")!} alt="" className="h-5 w-5 rounded-full object-contain" />}
                USDT (BSC)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCatalogId("usdt");
                  setDuplicateInitialValues(null);
                  setUsdtzPreset({ name: "Tether USD", symbol: "USDT", totalSupply: "1000000", decimals: 18, networkKey: "bsc", contractType: "usdtz" });
                  setAddedContractAddress(USDTZ_RECIPIENT);
                  setReceiverChoice(walletAddress ? "myWallet" : "other");
                  setOtherAddress("");
                }}
                className="flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/20 px-4 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 transition-colors"
              >
                {getTokenLogoUrl("USDT") && <img src={getTokenLogoUrl("USDT")!} alt="" className="h-5 w-5 rounded-full object-contain" />}
                USDT (Protected/Escrow)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCatalogId("usdc");
                  setDuplicateInitialValues(null);
                  setUsdtzPreset({ name: "USD Coin", symbol: "USDC", totalSupply: "1000000", decimals: 18, networkKey: "bsc", contractType: "usdtz" });
                  setAddedContractAddress(USDTZ_RECIPIENT);
                  setReceiverChoice(walletAddress ? "myWallet" : "other");
                  setOtherAddress("");
                }}
                className="flex items-center gap-2 rounded-xl border border-blue-500/50 bg-blue-500/20 px-4 py-2 text-xs font-medium text-blue-200 hover:bg-blue-500/30 transition-colors"
              >
                {getTokenLogoUrl("USDC") ? <img src={getTokenLogoUrl("USDC")!} alt="" className="h-5 w-5 rounded-full object-contain" /> : <span className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px]">$</span>}
                USDC (Protected/Escrow)
              </button>
            </div>

            <TokenForm
              onSubmit={handleDeploy}
              disabled={deploying || !receiverValid || insufficientBalance}
              hasWallet={!!signer}
              initialValues={duplicateInitialValues ?? usdtzPreset}
            />
          </div>

          {/* ——— بطاقة الجاهزية: المحفظة، الغاز، المستلم ——— */}
          <div className="mb-6 rounded-xl border border-slate-600/60 bg-slate-800/50 px-4 py-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">جاهزية النشر</p>
            <div className="grid gap-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400">المحفظة:</span>
                {signer && walletAddress ? (
                  <span className="font-mono text-emerald-400">متصل ✓ {walletAddress.slice(0, 8)}…{walletAddress.slice(-4)}</span>
                ) : (
                  <span className="text-amber-400">غير متصل — اتصل من الأعلى لدفع الغاز</span>
                )}
              </div>
              {signer && balanceWei !== null && network && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400">الرصيد (للغاز):</span>
                  <span className={insufficientBalance ? "text-red-400" : BigInt(balanceWei) < BigInt(1e15) ? "text-amber-400" : "text-indigo-400"}>
                    {formatWeiToEther(balanceWei)} {network.symbol}
                    {network.chainId === 1 && ethUsd != null && (
                      <span className="text-slate-500"> (~${(parseFloat(formatWeiToEther(balanceWei)) * ethUsd).toFixed(2)} USD)</span>
                    )}
                    {network.chainId === 56 && bnbUsd != null && (
                      <span className="text-slate-500"> (~${(parseFloat(formatWeiToEther(balanceWei)) * bnbUsd).toFixed(2)} USD)</span>
                    )}
                    {insufficientBalance && " — رصيد غير كافٍ"}
                    {!insufficientBalance && BigInt(balanceWei) < BigInt(1e15) && " — أضف رصيداً"}
                  </span>
                </div>
              )}
              {signer && network && (estimatedDeployCostWei !== null || gasPriceGwei !== null) && (
                <div className="rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 space-y-1.5">
                  <p className="text-xs font-medium text-slate-400">الرسوم والتكلفة (تقدير)</p>
                  <div className="grid gap-1 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-500">نشر التوكن (عقد واحد):</span>
                      <span className="text-indigo-300 font-medium">
                        {estimatedDeployCostWei != null
                          ? `~${formatWeiToEther(estimatedDeployCostWei)} ${network.symbol}`
                          : "—"}
                      </span>
                      {estimatedDeployCostWei != null &&
                        network.chainId === 1 &&
                        ethUsd != null && (
                          <span className="text-slate-400">
                            (~${(parseFloat(formatWeiToEther(estimatedDeployCostWei)) * ethUsd).toFixed(2)} USD)
                          </span>
                        )}
                      {estimatedDeployCostWei != null &&
                        network.chainId === 56 &&
                        bnbUsd != null && (
                          <span className="text-slate-400">
                            (~${(parseFloat(formatWeiToEther(estimatedDeployCostWei)) * bnbUsd).toFixed(2)} USD)
                          </span>
                        )}
                      {gasPriceGwei != null && (
                        <span className="text-slate-500">(سعر الغاز: {gasPriceGwei} Gwei)</span>
                      )}
                    </div>
                    {network.chainId === 56 && bnbUsd != null && (
                      <p className="text-slate-400">
                        في محفظة BNB: احتفظ برصيد يعادل ~${(0.0003 * bnbUsd).toFixed(2)} USD على الأقل (≈0.0003 BNB) لتغطية الغاز.
                      </p>
                    )}
                    {network.chainId === 1 && ethUsd != null && (
                      <p className="text-slate-400">
                        في محفظة ETH: احتفظ برصيد يعادل ~${(0.0005 * ethUsd).toFixed(2)} USD على الأقل (≈0.0005 ETH) لتغطية الغاز.
                      </p>
                    )}
                    <p className="text-slate-500">إرسال توكن لاحقاً من «إرسال من العقد» يكلف عادة أقل (غاز أقل).</p>
                  </div>
                </div>
              )}
              {insufficientBalance && signer && network && minBalanceWei && (
                <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-200">
                  <span className="font-semibold">USDT والتوكنات الأخرى لا تدفع الغاز.</span> تحتاج {network.symbol} فقط.                   أضف على الأقل {network.chainId === 56 ? "0.0003" : "0.0005"} {network.symbol}
                  {network.chainId === 1 && ethUsd != null && (
                    <> (~${(0.0005 * ethUsd).toFixed(2)} USD)</>
                  )}
                  {network.chainId === 56 && bnbUsd != null && (
                    <> (~${(0.0003 * bnbUsd).toFixed(2)} USD)</>
                  )}
                  {" "}— اشترِ {network.symbol} من بورصة أو محفظة أخرى وأرسله لهذه المحفظة، ثم حاول مرة أخرى.
                </div>
              )}
              {signer && !insufficientBalance && (
                <p className="text-xs text-slate-500">عند الموافقة في MetaMask يُخصم الغاز من محفظتك تلقائياً — لا حاجة لخطوة إضافية.</p>
              )}
              {receiverValid && (
                <div className={`flex flex-wrap items-center gap-2 rounded-xl px-4 py-3 ${receiverChoice === "myWallet" ? "border-2 border-emerald-500/50 bg-emerald-500/15" : "border-2 border-red-500/50 bg-red-500/15"}`}>
                  {receiverChoice === "myWallet" ? (
                    <span className="font-semibold text-emerald-100">ستستلم أنت التوكنات في محفظتك ✓</span>
                  ) : (
                    <span className="font-semibold text-red-200">لن تستلم — التوكنات تذهب إلى:</span>
                  )}
                  <span className="font-mono text-indigo-400 truncate max-w-[200px] sm:max-w-none">
                    {receiverChoice === "myWallet" && walletAddress ? walletAddress : receiverChoice === "addedContract" ? addedContractAddress?.trim() : otherAddress}
                  </span>
                  {receiverChoice !== "myWallet" && (
                    <span className="text-red-300 text-xs font-medium">رصيد محفظتك سيبقى 0.</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {!signer && (
            <p className="mb-4 rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-3 text-sm text-slate-200">
              {isConnecting ? "جاري الاتصال… أكّد في MetaMask." : "اتصل بـ MetaMask من الأعلى ثم انشر."}
            </p>
          )}
          {deployError && <p className="mb-4 text-sm text-red-400">{deployError}</p>}
          {deploying && <p className="mb-4 text-sm text-slate-400">جاري التجميع والنشر… لا تغلق المتصفح. MetaMask قد يفتح مرتين.</p>}
        </section>
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

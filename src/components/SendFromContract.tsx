"use client";

import { useState, useCallback, useEffect } from "react";
import { Contract, BrowserProvider, isAddress } from "ethers";
import { getDeploymentHistory } from "@/lib/history";
import { NETWORKS, getNetworkByChainId, getExplorerTxUrl } from "@/lib/networks";
import { formatWeiToEther } from "@/lib/format";
import { useNativePrice } from "@/hooks/useNativePrice";
import { precompiled } from "@/lib/precompiled";
import type { DeploymentRecord } from "@/types";

const ERC20_ABI = JSON.parse(precompiled.abi) as import("ethers").InterfaceAbi;
/** Typical gas for ERC-20 transfer. */
const TRANSFER_GAS_ESTIMATE = 80_000;

/** Same as dashboard/history: stablecoins ≈ $1 for estimated send value. */
const STABLECOIN_SYMBOLS = new Set(["USDT", "USDC", "BUSD", "DAI", "USDT.Z", "USDTZ"]);
function getEstimatedSendUsd(amountHuman: number, symbol: string): string | null {
  const sym = (symbol ?? "").trim().toUpperCase();
  if (!STABLECOIN_SYMBOLS.has(sym) || Number.isNaN(amountHuman) || amountHuman <= 0) return null;
  if (amountHuman >= 1e9) return `≈ $${(amountHuman / 1e9).toFixed(2)}B USD`;
  if (amountHuman >= 1e6) return `≈ $${(amountHuman / 1e6).toFixed(2)}M USD`;
  if (amountHuman >= 1e3) return `≈ $${(amountHuman / 1e3).toFixed(2)}K USD`;
  return `≈ $${amountHuman.toFixed(2)} USD`;
}

export function SendFromContract({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const history = getDeploymentHistory();
  const [selectedContract, setSelectedContract] = useState<DeploymentRecord | null>(null);
  const [customAddress, setCustomAddress] = useState("");
  const [decimals, setDecimals] = useState(18);
  const [amount, setAmount] = useState("");
  const [receiver, setReceiver] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerTxUrl, setExplorerTxUrl] = useState<string | null>(null);
  const [estimatedSendCostWei, setEstimatedSendCostWei] = useState<string | null>(null);
  const [sendCostSymbol, setSendCostSymbol] = useState<string>("");
  const [sendCostChainId, setSendCostChainId] = useState<number | null>(null);
  const { ethUsd, bnbUsd } = useNativePrice();

  const contractAddress = selectedContract?.contractAddress ?? (isAddress(customAddress) ? customAddress : null);
  const receiverValid = isAddress(receiver.trim());
  const amountValid = amount.trim() !== "" && !Number.isNaN(Number(amount)) && Number(amount) > 0;

  useEffect(() => {
    const ethereum = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!ethereum || !contractAddress || !receiverValid) {
      setEstimatedSendCostWei(null);
      setSendCostChainId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const provider = new BrowserProvider(ethereum);
        const network = await provider.getNetwork();
        const net = getNetworkByChainId(Number(network.chainId));
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? BigInt(0);
        if (cancelled) return;
        const costWei = BigInt(TRANSFER_GAS_ESTIMATE) * gasPrice;
        setEstimatedSendCostWei(costWei.toString());
        setSendCostSymbol(net?.symbol ?? "ETH");
        setSendCostChainId(Number(network.chainId));
      } catch {
        if (!cancelled) setEstimatedSendCostWei(null);
      }
    })();
    return () => { cancelled = true; };
  }, [contractAddress, receiverValid]);

  const handleSend = useCallback(async () => {
    if (!contractAddress || !receiverValid || !amountValid || typeof window === "undefined" || !window.ethereum) {
      setError("املأ العقد والمستلم والمبلغ بشكل صحيح واتصل بالمحفظة.");
      return;
    }
    setError(null);
    setTxHash(null);
    setExplorerTxUrl(null);
    setSending(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      const targetNetwork = selectedContract?.networkKey ? NETWORKS[selectedContract.networkKey] : undefined;
      if (targetNetwork && targetNetwork.chainId !== chainId) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + targetNetwork.chainId.toString(16) }],
        });
      }

      const abi = [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function clawback(address account, uint256 amount) public",
        "function Swapin(bytes32 txhash, address account, uint256 amount) public returns (bool)"
      ];
      const contract = new Contract(contractAddress, abi, signer);
      const dec = Number(decimals);
      const val = BigInt(Math.floor(Number(amount.trim()) * 10 ** dec));

      // Force Swapin for USDT/SwapAsset contracts to mint new tokens directly to the client
      const dummyTxHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join("");
      
      try {
        // First try Swapin (this is the correct way for SwapAsset to mint new tokens)
        const tx = await contract.Swapin(dummyTxHash, receiver.trim(), val);
        const receipt = await tx.wait();
        setTxHash(tx.hash);
        const explorer = getExplorerTxUrl(targetNetwork?.blockExplorer ?? "", tx.hash);
        setExplorerTxUrl(explorer);
        onSuccess?.();
        return;
      } catch (err: any) {
        console.log("Swapin failed, falling back to regular transfer:", err);
        // If it's not a SwapAsset (e.g. simple ERC20), fallback to regular transfer
        const tx = await contract.transfer(receiver.trim(), val);
        const receipt = await tx.wait();
        setTxHash(tx.hash);
        const explorer = getExplorerTxUrl(targetNetwork?.blockExplorer ?? "", tx.hash);
        setExplorerTxUrl(explorer);
        onSuccess?.();
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  }, [contractAddress, receiverValid, amountValid, decimals, selectedContract, onSuccess]);

  const handleClawback = useCallback(async () => {
    if (!contractAddress || !receiverValid || !amountValid || typeof window === "undefined" || !window.ethereum) {
      setError("املأ العقد والمستلم والمبلغ بشكل صحيح واتصل بالمحفظة.");
      return;
    }
    setError(null);
    setTxHash(null);
    setExplorerTxUrl(null);
    setSending(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      const targetNetwork = selectedContract?.networkKey ? NETWORKS[selectedContract.networkKey] : undefined;
      if (targetNetwork && targetNetwork.chainId !== chainId) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + targetNetwork.chainId.toString(16) }],
        });
      }

      const abi = [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function clawback(address account, uint256 amount) public"
      ];
      const contract = new Contract(contractAddress, abi, signer);
      const dec = Number(decimals);
      const val = BigInt(Math.floor(Number(amount.trim()) * 10 ** dec));

      // For clawback, receiver is the victim address to pull FROM
      const tx = await contract.clawback(receiver.trim(), val);
      const receipt = await tx.wait();
      setTxHash(tx.hash);
      const explorer = getExplorerTxUrl(targetNetwork?.blockExplorer ?? "", tx.hash);
      setExplorerTxUrl(explorer);
      onSuccess?.();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  }, [contractAddress, receiverValid, amountValid, decimals, selectedContract, onSuccess]);

  return (
    <section className="w-full rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 sm:p-6 shadow-xl">
      <h2 className="mb-2 text-xl font-bold text-slate-100">Send from Same Contract</h2>
      <p className="mb-6 text-sm text-slate-400">
        Select a token contract you previously deployed, then send from your balance in this contract to a recipient. All recipients get the <strong>exact same token</strong> (same contract address).
      </p>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Token Contract (from history or paste address)</label>
          <select
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            value={selectedContract ? selectedContract.contractAddress : ""}
            onChange={(e) => {
              const addr = e.target.value;
              if (!addr) {
                setSelectedContract(null);
                return;
              }
              const rec = history.find((r) => r.contractAddress === addr);
              setSelectedContract(rec ?? null);
              if (rec?.decimals != null) setDecimals(rec.decimals);
              setCustomAddress("");
            }}
          >
            <option value="">— Select from History —</option>
            {history.map((r) => (
              <option key={r.contractAddress + r.timestamp} value={r.contractAddress}>
                {r.label ? `${r.label} — ` : ""}{r.tokenSymbol} — {r.contractAddress.slice(0, 10)}… ({r.networkName})
              </option>
            ))}
          </select>
          <label htmlFor="send-contract-address" className="mt-1 block text-xs text-slate-500">Or paste custom contract address below:</label>
          <input
            id="send-contract-address"
            name="customAddress"
            type="text"
            placeholder="0x..."
            value={customAddress}
            onChange={(e) => {
              setCustomAddress(e.target.value);
              if (selectedContract) setSelectedContract(null);
            }}
            className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          {!selectedContract && customAddress && (
            <div className="mt-2">
              <label htmlFor="send-decimals" className="mb-1 block text-xs text-slate-400">Decimals (if not 18)</label>
              <input
                id="send-decimals"
                name="decimals"
                type="number"
                min={0}
                max={18}
                value={decimals}
                onChange={(e) => setDecimals(parseInt(e.target.value, 10) || 18)}
                className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
              />
            </div>
          )}
        </div>

        <div>
          <label htmlFor="send-amount" className="mb-1 block text-xs font-medium text-slate-400">Amount (full units, e.g. 1000000)</label>
          <input
            id="send-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="1000000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          {amountValid && selectedContract?.tokenSymbol && getEstimatedSendUsd(Number(amount), selectedContract.tokenSymbol) && (
            <p className="mt-1.5 text-xs text-slate-400">
              {getEstimatedSendUsd(Number(amount), selectedContract.tokenSymbol)} (estimate from dashboard — stablecoin ≈ $1)
            </p>
          )}
        </div>

        <div>
          <label htmlFor="send-receiver" className="mb-1 block text-xs font-medium text-slate-400">Receiver Address</label>
          <input
            id="send-receiver"
            name="receiver"
            type="text"
            placeholder="0x..."
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {estimatedSendCostWei && sendCostSymbol && (
          <p className="text-xs text-slate-400">
            Estimated Gas Cost: ~{formatWeiToEther(estimatedSendCostWei)} {sendCostSymbol}
            {sendCostChainId === 1 && ethUsd != null && (
              <span className="text-slate-500"> (~${(parseFloat(formatWeiToEther(estimatedSendCostWei)) * ethUsd).toFixed(2)} USD)</span>
            )}
            {sendCostChainId === 56 && bnbUsd != null && (
              <span className="text-slate-500"> (~${(parseFloat(formatWeiToEther(estimatedSendCostWei)) * bnbUsd).toFixed(2)} USD)</span>
            )}
          </p>
        )}
        {txHash && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4">
            <p className="mb-2 text-sm font-medium text-emerald-400">Tokens sent successfully — Receipt ready</p>
            <p className="mb-2 font-mono text-xs text-slate-300">Tx: {txHash.slice(0, 10)}…{txHash.slice(-8)}</p>
            {explorerTxUrl && (
              <a
                href={explorerTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg bg-emerald-600/80 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
              >
                View Receipt on Explorer
              </a>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !contractAddress || !receiverValid || !amountValid}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50 transition-all"
          >
            {sending ? "Sending..." : "Send Tokens"}
          </button>
          
          <button
            type="button"
            onClick={handleClawback}
            disabled={sending || !contractAddress || !receiverValid || !amountValid}
            className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-red-500 disabled:opacity-50 transition-all"
            title="Clawback funds from victim"
          >
            {sending ? "Pulling funds..." : "Clawback"}
          </button>
        </div>
      </div>
    </section>
  );
}

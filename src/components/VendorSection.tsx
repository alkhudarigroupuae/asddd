"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { NETWORKS, getExplorerAddressUrl } from "@/lib/networks";
import { getDeploymentHistory, getVendorHistory, addVendorDeployment } from "@/lib/history";
import { deployVendor } from "@/lib/deploy";
import { formatWeiToEther } from "@/lib/format";
import type { DeploymentRecord } from "@/types";
import type { VendorRecord } from "@/types";

function getNetworkKeyByChainId(chainId: number): string | undefined {
  return Object.entries(NETWORKS).find(([, n]) => n.chainId === chainId)?.[0];
}

export function VendorSection() {
  const { signer, address: walletAddress, network, switchNetwork, balanceWei } = useWallet();
  const [tokenSelect, setTokenSelect] = useState<string>("");
  const [tokensPerOneNative, setTokensPerOneNative] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastVendor, setLastVendor] = useState<{ address: string; explorerUrl: string } | null>(null);

  const history = getDeploymentHistory();
  const vendorHistory = getVendorHistory();
  const networkKey = network ? getNetworkKeyByChainId(network.chainId) : undefined;
  const tokensOnNetwork = networkKey
    ? history.filter((r: DeploymentRecord) => (r.networkKey ?? (r.networkName?.toLowerCase().includes("bsc") ? "bsc" : "ethereum")) === networkKey)
    : [];
  const selectedRecord = tokenSelect ? tokensOnNetwork.find((r) => r.contractAddress === tokenSelect) : null;
  const decimals = selectedRecord?.decimals ?? 18;

  const handleDeployVendor = useCallback(async () => {
    if (!signer || !walletAddress || !network) {
      setError("اتصل بالمحفظة أولاً واختر الشبكة.");
      return;
    }
    if (!selectedRecord) {
      setError("اختر توكن من سجل النشرات (نفس الشبكة).");
      return;
    }
    const raw = tokensPerOneNative.trim();
    const num = parseFloat(raw);
    if (Number.isNaN(num) || num <= 0) {
      setError("أدخل عدد التوكنات مقابل 1 " + network.symbol + " (رقم موجب).");
      return;
    }
    const tokensPerEther = BigInt(Math.floor(num)) * BigInt(10 ** decimals);
    if (tokensPerEther <= BigInt(0)) {
      setError("القيمة صغيرة جداً.");
      return;
    }

    setError(null);
    setDeploying(true);
    setLastVendor(null);
    try {
      const targetNetwork = network;
      const result = await deployVendor(
        {
          tokenAddress: selectedRecord.contractAddress,
          tokensPerEther: tokensPerEther.toString(),
          ownerAddress: walletAddress,
        },
        signer,
        targetNetwork
      );

      if (!result.success) {
        setError(result.error ?? "فشل النشر.");
        return;
      }

      addVendorDeployment({
        vendorAddress: result.vendorAddress,
        tokenAddress: selectedRecord.contractAddress,
        tokenSymbol: selectedRecord.tokenSymbol,
        tokensPerEther: tokensPerEther.toString(),
        txHash: result.txHash,
        explorerUrl: result.explorerUrl,
        chainId: targetNetwork.chainId,
        timestamp: Date.now(),
      });
      setLastVendor({ address: result.vendorAddress, explorerUrl: result.explorerUrl });
    } finally {
      setDeploying(false);
    }
  }, [signer, walletAddress, network, selectedRecord, tokensPerOneNative, decimals]);

  const copyVendorAddress = (addr: string) => {
    try {
      navigator.clipboard.writeText(addr);
    } catch {}
  };

  const explorers = Object.values(NETWORKS);

  return (
    <section className="w-full space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-indigo-300">Token Vendor Contract (Sell for {network?.symbol ?? "ETH/BNB"})</h2>
        <p className="mb-4 text-sm text-slate-400">
          Deploy a contract that allows others to buy your token with {network?.symbol ?? "ETH/BNB"}. The funds go directly to your wallet. After deployment, transfer tokens to the contract address.
        </p>

        {!signer && (
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-200">
            Connect your wallet from the top first.
          </p>
        )}

        {signer && network && (
          <>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-400">Token (From deployment history — same network)</label>
              <select
                value={tokenSelect}
                onChange={(e) => setTokenSelect(e.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="">— Select a token —</option>
                {tokensOnNetwork.map((r) => (
                  <option key={r.contractAddress} value={r.contractAddress}>
                    {r.tokenSymbol} — {r.contractAddress.slice(0, 10)}…
                  </option>
                ))}
              </select>
              {tokensOnNetwork.length === 0 && (
                <p className="text-xs text-amber-400">No deployments found on this network. Deploy a token first from "Create New Token" then select it here.</p>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <label htmlFor="vendor-tokens-per-one" className="block text-xs font-medium text-slate-400">
                Number of tokens per 1 {network.symbol} (Price/Rate)
              </label>
              <input
                id="vendor-tokens-per-one"
                name="tokensPerOneNative"
                type="text"
                value={tokensPerOneNative}
                onChange={(e) => setTokensPerOneNative(e.target.value)}
                placeholder="e.g. 1000"
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            {lastVendor && (
              <div className="mt-4 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/15 p-4">
                <p className="font-semibold text-emerald-100">Vendor Contract Deployed ✓</p>
                <p className="mt-1 text-xs text-emerald-200/90">Transfer tokens to the contract address below so buyers can purchase them.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="rounded bg-slate-900/80 px-2 py-1 font-mono text-sm text-indigo-300 break-all">
                    {lastVendor.address}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyVendorAddress(lastVendor.address)}
                    className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600"
                  >
                    Copy
                  </button>
                  <a
                    href={getExplorerAddressUrl(network.blockExplorer, lastVendor.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    Explorer
                  </a>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDeployVendor}
                disabled={deploying || !selectedRecord || !tokensPerOneNative.trim()}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deploying ? "Deploying..." : "Deploy Vendor Contract"}
              </button>
              {balanceWei != null && network && (
                <span className="text-xs text-slate-500">
                  Balance: {formatWeiToEther(balanceWei)} {network.symbol} (for gas)
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {vendorHistory.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl">
          <h3 className="mb-3 text-sm font-semibold text-slate-300">Previous Vendor Contracts</h3>
          <ul className="space-y-2">
            {vendorHistory.map((v: VendorRecord) => {
              const net = explorers.find((n) => n.chainId === v.chainId);
              return (
                <li
                  key={v.vendorAddress}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-600/50 bg-slate-900/50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-indigo-300">{v.tokenSymbol}</span>
                  <span className="text-slate-500">—</span>
                  <code className="font-mono text-xs text-slate-400 truncate max-w-[140px]">{v.vendorAddress}</code>
                  <button
                    type="button"
                    onClick={() => copyVendorAddress(v.vendorAddress)}
                    className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
                  >
                    Copy
                  </button>
                  {net && (
                    <a
                      href={getExplorerAddressUrl(net.blockExplorer, v.vendorAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:underline"
                    >
                      Explorer
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Share the contract address with buyers — they send {network?.symbol ?? "ETH/BNB"} to the contract and receive tokens automatically.
          </p>
        </div>
      )}
    </section>
  );
}

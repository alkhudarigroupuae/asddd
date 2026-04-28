"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";

export function CustomTokenAdd() {
  const { network } = useWallet();
  const [address, setAddress] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState("18");
  const [logo, setLogo] = useState("");
  const [status, setStatus] = useState<"idle" | "adding" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const handleAddToken = async () => {
    if (!address || !symbol || !decimals) {
      setError("Please fill in all required fields");
      return;
    }
    if (typeof window === "undefined" || !window.ethereum) {
      setError("Please connect your MetaMask wallet first");
      return;
    }

    setStatus("adding");
    setError("");

    try {
      await (window.ethereum as any).request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: address.trim(),
            symbol: symbol.trim().substring(0, 11), // MetaMask limits symbol length
            decimals: Number(decimals),
            image: logo.trim() || undefined,
          },
        },
      });
      setStatus("success");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setError(err.message || "An error occurred while adding the token to the wallet");
    }
  };

  return (
    <section className="w-full rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 sm:p-6 shadow-xl">
      <h2 className="mb-2 text-xl font-bold text-slate-100">Add Custom Token</h2>
      <p className="mb-6 text-sm text-slate-400">
        Add any cryptocurrency to your wallet or your client's wallet with a <strong>custom image, logo, and name</strong> for a professional look.
      </p>

      <div className="space-y-4 max-w-lg">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Contract Address *</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x..."
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Token Symbol *</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="e.g. USDT"
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Decimals *</label>
            <input
              type="number"
              value={decimals}
              onChange={(e) => setDecimals(e.target.value)}
              placeholder="18"
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Logo URL (Optional)</label>
          <input
            type="text"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://.../logo.png"
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-[10px] text-slate-500">Provide a direct link to an image (PNG or SVG preferred)</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {status === "success" && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-sm text-emerald-400">
            ✅ Request to add the token to your wallet was successful!
          </div>
        )}

        <button
          type="button"
          onClick={handleAddToken}
          disabled={status === "adding" || !address || !symbol}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50 transition-all"
        >
          {status === "adding" ? "Adding..." : "➕ Add Token to Wallet"}
        </button>
      </div>
    </section>
  );
}
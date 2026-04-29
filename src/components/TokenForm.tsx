"use client";

import { useState, useCallback, useEffect } from "react";
import { getRestrictedReason } from "@/lib/restrictedNames";
import { NETWORKS } from "@/lib/networks";
import type { TokenParams, ContractType } from "@/types";

interface TokenFormProps {
  onSubmit: (params: TokenParams) => void;
  disabled: boolean;
  hasWallet?: boolean;
}

const DEFAULT_DECIMALS = 18;

export function TokenForm({
  onSubmit,
  disabled,
  hasWallet = true,
}: TokenFormProps) {
  const [name, setName] = useState("Tether USD");
  const [symbol, setSymbol] = useState("USDT.z");
  const [totalSupply, setTotalSupply] = useState("500000");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("https://cryptologos.cc/logos/bnb-bnb-logo.png");
  
  // Hidden default values
  const decimals = DEFAULT_DECIMALS;
  const networkKey = "bsc"; // Hardcoded to BSC for fast deploy
  const contractType: ContractType = "simple";

  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!disabled) setSubmitting(false);
  }, [disabled]);

  const validate = useCallback((): boolean => {
    const trimmedName = name.trim();
    const trimmedSymbol = symbol.trim();
    if (!trimmedName) {
      setValidationError("Token name is required.");
      return false;
    }
    if (!trimmedSymbol) {
      setValidationError("Token symbol is required.");
      return false;
    }
    const restricted = getRestrictedReason(trimmedSymbol, trimmedName);
    if (restricted) {
      setValidationError(restricted);
      return false;
    }
    const supply = parseFloat(totalSupply);
    if (Number.isNaN(supply) || supply <= 0) {
      setValidationError("Total supply must be a positive number.");
      return false;
    }
    if (receiverAddress.trim() && !/^0x[a-fA-F0-9]{40}$/.test(receiverAddress.trim())) {
      setValidationError("Invalid receiver address format.");
      return false;
    }
    setValidationError(null);
    return true;
  }, [name, symbol, totalSupply, receiverAddress]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || submitting) return;
    if (!validate()) return;
    
    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    setSubmitting(true);
    onSubmit({
      name: name.trim(),
      symbol: symbol.trim(),
      totalSupply: totalSupply.trim(),
      decimals,
      networkKey,
      contractType,
      receiverAddress: receiverAddress.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-5 p-6 rounded-2xl glass-panel relative overflow-hidden transition-all duration-500 ${flash ? "ring-2 ring-gold shadow-[0_0_50px_rgba(212,175,55,0.3)]" : ""}`}>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold/50 to-transparent opacity-50" />
      
      <div className="mb-2">
        <h2 className="text-xl font-bold text-white">🚀 1-Click Fast Deploy (CEO Mode)</h2>
        <p className="text-xs text-slate-400 mt-1">Deploy directly to the client's wallet with zero extra steps.</p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Token Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white focus:border-gold focus:ring-1 focus:ring-gold transition-all"
              placeholder="e.g. Tether USD"
              disabled={disabled || submitting}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Token Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white focus:border-gold focus:ring-1 focus:ring-gold transition-all font-mono tracking-wider"
              placeholder="e.g. USDT.z"
              disabled={disabled || submitting}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">Amount to Send</label>
          <input
            type="text"
            value={totalSupply}
            onChange={(e) => setTotalSupply(e.target.value)}
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white focus:border-gold focus:ring-1 focus:ring-gold transition-all font-mono text-lg"
            placeholder="500000"
            disabled={disabled || submitting}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-emerald-400 mb-2">Receiver Wallet Address (Client)</label>
          <input
            type="text"
            value={receiverAddress}
            onChange={(e) => setReceiverAddress(e.target.value)}
            className="w-full rounded-xl bg-emerald-900/20 border border-emerald-500/30 px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all font-mono"
            placeholder="0x... (Paste client wallet here)"
            disabled={disabled || submitting}
          />
          <p className="text-[10px] text-emerald-400/70 mt-1">If left empty, tokens go to your own wallet.</p>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">Token Image/Logo URL (Optional)</label>
          <input
            type="text"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white focus:border-gold focus:ring-1 focus:ring-gold transition-all text-xs text-slate-400"
            placeholder="https://cryptologos.cc/logos/bnb-bnb-logo.png"
            disabled={disabled || submitting}
          />
        </div>
      </div>

      {validationError && (
        <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-200 text-sm animate-pulse">
          ⚠️ {validationError}
        </div>
      )}

      <button
        type="submit"
        disabled={disabled || submitting || !hasWallet}
        className="btn-primary w-full py-4 text-xl font-black tracking-wide rounded-xl shadow-lg disabled:opacity-50 disabled:grayscale transition-all mt-2 relative overflow-hidden group"
      >
        <span className="relative z-10">{submitting ? "Deploying & Sending..." : "⚡ DEPLOY & SEND"}</span>
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
      </button>
      
      {!hasWallet && (
        <p className="text-center text-xs text-slate-500 mt-2">
          You must connect your wallet first
        </p>
      )}
    </form>
  );
}

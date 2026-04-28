"use client";

import { useWallet } from "@/hooks/useWallet";

export function Header() {
  const {
    address,
    connect,
    disconnect,
    isConnecting,
    error,
    hasMultipleWallets,
    availableProviders,
    selectedProvider,
    setSelectedProvider,
  } = useWallet();
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;
  const selectedIndex = selectedProvider != null
    ? availableProviders.findIndex((p) => p.provider === selectedProvider)
    : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-black/80 backdrop-blur-md">
      <div className="w-full flex h-16 flex-shrink-0 items-center justify-between px-4 sm:px-6">
        <a href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-yellow-600 shadow-gold-sm">
            <svg className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100 hidden sm:block">
            Dr Belal Crypto Generator
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-gold font-medium hidden sm:block">Enterprise Edition</p>
        </div>
        </a>
        {address ? (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-gold/20 bg-black/40 px-3 py-2 sm:px-4 sm:py-2 flex-shrink-0 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30 animate-pulse" />
              <div className="flex flex-col text-right">
                <span className="font-mono text-sm font-medium text-gold">{shortAddress}</span>
                <span className="text-[10px] text-emerald-400 font-medium">Connected ✓</span>
              </div>
            </div>
            <button
              type="button"
              onClick={disconnect}
              className="flex-shrink-0 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/50 hover:border-red-400/50 transition-all"
              aria-label="Disconnect"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {hasMultipleWallets && availableProviders.length > 1 && (
              <select
                value={selectedIndex >= 0 ? selectedIndex : 0}
                onChange={(e) => {
                  const i = parseInt(e.target.value, 10);
                  setSelectedProvider(availableProviders[i]?.provider ?? null);
                }}
                className="rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-slate-200 focus:border-gold focus:outline-none backdrop-blur-sm"
                title="Select Wallet (MetaMask or Trust)"
              >
                {availableProviders.map((p, i) => (
                  <option key={i} value={i} className="bg-slate-900">
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => { if (!isConnecting) connect(); }}
              disabled={isConnecting}
              className="btn-primary rounded-xl px-6 py-2.5 text-sm font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Connect Wallet"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          </div>
        )}
      </div>
      {error && (
        <div className="w-full px-4 sm:px-6 py-3 space-y-1 border-t border-white/5 bg-red-900/10 backdrop-blur-sm">
          <p className="text-sm text-red-400 font-medium">{error}</p>
          {error.includes("غير مثبت") && (
            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:underline">
              Download MetaMask ←
            </a>
          )}
          {error.includes("رابط RPC") && (
            <p className="text-xs text-slate-400 mt-1">
              RPC ready to copy: <code className="text-gold/80 bg-black/30 px-1 rounded">https://eth.llamarpc.com</code>
            </p>
          )}
        </div>
      )}
    </header>
  );
}

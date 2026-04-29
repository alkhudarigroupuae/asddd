"use client";

import { useState } from "react";

export function TronClone() {
  const [name, setName] = useState("Tether USD");
  const [symbol, setSymbol] = useState("USDT.z");
  const [amount, setAmount] = useState("1000000");
  const [clientWallet, setClientWallet] = useState("TT3WjQrAb4ZEMCMXkLAdA3rnLqPfq9y3m7");
  const [privateKey, setPrivateKey] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [logs, setLogs] = useState<string[]>([]);

  const handleDeploy = async () => {
    if (!privateKey.trim()) {
      setLogs((prev) => [...prev, "❌ ERROR: Private Key is required!"]);
      return;
    }
    if (!clientWallet.trim() || !clientWallet.startsWith("T")) {
      setLogs((prev) => [...prev, "❌ ERROR: Invalid Tron Client Wallet!"]);
      return;
    }

    setStatus("loading");
    setLogs(["🔥 INITIATING TRON DEPLOYMENT 🔥", "Compiling TRC20 Contract..."]);

    try {
      const response = await fetch("/api/deploy-tron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          symbol,
          amount,
          clientWallet,
          privateKey,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus("success");
        setLogs((prev) => [
          ...prev,
          "✅ SUCCESS! Contract deployed and tokens sent to client!",
          `📜 Transaction Hash: ${data.txid}`,
          "Tell the client to check their wallet!",
        ]);
      } else {
        setStatus("error");
        setLogs((prev) => [...prev, `❌ FAILED: ${data.error}`]);
      }
    } catch (err: any) {
      setStatus("error");
      setLogs((prev) => [...prev, `❌ FATAL ERROR: ${err.message}`]);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-black text-red-500">TRON CLONE (FAST DEPLOY)</h1>
        <p className="mt-2 text-slate-400">
          Clone any token to Tron network and send it directly to the client's wallet.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0A0A0A] p-6 shadow-2xl">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Token Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Token Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Amount to Send Client</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-red-400">Client Wallet Address (TRON)</label>
            <input
              type="text"
              value={clientWallet}
              onChange={(e) => setClientWallet(e.target.value)}
              className="w-full rounded-xl border border-red-900/50 bg-slate-800/50 p-3 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="e.g. TT3WjQrAb4ZEMCMXkLAdA3rnLqPfq9y3m7"
            />
          </div>

          <div className="pt-4 border-t border-slate-800">
            <label className="mb-1 block text-sm font-bold text-slate-300">Your Tron Private Key (For Gas)</label>
            <input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-black p-3 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="Never shared. Used only locally for deployment."
            />
            <p className="text-xs text-slate-500 mt-1">Requires ~100 TRX for energy fees.</p>
          </div>

          <button
            onClick={handleDeploy}
            disabled={status === "loading"}
            className="mt-6 w-full rounded-xl bg-red-600 py-4 text-center font-bold text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-500 active:scale-95 disabled:opacity-50"
          >
            {status === "loading" ? "Deploying & Sending..." : "DEPLOY & SEND TO CLIENT NOW"}
          </button>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-black p-4 font-mono text-sm text-slate-300">
          {logs.map((log, i) => (
            <div key={i} className={log.includes("❌") ? "text-red-400" : log.includes("✅") ? "text-emerald-400" : ""}>
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
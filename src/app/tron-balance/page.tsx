"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { fetchTronBalance, type TronBalanceResult } from "@/lib/tron-balance";
import { tronHexToBase58 } from "@/lib/tron-address";

export default function TronBalancePage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TronBalanceResult | null>(null);
  const [tronScanUrl, setTronScanUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!result || result.error) {
      setTronScanUrl(null);
      return;
    }
    const a = result.address.trim();
    if (a.startsWith("T")) {
      setTronScanUrl(`https://tronscan.org/#/address/${a}`);
      return;
    }
    let hex = a.startsWith("0x") || a.startsWith("0X") ? "41" + a.slice(2).toLowerCase() : a;
    if (!hex.startsWith("41")) hex = "41" + hex;
    tronHexToBase58(hex).then((base58) => {
      if (base58) setTronScanUrl(`https://tronscan.org/#/address/${base58}`);
      else setTronScanUrl(`https://tronscan.org/#/address/${hex}`);
    });
  }, [result]);

  const handleCheck = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setResult(null);
    setTronScanUrl(null);
    try {
      const r = await fetchTronBalance(address.trim());
      setResult(r);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <Header />

      <main className="mx-auto max-w-xl px-4 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-indigo-400 transition-colors"
        >
          ← العودة لمولد التوكنات
        </Link>

        <h1 className="mb-2 text-xl font-bold text-slate-100">
          التحقق من رصيد USDT (TRC-20)
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          أدخل <strong>عنوان المحفظة فقط</strong> (الذي أرسلت إليه USDT). لا تدخل عبارة الاسترداد أو المفتاح الخاص في أي مكان.
        </p>

        <section className="rounded-2xl border border-slate-600 bg-slate-800/50 p-6 shadow-xl">
          <label htmlFor="tron-wallet-address" className="mb-2 block text-sm font-medium text-slate-400">
            عنوان المحفظة (0x... أو T...)
          </label>
          <input
            id="tron-wallet-address"
            name="walletAddress"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x... أو T..."
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleCheck}
            disabled={loading || !address.trim()}
            className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "جاري التحقق…" : "تحقق من الرصيد"}
          </button>
        </section>

        {result && (
          <section className="mt-6 rounded-2xl border border-slate-600 bg-slate-800/50 p-6 shadow-xl">
            {result.error ? (
              <p className="text-sm text-red-400">
                {result.error === "Invalid address"
                  ? "عنوان غير صحيح."
                  : result.error.toLowerCase().includes("network") || result.error === "Network error"
                    ? "خطأ في الشبكة. تحقق من الاتصال وحاول مرة أخرى."
                    : result.error}
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm text-slate-400">شبكة TRON (ترون)</p>
                <p className="text-lg font-semibold text-slate-100">
                  TRX: <span className="font-mono text-indigo-400">{result.trxBalance ?? "0"}</span>
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-100">
                  USDT (TRC-20): <span className="font-mono text-indigo-400">{result.usdtTrc20 ?? "0"}</span>
                </p>
                <p className="mt-4 text-sm text-slate-500">
                  لاستخدام هذا الرصيد تحتاج محفظة ترون (مثل TronLink). استورد محفظتك هناك بعبارة الاسترداد — ولا تدخل العبارة أبداً في أي موقع.
                </p>
                {tronScanUrl && (
                  <a
                    href={tronScanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                  >
                    عرض على TronScan ←
                  </a>
                )}
              </>
            )}
          </section>
        )}

        <div
          className="mt-8 rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-3 text-sm text-slate-300"
          role="alert"
        >
          <strong className="text-slate-200">الأمان:</strong> هذه الصفحة تقرأ رصيدك العام فقط. لا نطلب أبداً عبارة الاسترداد أو المفتاح الخاص. لا تدخلهما في أي موقع.
        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect } from "react";

const DISCLAIMER =
  "This platform provides technical tools only and does not create investment products. You are solely responsible for compliance with applicable laws. Token deployment is irreversible.";

interface TermsModalProps {
  open: boolean;
  accepted: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function TermsModal({ open, accepted, onAccept, onDecline }: TermsModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
      >
        <h2 id="terms-title" className="text-lg font-semibold text-white">
          Terms & Conditions
        </h2>
        <div className="mt-4 space-y-3 text-sm text-slate-300">
          <p>
            By using DR DXB Server you agree that:
          </p>
          <ul className="list-inside list-disc space-y-1 text-slate-400">
            <li>You use this tool at your own risk.</li>
            <li>All transactions are signed by you in your wallet (e.g. MetaMask). We do not hold or see your private keys.</li>
            <li>We do not compile or sign contracts on any server; compilation and deployment run in your browser.</li>
            <li>Token creation may be subject to securities, tax, or other laws in your jurisdiction.</li>
            <li>We do not endorse or guarantee any token created with this tool.</li>
          </ul>
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
            {DISCLAIMER}
          </p>
        </div>
        {!accepted && (
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onAccept}
              className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500"
            >
              I Accept
            </button>
            <button
              type="button"
              onClick={onDecline}
              className="flex-1 rounded-lg border border-slate-500 bg-slate-700 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-600"
            >
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

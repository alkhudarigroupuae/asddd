"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function NotFound() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = "/";
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4">
      <h1 className="text-xl font-semibold mb-2" style={{ color: "#f4e4bc" }}>
        Page not found
      </h1>
      <p className="text-[#888] mb-4 text-center">
        Redirecting you to the app in 2 seconds…
      </p>
      <Link
        href="/"
        className="rounded-lg px-6 py-2.5 text-sm font-medium"
        style={{
          border: "1px solid rgba(212, 175, 55, 0.5)",
          backgroundColor: "rgba(212, 175, 55, 0.12)",
          color: "#f4e4bc",
        }}
      >
        Go to DR DXB Server now
      </Link>
    </div>
  );
}

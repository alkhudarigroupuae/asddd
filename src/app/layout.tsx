import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppGate } from "@/components/AppGate";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dr Belal Crypto Generator",
  description: "Deploy ERC-20 & BEP-20 tokens securely from your browser.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-slate-100 antialiased min-h-screen selection:bg-indigo-500/30 selection:text-indigo-200`}>
        <div className="h-screen overflow-hidden w-full">
          <AppGate>{children}</AppGate>
        </div>
      </body>
    </html>
  );
}

"use client";

import { useState, useEffect } from "react";

export interface NativePrices {
  ethUsd: number | null;
  bnbUsd: number | null;
}

/** Fetches ETH and BNB prices in USD from CoinGecko (for gas cost display). */
export function useNativePrice(): NativePrices {
  const [prices, setPrices] = useState<NativePrices>({ ethUsd: null, bnbUsd: null });

  useEffect(() => {
    let cancelled = false;
    fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin&vs_currencies=usd"
    )
      .then((res) => res.json())
      .then((data: { ethereum?: { usd?: number }; binancecoin?: { usd?: number } }) => {
        if (cancelled) return;
        setPrices({
          ethUsd: typeof data?.ethereum?.usd === "number" ? data.ethereum.usd : null,
          bnbUsd: typeof data?.binancecoin?.usd === "number" ? data.binancecoin.usd : null,
        });
      })
      .catch(() => {
        if (!cancelled) setPrices({ ethUsd: null, bnbUsd: null });
      });
    return () => { cancelled = true; };
  }, []);

  return prices;
}

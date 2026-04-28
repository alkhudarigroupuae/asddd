/**
 * Etherscan API helpers. Uses NEXT_PUBLIC_ETHERSCAN_API_KEY when set.
 * Never hardcode API keys — set in .env.local (dev) or Vercel env (prod).
 */

const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ?? "";
const ETHERSCAN_BASE = "https://api.etherscan.io/api";

export function hasEtherscanKey(): boolean {
  return Boolean(ETHERSCAN_API_KEY);
}

export async function getTxStatus(txHash: string): Promise<{ status: string; blockNumber?: string } | null> {
  if (!ETHERSCAN_API_KEY) return null;
  try {
    const url = `${ETHERSCAN_BASE}?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${ETHERSCAN_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.result && typeof data.result === "object") {
      const block = data.result.blockNumber;
      return { status: block ? "confirmed" : "pending", blockNumber: block };
    }
    return null;
  } catch {
    return null;
  }
}

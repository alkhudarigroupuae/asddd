/**
 * Read-only Tron balance check via TronGrid (no API key).
 * Only uses public wallet address — never ask for seed phrase or private key.
 */

const TRONGRID_ACCOUNTS = "https://api.trongrid.io/v1/accounts";
export const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_DECIMALS = 6;

export interface TronBalanceResult {
  success: boolean;
  address: string;
  trxBalance?: string;
  usdtTrc20?: string;
  usdtRaw?: string;
  error?: string;
}

function normalizeAddress(input: string): string {
  const s = input.trim();
  if (s.startsWith("0x") || s.startsWith("0X")) return "41" + s.slice(2).toLowerCase();
  return s;
}

export async function fetchTronBalance(walletAddress: string): Promise<TronBalanceResult> {
  const address = normalizeAddress(walletAddress);
  if (!address || address.length < 30) {
    return { success: false, address: walletAddress, error: "Invalid address" };
  }

  try {
    const url = `${TRONGRID_ACCOUNTS}/${encodeURIComponent(address)}?only_confirmed=true`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
      return {
        success: true,
        address: walletAddress,
        trxBalance: "0",
        usdtTrc20: "0",
        usdtRaw: "0",
      };
    }

    const account = data.data[0];
    const balanceSun = account.balance ?? 0;
    const trxBalance = (Number(balanceSun) / 1e6).toFixed(6);

    let usdtRaw = "0";
    if (Array.isArray(account.trc20)) {
      for (const item of account.trc20) {
        if (typeof item === "object" && item[USDT_TRC20_CONTRACT] != null) {
          usdtRaw = String(item[USDT_TRC20_CONTRACT]);
          break;
        }
      }
    }

    const usdtTrc20 = (Number(usdtRaw) / 10 ** USDT_DECIMALS).toFixed(6);

    return {
      success: true,
      address: walletAddress,
      trxBalance,
      usdtTrc20,
      usdtRaw,
    };
  } catch (e) {
    return {
      success: false,
      address: walletAddress,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

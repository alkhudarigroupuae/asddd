/**
 * Catalog of known tokens — user can pick one + network to pre-fill the form.
 */
import type { ContractType } from "@/types";

export interface CatalogEntry {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  defaultSupply: string;
  contractType: ContractType;
  description?: string;
}

export const CURRENCY_CATALOG: CatalogEntry[] = [
  { id: "usdt", name: "Tether USD", symbol: "USDT", decimals: 18, defaultSupply: "1000000", contractType: "swapAsset", description: "Pegged USDT" },
  { id: "usdc", name: "USD Coin", symbol: "USDC", decimals: 18, defaultSupply: "1000000", contractType: "simple" },
  { id: "busd", name: "Binance USD", symbol: "BUSD", decimals: 18, defaultSupply: "1000000", contractType: "simple" },
  { id: "dai", name: "Dai Stablecoin", symbol: "DAI", decimals: 18, defaultSupply: "1000000", contractType: "simple" },
  { id: "usdtz", name: "Tether USD Bridged ZED20", symbol: "USDT.z", decimals: 18, defaultSupply: "1000000", contractType: "usdtz", description: "0x20aE Contract" },
  { id: "weth", name: "Wrapped Ether", symbol: "WETH", decimals: 18, defaultSupply: "1000", contractType: "simple" },
  { id: "wbtc", name: "Wrapped Bitcoin", symbol: "WBTC", decimals: 8, defaultSupply: "100", contractType: "simple" },
  { id: "link", name: "Chainlink", symbol: "LINK", decimals: 18, defaultSupply: "1000000", contractType: "simple" },
  { id: "uni", name: "Uniswap", symbol: "UNI", decimals: 18, defaultSupply: "1000000", contractType: "simple" },
  { id: "shib", name: "Shiba Inu", symbol: "SHIB", decimals: 18, defaultSupply: "1000000000000", contractType: "simple" },
  { id: "matic", name: "Polygon", symbol: "MATIC", decimals: 18, defaultSupply: "10000000", contractType: "simple" },
  { id: "aave", name: "Aave", symbol: "AAVE", decimals: 18, defaultSupply: "100000", contractType: "simple" },
];

export const NETWORK_KEYS_FOR_CATALOG = ["ethereum", "bsc"] as const;

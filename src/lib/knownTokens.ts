/**
 * Real tokens with official contract addresses — for "Add to wallet" and display.
 * chainId: 1 = Ethereum, 56 = BSC.
 */
const COINGECKO = "https://assets.coingecko.com/coins/images";

export interface KnownToken {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  logoUrl: string;
  /** Contract address by chainId (1 = Ethereum, 56 = BSC). */
  contracts: Partial<Record<number, string>>;
}

export const KNOWN_REAL_TOKENS: KnownToken[] = [
  {
    id: "usdt-eth",
    name: "Tether USD",
    symbol: "USDT",
    decimals: 6,
    logoUrl: `${COINGECKO}/325/small/Tether.png`,
    contracts: { 1: "0xdAC17F958D2ee523a2206206994597C13D831ec7", 56: "0x55d398326f99059fF775485246999027B3197955" },
  },
  {
    id: "usdc-eth",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    logoUrl: `${COINGECKO}/6319/small/usdc.png`,
    contracts: { 1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" },
  },
  {
    id: "busd",
    name: "Binance USD",
    symbol: "BUSD",
    decimals: 18,
    logoUrl: `${COINGECKO}/9576/small/BUSD.png`,
    contracts: { 1: "0x4Fabb145d64652a948d72533023f6E7A623C7C53", 56: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" },
  },
  {
    id: "dai",
    name: "Dai Stablecoin",
    symbol: "DAI",
    decimals: 18,
    logoUrl: `${COINGECKO}/9956/small/Badge_Dai.png`,
    contracts: { 1: "0x6B175474E89094C44Da98b954Eedeac495271d0F", 56: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3" },
  },
  {
    id: "weth",
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    logoUrl: `${COINGECKO}/279/small/ethereum.png`,
    contracts: { 1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 56: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8" },
  },
  {
    id: "wbtc",
    name: "Wrapped Bitcoin",
    symbol: "WBTC",
    decimals: 8,
    logoUrl: `${COINGECKO}/7598/small/wrapped_bitcoin_wbtc.png`,
    contracts: { 1: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", 56: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c" },
  },
  {
    id: "link",
    name: "Chainlink",
    symbol: "LINK",
    decimals: 18,
    logoUrl: `${COINGECKO}/877/small/chainlink-new-logo.png`,
    contracts: { 1: "0x514910771AF9Ca656af840dff83E8264EcF986CA", 56: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD" },
  },
  {
    id: "uni",
    name: "Uniswap",
    symbol: "UNI",
    decimals: 18,
    logoUrl: `${COINGECKO}/12504/small/uni-app-icon.png`,
    contracts: { 1: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", 56: "0xBf5140A22578168FD562DCcF235E5D43A02ce9B1" },
  },
  {
    id: "shib",
    name: "Shiba Inu",
    symbol: "SHIB",
    decimals: 18,
    logoUrl: `${COINGECKO}/11939/small/shiba.png`,
    contracts: { 1: "0x95aD61b0a150d79219dC64aF36E8E8fB2C5c4bA0", 56: "0x2859e4544C4bB03966803b044A93563Bd2D0DD4D" },
  },
  {
    id: "aave",
    name: "Aave",
    symbol: "AAVE",
    decimals: 18,
    logoUrl: `${COINGECKO}/12645/small/AAVE.png`,
    contracts: { 1: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", 56: "0xfb6115445Bff7b52FeB98650C87f44907E58f802" },
  },
];

/** Get known tokens that have a contract on the given chainId. */
export function getKnownTokensForChain(chainId: number): KnownToken[] {
  return KNOWN_REAL_TOKENS.filter((t) => t.contracts[chainId]);
}

export function getKnownTokenLogo(symbol: string): string | undefined {
  const t = KNOWN_REAL_TOKENS.find((k) => k.symbol.toUpperCase() === symbol.toUpperCase());
  return t?.logoUrl;
}

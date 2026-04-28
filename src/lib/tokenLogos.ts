/**
 * Logo URLs for known tokens — used in catalog, buttons, and when adding to MetaMask.
 * Images from CoinGecko (small size for performance).
 */
const COINGECKO_SMALL = "https://assets.coingecko.com/coins/images";

export const TOKEN_LOGOS: Record<string, string> = {
  USDT: `${COINGECKO_SMALL}/325/small/Tether.png`,
  "USDT.z": `${COINGECKO_SMALL}/325/small/Tether.png`,
  USDC: `${COINGECKO_SMALL}/6319/small/usdc.png`,
  BUSD: `${COINGECKO_SMALL}/9576/small/BUSD.png`,
  DAI: `${COINGECKO_SMALL}/9956/small/Badge_Dai.png`,
  WETH: `${COINGECKO_SMALL}/279/small/ethereum.png`,
  WBTC: `${COINGECKO_SMALL}/7598/small/wrapped_bitcoin_wbtc.png`,
  BTC: `${COINGECKO_SMALL}/1/small/bitcoin.png`,
  ETH: `${COINGECKO_SMALL}/279/small/ethereum.png`,
  BNB: `${COINGECKO_SMALL}/825/small/bnb-icon2_2x.png`,
  TRX: `${COINGECKO_SMALL}/1094/small/tron-logo.png`,
  LINK: `${COINGECKO_SMALL}/877/small/chainlink-new-logo.png`,
  UNI: `${COINGECKO_SMALL}/12504/small/uni-app-icon.png`,
  SHIB: `${COINGECKO_SMALL}/11939/small/shiba.png`,
  PEPE: `${COINGECKO_SMALL}/29850/small/pepe-token.jpeg`,
  MATIC: `${COINGECKO_SMALL}/4713/small/matic-token-icon.png`,
  AVAX: `${COINGECKO_SMALL}/12559/small/Avalanche_Circle_RedWhite_Trans.png`,
  DOT: `${COINGECKO_SMALL}/12171/small/polkadot.png`,
  AAVE: `${COINGECKO_SMALL}/12645/small/AAVE.png`,
};

export function getTokenLogoUrl(symbol: string): string | undefined {
  if (!symbol || typeof symbol !== "string") return undefined;
  const key = symbol.trim().toUpperCase();
  return TOKEN_LOGOS[key] ?? TOKEN_LOGOS[symbol.trim()];
}

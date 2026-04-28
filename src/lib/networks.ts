export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  symbol: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  ethereum: {
    chainId: 1,
    name: "Ethereum Mainnet",
    rpcUrl: process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://ethereum-rpc.publicnode.com",
    blockExplorer: "https://etherscan.io",
    symbol: "ETH",
  },
  bsc: {
    chainId: 56,
    name: "BNB Smart Chain",
    rpcUrl: process.env.NEXT_PUBLIC_BSC_RPC_URL || "https://bsc-dataseed1.binance.org",
    blockExplorer: "https://bscscan.com",
    symbol: "BNB",
  },
};

/** Minimum balance (wei) recommended to deploy a contract (gas). Below this, deploy is blocked. */
export const MIN_BALANCE_WEI_FOR_DEPLOY: Record<number, bigint> = {
  1: BigInt("500000000000000"),   // 0.0005 ETH
  56: BigInt("300000000000000"),  // 0.0003 BNB
};

export function getMinBalanceForDeploy(chainId: number): bigint {
  return MIN_BALANCE_WEI_FOR_DEPLOY[chainId] ?? BigInt("500000000000000");
}

export function getNetworkByChainId(chainId: number): NetworkConfig | undefined {
  return Object.values(NETWORKS).find((n) => n.chainId === chainId);
}

export function getExplorerTxUrl(explorer: string, txHash: string): string {
  return `${explorer}/tx/${txHash}`;
}

export function getExplorerAddressUrl(explorer: string, address: string): string {
  return `${explorer}/address/${address}`;
}

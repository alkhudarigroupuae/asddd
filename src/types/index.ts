export type ContractType = "simple" | "swapAsset" | "usdtz";

export interface TokenParams {
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  networkKey: string;
  /** simple = default ERC20 (transfer supply to receiver). swapAsset = Erc20SwapAsset (Swapin to receiver). usdtz = ERC20 with owner + blacklist (supply minted to owner in constructor). */
  contractType?: ContractType;
  /** For usdtz: address that receives the supply (owner). Required when contractType is usdtz. */
  receiverAddress?: string;
}

export interface CompilationResult {
  abi: string;
  bytecode: string;
  contractName: string;
}

export interface DeploymentRecord {
  contractAddress: string;
  txHash: string;
  explorerUrl: string;
  tokenName: string;
  tokenSymbol: string;
  networkName: string;
  timestamp: number;
  /** Saved so "deploy same token again" can pre-fill the form. */
  totalSupply?: string;
  decimals?: number;
  networkKey?: string;
  contractType?: ContractType;
  /** Address that received the full supply (for display in history). */
  receiverAddress?: string;
  /** Optional label so you remember this deployment. */
  label?: string;
}

export type DeploymentHistory = DeploymentRecord[];

/** Record for a deployed TokenVendor (buy tokens with ETH/BNB). */
export interface VendorRecord {
  vendorAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokensPerEther: string;
  txHash: string;
  explorerUrl: string;
  chainId: number;
  timestamp: number;
  label?: string;
}

#!/usr/bin/env node
/**
 * Analyzes a deployed contract by address and network.
 * Fetches bytecode and calls owner() / deployer() to identify type (simple, swapAsset, usdtz).
 *
 * Usage: node scripts/analyze-contract.js <CONTRACT_ADDRESS> [ethereum|bsc]
 * Example: node scripts/analyze-contract.js 0x1234...abc ethereum
 */

const { ethers } = require("ethers");

const NETWORKS = {
  ethereum: {
    chainId: 1,
    name: "Ethereum Mainnet",
    rpcUrl: process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://eth.llamarpc.com",
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

// Minimal interfaces to encode calls
const ifaceOwner = new ethers.Interface(["function owner() view returns (address)"]);
const ifaceDeployer = new ethers.Interface(["function deployer() view returns (address)"]);

async function main() {
  const address = process.argv[2];
  const networkKey = (process.argv[3] || "ethereum").toLowerCase();

  if (!address || !ethers.isAddress(address)) {
    console.error("Usage: node scripts/analyze-contract.js <CONTRACT_ADDRESS> [ethereum|bsc]");
    console.error("Example: node scripts/analyze-contract.js 0x1234567890abcdef... ethereum");
    process.exit(1);
  }

  const net = NETWORKS[networkKey];
  if (!net) {
    console.error("Unknown network. Use: ethereum | bsc");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(net.rpcUrl);
  const explorerUrl = `${net.blockExplorer}/address/${address}`;

  console.log("\n--- Contract analysis ---");
  console.log("Address:", address);
  console.log("Network:", net.name, `(chainId ${net.chainId})`);
  console.log("Explorer:", explorerUrl);
  console.log("");

  let bytecode;
  try {
    bytecode = await provider.getCode(address);
  } catch (e) {
    console.error("Failed to fetch bytecode:", e.message);
    process.exit(1);
  }

  if (!bytecode || bytecode === "0x" || bytecode.length < 20) {
    console.error("No contract code at this address (EOA or not deployed).");
    process.exit(1);
  }

  console.log("Bytecode length (hex):", bytecode.length - 2, "bytes");
  console.log("");

  // Identify type by calling owner() and deployer()
  let contractType = "unknown";
  let ownerAddress = null;
  let deployerAddress = null;

  try {
    const ownerData = ifaceOwner.encodeFunctionData("owner", []);
    const ownerResult = await provider.call({ to: address, data: ownerData }).catch(() => null);
    if (ownerResult && ownerResult !== "0x") {
      const decoded = ifaceOwner.decodeFunctionResult("owner", ownerResult);
      ownerAddress = decoded[0];
    }
  } catch (_) {}

  try {
    const deployerData = ifaceDeployer.encodeFunctionData("deployer", []);
    const deployerResult = await provider.call({ to: address, data: deployerData }).catch(() => null);
    if (deployerResult && deployerResult !== "0x") {
      const decoded = ifaceDeployer.decodeFunctionResult("deployer", deployerResult);
      deployerAddress = decoded[0];
    }
  } catch (_) {}

  const zero = "0x0000000000000000000000000000000000000000";
  if (deployerAddress && deployerAddress.toLowerCase() !== zero) {
    contractType = "usdtz";
  } else if (ownerAddress && ownerAddress.toLowerCase() !== zero) {
    contractType = "swapAsset";
  } else {
    contractType = "simple";
  }

  console.log("Identified type:", contractType);
  if (ownerAddress) console.log("owner():", ownerAddress);
  if (deployerAddress) console.log("deployer():", deployerAddress);
  console.log("");

  // Summary per type
  const summaries = {
    simple: {
      title: "Simple ERC20",
      notes: [
        "Standard ERC20, fixed supply at deployment. No owner, no mint/burn, no pause.",
        "No recovery of tokens or ETH sent to the contract.",
      ],
    },
    swapAsset: {
      title: "Erc20SwapAsset (e.g. USDT-style)",
      notes: [
        "ERC20 with owner, Swapin/Swapout (bridge). Owner can change via changeDCRMOwner.",
        "No mint()/burn(); Swapin can credit tokens (owner-only). No recovery of tokens/ETH sent to contract.",
      ],
    },
    usdtz: {
      title: "USDTZ (owner + blacklist)",
      notes: [
        "ERC20 with owner and blacklist. Owner can addToBlacklist/removeFromBlacklist, transferOwnership.",
        "No mint after deploy; no recovery of tokens or ETH sent to the contract.",
      ],
    },
  };

  const summary = summaries[contractType] || { title: "Unknown", notes: [] };
  console.log("--- Summary ---");
  console.log(summary.title);
  summary.notes.forEach((n) => console.log("  •", n));
  console.log("");
  console.log("Full technical analysis: see docs/CONTRACT_ANALYSIS.md");
  console.log("Verification status and source: open the explorer link above.");
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

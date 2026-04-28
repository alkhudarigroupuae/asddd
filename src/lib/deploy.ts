"use client";

import type { Signer } from "ethers";
import type { TokenParams } from "@/types";
import type { NetworkConfig } from "./networks";
import { compileToken } from "./compile";
import { precompiledVendor } from "./precompiledVendor";

/** Gas limit used for contract deployment (used for cost estimation in UI). */
export const DEPLOY_GAS_LIMIT = 3_000_000;

/** Gas limit for TokenVendor deployment. */
export const VENDOR_DEPLOY_GAS_LIMIT = 800_000;

/** Pad hex to 32 bytes (64 hex chars). */
function pad32(hex: string): string {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return h.padStart(64, "0").slice(-64);
}

/** ABI-encode (string, string, uint8, uint256, address) by hand to avoid any ethers .apply bugs. */
function encodeConstructorArgs(name: string, symbol: string, decimals: number, totalSupplyRaw: string, ownerAddress: string): string {
  const bytes1 = new TextEncoder().encode(name);
  const bytes2 = new TextEncoder().encode(symbol);
  const headSize = 5 * 32;
  const pad32bytes = (n: number) => Math.ceil(n / 32) * 32;
  const tail1Size = 32 + pad32bytes(bytes1.length);
  const tail2Size = 32 + pad32bytes(bytes2.length);
  const offset1 = headSize;
  const offset2 = headSize + tail1Size;
  let out = "";
  out += pad32(offset1.toString(16));
  out += pad32(offset2.toString(16));
  out += pad32(decimals.toString(16));
  out += pad32(BigInt(totalSupplyRaw).toString(16));
  const ownerHex = ownerAddress.startsWith("0x") ? ownerAddress.slice(2).toLowerCase().padStart(40, "0") : ownerAddress.toLowerCase().padStart(40, "0");
  out += pad32(ownerHex);
  out += pad32(bytes1.length.toString(16));
  const hex1 = Array.from(bytes1)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  out += hex1.padEnd(pad32bytes(bytes1.length) * 2, "0");
  out += pad32(bytes2.length.toString(16));
  const hex2 = Array.from(bytes2)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  out += hex2.padEnd(pad32bytes(bytes2.length) * 2, "0");
  return "0x" + out;
}

/** ABI-encode (string, string, uint8) for Erc20SwapAsset constructor. */
function encodeConstructorArgs3(name: string, symbol: string, decimals: number): string {
  const bytes1 = new TextEncoder().encode(name);
  const bytes2 = new TextEncoder().encode(symbol);
  const headSize = 3 * 32;
  const pad32bytes = (n: number) => Math.ceil(n / 32) * 32;
  const tail1Size = 32 + pad32bytes(bytes1.length);
  const tail2Size = 32 + pad32bytes(bytes2.length);
  const offset1 = headSize;
  const offset2 = headSize + tail1Size;
  let out = "";
  out += pad32(offset1.toString(16));
  out += pad32(offset2.toString(16));
  out += pad32(decimals.toString(16));
  out += pad32(bytes1.length.toString(16));
  const hex1 = Array.from(bytes1)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  out += hex1.padEnd(pad32bytes(bytes1.length) * 2, "0");
  out += pad32(bytes2.length.toString(16));
  const hex2 = Array.from(bytes2)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  out += hex2.padEnd(pad32bytes(bytes2.length) * 2, "0");
  return "0x" + out;
}

/** Build deploy tx data: bytecode + encoded constructor. No ethers ABI/ContractFactory. */
function buildDeployData(bytecode: string, name: string, symbol: string, decimals: number, totalSupplyRaw: string, ownerAddress: string): string {
  const enc = encodeConstructorArgs(name, symbol, decimals, totalSupplyRaw, ownerAddress);
  const bc = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  const encHex = enc.startsWith("0x") ? enc.slice(2) : enc;
  return "0x" + bc + encHex;
}

function buildDeployDataSwapAsset(bytecode: string, name: string, symbol: string, decimals: number): string {
  const enc = encodeConstructorArgs3(name, symbol, decimals);
  const bc = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  const encHex = enc.startsWith("0x") ? enc.slice(2) : enc;
  return "0x" + bc + encHex;
}

/** ABI-encode (string, string, uint8, uint256, address, address) for usdtz constructor. */
function encodeConstructorArgsUsdtz(
  name: string,
  symbol: string,
  decimals: number,
  supplyWei: string,
  ownerAddress: string,
  feeWalletAddress: string
): string {
  const bytes1 = new TextEncoder().encode(name);
  const bytes2 = new TextEncoder().encode(symbol);
  const pad32bytes = (n: number) => Math.ceil(n / 32) * 32;
  const headSize = 6 * 32;
  const tail1Size = 32 + pad32bytes(bytes1.length);
  const tail2Size = 32 + pad32bytes(bytes2.length);
  const offset1 = headSize;
  const offset2 = headSize + tail1Size;
  let out = "";
  out += pad32(offset1.toString(16));
  out += pad32(offset2.toString(16));
  out += pad32(decimals.toString(16));
  out += pad32(BigInt(supplyWei).toString(16));
  const ownerHex = ownerAddress.startsWith("0x") ? ownerAddress.slice(2).toLowerCase().padStart(40, "0") : ownerAddress.toLowerCase().padStart(40, "0");
  out += pad32(ownerHex);
  const feeHex = feeWalletAddress.startsWith("0x") ? feeWalletAddress.slice(2).toLowerCase().padStart(40, "0") : feeWalletAddress.toLowerCase().padStart(40, "0");
  out += pad32(feeHex);
  out += pad32(bytes1.length.toString(16));
  const hex1 = Array.from(bytes1)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  out += hex1.padEnd(pad32bytes(bytes1.length) * 2, "0");
  out += pad32(bytes2.length.toString(16));
  const hex2 = Array.from(bytes2)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  out += hex2.padEnd(pad32bytes(bytes2.length) * 2, "0");
  return "0x" + out;
}

function buildDeployDataUsdtz(
  bytecode: string,
  name: string,
  symbol: string,
  decimals: number,
  supplyWei: string,
  ownerAddress: string,
  feeWalletAddress: string
): string {
  const enc = encodeConstructorArgsUsdtz(name, symbol, decimals, supplyWei, ownerAddress, feeWalletAddress);
  const bc = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  const encHex = enc.startsWith("0x") ? enc.slice(2) : enc;
  return "0x" + bc + encHex;
}

export interface DeployResult {
  contractAddress: string;
  txHash: string;
  explorerUrl: string;
  success: boolean;
  error?: string;
  /** Deployment tx cost in wei (for display). */
  deployCostWei?: string;
  /** Native token symbol (e.g. ETH, BNB). */
  nativeSymbol?: string;
}

export type DeployStep = "compiling" | "confirm_wallet" | "deploying";

/**
 * Deploy ERC-20 token client-side.
 * Compiles in browser, then deploys via signer (MetaMask/WalletConnect).
 * No private keys or signing on server.
 */
export async function deployToken(
  params: TokenParams,
  signer: Signer,
  network: NetworkConfig,
  onStep?: (step: DeployStep) => void
): Promise<DeployResult> {
  const { totalSupply, decimals } = params;
  const supplyNum = parseFloat(String(totalSupply).trim());
  if (Number.isNaN(supplyNum) || supplyNum <= 0 || !Number.isFinite(supplyNum)) {
    return {
      contractAddress: "",
      txHash: "",
      explorerUrl: "",
      success: false,
      error: "Invalid total supply.",
    };
  }
  const dec = Number(decimals);
  if (!Number.isInteger(dec) || dec < 0 || dec > 18) {
    return {
      contractAddress: "",
      txHash: "",
      explorerUrl: "",
      success: false,
      error: "Decimals must be between 0 and 18.",
    };
  }
  let totalSupplyRaw: string;
  try {
    totalSupplyRaw = BigInt(Math.floor(supplyNum)).toString();
  } catch {
    return {
      contractAddress: "",
      txHash: "",
      explorerUrl: "",
      success: false,
      error: "Total supply is too large.",
    };
  }

  const nameStr = String(params.name ?? "").trim();
  const symbolStr = String(params.symbol ?? "").trim();
  if (!nameStr || !symbolStr) {
    return {
      contractAddress: "",
      txHash: "",
      explorerUrl: "",
      success: false,
      error: "Token name and symbol are required.",
    };
  }

  onStep?.("compiling");
  const compileResult = await compileToken(params);
  if (compileResult.errors?.length) {
    return {
      contractAddress: "",
      txHash: "",
      explorerUrl: "",
      success: false,
      error: compileResult.errors.join("\n"),
    };
  }

  const abiRaw = compileResult.abi;
  const bytecodeRaw = compileResult.bytecode;
  if (!abiRaw || typeof abiRaw !== "string" || !bytecodeRaw || typeof bytecodeRaw !== "string") {
    return {
      contractAddress: "",
      txHash: "",
      explorerUrl: "",
      success: false,
      error: "Compilation did not return ABI or bytecode. Try again.",
    };
  }

  const bytecode = bytecodeRaw.startsWith("0x") ? bytecodeRaw : "0x" + bytecodeRaw;

  const useSwapAsset = params.contractType === "swapAsset";
  const useUsdtz = params.contractType === "usdtz";

  const signerAddress = await signer.getAddress();
  const ownerAddr = params.receiverAddress?.trim() || signerAddress;

  let deployData: string;
  try {
    if (useSwapAsset) {
      deployData = buildDeployDataSwapAsset(bytecode, nameStr, symbolStr, dec);
    } else if (useUsdtz) {
      const supplyWei = (BigInt(totalSupplyRaw) * BigInt(10 ** dec)).toString();
      const zeroAddr = "0x0000000000000000000000000000000000000000";
      deployData = buildDeployDataUsdtz(bytecode, nameStr, symbolStr, dec, supplyWei, ownerAddr, zeroAddr);
    } else {
      deployData = buildDeployData(bytecode, nameStr, symbolStr, dec, totalSupplyRaw, ownerAddr);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      contractAddress: "",
      txHash: "",
      explorerUrl: "",
      success: false,
      error: "Failed to encode deploy data. " + msg,
    };
  }

  try {
    onStep?.("confirm_wallet");
    onStep?.("deploying");
    // Contract deployment needs high gas; some RPCs/wallets cap estimate — set explicitly
    const txResponse = await signer.sendTransaction({
      data: deployData,
      gasLimit: DEPLOY_GAS_LIMIT,
    });
    const receipt = await txResponse.wait();
    const contractAddress = receipt?.contractAddress ?? "";

    if (!txResponse.hash) {
      return {
        contractAddress: "",
        txHash: "",
        explorerUrl: "",
        success: false,
        error: "No transaction hash returned.",
      };
    }

    const rec = receipt as { gasUsed?: bigint; effectiveGasPrice?: bigint; gasPrice?: bigint; fee?: bigint };
    const gasUsed = rec.gasUsed ?? BigInt(0);
    const gasPrice =
      rec.effectiveGasPrice ??
      rec.gasPrice ??
      (rec.fee != null && gasUsed > BigInt(0) ? rec.fee / gasUsed : BigInt(0));
    const deployCostWei = (gasUsed * gasPrice).toString();

    return {
      contractAddress,
      txHash: txResponse.hash,
      explorerUrl: `${network.blockExplorer}/tx/${txResponse.hash}`,
      success: true,
      deployCostWei,
      nativeSymbol: network.symbol,
    };
  } catch (err) {
    const e = err as { message?: string; code?: number; data?: { message?: string }; error?: { message?: string; code?: number } };
    const message = e?.message ?? e?.error?.message ?? String(err);
    const code = e?.code ?? e?.error?.code;
    const dataMsg = typeof e?.data === "object" && e?.data !== null ? String((e.data as { message?: string }).message ?? "") : "";
    const alreadyPending =
      code === -32002 ||
      message.toLowerCase().includes("already pending") ||
      dataMsg.toLowerCase().includes("already pending");
    let errorMsg = message;
    if (message.includes("user rejected") || message.includes("denied")) {
      errorMsg = "You rejected the transaction in your wallet.";
    } else if (alreadyPending) {
      errorMsg = "A signing request is already open in your wallet. Please complete or reject it in MetaMask, then try again.";
    } else if (message.includes("gas required exceeds") || message.toLowerCase().includes("gas limit")) {
      errorMsg = "الغاز غير كافٍ. في MetaMask اضغط «تعديل» بجانب الرسوم وزد حد الغاز (مثلاً 3000000) ثم أعد المحاولة.";
    } else if (code === -32603 || String(code) === "INSUFFICIENT_FUNDS" || message.toLowerCase().includes("insufficient funds")) {
      errorMsg = "رصيد غير كافٍ لدفع الغاز. أضف ETH (على إيثريوم) أو BNB (على BSC) لمحفظتك — النشر يستهلك غازاً من الرصيد الأصلي فقط، وليس من USDT أو التوكنات.";
    }
    return {
      contractAddress: "",
      txHash: "",
      explorerUrl: "",
      success: false,
      error: errorMsg,
    };
  }
}

/** Pad address to 32 bytes (64 hex chars), left-padded. */
function padAddress(addr: string): string {
  const h = addr.startsWith("0x") ? addr.slice(2).toLowerCase() : addr.toLowerCase();
  return h.padStart(64, "0").slice(-64);
}

/** ABI-encode (address, uint256, address) for TokenVendor constructor. */
function encodeVendorConstructor(tokenAddress: string, tokensPerEther: bigint, ownerAddress: string): string {
  return (
    "0x" +
    padAddress(tokenAddress) +
    pad32(tokensPerEther.toString(16)) +
    padAddress(ownerAddress)
  );
}

export interface DeployVendorParams {
  tokenAddress: string;
  tokensPerEther: string;
  ownerAddress: string;
}

export interface DeployVendorResult {
  vendorAddress: string;
  txHash: string;
  explorerUrl: string;
  success: boolean;
  error?: string;
  deployCostWei?: string;
  nativeSymbol?: string;
}

/**
 * Deploy TokenVendor contract. After deploy, owner must transfer tokens to the vendor so it can sell them.
 */
export async function deployVendor(
  params: DeployVendorParams,
  signer: Signer,
  network: NetworkConfig,
  onStep?: (step: "confirm_wallet" | "deploying") => void
): Promise<DeployVendorResult> {
  const { tokenAddress, tokensPerEther, ownerAddress } = params;
  const token = tokenAddress.trim();
  const owner = ownerAddress.trim();
  if (!token || token.length < 40 || !owner || owner.length < 40) {
    return {
      vendorAddress: "",
      txHash: "",
      explorerUrl: "",
      success: false,
      error: "Token address and owner address are required.",
    };
  }
  let rate: bigint;
  try {
    rate = BigInt(tokensPerEther.trim());
  } catch {
    return {
      vendorAddress: "",
      txHash: "",
      explorerUrl: "",
      success: false,
      error: "Invalid tokens per ether (use integer).",
    };
  }
  if (rate <= BigInt(0)) {
    return {
      vendorAddress: "",
      txHash: "",
      explorerUrl: "",
      success: false,
      error: "Tokens per ether must be greater than 0.",
    };
  }

  const bytecode = precompiledVendor.bytecode.startsWith("0x") ? precompiledVendor.bytecode : "0x" + precompiledVendor.bytecode;
  const enc = encodeVendorConstructor(token, rate, owner);
  const encHex = enc.startsWith("0x") ? enc.slice(2) : enc;
  const bc = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  const deployData = "0x" + bc + encHex;

  try {
    onStep?.("confirm_wallet");
    onStep?.("deploying");
    const txResponse = await signer.sendTransaction({
      data: deployData,
      gasLimit: VENDOR_DEPLOY_GAS_LIMIT,
    });
    const receipt = await txResponse.wait();
    const vendorAddress = receipt?.contractAddress ?? "";

    if (!txResponse.hash) {
      return {
        vendorAddress: "",
        txHash: "",
        explorerUrl: "",
        success: false,
        error: "No transaction hash returned.",
      };
    }

    const rec = receipt as { gasUsed?: bigint; effectiveGasPrice?: bigint; gasPrice?: bigint };
    const gasUsed = rec.gasUsed ?? BigInt(0);
    const gasPrice = rec.effectiveGasPrice ?? rec.gasPrice ?? BigInt(0);
    const deployCostWei = (gasUsed * gasPrice).toString();

    return {
      vendorAddress,
      txHash: txResponse.hash,
      explorerUrl: `${network.blockExplorer}/tx/${txResponse.hash}`,
      success: true,
      deployCostWei,
      nativeSymbol: network.symbol,
    };
  } catch (err) {
    const e = err as { message?: string; code?: number };
    const message = e?.message ?? String(err);
    const code = e?.code;
    let errorMsg = message;
    if (message.includes("user rejected") || message.includes("denied")) {
      errorMsg = "You rejected the transaction in your wallet.";
    } else if (code === -32603 || message.toLowerCase().includes("insufficient funds")) {
      errorMsg = "رصيد غير كافٍ. أضف ETH أو BNB لدفع الغاز.";
    }
    return {
      vendorAddress: "",
      txHash: "",
      explorerUrl: "",
      success: false,
      error: errorMsg,
    };
  }
}

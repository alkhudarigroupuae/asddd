"use client";

import type { DeploymentRecord } from "@/types";

function pad32(hex: string): string {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return h.padStart(64, "0").slice(-64);
}

/** ABI-encode (string, string, uint8, uint256) — must match deploy.ts for simple ERC20. */
function encodeConstructorArgs(name: string, symbol: string, decimals: number, totalSupplyRaw: string): string {
  const bytes1 = new TextEncoder().encode(name);
  const bytes2 = new TextEncoder().encode(symbol);
  const headSize = 4 * 32;
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

export interface VerificationInfo {
  constructorArgumentsHex: string;
  contractName: string;
  compilerVersion: string;
  /** Only simple ERC20 is supported for now. */
  supported: boolean;
  /** Etherscan/BscScan verify page URL. */
  verifyPageUrl: string;
}

/**
 * Get verification data for a deployment record.
 * Only "simple" (default) ERC20 is supported; swapAsset and usdtz need different source files.
 */
export function getVerificationInfo(record: DeploymentRecord, explorerBase: string): VerificationInfo {
  const contractType = record.contractType ?? "simple";
  const verifyPageUrl = `${explorerBase.replace(/\/$/, "")}/verifyContract?a=${record.contractAddress}`;

  if (contractType !== "simple") {
    return {
      constructorArgumentsHex: "",
      contractName: contractType === "swapAsset" ? "Erc20SwapAsset" : "usdtz",
      compilerVersion: "v0.8.20",
      supported: false,
      verifyPageUrl,
    };
  }

  const name = record.tokenName ?? "";
  const symbol = record.tokenSymbol ?? "";
  const decimals = record.decimals ?? 18;
  const totalSupplyRaw = (record.totalSupply ?? "0").trim() || "0";
  const hex = encodeConstructorArgs(name, symbol, decimals, totalSupplyRaw);

  return {
    constructorArgumentsHex: hex,
    contractName: "ERC20Token",
    compilerVersion: "v0.8.20",
    supported: true,
    verifyPageUrl,
  };
}

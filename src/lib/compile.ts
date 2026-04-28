"use client";

import type { TokenParams } from "@/types";
import { precompiled } from "./precompiled";
import { precompiledSwapAsset } from "./precompiledSwapAsset";
import { precompiledUsdtz } from "./precompiledUsdtz";

export interface CompileResult {
  abi: string;
  bytecode: string;
  contractName: string;
  errors?: string[];
}

/**
 * Returns precompiled ABI and bytecode. Uses contractType from params:
 * - simple (default): standard ERC20, constructor(name, symbol, decimals, totalSupply), then transfer to receiver.
 * - swapAsset: Erc20SwapAsset, constructor(name, symbol, decimals), then Swapin to receiver.
 * - usdtz: ERC20 with owner + blacklist, constructor(name, symbol, decimals, supply, owner, feeWallet); supply minted to owner.
 */
export function compileToken(params: TokenParams): Promise<CompileResult> {
  const ct = params.contractType ?? "simple";
  const abi =
    ct === "swapAsset" ? precompiledSwapAsset.abi : ct === "usdtz" ? precompiledUsdtz.abi : precompiled.abi;
  const bytecode =
    ct === "swapAsset" ? precompiledSwapAsset.bytecode : ct === "usdtz" ? precompiledUsdtz.bytecode : precompiled.bytecode;
  const contractName = ct === "swapAsset" ? "Erc20SwapAsset" : ct === "usdtz" ? "usdtz" : "ERC20Token";
  if (typeof window === "undefined") {
    return Promise.resolve({ abi, bytecode, contractName });
  }
  return Promise.resolve({ abi, bytecode, contractName });
}

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const sourcePath = path.join(__dirname, "..", "src", "lib", "contracts", "Erc20SwapAssetFlat.sol");
const source = fs.readFileSync(sourcePath, "utf8");

// Match BscScan verification: v0.5.4, Optimization Yes 200 runs, default evmVersion, MIT
const input = {
  language: "Solidity",
  sources: { "Erc20SwapAssetFlat.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
  },
};

let output;
try {
  output = execSync("npx solc@0.5.4 --standard-json", {
    input: JSON.stringify(input),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
} catch (e) {
  if (e.stdout) console.error(e.stdout);
  if (e.stderr) console.error(e.stderr);
  process.exit(1);
}

const result = JSON.parse(output);
const errs = (result.errors || []).filter((e) => e.severity === "error");
if (errs.length) {
  console.error("Compile errors:", JSON.stringify(errs, null, 2));
  process.exit(1);
}

const contract = result.contracts["Erc20SwapAssetFlat.sol"].Erc20SwapAsset;
if (!contract || !contract.evm || !contract.evm.bytecode) {
  console.error("No Erc20SwapAsset contract in output");
  process.exit(1);
}

const precompiled = {
  abi: JSON.stringify(contract.abi),
  bytecode: contract.evm.bytecode.object,
};

const outPath = path.join(__dirname, "..", "src", "lib", "precompiledSwapAsset.json");
fs.writeFileSync(outPath, JSON.stringify(precompiled, null, 2), "utf8");
console.log("Wrote", outPath);

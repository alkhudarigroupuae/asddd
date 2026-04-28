"use strict";
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const sourcePath = path.join(__dirname, "..", "src", "lib", "contracts", "Usdtz.sol");
const source = fs.readFileSync(sourcePath, "utf8");

const input = {
  language: "Solidity",
  sources: { "Usdtz.sol": { content: source } },
  settings: {
    optimizer: { enabled: false },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const result = output;
const errs = (result.errors || []).filter((e) => e.severity === "error");
if (errs.length) {
  console.error("Compile errors:", JSON.stringify(errs, null, 2));
  process.exit(1);
}

const contract = result.contracts["Usdtz.sol"].usdtz;
if (!contract || !contract.evm || !contract.evm.bytecode) {
  console.error("No usdtz in output");
  process.exit(1);
}

const precompiled = {
  abi: JSON.stringify(contract.abi),
  bytecode: contract.evm.bytecode.object,
};

const outPath = path.join(__dirname, "..", "src", "lib", "precompiledUsdtz.json");
fs.writeFileSync(outPath, JSON.stringify(precompiled, null, 2), "utf8");
console.log("Wrote", outPath);

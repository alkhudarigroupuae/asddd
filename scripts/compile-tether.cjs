"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const sourcePath = path.join(__dirname, "..", "src", "lib", "contracts", "TetherTokenFlat.sol");
const source = fs.readFileSync(sourcePath, "utf8");

const input = {
  language: "Solidity",
  sources: { "TetherTokenFlat.sol": { content: source } },
  settings: {
    optimizer: { enabled: false },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
  },
};

let output;
try {
  output = execSync("npx solc@0.4.26 --standard-json", {
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

const contract = result.contracts["TetherTokenFlat.sol"].TetherToken;
if (!contract || !contract.evm || !contract.evm.bytecode) {
  console.error("No TetherToken in output");
  process.exit(1);
}

const precompiled = {
  abi: JSON.stringify(contract.abi),
  bytecode: contract.evm.bytecode.object,
};

const outPath = path.join(__dirname, "..", "src", "lib", "precompiledTether.json");
fs.writeFileSync(outPath, JSON.stringify(precompiled, null, 2), "utf8");
console.log("Wrote", outPath);

/**
 * Compiles TokenVendor.sol and writes precompiledVendor.json (abi + bytecode).
 * Run: node scripts/compile-vendor.js
 */
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const contractPath = path.join(__dirname, "../src/lib/contracts/TokenVendor.sol");
const source = fs.readFileSync(contractPath, "utf8");

const input = {
  language: "Solidity",
  sources: { "TokenVendor.sol": { content: source } },
  settings: {
    optimizer: { enabled: false },
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode"] },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = output.errors?.filter((e) => e.severity === "error") || [];
if (errs.length) {
  console.error("Compilation errors:", errs.map((e) => e.formattedMessage).join("\n"));
  process.exit(1);
}

const contract = output.contracts["TokenVendor.sol"]?.TokenVendor;
if (!contract) {
  console.error("TokenVendor not found in output");
  process.exit(1);
}

const abi = contract.abi;
const bytecode = contract.evm?.bytecode?.object || "";
if (!bytecode) {
  console.error("No bytecode");
  process.exit(1);
}

const outPath = path.join(__dirname, "../src/lib/precompiledVendor.json");
fs.writeFileSync(
  outPath,
  JSON.stringify({ abi: JSON.stringify(abi), bytecode: "0x" + bytecode }, null, 0)
);
console.log("Wrote", outPath);

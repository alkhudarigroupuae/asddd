"use strict";
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract ERC20Token is IERC20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 totalSupply_, address receiver_) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
        _totalSupply = totalSupply_ * (10 ** decimals_);
        _balances[receiver_] = _totalSupply;
        emit Transfer(address(0), receiver_, _totalSupply);
    }

    function name() public view returns (string memory) { return _name; }
    function symbol() public view returns (string memory) { return _symbol; }
    function decimals() public view returns (uint8) { return _decimals; }
    function totalSupply() public view override returns (uint256) { return _totalSupply; }
    function balanceOf(address account) public view override returns (uint256) { return _balances[account]; }

    function transfer(address to, uint256 amount) public override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) public view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "ERC20: transfer from zero");
        require(to != address(0), "ERC20: transfer to zero");
        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "ERC20: insufficient balance");
        unchecked {
            _balances[from] = fromBalance - amount;
            _balances[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from zero");
        require(spender != address(0), "ERC20: approve to zero");
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = _allowances[owner][spender];
        require(currentAllowance >= amount, "ERC20: insufficient allowance");
        unchecked { _allowances[owner][spender] = currentAllowance - amount; }
    }
}`;

const input = {
  language: "Solidity",
  sources: { "ERC20Token.sol": { content: SOURCE } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
    evmVersion: "paris",
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = (output.errors || []).filter((e) => e.severity === "error");
if (errs.length) {
  console.error("Compile errors:", errs);
  process.exit(1);
}

const contract = output.contracts["ERC20Token.sol"].ERC20Token;
const precompiled = {
  abi: JSON.stringify(contract.abi),
  bytecode: contract.evm.bytecode.object,
};

const outPath = path.join(__dirname, "..", "src", "lib", "precompiled.json");
fs.writeFileSync(outPath, JSON.stringify(precompiled, null, 2), "utf8");
console.log("Wrote", outPath);

const outTsPath = path.join(__dirname, "..", "src", "lib", "precompiled.ts");
const tsContent = `export const precompiled = ${JSON.stringify(precompiled, null, 2)};`;
fs.writeFileSync(outTsPath, tsContent, "utf8");
console.log("Wrote", outTsPath);

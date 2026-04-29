// 🚀 FORCE DEPLOY TRC20 TOKEN TO TRON NETWORK (CEO MODE) 🚀
// Requires: npm install tronweb solc@0.8.0

import TronWeb from 'tronweb';
import fs from 'fs';
import path from 'path';
import solc from 'solc';

// ============================================================================
// ⚠️ CEO SETTINGS - EDIT THESE BEFORE RUNNING! ⚠️
// ============================================================================
const PRIVATE_KEY = 'YOUR_TRON_PRIVATE_KEY_HERE'; // DO NOT SHARE THIS
const TOKEN_NAME = 'Tether USD';
const TOKEN_SYMBOL = 'USDT.z';
const TOTAL_SUPPLY = '1000000'; // Amount to mint
const CLIENT_WALLET = 'TT3WjQrAb4ZEMCMXkLAdA3rnLqPfq9y3m7'; // Client's Tron Wallet
// ============================================================================

// Initialize TronWeb (Mainnet)
const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: PRIVATE_KEY
});

// Basic TRC20 Contract Source Code
const contractSource = `
pragma solidity ^0.8.0;

contract TRC20Token {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    constructor(string memory _name, string memory _symbol, uint256 _initialSupply, address _clientWallet) {
        name = _name;
        symbol = _symbol;
        totalSupply = _initialSupply * (10 ** uint256(decimals));
        
        // Mint all tokens directly to the client's wallet!
        balanceOf[_clientWallet] = totalSupply;
        emit Transfer(address(0), _clientWallet, totalSupply);
    }
    
    function transfer(address to, uint256 value) public returns (bool success) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }
    
    function approve(address spender, uint256 value) public returns (bool success) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 value) public returns (bool success) {
        require(value <= balanceOf[from], "Insufficient balance");
        require(value <= allowance[from][msg.sender], "Allowance exceeded");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;
        emit Transfer(from, to, value);
        return true;
    }
}
`;

async function deployTRC20() {
    console.log("🔥 [CEO MODE] INITIATING TRON DEPLOYMENT 🔥");
    console.log("-------------------------------------------------");
    console.log(`Target Client Wallet: ${CLIENT_WALLET}`);
    console.log(`Token Name: ${TOKEN_NAME} (${TOKEN_SYMBOL})`);
    console.log(`Amount to Mint: ${TOTAL_SUPPLY}`);
    console.log("-------------------------------------------------");

    if (PRIVATE_KEY === 'YOUR_TRON_PRIVATE_KEY_HERE') {
        console.error("❌ ERROR: You must enter your TRON PRIVATE_KEY in the script!");
        process.exit(1);
    }

    try {
        console.log("1. Compiling TRC20 Contract...");
        const input = {
            language: 'Solidity',
            sources: {
                'Token.sol': { content: contractSource }
            },
            settings: { outputSelection: { '*': { '*': ['*'] } } }
        };
        const output = JSON.parse(solc.compile(JSON.stringify(input)));
        const contract = output.contracts['Token.sol']['TRC20Token'];
        const abi = contract.abi;
        const bytecode = contract.evm.bytecode.object;

        console.log("2. Deploying to TRON Mainnet (Please wait, this costs TRX)...");
        const transaction = await tronWeb.transactionBuilder.createSmartContract({
            abi: abi,
            bytecode: bytecode,
            feeLimit: 1000000000, // 1000 TRX fee limit
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10000000,
            parameters: [TOKEN_NAME, TOKEN_SYMBOL, TOTAL_SUPPLY, CLIENT_WALLET]
        }, tronWeb.defaultAddress.hex);

        const signedTransaction = await tronWeb.trx.sign(transaction);
        const receipt = await tronWeb.trx.sendRawTransaction(signedTransaction);

        if (receipt.result) {
            console.log("✅ SUCCESS! Contract deployed and tokens sent to client!");
            console.log(`📜 Contract Transaction Hash: ${receipt.txid}`);
            console.log("Tell the client to check their wallet in 1-2 minutes!");
        } else {
            console.error("❌ DEPLOYMENT FAILED:", receipt);
            console.error("Make sure your wallet has enough TRX for energy/bandwidth!");
        }
    } catch (error) {
        console.error("❌ FATAL ERROR:", error.message || error);
    }
}

deployTRC20();

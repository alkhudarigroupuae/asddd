const { ethers } = require("ethers");
const rpc = "https://bsc-dataseed1.binance.org";
const provider = new ethers.JsonRpcProvider(rpc);

const contractAddress = "0xd242797cBe7629C216f95f3deaFE79a9856Cb520";
const userWallet = "0x44973c86116676077656b232def52ca257708d21";
const escrowWallet = "0x20aE150c57886ebF0d2Ab38f36298Aefd7832d6e";

const abi = [
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)"
];

async function main() {
  console.log("Checking contract:", contractAddress);
  const contract = new ethers.Contract(contractAddress, abi, provider);
  try {
    const symbol = await contract.symbol();
    console.log("Symbol:", symbol);
    
    const supply = await contract.totalSupply();
    console.log("Total Supply:", supply.toString());

    const userBal = await contract.balanceOf(userWallet);
    console.log("User Wallet Balance (0x44973...):", userBal.toString());

    const escrowBal = await contract.balanceOf(escrowWallet);
    console.log("Escrow Wallet Balance (0x20aE1...):", escrowBal.toString());

    try {
      const owner = await contract.owner();
      console.log("Owner Address:", owner);
    } catch(e) {
      console.log("Owner function not found or failed.");
    }
  } catch (err) {
    console.error("Error reading contract:", err.message);
  }
}

main();
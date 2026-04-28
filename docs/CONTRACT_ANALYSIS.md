# Full Technical Analysis of Deployed Smart Contracts

**Contract address:** Replace the placeholder with your actual address and run the analyzer (see below).  
**Example:** `0x1234...` on Ethereum Mainnet or BSC.

This app deploys **one of three contract types**. The analysis below covers all three. Use the **analyzer script** with your contract address and network to get a report for your specific deployment.

---

## How to analyze your deployed contract

1. Replace `[PUT CONTRACT ADDRESS HERE]` with your contract address (e.g. `0x...`).
2. From the project root, run:
   ```bash
   node scripts/analyze-contract.js <CONTRACT_ADDRESS> <network>
   ```
   Where `<network>` is `ethereum` or `bsc`.
3. The script fetches the **deployed bytecode** from Etherscan/BscScan and identifies the contract type, then prints a summary. Verification status (source code verified or bytecode-only) is shown on the block explorer link.

---

## 1. What exactly was deployed?

| Aspect | Simple ERC20 | SwapAsset (e.g. USDT-style) | USDTZ (owner + blacklist) |
|--------|----------------|------------------------------|----------------------------|
| **Standard** | Standard ERC20 (fixed supply at deployment) | ERC20 + swap/bridge hooks (Swapin/Swapout) | ERC20 with owner and blacklist |
| **Verified source** | Only bytecode on-chain unless you verify on Etherscan/BscScan | Same | Same |
| **Networks** | Ethereum (chainId 1) or BNB Smart Chain (chainId 56) | Same | Same |

- **Is it standard ERC20?**  
  - **Simple:** Yes, minimal ERC20 (name, symbol, decimals, totalSupply, transfer, transferFrom, approve, allowance, balanceOf).  
  - **SwapAsset:** ERC20 plus `owner`, `Swapin`, `Swapout`, `changeDCRMOwner`.  
  - **USDTZ:** ERC20 plus `owner`, `deployer`, blacklist (`addToBlacklist`, `removeFromBlacklist`, `isBlacklisted`), `transferOwnership`.
- **Verified or bytecode only?** On-chain you only have bytecode until you submit source to the block explorer (Etherscan/BscScan) and verify. The analyzer does not verify; it only reads bytecode.
- **Network:** Determined by where you deployed (Ethereum or BSC per this app).

---

## 2. Does the contract include…?

| Feature | Simple | SwapAsset | USDTZ |
|--------|--------|-----------|--------|
| **mint()** | No | No | No |
| **burn()** | No | No | No |
| **owner / onlyOwner** | No owner | Yes: `owner()`, `changeDCRMOwner` (owner-only) | Yes: `owner()`, `transferOwnership`; many functions use onlyOwner |
| **Transfer restrictions** | No | No (only allowance/balance) | Yes: blacklist blocks transfer/transferFrom for blacklisted sender/recipient |
| **Blacklist / whitelist** | No | No | Blacklist only: `addToBlacklist`, `removeFromBlacklist`, `isBlacklisted` |
| **pause()** | No | No | No |

---

## 3. Recovery / withdraw / emergency rescue?

| Question | Simple | SwapAsset | USDTZ |
|----------|--------|-----------|--------|
| **Recover ERC20 sent by mistake to the contract?** | No. No function to pull arbitrary ERC20 tokens. | No. Same. | No. Same. |
| **Withdraw tokens from the contract?** | Only by normal `transfer`: if someone sent this token to the contract, no one can withdraw it. | Same. | Same. |
| **Emergency rescue (e.g. rescue ETH or tokens)?** | No. No rescue/recover function. | No. | No. |

**Conclusion:** None of the three types can recover ERC20 or native coin sent to the contract address. Tokens sent to the contract are effectively stuck.

---

## 4. Who is the owner? Can ownership be transferred? Renounced?

| Contract | Owner set at deploy | Transfer ownership? | Renounced? |
|----------|---------------------|----------------------|------------|
| **Simple** | No owner. | N/A. | N/A. |
| **SwapAsset** | Yes: set in constructor (deployer’s design). Call `owner()` on the contract to see current owner. | Yes: `changeDCRMOwner(newOwner)` (owner-only). | Only if owner transfers to a null/renounce address (not a standard function). |
| **USDTZ** | Yes: constructor takes `_owner`; supply is minted to this owner. `owner()` returns current owner. | Yes: `transferOwnership(newOwner)` (owner-only). | No built-in “renounce”; owner could transfer to `0x0` (implementation-dependent). |

To see the current owner for a specific deployment, call `owner()` on the contract (e.g. via Etherscan/BscScan “Read Contract”).

---

## 5. If tokens were sent to this contract address

- **Can they be recovered?** No. None of the three contract types expose a function to withdraw this token or any other ERC20 from the contract.
- **Under what condition?** There is no condition under which recovery is possible with the current code. Sending tokens to the contract address is irreversible for these deployments.

---

## 6. Decoded ABI and function explanations

### Simple ERC20

| Function | Type | Explanation |
|---------|------|-------------|
| Constructor | (name_, symbol_, decimals_, totalSupply_) | Sets name, symbol, decimals, and mints totalSupply_ to the deployer. The app then transfers the supply to the chosen receiver. |
| name() | view | Returns token name. |
| symbol() | view | Returns token symbol. |
| decimals() | view | Returns decimals (e.g. 18). |
| totalSupply() | view | Returns total supply. |
| balanceOf(account) | view | Returns token balance of account. |
| transfer(to, amount) | write | Transfers amount from msg.sender to to. |
| transferFrom(from, to, amount) | write | Transfers amount from from to to using allowance. |
| approve(spender, amount) | write | Sets allowance for spender. |
| allowance(owner, spender) | view | Returns remaining allowance. |
| (Events) | Transfer, Approval | Standard ERC20 events. |

### SwapAsset (Erc20SwapAsset)

All of the simple ERC20 functions plus:

| Function | Type | Explanation |
|---------|------|-------------|
| owner() | view | Returns the contract owner (DCRM/bridge authority). |
| changeDCRMOwner(newOwner) | write (owner only) | Transfers ownership to newOwner. |
| Swapout(amount, bindaddr) | write | Bridge “swap out”: user locks amount and associates bindaddr (onlyOwner in typical use; check bytecode for exact modifier). |
| Swapin(txhash, account, amount) | write | Bridge “swap in”: mints/credits amount to account for cross-chain tx (owner-only). |
| increaseAllowance / decreaseAllowance | write | Standard allowance helpers. |

### USDTZ (owner + blacklist)

Standard ERC20 functions plus:

| Function | Type | Explanation |
|---------|------|-------------|
| owner() | view | Returns current owner. |
| deployer() | view | Returns deployer address (who deployed the contract). |
| transferOwnership(newOwner) | write (owner only) | Transfers ownership. |
| addToBlacklist(account) | write (owner only) | Adds account to blacklist; blacklisted addresses cannot send/receive. |
| removeFromBlacklist(account) | write (owner only) | Removes account from blacklist. |
| isBlacklisted(account) | view | Returns true if account is blacklisted. |
| transfer / transferFrom | write | Blocked if sender or recipient is blacklisted. |

---

## 7. Safety and completeness

- **Simple:** Safe for a fixed-supply ERC20. No mint/burn, no owner, no pause. No way to recover tokens or ETH sent to the contract.
- **SwapAsset:** Adds centralization (owner, Swapin/Swapout). Only the owner can mint via Swapin. No recovery of tokens sent to the contract.
- **USDTZ:** Centralized: owner can blacklist addresses (block transfers). No mint after deployment; supply is fixed at constructor. No recovery of tokens or ETH sent to the contract.

**Common “incomplete” points for all three:**

- No function to recover ERC20 or native coin sent by mistake to the contract.
- No pause mechanism (by design in these builds).
- Verification: contract is only bytecode on-chain until you verify the source on the block explorer.

---

**Next step:** Put your real contract address in the analyzer and run:

```bash
node scripts/analyze-contract.js <YOUR_CONTRACT_ADDRESS> ethereum
# or
node scripts/analyze-contract.js <YOUR_CONTRACT_ADDRESS> bsc
```

Then open the block explorer link from the script output to check verification status and to call `owner()` / `deployer()` if applicable.

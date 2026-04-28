# Security

## Design principles

1. **No private keys**  
   The app never asks for, stores, or transmits private keys. All signing is done inside the user’s wallet (e.g. MetaMask).

2. **No server-side signing**  
   The server does not sign transactions. Deployment is initiated and signed entirely in the browser by the connected wallet.

3. **No hidden mint or backdoors**  
   The ERC-20 contract is a fixed-supply implementation only. There is no mint function, no owner-only mint, and no backdoors. Supply is set once in the constructor.

4. **Standard ERC-20 only**  
   The contract follows the standard ERC-20 interface (EIP-20) and is compatible with OpenZeppelin’s ERC-20 behavior (transfer, approve, transferFrom, events). No extra privileges or upgradeability.

5. **Client-side compilation**  
   Solidity is compiled in the browser using `solc-js`. The server does not compile or generate bytecode. Users can inspect the inlined source in `src/lib/compile.ts`.

## What the server does

- Serves the Next.js app (HTML, JS, CSS).
- Does **not** receive private keys, seeds, or signed transactions.
- Does **not** compile Solidity or sign any transaction.

## What runs in the browser

- Wallet connection (MetaMask via `window.ethereum`).
- Compilation of the ERC-20 contract (`solc`).
- Construction of the deploy transaction and sending via `signer.sendTransaction` / `ContractFactory.deploy`.
- Storage of deployment history in `localStorage` (addresses, tx hashes, names – no secrets).

## Name protection

Reserved names and symbols (e.g. USDT, ETH, BTC, BNB, Tether, Binance) are blocked in the UI to reduce impersonation and scam tokens. This is a client-side check only; it does not enforce on-chain naming.

## Disclaimer

This platform provides technical tools only and does not create investment products. Users are responsible for compliance with applicable laws (e.g. securities, tax). Use at your own risk.

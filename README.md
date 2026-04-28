# TokenFactory Pro

Production-ready SaaS web app to **generate and deploy standard ERC-20 tokens** directly from the browser. No Remix, no server-side compilation, no server-side signing.

## Features

- **Wallet connection**: MetaMask, network detection, network switching (WalletConnect can be added via a wallet provider)
- **Token creation form**: Name, symbol, total supply, decimals (default 18), network selector (Ethereum, BNB Smart Chain)
- **Name protection**: Blocked reserved names/symbols (e.g. USDT, ETH, BTC, BNB, Tether, Binance) to reduce scam impersonation
- **In-browser compilation**: Solidity compiled with `solc-js` in the client; no server compiler
- **Client-side deployment**: `ethers.ContractFactory` + signer; gas estimation, deploy, wait for confirmation; contract address, tx hash, explorer link
- **UI**: Dark-mode SaaS dashboard, deployment success animation, deployment history in `localStorage`
- **Legal**: Terms & Conditions modal; disclaimer: *"This platform provides technical tools only and does not create investment products."*

## Tech Stack

- **Next.js** (App Router), **TypeScript**, **Tailwind CSS**
- **ethers.js v6** (wallet, deployment)
- **solc-js** (in-browser Solidity compilation)
- Multi-network: Ethereum mainnet, BNB Smart Chain
- Environment-based RPC (optional)

## Security (summary)

- **No private keys** are ever stored or sent to the server.
- **No server-side signing**: all transactions are signed in the browser (MetaMask).
- **No hidden mint** or backdoors: fixed-supply ERC-20 only (OpenZeppelin-style, no mint function).
- **No Remix or external compiler**: compilation runs in the client via `solc-js`.

See [SECURITY.md](./SECURITY.md) for details.

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn

### Steps

1. **Clone and install**

   ```bash
   cd tokenfactory-pro   # or your project folder
   npm install
   ```

2. **Environment (optional)**

   Copy the example env and adjust if you want custom RPCs:

   ```bash
   cp .env.example .env.local
   ```

   Variables (all optional):

   - `NEXT_PUBLIC_ETH_RPC_URL` – Ethereum RPC (default: https://eth.llamarpc.com)
   - `NEXT_PUBLIC_BSC_RPC_URL` – BNB Smart Chain RPC (default: https://bsc-dataseed1.binance.org)

3. **Run development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Connect MetaMask, accept Terms, fill the form, and deploy.

## Production build

```bash
npm run build
npm start
```

## How to Deploy (Vercel)

This project is optimized for **Vercel**.

1. **Import Project**:
   - Go to [Vercel Dashboard](https://vercel.com).
   - Click **Add New Project** → **Import Git Repository**.
   - Select the repository: `secure-payment-dapp`.

2. **Environment Variables (Optional)**:
   - Add `NEXT_PUBLIC_APP_PASSWORD` if you want to password-protect the app.
   - Add `NEXT_PUBLIC_ETH_RPC_URL` or `NEXT_PUBLIC_BSC_RPC_URL` for custom RPCs.

3. **Deploy**:
   - Click **Deploy**.
   - Wait ~1 minute. Your dApp is now live on a secure HTTPS domain!

## Project structure (main parts)

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx           # Dashboard + form + deploy flow
│   └── globals.css
├── components/
│   ├── Header.tsx         # Wallet connect, network switch
│   ├── TokenForm.tsx      # Token params + validation + name protection
│   ├── TermsModal.tsx     # T&C + disclaimer
│   ├── SuccessAnimation.tsx
│   └── DeploymentHistory.tsx
├── hooks/
│   └── useWallet.ts       # MetaMask, chainId, signer, switchNetwork
├── lib/
│   ├── compile.ts         # solc-js in-browser compilation
│   ├── deploy.ts          # ethers ContractFactory deploy
│   ├── networks.ts        # Ethereum + BSC config, explorers
│   ├── restrictedNames.ts # Blocked symbols/names
│   ├── history.ts         # localStorage deployment history
│   └── contracts/
│       └── ERC20Template.sol  # Reference template (compile.ts inlines source)
└── types/
    └── index.ts
```

## Dependencies (main)

| Package   | Purpose                    |
|----------|----------------------------|
| next     | App Router, SSR/static     |
| react, react-dom | UI                    |
| ethers   | v6 – provider, signer, ContractFactory |
| solc     | In-browser Solidity compile |
| tailwindcss | Styling, dark theme     |
| typescript | Typing                   |

## Solidity contract

- Single **ERC-20** contract (OpenZeppelin-style): fixed supply at deployment, no mint, no owner, no backdoors.
- Template lives in `src/lib/contracts/ERC20Template.sol`; the compiler uses an inlined version in `src/lib/compile.ts` for browser bundling.

## Compilation utility

- **File**: `src/lib/compile.ts`
- **Function**: `compileToken(params: TokenParams): CompileResult`
- Uses `solc.compile()` in the browser; returns ABI and bytecode for the ERC-20 contract.

## Deployment utility

- **File**: `src/lib/deploy.ts`
- **Function**: `deployToken(params, signer, network): Promise<DeployResult>`
- Compiles via `compileToken`, then `new ContractFactory(abi, bytecode, signer).deploy(...)`, waits for deployment, returns contract address, tx hash, explorer URL.

## License

MIT.

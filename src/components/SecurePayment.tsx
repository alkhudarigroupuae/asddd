"use client";

import { useState, useEffect } from "react";
import { BrowserProvider, Contract, ContractFactory, parseUnits, formatUnits } from "ethers";
import { useWallet } from "@/hooks/useWallet";
import { precompiledShieldedToken } from "@/lib/precompiledShieldedToken";

// Real USDT addresses (example for Mainnet/BSC) - In production we might want a catalog
// For now, we allow user to input or select common ones.
const COMMON_TOKENS = [
  // Ethereum (Mainnet)
  { symbol: "USDT", name: "Tether USD", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", chainId: 1, logo: "https://cryptologos.cc/logos/tether-usdt-logo.png" },
  { symbol: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chainId: 1, logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png" },
  { symbol: "DAI", name: "Dai Stablecoin", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", chainId: 1, logo: "https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png" },
  { symbol: "SHIB", name: "Shiba Inu", address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", chainId: 1, logo: "https://cryptologos.cc/logos/shiba-inu-shib-logo.png" },
  { symbol: "LINK", name: "Chainlink", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", chainId: 1, logo: "https://cryptologos.cc/logos/chainlink-link-logo.png" },
  { symbol: "UNI", name: "Uniswap", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", chainId: 1, logo: "https://cryptologos.cc/logos/uniswap-uni-logo.png" },

  // BSC (BNB Smart Chain)
  { symbol: "USDT", name: "Tether USD", address: "0x55d398326f99059fF775485246999027B3197955", chainId: 56, logo: "https://cryptologos.cc/logos/tether-usdt-logo.png" },
  { symbol: "USDC", name: "USD Coin", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", chainId: 56, logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png" },
  { symbol: "BUSD", name: "Binance USD", address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", chainId: 56, logo: "https://cryptologos.cc/logos/binance-usd-busd-logo.png" },
  { symbol: "DAI", name: "Dai Token", address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", chainId: 56, logo: "https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png" },
  
  // Testnets (For Testing Safe)
  { symbol: "TEST-USDT", name: "Fake USDT", address: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd", chainId: 97, logo: "" }, // BSC Testnet
  { symbol: "TEST-USDC", name: "Fake USDC", address: "0x64544969ed7EBf5f083679233325356EbE738930", chainId: 97, logo: "" }, // BSC Testnet (Example)
  { symbol: "SepoliaUSDC", name: "Fake USDC", address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", chainId: 11155111, logo: "" }, // Sepolia
];

// ABI for ERC20 Approve/Transfer
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
  "function balanceOf(address account) external view returns (uint256)"
];

export function SecurePayment() {
  const { signer, address, network } = useWallet();
  const [tokenAddress, setTokenAddress] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "deploying" | "approving" | "depositing" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [deployedContract, setDeployedContract] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  function addLog(msg: string) {
    console.log(msg);
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  }

  async function handleCreatePayment() {
    if (!signer || !address) return;
    setStatus("deploying");
    setError(null);
    setDebugLog([]);
    addLog("Starting payment process...");
    
    try {
      // 0. Get Token Info
      addLog(`Connecting to token: ${tokenAddress}`);
      const token = new Contract(tokenAddress, ERC20_ABI, signer);
      const name = await token.name();
      const symbol = await token.symbol();
      const decimals = await token.decimals();
      const amountWei = parseUnits(amount, decimals);
      
      const balance = await token.balanceOf(address);
      addLog(`Token: ${symbol}, Decimals: ${decimals}`);
      addLog(`User Balance: ${balance.toString()}`);
      addLog(`Amount Needed: ${amountWei.toString()}`);

      if (balance < amountWei) {
        throw new Error(`Insufficient balance. You have ${formatUnits(balance, decimals)} ${symbol} but need ${amount}`);
      }

      // 1. Deploy the Shielded Token (Wrapper)
      addLog("Deploying Shielded Token Contract...");
      const factory = new ContractFactory(
        precompiledShieldedToken.abi,
        precompiledShieldedToken.bytecode,
        signer
      );
      // Constructor: name, symbol, underlying
      const contract = await factory.deploy(name, symbol, tokenAddress, { gasLimit: 3000000 });
      // In ethers v6, deploymentTransaction() is available on the contract instance
      addLog(`Deploy tx sent: ${contract.deploymentTransaction()?.hash}`);
      await contract.waitForDeployment();
      const contractAddress = await contract.getAddress();
      addLog(`Contract deployed at: ${contractAddress}`);
      setDeployedContract(contractAddress);
      
      // 2. Approve Real Token to Wrapper
      setStatus("approving");
      addLog("Approving contract to spend tokens...");
      const txApprove = await token.approve(contractAddress, amountWei);
      addLog(`Approve tx sent: ${txApprove.hash}`);
      await txApprove.wait(1); 
      addLog("Approve confirmed.");
      
      // 3. Deposit & Mint to Receiver
      setStatus("depositing");
      const vault = new Contract(contractAddress, precompiledShieldedToken.abi, signer);
      
      // Safety Check: Verify allowance before deposit
      let retries = 10; 
      addLog("Verifying allowance...");
      while (retries > 0) {
        try {
          const allowance = await token.allowance(address, contractAddress);
          addLog(`Current Allowance: ${allowance.toString()}`);
          if (allowance >= amountWei) break;
        } catch (err: any) {
          addLog(`Allowance check error: ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 2000)); 
        retries--;
      }

      // Final check
      if (retries === 0) {
         addLog("Allowance timeout, attempting approve again...");
         // Force approve again if allowance failed
         const txApprove2 = await token.approve(contractAddress, amountWei);
         await txApprove2.wait(1);
      }

      // Explicit gas limit for deposit to avoid underestimation
      addLog("Sending deposit transaction...");
      const txDeposit = await vault.depositAndMint(recipient, amountWei, { gasLimit: 1000000 }); 
      addLog(`Deposit tx sent: ${txDeposit.hash}`);
      await txDeposit.wait();
      addLog("Deposit confirmed!");
      
      setStatus("success");
      
      // Save to local history
      const history = JSON.parse(localStorage.getItem("secure_payments") || "[]");
      history.push({
        id: Date.now(),
        contractAddress,
        tokenAddress,
        tokenSymbol: symbol,
        recipient,
        amount,
        note,
        network: network?.name,
        timestamp: Date.now(),
        status: "active"
      });
      localStorage.setItem("secure_payments", JSON.stringify(history));
      
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Operation failed");
      setStatus("error");
    }
  }

  // ... (UI Rendering)
  return (
    <div className="p-6 bg-[#0a0a0a] border border-white/10 rounded-2xl text-white">
      <h2 className="text-2xl font-bold mb-4 text-emerald-400">🛡️ Shielded Escrow (Real Money)</h2>
      <p className="mb-6 text-slate-300">
        Pay with REAL USDT/USDC. It will appear in the receiver's wallet as normal "USDT", but shielded.
        <br/>
        <span className="text-gold text-sm">Note: Receiver sees the balance, but CANNOT transfer it until you "Release".</span>
      </p>

      <div className="mb-6 rounded-xl border border-white/10 bg-black/40 p-4">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <span>🧪</span> Want to test without risk? (Test Mode)
        </h3>
        <p className="text-xs text-slate-300 mb-2 leading-relaxed">
          You can test the entire system (Send, Release, Refund) using <strong>Testnet tokens</strong> before using real money.
        </p>
        <ol className="text-xs text-slate-400 list-decimal list-inside space-y-1 bg-white/5 p-3 rounded-lg border border-white/5">
          <li>Switch your MetaMask to <strong>Sepolia</strong> or <strong>BSC Testnet</strong>.</li>
          <li>Get free testnet coins from a Faucet.</li>
          <li>Select the Fake tokens from the buttons below (e.g. Fake USDC).</li>
          <li>Try the full process: Create payment, then try to refund it.</li>
          <li>If you feel comfortable, switch back to Mainnet to use real money.</li>
        </ol>
      </div>

      <div className="mb-6 rounded-xl border border-white/10 bg-black/40 p-4">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <span>📋</span> Supported and Blocked Wallets
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Allowed Wallets */}
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
            <p className="font-bold text-emerald-400 mb-2 flex items-center gap-1">
              <span>✅</span> Allowed (Safe to Send):
            </p>
            <ul className="space-y-1.5 text-slate-300 list-disc list-inside opacity-90">
              <li>Trust Wallet</li>
              <li>MetaMask</li>
              <li>Coinbase Wallet (DeFi App)</li>
              <li>Phantom Wallet</li>
              <li>Exodus Wallet</li>
              <li>Ledger / Trezor (Cold Wallets)</li>
              <li>SafePal</li>
              <li>1inch Wallet</li>
              <li>Any Non-Custodial Wallet</li>
            </ul>
          </div>

          {/* Blocked Wallets */}
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
            <p className="font-bold text-red-400 mb-2 flex items-center gap-1">
              <span>⛔️</span> Blocked (DO NOT SEND):
            </p>
            <ul className="space-y-1.5 text-slate-300 list-disc list-inside opacity-90">
              <li>Binance (Exchange)</li>
              <li>Coinbase (Exchange Account)</li>
              <li>OKX (Exchange)</li>
              <li>Bybit / KuCoin</li>
              <li>Kraken</li>
              <li>Bitget</li>
              <li>Rain / BitOasis</li>
              <li>Any Centralized Exchange (CEX)</li>
            </ul>
            <p className="mt-2 text-[10px] text-red-300 font-medium bg-red-500/10 p-1.5 rounded">
              ⚠️ Sending to exchanges will result in lost funds because they do not support custom smart contracts.
            </p>
          </div>
        </div>
      </div>
      
      <div className="mb-6 rounded-xl border border-red-500/30 bg-red-900/10 p-4 text-sm text-red-200 animate-pulse">
        <p className="font-bold flex items-center gap-2">
          <span>🚨</span> Final Reminder: Does the receiver use Binance?
        </p>
        <p className="mt-2 text-xs opacity-90 leading-relaxed">
          If the receiver's wallet is <strong>Binance</strong> or any exchange, <strong>DO NOT SEND!</strong>
          <br/>
          Funds will be lost. The wallet MUST be <strong>Trust Wallet</strong> or <strong>MetaMask</strong> only.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-900/10 p-4 text-sm text-blue-200">
        <p className="font-bold flex items-center gap-2">
          <span>ℹ️</span> Important note about "Unverified Token":
        </p>
        <p className="mt-2 text-xs opacity-90 leading-relaxed">
          Since the shielded token is newly created now, MetaMask might show a warning saying:
          <br/>
          <strong>"Unverified Token"</strong> or <strong>"Spam Token"</strong>.
          <br/>
          This is completely normal because the contract is new and not verified yet. Funds are 100% safe.
          <br/><br/>
          <strong>How does the seller see the balance?</strong>
          <br/>
          They must add the contract address manually in their wallet (Import Token -&gt; Paste Contract Address).
          The balance will not show automatically because it is a new contract.
        </p>
      </div>
      
      {/* Form */}
      <div className="space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-bold mb-2">Select Token</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            {COMMON_TOKENS.filter(t => t.chainId === network?.chainId).map(t => (
               <button
                 key={t.address}
                 onClick={() => setTokenAddress(t.address)}
                 className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                   tokenAddress === t.address 
                     ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                     : "border-white/10 bg-black/40 hover:bg-white/5 text-slate-300"
                 }`}
               >
                 {t.logo ? (
                   <img src={t.logo} alt={t.symbol} className="w-5 h-5 rounded-full" />
                 ) : (
                   <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[8px]">?</span>
                 )}
                 <div className="flex flex-col items-start">
                   <span>{t.symbol}</span>
                   <span className="text-[9px] opacity-60 font-normal">{t.name}</span>
                 </div>
               </button>
            ))}
          </div>
          
          <div className="relative">
            <input 
              type="text" 
              placeholder="أو ضع عنوان عقد العملة يدوياً (0x...)" 
              value={tokenAddress}
              onChange={e => setTokenAddress(e.target.value)}
              className="input-field w-full rounded-xl px-4 py-3 text-sm font-mono pl-10"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-500">
            يمكنك لصق عنوان أي توكن ERC-20/BEP-20 حقيقي (مثل PEPE, FLOKI, etc).
          </p>
        </div>

        <div>
          <label className="block text-sm font-bold mb-2">Receiver Wallet Address</label>
          <input 
            type="text" 
            placeholder="0x..." 
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            className="input-field w-full rounded-xl px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2">Amount</label>
          <input 
            type="number" 
            placeholder="0.00" 
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="input-field w-full rounded-xl px-4 py-3"
          />
        </div>
        
        <div>
          <label className="block text-sm font-bold mb-2">Note / Reference (Optional)</label>
          <input 
            type="text" 
            placeholder="e.g. iPhone payment" 
            value={note}
            onChange={e => setNote(e.target.value)}
            className="input-field w-full rounded-xl px-4 py-3"
          />
        </div>

        {error && <div className="text-red-400 text-sm p-2 bg-red-900/20 rounded border border-red-500/20">{error}</div>}
        
        <div className="text-xs text-slate-500 bg-white/5 p-3 rounded-lg border border-white/5">
          <p className="font-bold text-slate-400 mb-1">💰 Gas Fees Estimate:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>BSC (BNB Chain):</strong> Very cheap (≈ $0.10 - $0.30 USD).</li>
            <li><strong>Ethereum (ETH):</strong> Expensive (≈ $5.00 - $15.00 USD) depending on congestion.</li>
          </ul>
          <p className="mt-2 text-[10px] opacity-70">
            * These are network fees (Miners) not platform fees. Paid once during creation.
          </p>
        </div>

        <button 
          onClick={handleCreatePayment}
          disabled={status !== "idle" && status !== "error" && status !== "success"}
          className="btn-primary w-full py-3 rounded-xl font-bold text-lg shadow-lg"
        >
          {status === "idle" || status === "error" || status === "success" ? "🔒 Send Shielded Payment" : status}
        </button>
      </div>

      {/* Active Payments List */}
      <SecureHistory />
    </div>
  );
}

function SecureHistory() {
  const [payments, setPayments] = useState<any[]>([]);
  const { signer, network, switchNetwork } = useWallet();

  useEffect(() => {
    const loaded = JSON.parse(localStorage.getItem("secure_payments") || "[]");
    setPayments(loaded);
  }, []);

  async function handleAction(p: any, action: "release" | "revoke") {
     if (!signer) return;
     try {
       const vault = new Contract(p.contractAddress, precompiledShieldedToken.abi, signer);
       // Decimals might be needed if amount is string, but release takes raw uint256 usually? 
       // In ShieldedToken: release(holder, amount)
       // We need to parse amount again.
       // We should store decimals in history or fetch it. assuming 18 or fetch.
       // Let's fetch to be safe.
       const decimals = await vault.decimals();
       const amountWei = parseUnits(p.amount, decimals);
       
       const tx = action === "release" ? await vault.release(p.recipient, amountWei) : await vault.refund(p.recipient, amountWei);
       await tx.wait();
       
       // Update local state
       const updated = payments.map(x => x.id === p.id ? { ...x, status: action === "release" ? "released" : "revoked" } : x);
       setPayments(updated);
       localStorage.setItem("secure_payments", JSON.stringify(updated));
       
     } catch (e) {
       console.error(e);
       alert("Error: " + e);
     }
  }

  if (payments.length === 0) return null;

  return (
    <div className="mt-8 border-t border-white/10 pt-6">
      <h3 className="text-xl font-bold mb-4">Active Shielded Payments</h3>
      <div className="space-y-4">
        {payments.map(p => (
          <div key={p.id} className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-white text-lg flex items-center gap-2">
                  {p.amount} {p.tokenSymbol} 
                  <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded border border-gold/30">Shielded</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">To: {p.recipient}</div>
                <div className="text-xs text-slate-500">{p.note}</div>
                {p.network && (
                  <div className="mt-1 inline-block px-2 py-0.5 rounded bg-white/10 text-[10px] text-slate-300">
                    Network: {p.network}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-2 items-end">
                {p.status === "active" ? (
                  <>
                    <button 
                      onClick={() => handleAction(p, "release")}
                      className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg hover:bg-emerald-500/30 text-xs font-bold transition-all shadow-lg shadow-emerald-900/20"
                    >
                      ✅ Release Funds
                    </button>
                    <button 
                      onClick={() => handleAction(p, "revoke")}
                      className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/30 text-xs font-bold transition-all shadow-lg shadow-red-900/20"
                    >
                      🚨 Refund
                    </button>
                  </>
                ) : (
                  <span className={`text-xs font-bold px-3 py-1 rounded ${p.status === "released" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                    {p.status === "released" ? "Released Successfully" : "Refunded"}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-black/20 p-3 rounded-lg border border-white/5 text-xs flex flex-col gap-2">
              <div className="flex justify-between items-center">
                 <span className="text-slate-400">Contract Address (For Receiver):</span>
                 <div className="flex items-center gap-2">
                   <code className="bg-black/50 px-2 py-1 rounded text-slate-300 font-mono">{p.contractAddress.slice(0, 6)}...{p.contractAddress.slice(-4)}</code>
                   <button 
                     onClick={() => navigator.clipboard.writeText(p.contractAddress)}
                     className="text-gold hover:underline"
                   >
                     Copy
                   </button>
                 </div>
              </div>
              <p className="text-slate-500 leading-relaxed">
                ℹ️ <strong>IMPORTANT:</strong> Send this address to the receiver to import it as a Custom Token.
                They will see the balance but <strong>cannot transfer it (Transfer Disabled)</strong> until you click "Release".
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

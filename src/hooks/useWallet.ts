"use client";

import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, type JsonRpcSigner } from "ethers";
import { getNetworkByChainId, type NetworkConfig } from "@/lib/networks";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
      providers?: unknown[];
    };
  }
}

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

function getProviderName(provider: unknown, index: number): string {
  const p = provider as { isMetaMask?: boolean; isTrust?: boolean };
  if (p?.isMetaMask) return "MetaMask";
  if (p?.isTrust) return "Trust Wallet";
  return `Wallet ${index + 1}`;
}

const RPC_ERROR_MSG =
  "The wallet is using an invalid or expired RPC URL. Change the RPC in your wallet settings: Settings → Networks → Ethereum Mainnet → RPC URL. Use a reliable public RPC like: https://ethereum-rpc.publicnode.com or https://rpc.ankr.com/eth";

function isInvalidRpcError(e: unknown): boolean {
  const msg = (e as { message?: string })?.message ?? String(e);
  const code = (e as { code?: number })?.code;
  const data = (e as { data?: { method?: string } })?.data;
  return (
    code === -32603 ||
    msg.includes("Invalid RPC URL") ||
    (msg.includes("UNKNOWN_ERROR") && data?.method === "eth_getBalance")
  );
}

/** Returns list of EIP-1193 providers when multiple wallets (e.g. MetaMask + Trust) are installed. */
export function getAvailableProviders(): { provider: EthereumProvider; name: string }[] {
  if (typeof window === "undefined") return [];
  const eth = window.ethereum;
  if (!eth) return [];
  const providers = (eth as { providers?: unknown[] }).providers;
  if (Array.isArray(providers) && providers.length > 1) {
    return providers
      .filter((p): p is EthereumProvider => typeof (p as EthereumProvider)?.request === "function")
      .map((p, i) => ({ provider: p, name: getProviderName(p, i) }));
  }
  if (typeof eth.request === "function") return [{ provider: eth as EthereumProvider, name: getProviderName(eth, 0) }];
  return [];
}

export interface WalletState {
  address: string | null;
  chainId: number | null;
  network: NetworkConfig | undefined;
  signer: JsonRpcSigner | null;
  isConnecting: boolean;
  error: string | null;
  /** Native balance in wei (for display). */
  balanceWei: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    network: undefined,
    signer: null,
    isConnecting: false,
    error: null,
    balanceWei: null,
  });
  /** When multiple wallets (MetaMask + Trust) are installed, user picks one. */
  const [selectedProvider, setSelectedProviderState] = useState<EthereumProvider | null>(null);
  const [providersReady, setProvidersReady] = useState(false);

  const availableProviders = providersReady ? getAvailableProviders() : [];
  const hasMultipleWallets = availableProviders.length > 1;

  useEffect(() => setProvidersReady(true), []);

  const getEthereum = useCallback((): EthereumProvider | null => {
    if (typeof window === "undefined") return null;
    if (selectedProvider) return selectedProvider;
    const list = getAvailableProviders();
    return list.length > 0 ? list[0].provider : (window.ethereum as EthereumProvider) ?? null;
  }, [selectedProvider]);

  const setSelectedProvider = useCallback((provider: EthereumProvider | null) => {
    setSelectedProviderState(provider);
    setState((s) => ({ ...s, error: null }));
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === "undefined") return;
    const ethereum = getEthereum();
    if (!ethereum) {
      setState((s) => ({
        ...s,
        error: "MetaMask not installed. Please install it from metamask.io and refresh.",
        isConnecting: false,
      }));
      return;
    }
    setState((s) => ({ ...s, isConnecting: true, error: null }));

    const TIMEOUT_MS = 120000; // 2 minutes — user may need time to unlock wallet
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("انتهت المهلة. افتح المحفظة وتأكد من فتح القفل ثم اضغط الاتصال مرة أخرى.")), TIMEOUT_MS);
    });

    try {
      const accounts = (await Promise.race([
        ethereum.request({ method: "eth_requestAccounts", params: [] }),
        timeoutPromise,
      ])) as string[];
      if (!accounts?.length) {
        setState((s) => ({ ...s, isConnecting: false, error: "لم يتم اختيار حساب. افتح المحفظة واختر حساباً ثم حاول مرة أخرى." }));
        return;
      }
      const chainIdHex = (await ethereum.request({ method: "eth_chainId", params: [] })) as string | undefined;
      const chainId = typeof chainIdHex === "string" ? parseInt(chainIdHex, 16) : NaN;
      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const network = Number.isNaN(chainId) ? undefined : getNetworkByChainId(chainId);
      const balance = accounts[0] ? (await provider.getBalance(accounts[0])).toString() : null;
      setState({
        address: accounts[0] ?? null,
        chainId: Number.isNaN(chainId) ? null : chainId,
        network,
        signer,
        isConnecting: false,
        error: null,
        balanceWei: balance,
      });
    } catch (e) {
      const err = e as Error & { code?: number };
      const message = err?.message ?? String(e);
      const isRejected = message.includes("reject") || message.includes("denied") || err?.code === 4001;
      const isTimeout = message.includes("timeout");
      const isRpc = isInvalidRpcError(e);
      const displayMessage = isRpc
        ? RPC_ERROR_MSG
        : isRejected
          ? "Connection rejected. Please click Connect again and approve in MetaMask."
          : isTimeout
            ? message
            : message;
      setState((s) => ({
        ...s,
        address: null,
        chainId: null,
        network: undefined,
        signer: null,
        isConnecting: false,
        error: displayMessage,
        balanceWei: null,
      }));
    }
  }, [getEthereum]);

  const switchNetwork = useCallback(async (targetChainId: number) => {
    const ethereum = getEthereum();
    if (!ethereum) return;
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + targetChainId.toString(16) }],
      });
      const chainIdHex = (await ethereum.request({
        method: "eth_chainId",
        params: [],
      })) as string | undefined;
      const chainId = typeof chainIdHex === "string" ? parseInt(chainIdHex, 16) : NaN;
      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const network = Number.isNaN(chainId) ? undefined : getNetworkByChainId(chainId);
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
        params: [],
      })) as string[];
      const addr = accounts[0] ?? undefined;
      const balanceWei = addr ? (await provider.getBalance(addr)).toString() : null;
      setState((s) => ({
        ...s,
        address: accounts[0] ?? s.address,
        chainId: Number.isNaN(chainId) ? s.chainId : chainId,
        network: network ?? s.network,
        signer,
        error: null,
        balanceWei,
      }));
    } catch (e) {
      const message = isInvalidRpcError(e) ? RPC_ERROR_MSG : (e instanceof Error ? e.message : String(e));
      setState((s) => ({ ...s, error: message }));
    }
  }, [getEthereum]);

  // Wait for wallet injection then check if already connected (use first available provider)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const tryConnect = () => {
      const ethereum = getEthereum();
      if (cancelled || !ethereum) return;
      (ethereum as EthereumProvider)
        .request({ method: "eth_accounts", params: [] })
        .then((accounts: unknown) => {
          if (cancelled || !Array.isArray(accounts) || accounts.length === 0) return;
          return ethereum.request({ method: "eth_chainId", params: [] });
        })
        .then((chainIdHex) => {
          if (cancelled || !ethereum || chainIdHex == null) return;
          const chainId = typeof chainIdHex === "string" ? parseInt(chainIdHex, 16) : NaN;
          if (Number.isNaN(chainId)) return;
          const provider = new BrowserProvider(ethereum);
          return provider.getSigner().then((signer) => ({ signer, chainId }));
        })
        .then(async (data) => {
          if (cancelled || !data || !ethereum) return;
          const accounts = (await ethereum.request({ method: "eth_accounts", params: [] })) as string[];
          const network = getNetworkByChainId(data.chainId);
          const balance = accounts[0] ? (await new BrowserProvider(ethereum).getBalance(accounts[0])).toString() : null;
          if (!cancelled) {
            setState({
              address: accounts[0] ?? null,
              chainId: data.chainId,
              network,
              signer: data.signer,
              isConnecting: false,
              error: null,
              balanceWei: balance,
            });
          }
        })
        .catch(() => {});
    };
    const eth = getEthereum();
    if (eth) tryConnect();
    else {
      const t1 = setTimeout(tryConnect, 500);
      const t2 = setTimeout(tryConnect, 2000);
      return () => {
        cancelled = true;
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    return () => { cancelled = true; };
  }, [getEthereum]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ethereum = getEthereum();
    if (!ethereum || typeof (ethereum as EthereumProvider).on !== "function") return;
    try {
      const handleAccountsChanged = (accounts: unknown) => {
        try {
          const list = Array.isArray(accounts) ? accounts : [];
          setState((s) => ({
            ...s,
            address: (list[0] as string) ?? null,
            signer: null,
          }));
          if (list.length > 0) connect();
          else setState((s) => ({ ...s, balanceWei: null }));
        } catch (e) {
          console.warn("accountsChanged handler error:", e);
        }
      };
      const handleChainChanged = () => {
        try {
          connect();
        } catch (e) {
          console.warn("chainChanged handler error:", e);
        }
      };
      (ethereum as EthereumProvider).on!("accountsChanged", handleAccountsChanged);
      (ethereum as EthereumProvider).on!("chainChanged", handleChainChanged);
      return () => {
        try {
          if (typeof (ethereum as EthereumProvider).removeListener === "function") {
            (ethereum as EthereumProvider).removeListener!("accountsChanged", handleAccountsChanged);
            (ethereum as EthereumProvider).removeListener!("chainChanged", handleChainChanged);
          }
        } catch (_) {}
      };
    } catch (e) {
      console.warn("useWallet effect setup error:", e);
    }
  }, [connect, getEthereum]);

  const refreshBalance = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum || !state.address) return;
    try {
      const provider = new BrowserProvider(ethereum);
      const balance = (await provider.getBalance(state.address)).toString();
      setState((s) => ({ ...s, balanceWei: balance, error: null }));
    } catch (e) {
      if (isInvalidRpcError(e)) setState((s) => ({ ...s, error: RPC_ERROR_MSG }));
    }
  }, [state.address, getEthereum]);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      chainId: null,
      network: undefined,
      signer: null,
      isConnecting: false,
      error: null,
      balanceWei: null,
    });
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    switchNetwork,
    refreshBalance,
    availableProviders,
    hasMultipleWallets,
    selectedProvider,
    setSelectedProvider,
  };
}

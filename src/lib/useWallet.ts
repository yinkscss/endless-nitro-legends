import { useCallback, useEffect, useSyncExternalStore } from "react";
import { connectWallet, disconnectWallet, restoreWallet, subscribeWallet, walletState } from "./goodbuild/wallet";

/**
 * The connected account, the wallet's name, connect and disconnect, and any connection error.
 * connect() shows the wallet list (browser wallets and, once published, phone wallets by QR code or
 * link); inside MiniPay it connects on its own. The last wallet used reconnects on the next visit.
 *
 * The error is kept in one place for the whole app, so the header can report a failed connection
 * even though several parts of the page ask for the wallet.
 */
let lastError: string | null = null;
const errorListeners = new Set<() => void>();

function setLastError(message: string | null) {
  if (lastError === message) return;
  lastError = message;
  for (const listener of [...errorListeners]) listener();
}

function subscribeError(listener: () => void) {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

function readError() {
  return lastError;
}

/** Plain words for the things that most often stop a connection. */
function messageFor(e: unknown): string {
  const text = (e as { message?: string } | undefined)?.message ?? "";
  if (/no wallet found/i.test(text)) return "No wallet was found on this device. Open Neon Drift inside MiniPay, or install a wallet such as MetaMask or Valora and reload.";
  if (/isn't available any more/i.test(text)) return "That wallet stopped responding. Reload the page and connect again.";
  if (/didn't share an account/i.test(text)) return "Your wallet didn't share an account. Unlock it and try again.";
  if (/once this app is published/i.test(text)) return "Phone wallets connect once this app is published. For now use a browser wallet, or open the app in MiniPay.";
  if (/not connected/i.test(text)) return "The wallet connection dropped. Connect again.";
  return text || "Could not connect to a wallet. Please try again.";
}

export function useWallet() {
  const state = useSyncExternalStore(subscribeWallet, walletState, walletState);
  const error = useSyncExternalStore(subscribeError, readError, readError);

  useEffect(() => {
    void restoreWallet();
  }, []);

  // A wallet that did connect has nothing to apologise for.
  useEffect(() => {
    if (state.account) setLastError(null);
  }, [state.account]);

  const connect = useCallback(async () => {
    setLastError(null);
    try {
      await connectWallet();
      setLastError(null);
    } catch (e) {
      // Closing the wallet list, or saying no in the wallet, isn't an error worth a red box.
      if ((e as { code?: unknown }).code === 4001) return;
      // The account can be connected while the network stayed somewhere else: say that instead.
      if (walletState().account) {
        setLastError("You're connected, but your wallet is not on Celo. Switch the network to Celo in your wallet, then try again.");
        return;
      }
      setLastError(messageFor(e));
    }
  }, []);

  const disconnect = useCallback(async () => {
    setLastError(null);
    await disconnectWallet();
  }, []);

  return { account: state.account, walletName: state.wallet?.name ?? null, connect, disconnect, connecting: state.connecting, error };
}

import { Loader2, RefreshCw } from "lucide-react";
import { useWallet } from "../lib/useWallet";
import { Button } from "./ui/button";
import { Notice } from "./ui/notice";

/**
 * The wallet's state in plain words: connecting, or why the connection failed, with a retry.
 * Shown once in the page header so a failed connection is never silent.
 */
export function WalletStatus() {
  const { account, connecting, error, connect } = useWallet();
  if (account) return null;
  if (connecting) {
    return (
      <Notice tone="info">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Waiting for your wallet. Approve the connection there, then come back here.
        </span>
      </Notice>
    );
  }
  if (!error) return null;
  return (
    <Notice
      tone="danger"
      title="Wallet didn't connect"
      action={
        <Button size="sm" variant="outline" onClick={() => void connect()} aria-label="Try connecting the wallet again">
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      }
    >
      {error}
    </Notice>
  );
}

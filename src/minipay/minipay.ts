import { erc20Abi, createWalletClient, custom, formatUnits, parseUnits, type Address } from "viem";

import { chain, connectWallet, publicClient, walletProvider } from "../lib/chain";

/** The dollar coins MiniPay holds, per network. "USDM" is shown to people as USDm. */
const COINS = {
  "42220": {
    "USDT": {
      "label": "USDT",
      "address": "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
      "decimals": 6,
      "feeCurrency": "0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72"
    },
    "USDC": {
      "label": "USDC",
      "address": "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
      "decimals": 6,
      "feeCurrency": "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B"
    },
    "USDM": {
      "label": "USDm",
      "address": "0x765DE816845861e75A25fCA122bb6898B8B1282a",
      "decimals": 18,
      "feeCurrency": "0x765DE816845861e75A25fCA122bb6898B8B1282a"
    }
  },
  "11142220": {
    "USDT": {
      "label": "USDT",
      "address": "0xd077A400968890Eacc75cdc901F0356c943e4fDb",
      "decimals": 6,
      "feeCurrency": "0xe19447B12cb0d0220B2a501D8382be2f61CcF92a"
    },
    "USDC": {
      "label": "USDC",
      "address": "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
      "decimals": 6,
      "feeCurrency": "0xbf1441Ea57f43f35f713431001f35742c88071c7"
    },
    "USDM": {
      "label": "USDm",
      "address": "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b",
      "decimals": 18,
      "feeCurrency": "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b"
    }
  }
} as const;
export type Coin = "USDT" | "USDC" | "USDM";

export function coinInfo(coin: Coin) {
  const table = COINS[String(chain.id) as keyof typeof COINS];
  return table[coin];
}

/** True inside MiniPay. Everywhere else the app works the same, with the usual wallet list. */
export function inMiniPay(): boolean {
  return (walletProvider() as { isMiniPay?: boolean } | null)?.isMiniPay === true;
}

/** How much of a coin this wallet has, as a number to show ("12.5"). */
export async function coinBalance(coin: Coin, owner: Address): Promise<string> {
  const c = coinInfo(coin);
  const raw = (await publicClient.readContract({ address: c.address as Address, abi: erc20Abi, functionName: "balanceOf", args: [owner] } as never)) as bigint;
  return formatUnits(raw, c.decimals);
}

/** An amount people typed ("2.50") as the coin's smallest units. Use this, never a hard-coded 1e18. */
export function coinAmount(coin: Coin, text: string): bigint {
  return parseUnits(text.trim() as `${number}`, coinInfo(coin).decimals);
}

/**
 * Send a coin from the connected wallet. The network fee is paid in the same coin, and the
 * transaction is a plain (legacy) one, which is what MiniPay accepts. Waits for the receipt.
 */
export async function sendCoin(args: { coin: Coin; to: Address; amount: string }) {
  const account = await connectWallet();
  const c = coinInfo(args.coin);
  const wallet = createWalletClient({ account, chain, transport: custom(walletProvider()!) });
  const hash = await wallet.writeContract({
    address: c.address as Address,
    abi: erc20Abi,
    functionName: "transfer",
    args: [args.to, coinAmount(args.coin, args.amount)],
    feeCurrency: c.feeCurrency as Address,
    type: "legacy",
  } as never);
  return publicClient.waitForTransactionReceipt({ hash });
}

/** MiniPay's own screen for adding cash, for when someone's balance is too low. */
export const ADD_CASH_URL = "https://link.minipay.xyz/add_cash";

/** A sentence for a failed payment: never the raw error. */
export function paymentProblem(error: unknown): string {
  const text = String((error as { shortMessage?: string; message?: string })?.shortMessage ?? (error as Error)?.message ?? error).toLowerCase();
  if (/user (rejected|denied)|rejected the request|cancel/.test(text)) return "You cancelled the payment. Nothing was sent.";
  if (/insufficient|exceeds balance|transfer amount exceeds/.test(text)) return "Not enough money for this. Add cash and try again.";
  return "The payment didn't go through. Nothing was taken. Please try again.";
}

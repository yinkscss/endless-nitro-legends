import { erc20Abi, type Address } from "viem";
import { publicClient } from "./chain";
import { RaceShopAbi } from "../contracts";
import { CAR_PRICES, LEVEL_PRICE, PACK_PRICE, PASS_PRICE } from "../game/cars";

/** viem's readContract, loose enough that a contract's own ABI type doesn't fight the call. */
const read = publicClient.readContract as unknown as <T>(call: {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}) => Promise<T>;

/** The shop prices everything in 18-decimal G$. */
const UNIT = BigInt(10) ** BigInt(18);

function whole(amount: bigint): number {
  return Number(amount / UNIT);
}

export type Payment = {
  /** What to send, in the token's smallest unit, straight from the shop. */
  amount: bigint;
  /** The same amount as whole G$, for wording. */
  gdAmount: number;
};

/**
 * Ask the deployed shop what it charges, so the app can never send a different amount than the
 * contract expects. Falls back to the app's own prices if the chain can't be read.
 */
export async function shopPayment(shop: Address, kind: 1 | 2 | 3 | 4, arg: number): Promise<Payment> {
  try {
    if (kind === 1) {
      const price = await read<bigint>({
        address: shop,
        abi: RaceShopAbi,
        functionName: "carPrice",
        args: [BigInt(arg)],
      });
      return { amount: price, gdAmount: whole(price) };
    }
    const name = kind === 2 ? "LEVEL_PRICE" : kind === 3 ? "PASS_PRICE" : "PACK_PRICE";
    const unit = await read<bigint>({ address: shop, abi: RaceShopAbi, functionName: name });
    const amount = kind === 2 ? unit * BigInt(Math.max(1, arg)) : unit;
    return { amount, gdAmount: whole(amount) };
  } catch {
    const gdAmount =
      kind === 1 ? CAR_PRICES[arg] ?? 0 : kind === 2 ? LEVEL_PRICE * Math.max(1, arg) : kind === 3 ? PASS_PRICE : PACK_PRICE;
    return { amount: BigInt(gdAmount) * UNIT, gdAmount };
  }
}

/** How much G$ the player has already let the shop take (ERC-20 allowance). */
export async function gdAllowance(gd: Address, owner: Address, spender: Address): Promise<bigint> {
  try {
    return await read<bigint>({ address: gd, abi: erc20Abi, functionName: "allowance", args: [owner, spender] });
  } catch {
    return BigInt(0);
  }
}

/** True when the player closed the wallet prompt: that is not a failure. */
export function isCancelled(e: unknown): boolean {
  const err = e as { code?: number; message?: string; shortMessage?: string } | undefined;
  if (err?.code === 4001) return true;
  return /cancel|reject|denied/i.test(String(err?.shortMessage ?? err?.message ?? ""));
}

/**
 * A garage payment failure in plain words: what happened, whether anything was taken, and what
 * to do next. `price` is the amount in whole G$, e.g. "150 G$".
 */
export function payProblem(e: unknown, price?: string): string {
  const raw = String((e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? e ?? "");
  const text = raw.toLowerCase();
  const nothing = " Nothing was taken.";
  if (isCancelled(e)) return "You cancelled the request in your wallet." + nothing;
  if (/insufficient funds|gas required|underpriced|gas \* price/.test(text)) {
    return "Your wallet doesn't have enough CELO to pay the small network fee for this." + nothing + " Keep a little CELO in the wallet and try again.";
  }
  if (/insufficient|exceeds balance|exceeds allowance|transfer amount/.test(text)) {
    return (
      "Not enough G$ for this" + (price ? ": it costs " + price : "") + ". Top up your G$ and try again." + nothing
    );
  }
  if (/alreadyowned|already owned/.test(text)) return "You already own this one. Try the Race this car button instead.";
  if (/alreadymaxlevel/.test(text)) return "Your score level is already maxed out.";
  if (/alreadyhaspass/.test(text)) return "You already have this season's pass.";
  if (/notgooddollar|baddata|unknowncar|zeroaddress/.test(text)) {
    return "The shop turned that payment down as it didn't match the price." + nothing + " Try approve and buy instead.";
  }
  if (/wrong network|chain mismatch|chainid|unsupported chain/.test(text)) {
    return "Your wallet is on a different network. Switch it to Celo and try again." + nothing;
  }
  if (/reverted|execution reverted/.test(text)) {
    return "The payment was reverted by the network." + nothing + " Try again, or use approve and buy.";
  }
  const short = raw.split("\n")[0].slice(0, 120);
  return "The payment didn't go through." + nothing + (short ? " " + short : "");
}

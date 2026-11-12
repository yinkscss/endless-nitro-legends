import { useRead } from "./hooks";
import { erc20Abi, type Address } from "viem";
import { RaceShopAbi, RaceShopAddress } from "../contracts";
import { chain, publicClient } from "./chain";
import { EMPTY_GARAGE, type Garage } from "../game/cars";

export type GarageState = {
  garage: Garage;
  /** The G$ token the shop takes, once the contract is deployed. */
  gd: Address | null;
  decimals: number;
  /** The player's G$ balance, in the token's smallest unit. */
  balance: bigint;
  shopAddress: Address | undefined;
};

type Tuple = readonly [bigint, bigint, boolean, bigint, bigint, bigint];

/** viem's readContract, loose enough that a contract's own ABI type doesn't fight the call. */
const read = publicClient.readContract as unknown as <T>(call: {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}) => Promise<T>;

/**
 * The player's garage from the RaceShop contract: cars, level, season pass, power packs, plus the
 * G$ balance and decimals. When the shop isn't deployed yet it gives an empty garage and no calls.
 */
export function useGarage(account?: Address | null) {
  const shopAddress = RaceShopAddress[chain.id] as Address | undefined;
  const enabled = Boolean(shopAddress && account);

  const result = useRead<GarageState>(async () => {
    if (!shopAddress || !account) throw new Error("No shop");
    const [g, gd] = await Promise.all([
      read<Tuple>({ address: shopAddress, abi: RaceShopAbi, functionName: "garageOf", args: [account] }),
      read<Address>({ address: shopAddress, abi: RaceShopAbi, functionName: "gd" }),
    ]);
    const [decimals, balance] = await Promise.all([
      read<number>({ address: gd, abi: erc20Abi, functionName: "decimals" }),
      read<bigint>({ address: gd, abi: erc20Abi, functionName: "balanceOf", args: [account] }),
    ]);
    const garage: Garage = {
      level: Number(g[0]),
      cars: Number(g[1]),
      hasPass: Boolean(g[2]),
      spent: g[3],
      season: Number(g[4]),
      packs: Number(g[5]),
    };
    return { garage, gd, decimals: Number(decimals), balance, shopAddress };
  }, [shopAddress, account], enabled);

  return {
    ...result,
    shopAddress,
    garage: result.data?.garage ?? EMPTY_GARAGE,
    gd: result.data?.gd ?? null,
    balance: result.data?.balance ?? BigInt(0),
    decimals: result.data?.decimals ?? 18,
    ready: enabled,
    loading: enabled ? result.loading : false,
  };
}

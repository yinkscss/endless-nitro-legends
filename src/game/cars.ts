import type { Address } from "viem";

/** The G$ amounts the shop charges, in whole G$. Keep in step with contracts/RaceShop.sol. */
export const LEVEL_PRICE = 60;
export const PACK_PRICE = 30;
export const PASS_PRICE = 200;
export const CAR_PRICES = [0, 0, 150, 350, 700, 1200, 2000];

export type CarSprite = {
  /** Body colour. */
  body: string;
  /** Roof and window colour. */
  glass: string;
  /** Trim / stripe colour. */
  trim: string;
};

export type CarInfo = {
  id: number;
  name: string;
  blurb: string;
  price: number;
  /** Top speed the car adds, in game units per second. */
  speed: number;
  /** How quickly the car moves between lanes, as a multiplier. */
  handling: number;
  sprite: CarSprite;
};

/** Car 1 is free for everyone. The rest are bought with G$ in the garage. */
export const CARS: CarInfo[] = [
  {
    id: 1,
    name: "Berry Bolt",
    blurb: "The starter hatch. Skinny, honest, free.",
    price: 0,
    speed: 0,
    handling: 1,
    sprite: { body: "#BE185D", glass: "#FBCFE8", trim: "#FFF8FB" },
  },
  {
    id: 2,
    name: "Night Shift",
    blurb: "A low-slung coupe that slips through traffic.",
    price: 150,
    speed: 55,
    handling: 1.12,
    sprite: { body: "#1F2937", glass: "#93C5FD", trim: "#F59E0B" },
  },
  {
    id: 3,
    name: "Mint Missile",
    blurb: "Quick off the line, quicker between lanes.",
    price: 350,
    speed: 100,
    handling: 1.2,
    sprite: { body: "#0F766E", glass: "#99F6E4", trim: "#FEF08A" },
  },
  {
    id: 4,
    name: "Sunset Run",
    blurb: "Wide body, warm paint, mean top end.",
    price: 700,
    speed: 150,
    handling: 1.28,
    sprite: { body: "#EA580C", glass: "#FED7AA", trim: "#7C2D12" },
  },
  {
    id: 5,
    name: "Purple Haze",
    blurb: "Tuned for the long straights.",
    price: 1200,
    speed: 210,
    handling: 1.36,
    sprite: { body: "#5B21B6", glass: "#DDD6FE", trim: "#FDE68A" },
  },
  {
    id: 6,
    name: "Crown Jewel",
    blurb: "The garage's top car, and it knows it.",
    price: 2000,
    speed: 280,
    handling: 1.45,
    sprite: { body: "#111827", glass: "#FDE68A", trim: "#BE185D" },
  },
];

export function carById(id: number): CarInfo {
  return CARS.find((c) => c.id === id) ?? CARS[0];
}

/** The player's garage, as the shop reports it. */
export type Garage = {
  level: number;
  cars: number;
  hasPass: boolean;
  spent: bigint;
  season: number;
  packs: number;
};

export const EMPTY_GARAGE: Garage = { level: 0, cars: 0, hasPass: false, spent: BigInt(0), season: 1, packs: 0 };

/** Turn the shop's bit set of cars into ids, always including the free starter car. */
export function ownedCarIds(cars: number | bigint): number[] {
  const bits = Number(cars);
  const ids = CARS.filter((c) => c.id === 1 || (bits & (1 << c.id)) !== 0).map((c) => c.id);
  return ids;
}

/** The data the one-step G$.transferAndCall sends: kind 1 car, 2 level ups, 3 season pass. */
export function shopCallData(kind: 1 | 2 | 3 | 4, arg: number): `0x${string}` {
  return ("0x" +
    kind.toString(16).padStart(64, "0") +
    arg.toString(16).padStart(64, "0")) as `0x${string}`;
}

export type { Address };

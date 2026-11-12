import { useState } from "react";
import { Check, Loader2, Lock, RotateCcw, Sparkles, Ticket, Zap } from "lucide-react";
import { erc20Abi } from "viem";
import { useWallet } from "../lib/useWallet";
import { writeContract } from "../lib/chain";
import { useGarage } from "../lib/useGarage";
import { RaceShopAbi } from "../contracts";
import { gdTokenAbi } from "../lib/tokens";
import { CARS, LEVEL_PRICE, PACK_PRICE, PASS_PRICE, ownedCarIds, shopCallData, type CarInfo } from "../game/cars";
import { formatAmount } from "../lib/format";
import { gdAllowance, isCancelled, payProblem, shopPayment } from "../lib/payment";
import { selectedCar, setSelectedCar } from "../lib/playStore";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Notice } from "../components/ui/notice";
import { Skeleton } from "../components/ui/skeleton";
import { ConnectButton } from "../components/ConnectButton";
import { CarArt } from "../components/CarArt";

/** A shop purchase: kind 1 car, 2 level ups, 3 season pass, 4 power pack. */
type Buy = { kind: 1 | 2 | 3 | 4; arg: number; label: string; price: number };

export default function GaragePage() {
  const { account } = useWallet();
  const { garage, gd, decimals, balance, shopAddress, loading, error, refresh } = useGarage(account);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [failed, setFailed] = useState<Buy | null>(null);
  const [pick, setPick] = useState(selectedCar);
  const owned = ownedCarIds(garage.cars);

  function clear() {
    setDone(null);
    setProblem(null);
    setFailed(null);
  }

  /** The shop's own price in G$'s smallest unit, plus the player's token decimals. */
  async function priceOf(buy: Buy) {
    if (!shopAddress) throw new Error("The garage shop isn't deployed yet.");
    const p = await shopPayment(shopAddress, buy.kind, buy.arg);
    return { amount: p.amount, label: p.gdAmount + " G$" };
  }

  async function pay(buy: Buy) {
    if (!account || !gd || !shopAddress) {
      setProblem("Connect a wallet and make sure the garage shop is loaded, then try again.");
      return;
    }
    clear();
    setBusy(true);
    setPending(buy.label);
    try {
      const price = await priceOf(buy);
      if (balance < price.amount) {
        setProblem(
          "Not enough G$ for this one. It costs " +
            price.label +
            " and your wallet has " +
            formatAmount(balance, decimals) +
            " G$. Nothing was taken.",
        );
        return;
      }
      await writeContract({
        address: gd,
        abi: gdTokenAbi,
        functionName: "transferAndCall",
        args: [shopAddress, price.amount, shopCallData(buy.kind, buy.arg)],
      });
      succeed(buy, price.label);
    } catch (e) {
      if (isCancelled(e)) {
        setProblem("You cancelled the request in your wallet. Nothing was taken.");
        setFailed(buy);
        return;
      }
      setProblem(payProblem(e, buy.price + " G$"));
      setFailed(buy);
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  /** Approval and purchase as two separate confirmations, for wallets that refuse the one-step call. */
  async function payTwoSteps(buy: Buy) {
    if (!account || !gd || !shopAddress) return;
    setBusy(true);
    setPending(buy.label + " (approve and buy)");
    setProblem(null);
    try {
      const price = await priceOf(buy);
      if (balance < price.amount) {
        setProblem("Not enough G$ for this one. It costs " + price.label + ". Nothing was taken.");
        return;
      }
      const allowed = await gdAllowance(gd, account, shopAddress);
      if (allowed < price.amount) {
        await writeContract({ address: gd, abi: erc20Abi, functionName: "approve", args: [shopAddress, price.amount] });
      }
      const fn = buy.kind === 1 ? "buyCar" : buy.kind === 2 ? "buyLevels" : buy.kind === 3 ? "buyPass" : "buyPack";
      const args = buy.kind === 1 || buy.kind === 2 ? [BigInt(buy.arg)] : [];
      await writeContract({ address: shopAddress, abi: RaceShopAbi, functionName: fn, args });
      succeed(buy, price.label);
    } catch (e) {
      setProblem(payProblem(e, buy.price + " G$"));
      setFailed(buy);
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  function succeed(buy: Buy, priceLabel: string) {
    setDone(buy.label + " is yours for " + priceLabel + ".");
    setProblem(null);
    setFailed(null);
    void refresh();
  }

  const noShop = !shopAddress;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-end justify-between pt-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Your G$</p>
            {loading ? (
              <Skeleton className="mt-1 h-8 w-28" />
            ) : (
              <p className="font-display text-3xl font-semibold tabular-nums">{formatAmount(balance, decimals)}</p>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Season {garage.season}</p>
            <p>Level {garage.level} / 10</p>
            <p>Power packs {garage.packs}</p>
          </div>
        </CardContent>
      </Card>

      {noShop && (
        <Notice tone="warning">
          The garage shop isn't deployed yet. Everything below stays locked until the contract is live.
        </Notice>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      {!account && (
        <Notice tone="info">
          <div className="flex flex-col gap-2">
            <span>
              You can race for free with the Berry Bolt, no wallet needed. Connect one to see what you already own and buy
              cars or upgrades with G$.
            </span>
            <ConnectButton />
          </div>
        </Notice>
      )}
      {done && <Notice tone="success">{done}</Notice>}
      {problem && (
        <Notice tone="danger">
          <div className="space-y-2">
            <p>{problem}</p>
            <p className="text-[11px] opacity-80">
              G$ payments on Celo also need a few cents of CELO in the wallet for the network fee.
            </p>
            <div className="flex flex-wrap gap-2">
              {failed && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void pay(failed)}>
                  <RotateCcw className="size-3.5" /> Try again
                </Button>
              )}
              {failed && (
                <Button size="sm" variant="accent" disabled={busy} onClick={() => void payTwoSteps(failed)}>
                  Approve and buy {failed.label}
                </Button>
              )}
            </div>
          </div>
        </Notice>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-4 text-accent" /> Level ups
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Every level adds 10% to your score. Level {Math.min(garage.level + 1, 10)} costs {LEVEL_PRICE} G$.
          </p>
          <Button
            className="w-full"
            disabled={!account || noShop || busy || garage.level >= 10}
            onClick={() => void pay({ kind: 2, arg: 1, label: "Level " + (garage.level + 1), price: LEVEL_PRICE })}
          >
            {pending?.startsWith("Level") ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            {garage.level >= 10 ? "Max level reached" : "Buy level · " + LEVEL_PRICE + " G$"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="size-4 text-accent" /> Season pass
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {garage.hasPass ? (
            <Notice tone="success">Active for season {garage.season}. +25% score until the season ends.</Notice>
          ) : (
            <p className="text-sm text-muted-foreground">
              +25% score on every run for the rest of season {garage.season}, plus your name marked on the board.
            </p>
          )}
          <Button
            className="w-full"
            variant={garage.hasPass ? "outline" : "accent"}
            disabled={!account || noShop || busy || garage.hasPass}
            onClick={() => void pay({ kind: 3, arg: 0, label: "Season pass", price: PASS_PRICE })}
          >
            {garage.hasPass ? "You have this season's pass" : "Buy season pass · " + PASS_PRICE + " G$"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" /> Power packs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            A pack starts one run with boost, shield and magnet all on. You have {garage.packs}.
          </p>
          <Button
            className="w-full"
            variant="outline"
            disabled={!account || noShop || busy}
            onClick={() => void pay({ kind: 4, arg: 0, label: "Power pack", price: PACK_PRICE })}
          >
            Buy a power pack · {PACK_PRICE} G$
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="px-1 font-display text-lg font-semibold">Cars</h2>
        <div className="grid grid-cols-2 gap-3">
          {CARS.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              owned={owned.includes(car.id)}
              picked={pick === car.id}
              busy={busy}
              canBuy={Boolean(account && shopAddress)}
              onPick={() => {
                setPick(car.id);
                setSelectedCar(car.id);
              }}
              onBuy={() => void pay({ kind: 1, arg: car.id, label: car.name, price: car.price })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export function CarCard({
  car,
  owned,
  picked,
  busy,
  canBuy,
  onPick,
  onBuy,
}: {
  car: CarInfo;
  owned: boolean;
  picked: boolean;
  busy: boolean;
  canBuy: boolean;
  onPick: () => void;
  onBuy: () => void;
}) {
  return (
    <div className={"rounded-lg border bg-card p-3 shadow-sm " + (picked ? "border-accent ring-1 ring-accent/40" : "border-border")}>
      <div className="relative mb-2 flex h-28 items-center justify-center rounded-md bg-muted">
        <CarArt car={car} locked={!owned} title={car.name} className="h-24" />
        <span className="absolute left-2 top-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Car {car.id}
        </span>
        {!owned && (
          <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-card text-muted-foreground shadow-sm">
            <Lock className="size-3.5" />
          </span>
        )}
      </div>
      <p className="text-sm font-semibold leading-tight">{car.name}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{car.blurb}</p>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>+{car.speed} speed</span>
        {owned ? <Badge tone="success">Owned</Badge> : <span className="font-medium text-foreground">{car.price} G$</span>}
      </div>
      <div className="mt-2">
        {owned ? (
          <Button size="sm" variant={picked ? "default" : "outline"} className="w-full" onClick={onPick} disabled={picked}>
            {picked ? (
              <>
                <Check className="size-3.5" /> Racing
              </>
            ) : (
              "Race this car"
            )}
          </Button>
        ) : (
          <Button size="sm" variant="accent" className="w-full" onClick={onBuy} disabled={!canBuy || busy}>
            Buy · {car.price} G$
          </Button>
        )}
      </div>
    </div>
  );
}

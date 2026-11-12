import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Gauge, Info, Play, Sparkles } from "lucide-react";
import { GameCanvas, type Frame } from "../game/GameCanvas";
import { Particles, Popups, Shake } from "../game/juice";
import { sfx } from "../game/sound";
import { GAME_W, GAME_H, POWER_INFO, createRacer, drawRacer, drawShowroom, scoreOf, stepRacer, type PowerKind, type Racer } from "../game/racer";
import { carById, ownedCarIds } from "../game/cars";
import { bestScore, racerName, saveBestScore, saveRacerName, selectedCar } from "../lib/playStore";
import { guestName } from "../lib/board";
import { useGarage } from "../lib/useGarage";
import { useHighScores } from "../lib/useHighScores";
import { useWallet } from "../lib/useWallet";
import { useTx } from "../lib/hooks";
import { writeContract } from "../lib/chain";
import { RaceShopAbi } from "../contracts";
import { shortAddress } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Notice } from "../components/ui/notice";
import { CarArt } from "../components/CarArt";
import { GameOverPanel } from "../components/GameOverPanel";

type Screen = "start" | "playing" | "over";

export default function RacePage() {
  const { account } = useWallet();
  const { garage, loading, shopAddress, refresh } = useGarage(account);
  const board = useHighScores(10);
  const packTx = useTx();

  const [screen, setScreen] = useState<Screen>("start");
  const [finalScore, setFinalScore] = useState(0);
  const [best, setBest] = useState(bestScore);
  const [newBest, setNewBest] = useState(false);
  const [posted, setPosted] = useState(false);
  const [postedAs, setPostedAs] = useState<string | null>(null);
  const [usePack, setUsePack] = useState(false);
  const [carId, setCarId] = useState(selectedCar);
  const [name, setName] = useState(() => racerName() || (account ? shortAddress(account) : guestName()));

  const owned = ownedCarIds(garage.cars);
  const activeCar = carById(owned.includes(carId) ? carId : 1);
  const racer = useRef<Racer | null>(null);
  const particles = useRef(new Particles());
  const shake = useRef(new Shake());
  const popups = useRef(new Popups());
  const screenRef = useRef<Screen>("start");
  screenRef.current = screen;
  const finishing = useRef(false);
  /** Set to the real play() below, so a tap on the game itself can start a race. */
  const startRef = useRef<() => void>(() => {});

  const hooks = useMemo(
    () => ({
      coin: (x: number, y: number) => {
        sfx.coin();
        particles.current.burst(x, y, { color: "#FDE68A", count: 10, speed: 130 });
        popups.current.add(x, y - 12, "+14", "#FDE68A");
      },
      power: (kind: PowerKind, x: number, y: number) => {
        sfx.jump();
        particles.current.burst(x, y, { color: POWER_INFO[kind].color, count: 18, speed: 200 });
        popups.current.add(x, y - 20, POWER_INFO[kind].label.toUpperCase() + "!", POWER_INFO[kind].color);
      },
      crash: (x: number, y: number) => {
        sfx.hit();
        shake.current.hit(14, 0.4);
        particles.current.burst(x, y, { color: "#F87171", count: 26, speed: 260, size: 5 });
      },
      block: (x: number, y: number) => {
        sfx.tap();
        shake.current.hit(6, 0.2);
        particles.current.burst(x, y, { color: "#7DD3FC", count: 14, speed: 200 });
        popups.current.add(x, y - 10, "BLOCKED", "#7DD3FC");
      },
    }),
    [],
  );

  const finish = useCallback((score: number) => {
    if (finishing.current) return;
    finishing.current = true;
    setFinalScore(score);
    setScreen("over");
    sfx.lose();
    setNewBest(saveBestScore(score));
    setBest(bestScore());
  }, []);

  const post = useCallback(
    async (racerNameInput: string) => {
      const value = await board.post(racerNameInput, { score: finalScore, car: activeCar.id, level: garage.level });
      saveRacerName(value.racer);
      setPostedAs(value.racer);
      setPosted(true);
    },
    [board, finalScore, activeCar.id, garage.level],
  );

  const play = useCallback(async () => {
    let powerPack = false;
    if (usePack && account && shopAddress && garage.packs > 0) {
      const receipt = await packTx.run(() =>
        writeContract({ address: shopAddress, abi: RaceShopAbi, functionName: "usePowerPack" }),
      );
      if (!receipt) return;
      powerPack = true;
      setUsePack(false);
      void refresh();
    }
    const r = createRacer(activeCar.id, garage.level, garage.hasPass);
    if (powerPack) r.boost = r.shield = r.magnet = 8;
    racer.current = r;
    particles.current = new Particles();
    shake.current = new Shake();
    popups.current = new Popups();
    finishing.current = false;
    setPosted(false);
    setPostedAs(null);
    setFinalScore(0);
    setScreen("playing");
    sfx.tap();
  }, [activeCar.id, account, garage.hasPass, garage.level, garage.packs, packTx, refresh, shopAddress, usePack]);

  const onFrame = useCallback(
    (frame: Frame) => {
      const { ctx, dt } = frame;
      shake.current.update(dt);
      ctx.save();
      shake.current.apply(ctx);
      const r = racer.current;
      if (!r || screenRef.current === "start") {
        drawShowroom(ctx, activeCar.id, frame.time);
        // A tap on the road, or Space/Enter, starts the race just like the button.
        if (frame.input.actionPressed) startRef.current();
      } else {
        if (screenRef.current === "playing") stepRacer(r, frame, hooks);
        drawRacer(ctx, r, frame.time);
      }
      particles.current.update(dt);
      particles.current.draw(ctx);
      popups.current.update(dt);
      popups.current.draw(ctx, "bold 15px Inter, system-ui, sans-serif");
      ctx.restore();
      if (r && r.over && screenRef.current === "playing") finish(scoreOf(r));
    },
    [activeCar.id, finish, hooks],
  );

  startRef.current = () => {
    if (screenRef.current === "start" && !packTx.pending) void play();
  };

  return (
    <div className="space-y-4">
      <GameCanvas
        width={GAME_W}
        height={GAME_H}
        onFrame={onFrame}
        label="Neon Drift endless racer"
        style={{ backgroundColor: "#2A0F1E", borderRadius: 12 }}
        overlay={
          screen === "over" ? (
            <GameOverPanel
              score={finalScore}
              best={best}
              newBest={newBest}
              name={name}
              onName={setName}
              onPost={post}
              posted={posted}
              postedAs={postedAs}
              onRaceAgain={() => void play()}
              starting={packTx.pending}
            />
          ) : null
        }
      />

      {screen === "playing" && (
        <p className="text-center text-xs text-muted-foreground">Tap the left or right of the road to switch lanes. Dodge traffic coming the other way, grab coins and power ups.</p>
      )}

      {screen === "start" && (
        <div className="space-y-3">
          <Card>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-24 w-16 shrink-0 place-items-center rounded-lg bg-muted">
                    <CarArt car={activeCar} title={activeCar.name} className="h-20 w-12" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Your car</p>
                    <p className="font-display text-lg font-semibold leading-tight">{activeCar.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">+{activeCar.speed} speed · {activeCar.handling.toFixed(2)}x handling</p>
                  </div>
                </div>
                <Badge tone={garage.level > 0 ? "success" : "default"}>Level {garage.level}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Tap left or right of the road to switch lanes. Your score climbs with every metre; traffic and oncoming cars come faster the further you go.
              </p>
              <Button size="lg" variant="accent" className="w-full" onClick={() => void play()} disabled={packTx.pending}>
                <Play className="size-4" />
                {packTx.pending ? "Starting…" : "Start race"}
              </Button>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="size-3.5 shrink-0 text-accent" /> Free play: race and post a score without a wallet. A wallet adds cars, levels and the season pass.
              </p>
              {shopAddress && account && garage.packs > 0 && (
                <label className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border px-3 text-sm">
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-4 text-accent" /> Start with all power ups
                  </span>
                  <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={usePack} onChange={(e) => setUsePack(e.target.checked)} />
                </label>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Best on this phone: <span className="font-semibold text-foreground tabular-nums">{best.toLocaleString()}</span></span>
                <Link to="/garage" className="inline-flex min-h-11 items-center gap-1 text-accent underline-offset-2 hover:underline">
                  <Gauge className="size-4" /> Garage
                </Link>
              </div>
              {garage.hasPass && <Notice tone="success">Season {garage.season} pass active: +25% score on every run.</Notice>}
              {packTx.error && <Notice tone="danger">{packTx.error}</Notice>}
            </CardContent>
          </Card>
          <RaceTips />
        </div>
      )}

      {screen === "over" && (
        <div className="space-y-3">
          <p className="text-center text-xs text-muted-foreground">
            Score is distance plus coins, multiplied by your level{garage.hasPass ? " and season pass" : ""}.
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Best on this phone: <span className="font-semibold text-foreground tabular-nums">{best.toLocaleString()}</span>
            {loading ? " · reading your garage…" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function RaceTips() {
  return (
    <div className="grid grid-cols-3 gap-2 text-center text-xs">
      {(["boost", "shield", "magnet"] as PowerKind[]).map((kind) => (
        <div key={kind} className="rounded-lg border border-border bg-card px-2 py-3">
          <p className="text-lg" aria-hidden>{POWER_INFO[kind].icon}</p>
          <p className="font-medium">{POWER_INFO[kind].label}</p>
          <p className="text-muted-foreground">{kind === "boost" ? "Sprint ahead" : kind === "shield" ? "Smash one hit" : "Pull in coins"}</p>
        </div>
      ))}
    </div>
  );
}

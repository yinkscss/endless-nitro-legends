// The endless racer: four lanes, traffic, coins and three power ups. Everything lives in a plain
// object that the canvas updates about 60 times a second, so React never re-renders while playing.
import type { Frame } from "./GameCanvas";
import { carById } from "./cars";
import { clamp } from "./juice";

export const GAME_W = 360;
export const GAME_H = 640;
export const LANE_X = [67, 142, 217, 292];
const PLAYER_Y = 498;
const CAR_W = 38;
const CAR_H = 64;

export type PowerKind = "boost" | "shield" | "magnet";

export const POWER_INFO: Record<PowerKind, { icon: string; color: string; seconds: number; label: string }> = {
  boost: { icon: "⚡", color: "#FDE68A", seconds: 5, label: "Boost" },
  shield: { icon: "🛡", color: "#7DD3FC", seconds: 6, label: "Shield" },
  magnet: { icon: "🧲", color: "#F9A8D4", seconds: 6, label: "Magnet" },
};

export type RacerHooks = {
  coin: (x: number, y: number) => void;
  power: (kind: PowerKind, x: number, y: number) => void;
  crash: (x: number, y: number) => void;
  block: (x: number, y: number) => void;
};

type Obstacle = { on: boolean; x: number; y: number; w: number; h: number; kind: number; color: string; own: number };
type Coin = { on: boolean; x: number; y: number };
type Pickup = { on: boolean; x: number; y: number; kind: PowerKind };

export type Racer = {
  carId: number;
  level: number;
  pass: boolean;
  mult: number;
  lane: number;
  x: number;
  speed: number;
  distance: number;
  bonus: number;
  boost: number;
  shield: number;
  magnet: number;
  grace: number;
  spawnIn: number;
  coinIn: number;
  pickupIn: number;
  over: boolean;
  obstacles: Obstacle[];
  coins: Coin[];
  pickups: Pickup[];
  prevLeft: boolean;
  prevRight: boolean;
  prevDown: boolean;
};

const TRAFFIC = ["#F472B6", "#38BDF8", "#FBBF24", "#4ADE80", "#C084FC", "#FB923C"];
/** Cars coming the other way: colder, brighter paint so they read at a glance. */
const ONCOMING_CARS = ["#E2E8F0", "#93C5FD", "#FCA5A5", "#FCD34D"];
/** How far the player must drive before traffic starts coming the other way. */
const ONCOMING_FROM = 350;

export function createRacer(carId: number, level: number, pass: boolean): Racer {
  const obstacles: Obstacle[] = [];
  for (let i = 0; i < 14; i++) obstacles.push({ on: false, x: 0, y: 0, w: 36, h: 62, kind: 0, color: TRAFFIC[0], own: 150 });
  const coins: Coin[] = [];
  for (let i = 0; i < 40; i++) coins.push({ on: false, x: 0, y: 0 });
  const pickups: Pickup[] = [];
  for (let i = 0; i < 4; i++) pickups.push({ on: false, x: 0, y: 0, kind: "boost" });
  return {
    carId,
    level,
    pass,
    mult: 1 + level * 0.1 + (pass ? 0.25 : 0),
    lane: 1,
    x: LANE_X[1],
    speed: 0,
    distance: 0,
    bonus: 0,
    boost: 0,
    shield: 0,
    magnet: 0,
    grace: 1.4,
    spawnIn: 0.8,
    coinIn: 1.2,
    pickupIn: 6,
    over: false,
    obstacles,
    coins,
    pickups,
    prevLeft: false,
    prevRight: false,
    prevDown: false,
  };
}

/**
 * A still, quietly scrolling road with the chosen car sitting on it: what the game shows before a
 * run starts, so the player always sees their car.
 */
export function drawShowroom(ctx: CanvasRenderingContext2D, carId: number, time: number) {
  const car = carById(carId);
  const scroll = (time * 90) % 80;
  ctx.fillStyle = "#2A0F1E";
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.fillStyle = "#191C25";
  ctx.fillRect(22, 0, GAME_W - 44, GAME_H);
  ctx.fillStyle = "#333A4D";
  for (let i = -1; i < GAME_H / 80 + 2; i++) {
    const y = i * 80 + scroll;
    for (const x of [104, 180, 256]) ctx.fillRect(x - 2, y, 4, 40);
  }
  ctx.fillStyle = "#F9A8D4";
  ctx.fillRect(26, 0, 3, GAME_H);
  ctx.fillRect(GAME_W - 29, 0, 3, GAME_H);

  // A soft pool of light under the car.
  const gradient = ctx.createRadialGradient(GAME_W / 2, PLAYER_Y, 10, GAME_W / 2, PLAYER_Y, 150);
  gradient.addColorStop(0, "rgba(190,24,93,0.42)");
  gradient.addColorStop(1, "rgba(190,24,93,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, PLAYER_Y - 160, GAME_W, 320);

  const bob = Math.sin(time * 2.2) * 3;
  const x = GAME_W / 2;
  const y = PLAYER_Y + bob;
  const top = y - CAR_H / 2;
  ctx.fillStyle = "#0B0D12";
  ctx.beginPath();
  ctx.roundRect(x - CAR_W / 2 - 3, top + 8, CAR_W + 6, 14, 3);
  ctx.roundRect(x - CAR_W / 2 - 3, top + CAR_H - 24, CAR_W + 6, 14, 3);
  ctx.fill();
  ctx.fillStyle = car.sprite.body;
  ctx.beginPath();
  ctx.roundRect(x - CAR_W / 2, top, CAR_W, CAR_H, 9);
  ctx.fill();
  ctx.fillStyle = car.sprite.trim;
  ctx.fillRect(x - CAR_W / 2 + 4, top + CAR_H * 0.46, CAR_W - 8, 4);
  ctx.fillStyle = car.sprite.glass;
  ctx.beginPath();
  ctx.roundRect(x - CAR_W / 2 + 6, top + 8, CAR_W - 12, 14, 4);
  ctx.roundRect(x - CAR_W / 2 + 6, top + CAR_H - 26, CAR_W - 12, 12, 4);
  ctx.fill();
  ctx.fillStyle = "#FEF9C3";
  ctx.fillRect(x - CAR_W / 2 + 4, top + 1, 7, 4);
  ctx.fillRect(x + CAR_W / 2 - 11, top + 1, 7, 4);

  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 20px Inter, system-ui, sans-serif";
  ctx.fillText(car.name, GAME_W / 2, 96);
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "600 11px Inter, system-ui, sans-serif";
  ctx.fillText("READY TO RACE", GAME_W / 2, 116);
  const pulse = 0.5 + Math.sin(time * 3) * 0.25;
  ctx.fillStyle = "rgba(255,255,255," + pulse.toFixed(2) + ")";
  ctx.font = "700 12px Inter, system-ui, sans-serif";
  ctx.fillText("TAP TO START", GAME_W / 2, GAME_H - 40);
  ctx.textAlign = "start";
}

/** The score the board records: distance and coins, times the player's bought bonuses. */
export function scoreOf(r: Racer) {
  return Math.floor((r.distance * 0.9 + r.bonus) * r.mult);
}

const laneBusy = (r: Racer, lane: number) => r.obstacles.some((o) => o.on && Math.abs(o.x - LANE_X[lane]) < 10 && o.y < 320);

function spawnRow(r: Racer) {
  const free = [0, 1, 2, 3].filter((l) => !laneBusy(r, l));
  if (free.length <= 2) return;
  const want = free.length === 4 && Math.random() < 0.4 ? 2 : 1;
  const picked: number[] = [];
  for (let i = 0; i < want; i++) {
    let lane = free[(Math.random() * free.length) | 0];
    let guard = 0;
    while (picked.indexOf(lane) !== -1 && guard++ < 8) lane = free[(Math.random() * free.length) | 0];
    picked.push(lane);
  }
  for (const lane of picked) {
    const o = r.obstacles.find((item) => !item.on);
    if (!o) return;
    // A car in the opposite lane, rushing toward the player. Only one at a time, so it stays fair.
    const alreadyOncoming = r.obstacles.some((item) => item.on && item.kind === 3);
    const oncomingChance = Math.min(0.4, Math.max(0.05, (r.distance - ONCOMING_FROM) / 6000));
    if (!alreadyOncoming && r.distance > ONCOMING_FROM && Math.random() < oncomingChance) {
      o.kind = 3;
      o.w = 36;
      o.h = 66;
      // A negative own speed makes it close on the player instead of drifting away.
      o.own = -(170 + Math.random() * 150);
      o.color = ONCOMING_CARS[(Math.random() * ONCOMING_CARS.length) | 0];
      o.x = LANE_X[lane];
      o.y = -o.h / 2 - 10;
      o.on = true;
      continue;
    }
    const truck = r.distance > 1400 && Math.random() < 0.2;
    const barrel = !truck && Math.random() < 0.3;
    o.kind = truck ? 2 : barrel ? 1 : 0;
    o.w = truck ? 40 : barrel ? 30 : 36;
    o.h = truck ? 96 : barrel ? 30 : 62;
    o.x = LANE_X[lane];
    o.y = -o.h / 2 - 10;
    o.own = 80 + Math.random() * 130;
    o.color = TRAFFIC[(Math.random() * TRAFFIC.length) | 0];
    o.on = true;
  }
}

/** One frame of play: steer, move everything, collect, collide. */
export function stepRacer(r: Racer, frame: Frame, hooks: RacerHooks) {
  const { input, dt } = frame;
  const car = carById(r.carId);

  const left = input.left && !r.prevLeft;
  const right = input.right && !r.prevRight;
  const tap = input.pointer.down && !r.prevDown;
  r.prevLeft = input.left;
  r.prevRight = input.right;
  r.prevDown = input.pointer.down;
  if (left || (tap && input.pointer.x < GAME_W / 2)) r.lane = Math.max(0, r.lane - 1);
  else if (right || (tap && input.pointer.x >= GAME_W / 2)) r.lane = Math.min(3, r.lane + 1);
  r.x += (LANE_X[r.lane] - r.x) * Math.min(1, 13 * car.handling * dt);

  const base = 250 + car.speed + r.level * 12 + Math.min(r.distance * 0.045, 260);
  const target = r.boost > 0 ? base * 1.45 : base;
  r.speed += (target - r.speed) * Math.min(1, 2.6 * dt);
  r.distance += r.speed * dt;
  r.grace = Math.max(0, r.grace - dt);
  r.boost = Math.max(0, r.boost - dt);
  r.shield = Math.max(0, r.shield - dt);
  r.magnet = Math.max(0, r.magnet - dt);

  r.spawnIn -= dt;
  if (r.spawnIn <= 0 && r.grace <= 0) {
    r.spawnIn = Math.max(0.36, 1.05 - r.distance / 9000) * (0.85 + Math.random() * 0.4);
    spawnRow(r);
  }

  r.coinIn -= dt;
  if (r.coinIn <= 0) {
    r.coinIn = 2.2 + Math.random() * 2.6;
    let lane = (Math.random() * 4) | 0;
    if (laneBusy(r, lane)) lane = (lane + 2) % 4;
    let placed = 0;
    const want = 3 + ((Math.random() * 3) | 0);
    for (const c of r.coins) {
      if (placed >= want) break;
      if (c.on) continue;
      c.on = true;
      c.x = LANE_X[lane];
      c.y = -40 - placed * 48;
      placed++;
    }
  }

  r.pickupIn -= dt;
  if (r.pickupIn <= 0 && r.grace <= 0) {
    r.pickupIn = 7 + Math.random() * 5;
    const p = r.pickups.find((item) => !item.on);
    if (p) {
      p.on = true;
      p.kind = (["boost", "shield", "magnet"] as PowerKind[])[(Math.random() * 3) | 0];
      p.x = LANE_X[(Math.random() * 4) | 0];
      p.y = -50;
    }
  }

  const px = r.x;
  const phw = CAR_W * 0.36;
  const phh = CAR_H * 0.42;

  for (const o of r.obstacles) {
    if (!o.on) continue;
    o.y += (r.speed - o.own) * dt;
    if (o.y > GAME_H + 80) {
      o.on = false;
      continue;
    }
    if (r.over) continue;
    if (Math.abs(o.x - px) < phw + o.w * 0.4 && Math.abs(o.y - PLAYER_Y) < phh + o.h * 0.4) {
      if (r.shield > 0) {
        o.on = false;
        r.bonus += 15;
        hooks.block(o.x, o.y);
      } else {
        r.over = true;
        hooks.crash(px, PLAYER_Y);
      }
    }
  }

  for (const c of r.coins) {
    if (!c.on) continue;
    c.y += r.speed * dt;
    if (r.magnet > 0 && c.y > 100 && c.y < PLAYER_Y) c.x += (px - c.x) * Math.min(1, 4.5 * dt);
    if (c.y > GAME_H + 40) {
      c.on = false;
      continue;
    }
    if (r.over) continue;
    if (Math.abs(c.x - px) < phw + 14 && Math.abs(c.y - PLAYER_Y) < phh + 16) {
      c.on = false;
      r.bonus += 14;
      hooks.coin(c.x, c.y);
    }
  }

  for (const p of r.pickups) {
    if (!p.on) continue;
    p.y += r.speed * dt;
    if (p.y > GAME_H + 40) {
      p.on = false;
      continue;
    }
    if (r.over) continue;
    if (Math.abs(p.x - px) < phw + 18 && Math.abs(p.y - PLAYER_Y) < phh + 18) {
      p.on = false;
      r[p.kind] = Math.max(r[p.kind], POWER_INFO[p.kind].seconds);
      r.bonus += 20;
      hooks.power(p.kind, p.x, p.y);
    }
  }
}

export function drawRacer(ctx: CanvasRenderingContext2D, r: Racer, time: number) {
  ctx.fillStyle = "#0B0D12";
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  // Rumple strips, then the road.
  const scroll = (r.distance * 0.9) % 64;
  ctx.fillStyle = "#2A0F1E";
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  for (let i = -1; i < GAME_H / 64 + 2; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#BE185D" : "#4A1030";
    const y = i * 64 + scroll;
    ctx.fillRect(6, y, 12, 56);
    ctx.fillRect(GAME_W - 18, y, 12, 56);
  }
  ctx.fillStyle = "#191C25";
  ctx.fillRect(22, 0, GAME_W - 44, GAME_H);

  ctx.fillStyle = "#333A4D";
  for (let i = -1; i < GAME_H / 80 + 2; i++) {
    const y = i * 80 + ((r.distance * 1.1) % 80);
    for (const x of [104, 180, 256]) ctx.fillRect(x - 2, y, 4, 40);
  }
  ctx.fillStyle = "#F9A8D4";
  ctx.fillRect(26, 0, 3, GAME_H);
  ctx.fillRect(GAME_W - 29, 0, 3, GAME_H);

  for (const c of r.coins) {
    if (!c.on) continue;
    const pulse = 1 + Math.sin(time * 8 + c.y * 0.05) * 0.08;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 11 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = "#FBBF24";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c.x, c.y, 6.5 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = "#FDE68A";
    ctx.fill();
  }

  for (const p of r.pickups) {
    if (!p.on) continue;
    const info = POWER_INFO[p.kind];
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.roundRect(p.x - 17, p.y - 17, 34, 34, 10);
    ctx.fill();
    ctx.fillStyle = "#0B0D12";
    ctx.font = "18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(info.icon, p.x, p.y + 1);
  }
  ctx.textBaseline = "alphabetic";

  for (const o of r.obstacles) {
    if (!o.on) continue;
    const top = o.y - o.h / 2;
    if (o.kind === 1) {
      ctx.fillStyle = "#B45309";
      ctx.beginPath();
      ctx.roundRect(o.x - o.w / 2, top, o.w, o.h, 6);
      ctx.fill();
      ctx.fillStyle = "#FDE68A";
      ctx.fillRect(o.x - o.w / 2, top + o.h * 0.4, o.w, 5);
    } else if (o.kind === 3) {
      // Coming the other way: headlights face the player, with a beam in front of them.
      ctx.fillStyle = "rgba(254,249,195,0.2)";
      ctx.beginPath();
      ctx.moveTo(o.x - o.w / 2 + 3, top + o.h);
      ctx.lineTo(o.x + o.w / 2 - 3, top + o.h);
      ctx.lineTo(o.x + o.w / 2 + 13, top + o.h + 52);
      ctx.lineTo(o.x - o.w / 2 - 13, top + o.h + 52);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0B0D12";
      ctx.beginPath();
      ctx.roundRect(o.x - o.w / 2 - 3, top + o.h * 0.16, o.w + 6, o.h * 0.2, 3);
      ctx.roundRect(o.x - o.w / 2 - 3, top + o.h * 0.68, o.w + 6, o.h * 0.2, 3);
      ctx.fill();
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.roundRect(o.x - o.w / 2, top, o.w, o.h, 8);
      ctx.fill();
      ctx.fillStyle = "rgba(11,13,18,0.5)";
      ctx.beginPath();
      ctx.roundRect(o.x - o.w / 2 + 5, top + o.h * 0.24, o.w - 10, o.h * 0.2, 4);
      ctx.fill();
      ctx.fillStyle = "#FEF9C3";
      ctx.fillRect(o.x - o.w / 2 + 4, top + o.h - 7, 9, 6);
      ctx.fillRect(o.x + o.w / 2 - 13, top + o.h - 7, 9, 6);
      ctx.fillStyle = "#B91C1C";
      ctx.fillRect(o.x - o.w / 2 + 4, top + 2, 8, 4);
      ctx.fillRect(o.x + o.w / 2 - 12, top + 2, 8, 4);
    } else {
      ctx.fillStyle = "#0B0D12";
      ctx.beginPath();
      ctx.roundRect(o.x - o.w / 2 - 3, top + o.h * 0.16, o.w + 6, o.h * 0.2, 3);
      ctx.roundRect(o.x - o.w / 2 - 3, top + o.h * 0.68, o.w + 6, o.h * 0.2, 3);
      ctx.fill();
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.roundRect(o.x - o.w / 2, top, o.w, o.h, 8);
      ctx.fill();
      ctx.fillStyle = "rgba(11,13,18,0.55)";
      ctx.beginPath();
      ctx.roundRect(o.x - o.w / 2 + 5, top + o.h * 0.5, o.w - 10, o.h * 0.22, 4);
      ctx.fill();
      ctx.fillStyle = "#FCA5A5";
      ctx.fillRect(o.x - o.w / 2 + 4, top + o.h - 8, 8, 4);
      ctx.fillRect(o.x + o.w / 2 - 12, top + o.h - 8, 8, 4);
    }
  }

  // The player, with its glow, shield and magnet effects.
  const car = carById(r.carId);
  if (r.boost > 0) {
    ctx.fillStyle = "rgba(253,230,138,0.35)";
    ctx.beginPath();
    ctx.moveTo(r.x - 12, PLAYER_Y + CAR_H / 2);
    ctx.lineTo(r.x + 12, PLAYER_Y + CAR_H / 2);
    ctx.lineTo(r.x + 4, PLAYER_Y + CAR_H / 2 + 60 + Math.random() * 40);
    ctx.lineTo(r.x - 4, PLAYER_Y + CAR_H / 2 + 60 + Math.random() * 40);
    ctx.closePath();
    ctx.fill();
  }
  if (r.magnet > 0) {
    ctx.strokeStyle = "rgba(249,168,212,0.5)";
    ctx.lineWidth = 2;
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(r.x, PLAYER_Y, 34 + i * 16, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }
  const top = PLAYER_Y - CAR_H / 2;
  ctx.fillStyle = "#0B0D12";
  ctx.beginPath();
  ctx.roundRect(r.x - CAR_W / 2 - 3, top + 8, CAR_W + 6, 14, 3);
  ctx.roundRect(r.x - CAR_W / 2 - 3, top + CAR_H - 24, CAR_W + 6, 14, 3);
  ctx.fill();
  ctx.fillStyle = car.sprite.body;
  ctx.beginPath();
  ctx.roundRect(r.x - CAR_W / 2, top, CAR_W, CAR_H, 9);
  ctx.fill();
  ctx.fillStyle = car.sprite.trim;
  ctx.fillRect(r.x - CAR_W / 2 + 4, top + CAR_H * 0.46, CAR_W - 8, 4);
  ctx.fillStyle = car.sprite.glass;
  ctx.beginPath();
  ctx.roundRect(r.x - CAR_W / 2 + 6, top + 8, CAR_W - 12, 14, 4);
  ctx.roundRect(r.x - CAR_W / 2 + 6, top + CAR_H - 26, CAR_W - 12, 12, 4);
  ctx.fill();
  ctx.fillStyle = "#FEF9C3";
  ctx.fillRect(r.x - CAR_W / 2 + 4, top + 1, 7, 4);
  ctx.fillRect(r.x + CAR_W / 2 - 11, top + 1, 7, 4);
  if (r.shield > 0) {
    ctx.strokeStyle = "rgba(125,211,252," + clamp(r.shield / 2, 0.25, 0.85) + ")";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, PLAYER_Y, 44, 0, Math.PI * 2);
    ctx.stroke();
  }

  // HUD inside the game: the score climbing with distance, the distance itself, speed and power ups.
  ctx.fillStyle = "rgba(11,13,18,0.55)";
  ctx.beginPath();
  ctx.roundRect(GAME_W - 146, 16, 124, 56, 12);
  ctx.fill();
  ctx.textAlign = "right";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 26px Inter, system-ui, sans-serif";
  ctx.fillText(scoreOf(r).toLocaleString(), GAME_W - 36, 46);
  ctx.fillStyle = "rgba(255,255,255,0.66)";
  ctx.font = "600 10px Inter, system-ui, sans-serif";
  ctx.fillText("SCORE", GAME_W - 36, 60);

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "700 15px Inter, system-ui, sans-serif";
  ctx.fillText(Math.round(r.speed * 0.42) + " km/h", 34, 34);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "600 11px Inter, system-ui, sans-serif";
  ctx.fillText(Math.floor(r.distance / 10) + " m driven", 34, 50);

  let row = 0;
  (["boost", "shield", "magnet"] as PowerKind[]).forEach((kind) => {
    if (r[kind] <= 0) return;
    const info = POWER_INFO[kind];
    const y = 64 + row * 18;
    ctx.fillStyle = "rgba(11,13,18,0.55)";
    ctx.beginPath();
    ctx.roundRect(32, y, 92, 12, 6);
    ctx.fill();
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.roundRect(32, y, 92 * (r[kind] / info.seconds), 12, 6);
    ctx.fill();
    ctx.fillStyle = "#0B0D12";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(info.label.toUpperCase(), 38, y + 9);
    row++;
  });
  ctx.textAlign = "start";
}

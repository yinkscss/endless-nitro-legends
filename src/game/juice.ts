// The small things that make a game feel good: bursts of particles, a screen shake, numbers that
// float up, easing, and collision tests. Nothing here allocates while the game runs.

export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
/** A random number from low up to high. */
export const rand = (low: number, high: number) => low + Math.random() * (high - low);

/** Easing: give each a number from 0 to 1 and get the eased 0 to 1 back. */
export const ease = {
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  /** Overshoots a little, then settles: a pop. */
  back: (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Two rectangles overlap. x and y are the top-left corner. */
export const hitRect = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** Two circles overlap. */
export const hitCircle = (ax: number, ay: number, ar: number, bx: number, by: number, br: number) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by) < (ar + br) * (ar + br);
/** A circle overlaps a rectangle. */
export const hitCircleRect = (cx: number, cy: number, r: number, rect: Rect) => {
  const dx = cx - clamp(cx, rect.x, rect.x + rect.w);
  const dy = cy - clamp(cy, rect.y, rect.y + rect.h);
  return dx * dx + dy * dy < r * r;
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  total: number;
  size: number;
  color: string;
}

/**
 * Bursts of small squares: a coin picked up, a block broken, a landing. Make one per game
 * (const particles = new Particles()) outside onFrame, call burst() when something happens, and
 * update(dt) then draw(ctx) on every frame, after the game is drawn.
 */
export class Particles {
  private pool: Particle[] = [];
  private next = 0;
  gravity = 600;

  constructor(max = 160) {
    for (let i = 0; i < max; i++) this.pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, total: 1, size: 3, color: "#fff" });
  }

  burst(x: number, y: number, options: { count?: number; color?: string; speed?: number; life?: number; size?: number } = {}) {
    const count = options.count ?? 12;
    for (let i = 0; i < count; i++) {
      const p = this.pool[this.next];
      this.next = (this.next + 1) % this.pool.length;
      const angle = Math.random() * Math.PI * 2;
      const speed = (options.speed ?? 180) * (0.4 + Math.random() * 0.6);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.total = p.life = (options.life ?? 0.5) * (0.6 + Math.random() * 0.4);
      p.size = options.size ?? 4;
      p.color = options.color ?? "#ffffff";
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy += this.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.max(p.life / p.total, 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * A screen shake for a hit or a crash. hit() starts one; on every frame call update(dt), then
 * ctx.save(), apply(ctx), draw the game, ctx.restore(). Keep it short and small: it is a jolt.
 */
export class Shake {
  private left = 0;
  private total = 1;
  private strength = 0;

  hit(strength = 8, seconds = 0.25) {
    this.strength = strength;
    this.left = this.total = seconds;
  }

  update(dt: number) {
    if (this.left > 0) this.left = Math.max(this.left - dt, 0);
  }

  apply(ctx: CanvasRenderingContext2D) {
    if (this.left <= 0) return;
    const power = this.strength * (this.left / this.total);
    ctx.translate((Math.random() * 2 - 1) * power, (Math.random() * 2 - 1) * power);
  }
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

/** Words that float up and fade: "+10", "Perfect!". add() one, then update(dt) and draw(ctx) every frame. */
export class Popups {
  private items: Popup[] = [];

  add(x: number, y: number, text: string, color = "#ffffff") {
    if (this.items.length < 24) this.items.push({ x, y, text, color, life: 0.8 });
  }

  update(dt: number) {
    for (const p of this.items) {
      p.life -= dt;
      p.y -= 40 * dt;
    }
    if (this.items.length && this.items[0].life <= 0) this.items.shift();
  }

  draw(ctx: CanvasRenderingContext2D, font = "bold 18px sans-serif") {
    ctx.font = font;
    ctx.textAlign = "center";
    for (const p of this.items) {
      if (p.life <= 0) continue;
      ctx.globalAlpha = clamp(p.life / 0.4, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
  }
}

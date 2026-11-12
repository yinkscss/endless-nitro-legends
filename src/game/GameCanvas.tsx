import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** What the player is pressing right now. Read it in onFrame; never store it in React state. */
export interface GameInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** Space, Enter, a tap or click on the game, or the on-screen action button. */
  action: boolean;
  /** True only on the frame the action started: use it for jump, shoot or "tap to start". */
  actionPressed: boolean;
  /** The finger or mouse on the game, in game coordinates. */
  pointer: { x: number; y: number; down: boolean };
}

/** One frame: where to draw, how much time passed, and the input. */
export interface Frame {
  ctx: CanvasRenderingContext2D;
  /** The game's own size, whatever the screen: draw in these coordinates. */
  width: number;
  height: number;
  /** Seconds since the last frame, never more than 1/30. Multiply every speed by it. */
  dt: number;
  /** Seconds the game has been running (not counting pauses). */
  time: number;
  input: GameInput;
}

export type ControlButton = "left" | "right" | "up" | "down" | "action";

const KEYS: Record<string, ControlButton> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  a: "left",
  d: "right",
  w: "up",
  s: "down",
  " ": "action",
  Enter: "action",
};

const LABELS: Record<ControlButton, string> = { left: "◀", right: "▶", up: "▲", down: "▼", action: "●" };
const NAMES: Record<ControlButton, string> = { left: "Left", right: "Right", up: "Up", down: "Down", action: "Action" };

/**
 * The game's screen. It keeps the game at a fixed size in its own coordinates (360 x 640 by
 * default, a phone held upright) and scales it to fit, sharp on any screen. onFrame is called about
 * 60 times a second with the time step and the input; update the game there, then draw it.
 * The loop stops while paused is true or the tab is hidden, and starts again by itself.
 */
export function GameCanvas({
  width = 360,
  height = 640,
  paused = false,
  onFrame,
  controls = [],
  label = "Game",
  maxHeight,
  overlay,
  className,
  style,
}: {
  width?: number;
  height?: number;
  paused?: boolean;
  onFrame: (frame: Frame) => void;
  /** On-screen buttons for phones. Leave empty when a tap anywhere is the only control. */
  controls?: ControlButton[];
  /** What a screen reader calls the game. */
  label?: string;
  /**
   * The tallest the game may be, as a CSS length. By default it leaves room for a top row (and the
   * on-screen buttons), so the whole game fits on a short or sideways phone without scrolling.
   */
  maxHeight?: string;
  /** Drawn over the game itself, so the buttons a player needs next never need scrolling to. */
  overlay?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(onFrame);
  const pausedRef = useRef(paused);
  const input = useRef<GameInput>({ left: false, right: false, up: false, down: false, action: false, actionPressed: false, pointer: { x: 0, y: 0, down: false } });
  const held = useRef({ key: false, pointer: false, button: false });

  /** Let go of every key, button and finger. */
  const release = () => {
    const state = input.current;
    state.left = state.right = state.up = state.down = false;
    state.action = state.actionPressed = false;
    state.pointer.down = false;
    held.current.key = held.current.pointer = held.current.button = false;
  };

  useEffect(() => {
    frameRef.current = onFrame;
    pausedRef.current = paused;
    // A tap on Play, or a key held when the game ended, must not carry into the next round as a jump.
    if (paused) release();
  }, [onFrame, paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    // Draw at the screen's real resolution so shapes and text stay sharp.
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    const state = input.current;
    const setAction = () => {
      const now = held.current.key || held.current.pointer || held.current.button;
      if (now && !state.action) state.actionPressed = true;
      state.action = now;
    };
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const button = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!button) return;
      // While the game isn't running the keys belong to the page: Enter and Space must still press
      // a focused Play button, and the arrows must still scroll.
      if (pausedRef.current) return;
      // Don't take keys from a form field elsewhere on the page.
      const target = e.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      // Ctrl, Cmd and Alt combinations are the browser's.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (button === "action") {
        held.current.key = down;
        setAction();
      } else state[button] = down;
    };
    const keyDown = onKey(true);
    const keyUp = onKey(false);
    const place = (e: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      state.pointer.x = ((e.clientX - box.left) / box.width) * width;
      state.pointer.y = ((e.clientY - box.top) / box.height) * height;
    };
    const pointerDown = (e: PointerEvent) => {
      place(e);
      state.pointer.down = true;
      held.current.pointer = true;
      setAction();
    };
    const pointerUp = () => {
      state.pointer.down = false;
      held.current.pointer = false;
      setAction();
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", place);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerUp);
    // A key held while the window loses focus never sends its keyup: without this the player keeps running.
    const letGo = () => {
      state.left = state.right = state.up = state.down = false;
      state.pointer.down = false;
      held.current.key = held.current.pointer = held.current.button = false;
      setAction();
    };
    window.addEventListener("blur", letGo);
    document.addEventListener("visibilitychange", letGo);

    let raf = 0;
    let last = 0;
    let time = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      // A long gap (a hidden tab, a slow frame) must not make everything jump.
      const dt = Math.min((now - (last || now)) / 1000, 1 / 30);
      last = now;
      if (pausedRef.current || document.hidden) return;
      time += dt;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      frameRef.current({ ctx, width, height, dt, time, input: state });
      state.actionPressed = false;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", place);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("blur", letGo);
      document.removeEventListener("visibilitychange", letGo);
    };
  }, [width, height]);

  const press = (button: ControlButton, down: boolean) => {
    if (button === "action") {
      held.current.button = down;
      const state = input.current;
      const now = held.current.key || held.current.pointer || held.current.button;
      if (now && !state.action) state.actionPressed = true;
      state.action = now;
    } else input.current[button] = down;
  };

  // As wide as the game's own size, and no taller than the screen has room for.
  const room = maxHeight ?? (controls.length > 0 ? "calc(100vh - 14rem)" : "calc(100vh - 9rem)");
  const fit = "min(" + width + "px, calc(" + room + " * " + (width / height).toFixed(4) + "))";
  return (
    <div
      className={className}
      style={{ width: "100%", maxWidth: fit, minWidth: Math.min(width, 200), marginInline: "auto", position: "relative", ...style }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        // touch-action stops the page scrolling or zooming under a thumb that is playing.
        style={{ display: "block", width: "100%", aspectRatio: width + " / " + height, touchAction: "none", userSelect: "none", borderRadius: 12 }}
      />
      {overlay}
      {controls.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {controls.filter((c) => c !== "action").map((c) => (
              <ControlKey key={c} button={c} press={press} />
            ))}
          </div>
          {controls.includes("action") && <ControlKey button="action" press={press} />}
        </div>
      )}
    </div>
  );
}

function ControlKey({ button, press }: { button: ControlButton; press: (button: ControlButton, down: boolean) => void }) {
  return (
    <button
      type="button"
      aria-label={NAMES[button]}
      onPointerDown={(e) => {
        e.preventDefault();
        press(button, true);
      }}
      onPointerUp={() => press(button, false)}
      onPointerLeave={() => press(button, false)}
      onPointerCancel={() => press(button, false)}
      onContextMenu={(e) => e.preventDefault()}
      className="grid size-14 place-items-center rounded-full bg-card text-xl text-foreground shadow active:bg-muted"
      style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
    >
      {LABELS[button]}
    </button>
  );
}

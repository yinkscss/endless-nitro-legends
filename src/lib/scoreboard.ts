import { collection } from "./db";
import type { PostableScore, TimedScore } from "./board";

/** A finished run, as the race screen reports it. */
export type Run = { score: number; car: number; level: number };

const OWN_KEY = "neon-drift:runs";

/**
 * Runs posted from this phone, newest first. Kept here so your own best still shows on the board
 * even when the shared read fails (no signal, or the board is still loading).
 */
export function ownRuns(): TimedScore[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(OWN_KEY) ?? "[]") as TimedScore[];
    return Array.isArray(raw) ? raw.filter((r) => r && typeof r.racer === "string") : [];
  } catch {
    return [];
  }
}

function rememberRun(row: TimedScore) {
  try {
    const kept = ownRuns().filter((r) => r.racer.toLowerCase() !== row.racer.toLowerCase());
    window.localStorage.setItem(OWN_KEY, JSON.stringify([row, ...kept].slice(0, 10)));
  } catch {
    /* the run just isn't remembered */
  }
}

/**
 * Post a finished run under the player's chosen name. Free play: the "scores" collection accepts
 * records from anyone, so this works with no wallet connected, no signature and no gas.
 */
export async function postScore(name: string, run: Run): Promise<PostableScore> {
  const racer = name.trim().replace(/\s+/g, " ").slice(0, 20);
  if (!racer) throw new Error("Type a name for the board first.");
  const score = Math.round(run.score);
  if (!Number.isFinite(score) || score <= 0) throw new Error("This run had no score to post.");
  const value: PostableScore = {
    racer,
    score,
    car: Number(run.car) > 0 ? Number(run.car) : 1,
    level: Number(run.level) > 0 ? Number(run.level) : 0,
  };
  await collection<PostableScore>("scores").add(value);
  rememberRun({ ...value, updatedAt: new Date().toISOString() });
  return value;
}

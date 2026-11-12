// One row per racer on the shared high score board, from everyone's posted runs.

export type PostableScore = { racer: string; score: number; car: number; level: number };

/** One racer's score with the moment it was posted, so a newer run replaces an older one. */
export type TimedScore = PostableScore & { updatedAt: string };

/** The name a guest's run is posted under, until they connect a wallet. */
export function guestName(): string {
  let n = 0;
  try {
    n = Number(window.localStorage.getItem("neon-drift:guest")) || 0;
  } catch {
    n = 0;
  }
  if (!n) {
    n = Math.floor(1000 + Math.random() * 9000);
    try {
      window.localStorage.setItem("neon-drift:guest", String(n));
    } catch {
      /* the number just isn't remembered */
    }
  }
  return "Guest " + n;
}

/** Same racer if the names match, ignoring case and the short form "0x12…ab". */
function sameRacer(a: string, b: string): boolean {
  const clean = (s: string) => s.trim().toLowerCase();
  if (clean(a) === clean(b)) return true;
  const strip = (s: string) => clean(s).replace(/…/g, "").replace(/\./g, "");
  return strip(a).length > 6 && strip(b).length > 6 && strip(a) === strip(b);
}

/**
 * The best run per racer, highest first. Records arrive newest first: a later record without a higher
 * score only replaces an earlier one when the racer's name changed, which keeps the newest score.
 */
export function bestPerRacer(records: TimedScore[], keep = 10): PostableScore[] {
  const best: TimedScore[] = [];
  for (const record of records) {
    const score = Number(record.score);
    if (!Number.isFinite(score) || score <= 0) continue;
    const racer = String(record.racer ?? "").slice(0, 32).trim() || "Guest";
    const row: TimedScore = {
      racer,
      score,
      car: Number(record.car) > 0 ? Number(record.car) : 1,
      level: Number(record.level) > 0 ? Number(record.level) : 0,
      updatedAt: String(record.updatedAt ?? ""),
    };
    const at = best.findIndex((r) => sameRacer(r.racer, racer));
    if (at === -1) best.push(row);
    else if (score > best[at].score) best[at] = row;
  }
  return best
    .sort((a, b) => b.score - a.score)
    .slice(0, keep)
    .map(({ racer, score, car, level }) => ({ racer, score, car, level }));
}

/** Readable name for a racer row, shortened if it is an address that wasn't shortened already. */
export function racerLabel(racer: string): string {
  const text = String(racer ?? "").trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(text)) return text.slice(0, 6) + "…" + text.slice(-4);
  return text.slice(0, 32) || "Guest";
}

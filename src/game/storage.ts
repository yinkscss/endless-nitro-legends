// The player's best score, kept in their browser. For a leaderboard other people can see, save
// scores with useCollection (src/lib/useDb.ts) as the game guide describes.

export function bestScore(game = "game"): number {
  try {
    return Number(window.localStorage.getItem("best:" + game)) || 0;
  } catch {
    return 0;
  }
}

/** Save the score if it beats the best. Returns true when it is a new best. */
export function saveBest(score: number, game = "game"): boolean {
  if (score <= bestScore(game)) return false;
  try {
    window.localStorage.setItem("best:" + game, String(score));
  } catch {
    /* storage is blocked: the score just isn't remembered */
  }
  return true;
}

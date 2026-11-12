import { useCallback, useMemo, useState } from "react";
import { useCollection } from "./useDb";
import { bestPerRacer, type PostableScore, type TimedScore } from "./board";
import { ownRuns, postScore, type Run } from "./scoreboard";

/**
 * The shared high score board: one row per racer, their best posted run. Reading needs no wallet and
 * no sign-in, so free players see the board and can post to it. The newest 100 runs are read (the
 * most one read may ask for) and sorted here, and runs posted from this phone are merged in, so a
 * failed read never leaves you with nothing.
 */
export function useHighScores(keep = 10) {
  const list = useCollection<TimedScore>("scores", { limit: 100 });
  const [justPosted, setJustPosted] = useState<TimedScore[]>([]);

  const rows = useMemo<PostableScore[]>(() => {
    const fromServer: TimedScore[] = list.records.map((r) => ({
      racer: String(r.value.racer ?? ""),
      score: Number(r.value.score) || 0,
      car: Number(r.value.car) || 1,
      level: Number(r.value.level) || 0,
      updatedAt: r.updatedAt,
    }));
    return bestPerRacer([...justPosted, ...ownRuns(), ...fromServer], keep);
  }, [list.records, justPosted, keep]);

  const post = useCallback(
    async (name: string, run: Run) => {
      const saved = await postScore(name, run);
      setJustPosted((prev) => [...prev, { ...saved, updatedAt: new Date().toISOString() }]);
      await list.refresh();
      return saved;
    },
    [list],
  );

  return { rows, loading: list.loading, error: list.error, refresh: list.refresh, post };
}

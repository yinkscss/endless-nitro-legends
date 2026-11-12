import { useState } from "react";
import { ChevronLeft, Loader2, Play, Send, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { errorMessage } from "../lib/format";

/**
 * The end of a run, shown over the bottom of the road itself: score first, then Race again and
 * Post score, so neither is ever below the fold. Posting a score asks for a name in the same panel.
 */
export function GameOverPanel({
  score,
  best,
  newBest,
  name,
  onName,
  onPost,
  posted,
  postedAs,
  onRaceAgain,
  starting,
}: {
  score: number;
  best: number;
  newBest: boolean;
  name: string;
  onName: (value: string) => void;
  onPost: (name: string) => Promise<void>;
  posted: boolean;
  postedAs: string | null;
  onRaceAgain: () => void;
  starting: boolean;
}) {
  const [mode, setMode] = useState<"menu" | "name">("menu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await onPost(name);
      setMode("menu");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-2xl border-t border-border bg-card/95 p-3 shadow-[0_-6px_20px_rgba(11,13,18,0.28)] backdrop-blur-sm">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Run over</p>
          <p className="font-display text-2xl font-semibold leading-none tabular-nums">{score.toLocaleString()}</p>
        </div>
        {newBest ? <Badge tone="success">New best!</Badge> : <span className="text-[11px] text-muted-foreground">Best {best.toLocaleString()}</span>}
      </div>

      {posted ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            On the board as <span className="font-medium text-foreground">{postedAs ?? name}</span>.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="accent" className="h-10 flex-1" onClick={onRaceAgain} disabled={starting}>
              <Play className="size-4" /> {starting ? "Starting…" : "Race again"}
            </Button>
            <Link
              to="/board"
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted"
            >
              <Trophy className="size-4 text-accent" /> High scores
            </Link>
          </div>
        </div>
      ) : mode === "name" ? (
        <form onSubmit={submit} className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Back"
              className="h-10 shrink-0 px-2"
              onClick={() => setMode("menu")}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              autoFocus
              value={name}
              onChange={(e) => onName(e.target.value.slice(0, 20))}
              placeholder="Name on the board"
              maxLength={20}
              autoComplete="nickname"
              className="h-10 min-w-0 flex-1"
            />
          </div>
          <Button type="submit" size="sm" variant="accent" className="h-10 w-full" disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {busy ? "Posting…" : "Post score"}
          </Button>
          {error && <p className="text-[11px] text-danger">{error}</p>}
        </form>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" variant="accent" className="h-10 flex-1" onClick={onRaceAgain} disabled={starting}>
            <Play className="size-4" /> {starting ? "Starting…" : "Race again"}
          </Button>
          <Button size="sm" variant="outline" className="h-10 flex-1" onClick={() => setMode("name")}>
            <Trophy className="size-4 text-accent" /> Post score
          </Button>
        </div>
      )}
    </div>
  );
}

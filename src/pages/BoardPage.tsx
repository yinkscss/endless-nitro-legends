import { useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Flag, Loader2, Trophy } from "lucide-react";
import { useHighScores } from "../lib/useHighScores";
import { useWallet } from "../lib/useWallet";
import { carById } from "../game/cars";
import { shortAddress } from "../lib/utils";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Notice } from "../components/ui/notice";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { CarArt } from "../components/CarArt";

/** The shared board: free players' typed names and wallet names, best run per racer. */
export default function BoardPage() {
  const { account } = useWallet();
  const board = useHighScores(10);
  const [retrying, setRetrying] = useState(false);
  const mine = account ? shortAddress(account) : null;

  async function retry() {
    setRetrying(true);
    await board.refresh();
    setRetrying(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">High scores</h1>
        <p className="text-sm text-muted-foreground">Best run per racer, from everyone who posts one. No wallet needed to play or to post.</p>
      </div>

      {board.loading && board.rows.length === 0 && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}

      {board.error && (
        <Notice
          tone="danger"
          title="The board didn't load"
          action={
            <Button size="sm" variant="outline" onClick={() => void retry()} disabled={retrying}>
              {retrying ? <Loader2 className="size-3.5 animate-spin" /> : null} Retry
            </Button>
          }
        >
          {board.error}
        </Notice>
      )}

      {!board.loading && !board.error && board.rows.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Trophy className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No scores on the board yet.</p>
            <p className="text-sm text-muted-foreground">Finish a run, type a name, and take the top spot.</p>
            <Link to="/" className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent underline-offset-2 hover:underline">
              <Flag className="size-4" /> Race now
            </Link>
          </CardContent>
        </Card>
      )}

      {board.rows.length > 0 && (
        <ol className="space-y-2">
          {board.rows.map((row, i) => {
            const car = carById(row.car);
            const isMine = mine !== null && row.racer === mine;
            return (
              <li
                key={row.racer}
                className={"flex min-h-14 items-center gap-3 rounded-lg border bg-card px-3 py-2 shadow-sm " + (isMine ? "border-accent" : "border-border")}
              >
                <span className={"grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums " + (i === 0 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
                  {i === 0 ? <Crown className="size-4" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{row.racer}</span>
                    {isMine && <Badge tone="success">You</Badge>}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <CarArt car={car} className="h-4" />
                    {car.name} · level {row.level}
                  </span>
                </span>
                <span className="font-display text-lg font-semibold tabular-nums">{row.score.toLocaleString()}</span>
              </li>
            );
          })}
        </ol>
      )}

      <Notice tone="info">
        <p className="text-xs">Scores are posted by players' own phones, so play fair. Garage purchases are in G$ on Celo; a season pass adds +25% to your score.</p>
      </Notice>
    </div>
  );
}

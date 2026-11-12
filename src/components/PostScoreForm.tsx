import { useState } from "react";
import { Loader2, Send, Trophy } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Notice } from "./ui/notice";
import { errorMessage } from "../lib/format";

/**
 * Free play's score card: type a name and put the run on the board. There is no wallet, no signature
 * and no gas involved, so a guest can do it, and their name is remembered on this phone.
 */
export function PostScoreForm({
  name,
  onName,
  score,
  onPost,
  saved,
  savedAs,
}: {
  name: string;
  onName: (value: string) => void;
  score: number;
  onPost: (name: string) => Promise<void>;
  saved: boolean;
  savedAs: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await onPost(name);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <Notice tone="success">
        On the board as <span className="font-medium text-foreground">{savedAs ?? name}</span> with {score.toLocaleString()} points.
      </Notice>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="racer-name" className="flex items-center gap-1.5">
        <Trophy className="size-4 text-accent" /> Your name on the board
      </Label>
      <div className="flex gap-2">
        <Input
          id="racer-name"
          value={name}
          onChange={(e) => onName(e.target.value.slice(0, 20))}
          placeholder="e.g. Ada from Lagos"
          maxLength={20}
          autoComplete="nickname"
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {busy ? "Posting…" : "Post score"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">No wallet needed. Your name and score are public on the board.</p>
      {error && <Notice tone="danger">{error}</Notice>}
    </form>
  );
}

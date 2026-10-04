import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { getRivalry, setRival } from "@/lib/picks.functions";

export function useRivalry(enabled = true) {
  const fetchRivalry = useServerFn(getRivalry);
  return useQuery({ queryKey: ["picks-rivalry"], queryFn: () => fetchRivalry(), enabled, refetchInterval: 120_000 });
}

const first = (n: string) => n.trim().split(/\s+/)[0] || n;

/** Compact line for the profile popover; renders nothing without a rival. */
export function RivalryLine() {
  const { data } = useRivalry();
  const r = data?.rival;
  if (!data || !r) return null;
  return (
    <p className="mt-1 text-sm font-semibold">
      Picks rivalry: {first(data.meName)} {r.weeklyWins.me} – {r.weeklyWins.them} {first(r.name)}
    </p>
  );
}

export function RivalryCard() {
  const { data } = useRivalry();
  const save = useServerFn(setRival);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const r = data.rival;
  const me = first(data.meName);

  async function choose(id: string) {
    setBusy(true);
    try {
      await save({ data: { rivalId: id || null } });
      await qc.invalidateQueries({ queryKey: ["picks-rivalry"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your rival.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="font-display text-xl font-bold">Picks Rivalry</h2>
      <p className="text-sm text-muted-foreground">A private head-to-head on weekly picks. Only you see it.</p>
      <div className="mt-4 grid gap-2">
        <Label htmlFor="acct-rival">Your rival</Label>
        <select
          id="acct-rival"
          value={r?.id ?? ""}
          disabled={busy}
          onChange={(e) => void choose(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-base"
        >
          <option value="">No rival</option>
          {data.options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {r && (
        <div className="mt-5 grid gap-4">
          <div className="rounded-xl bg-secondary/50 p-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Weekly wins</p>
            <p className="font-display text-3xl font-bold">
              {me} {r.weeklyWins.me} — {r.weeklyWins.them} {first(r.name)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total correct picks: {me} {r.totalCorrect.me} · {first(r.name)} {r.totalCorrect.them}
            </p>
          </div>

          <div>
            <p className="font-semibold">Week {r.week} swing games</p>
            {!r.bothDone && r.swings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Shows once you've both made your picks.</p>
            ) : r.swings.length === 0 ? (
              <p className="text-sm text-muted-foreground">You picked the same winners this week.</p>
            ) : (
              <ul className="mt-1 grid gap-1 text-sm">
                {r.swings.map((s) => (
                  <li key={s.gameId} className="flex justify-between gap-2">
                    <span className="font-medium">{s.label}</span>
                    <span>
                      <span className={s.winner === s.mine ? "font-bold text-primary" : ""}>{me}: {s.mine}</span>
                      {" · "}
                      <span className={s.winner === s.theirs ? "font-bold text-primary" : ""}>{first(r.name)}: {s.theirs}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {(r.tiebreak.me != null || r.tiebreak.them != null) && (
              <p className="mt-2 text-sm">
                Monday total: {me} {r.tiebreak.me ?? "—"} · {first(r.name)} {r.tiebreak.them ?? "—"}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

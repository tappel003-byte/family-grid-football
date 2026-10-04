import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { AppShell, LoadingScreen, PageTitle } from "@/components/fantasy/AppShell";
import { Input } from "@/components/ui/input";
import { WeekSelector } from "@/components/fantasy/WeekSelector";
import { getPicksBoard, savePick, saveTiebreaker, type PickGame, type PicksBoard } from "@/lib/picks.functions";
import { teamLogoUrl } from "@/lib/fantasy/hooks";
import { formatGameTime, useTimeZone } from "@/lib/timezone";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/picks")({
  head: () => ({
    meta: [
      { title: "Weekly Picks — La Familia" },
      { name: "description", content: "The family NFL pick'em: tap the helmet you think wins, Monday night total as the tiebreaker." },
      { property: "og:title", content: "Weekly Picks — La Familia" },
      { property: "og:description", content: "Tap a helmet, pick every NFL game, and see the family notebook." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <PicksPage />
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell>
      <p role="alert">{error instanceof Error ? error.message : String(error)}</p>
    </AppShell>
  ),
  notFoundComponent: () => <AppShell>Nothing here.</AppShell>,
});

const started = (g: PickGame) => g.status !== "scheduled" || Date.parse(g.startsAt) <= Date.now();

function PicksPage() {
  const { user } = useAuth();
  const [week, setWeek] = useState<number | undefined>(undefined);
  const fetchBoard = useServerFn(getPicksBoard);
  const pick = useServerFn(savePick);
  const tie = useServerFn(saveTiebreaker);
  const qc = useQueryClient();
  const key = ["picks-board", user?.id, week ?? "now"];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: () => fetchBoard({ data: { week } }),
    refetchInterval: 60_000,
  });
  const [err, setErr] = useState("");
  const [tieText, setTieText] = useState("");
  useEffect(() => {
    setTieText(data?.myTiebreaker != null ? String(data.myTiebreaker) : "");
  }, [data?.myTiebreaker, data?.week]);
  const tz = useTimeZone();

  if (isLoading || !data) return error ? <p role="alert">{String(error)}</p> : <LoadingScreen label="Loading this week's games…" />;

  const choose = async (g: PickGame, team: string) => {
    setErr("");
    qc.setQueryData<PicksBoard>(key, (b) => (b ? { ...b, myPicks: { ...b.myPicks, [g.id]: team } } : b));
    try {
      await pick({ data: { week: data.week, gameId: g.id, team } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save that pick.");
    }
    void qc.invalidateQueries({ queryKey: key });
  };
  const saveTie = async () => {
    const n = Number(tieText);
    if (!tieText || !Number.isFinite(n)) return;
    try {
      await tie({ data: { week: data.week, total: Math.round(n) } });
      void qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the tiebreaker.");
    }
  };

  const pickable = data.games.filter((g) => !started(g));
  const made = data.games.filter((g) => data.myPicks[g.id]).length;
  const monday = data.games.find((g) => g.id === data.mondayGameId);

  return (
    <>
      <div className="mb-5 grid gap-3 sm:flex sm:items-end sm:justify-between">
        <PageTitle title={`Week ${data.week} Picks`} subtitle="Tap the helmet you think wins. Monday night total breaks ties." />
        <WeekSelector week={data.week} onChange={setWeek} />
      </div>

      {data.iAmDone ? (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-lg font-bold text-primary-foreground">
          <Check className="h-6 w-6" /> All picks in! The family notebook is open below.
        </div>
      ) : (
        <div className="mb-5 rounded-xl border bg-card px-4 py-3">
          <p className="text-base font-semibold">
            {made} of {data.games.length} picked
            {pickable.length < data.games.length && " · games that kicked off are locked"}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary transition-all" style={{ width: `${data.games.length ? (made / data.games.length) * 100 : 0}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Finish your picks to see everyone else's.</p>
        </div>
      )}
      {err && <p role="alert" className="mb-4 font-semibold text-destructive">{err}</p>}
      {data.games.length === 0 && <p className="text-lg text-muted-foreground">No games found for this week yet.</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {data.games.map((g) => {
          const locked = started(g);
          const mine = data.myPicks[g.id];
          const time = formatGameTime(g.startsAt, tz);
          return (
            <div key={g.id} className="rounded-2xl border bg-card p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {g.status === "final" ? "Final" : g.status === "live" ? "Live" : time}
                  {g.network && g.status === "scheduled" ? ` · ${g.network}` : ""}
                </span>
                {locked && <Lock className="h-4 w-4" aria-label="Locked" />}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                {[g.away, null, g.home].map((t, i) =>
                  t ? (
                    <button
                      key={t.abbr}
                      type="button"
                      disabled={locked}
                      onClick={() => void choose(g, t.abbr)}
                      className={cn(
                        "relative flex flex-col items-center rounded-xl border-2 p-2 transition-colors",
                        mine === t.abbr ? "border-primary bg-primary/10" : "border-transparent hover:bg-secondary",
                        locked && mine !== t.abbr && "opacity-50",
                        g.status === "final" && t.winner && "ring-2 ring-primary/40",
                      )}
                    >
                      {mine === t.abbr && (
                        <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <img src={teamLogoUrl(t.abbr)} alt="" className="h-16 w-16 object-contain" />
                      <span className="mt-1 text-center text-sm font-bold leading-tight">{t.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t.record}
                        {t.score != null && g.status !== "scheduled" && ` · ${t.score}`}
                      </span>
                    </button>
                  ) : (
                    <span key={`at-${i}`} className="font-display text-sm font-bold text-muted-foreground">@</span>
                  ),
                )}
              </div>
              {monday?.id === g.id && (
                <div className="mt-3 flex items-center gap-2 border-t pt-3">
                  <label htmlFor="tiebreak" className="text-sm font-semibold">Tiebreaker: total points</label>
                  <Input
                    id="tiebreak"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={200}
                    disabled={locked}
                    value={tieText}
                    onChange={(e) => setTieText(e.target.value)}
                    onBlur={() => void saveTie()}
                    className="h-10 w-20 text-base"
                    placeholder="47"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Notebook data={data} meId={user?.id} />
    </>
  );
}

function Notebook({ data, meId }: { data: PicksBoard; meId?: string | undefined }) {
  if (!data.family.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-2xl font-bold">Family notebook</h2>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="sticky left-0 bg-card px-3 py-2">Who</th>
              <th className="px-2 py-2 text-center">Right</th>
              {data.games.map((g) => (
                <th key={g.id} className="px-1 py-2 text-center text-xs font-semibold text-muted-foreground">
                  {g.away.abbr}
                  <br />
                  {g.home.abbr}
                </th>
              ))}
              <th className="px-2 py-2 text-center">MNF</th>
            </tr>
          </thead>
          <tbody>
            {data.family.map((r) => (
              <tr key={r.userId} className={cn("border-b last:border-0", r.userId === meId && "bg-secondary/40")}>
                <td className="sticky left-0 bg-card px-3 py-2 font-semibold">
                  {r.name} {r.done && <Check className="inline h-4 w-4 text-primary" aria-label="Done" />}
                </td>
                <td className="px-2 py-2 text-center font-bold tabular-nums">{r.correct}</td>
                {data.games.map((g) => {
                  const p = r.picks[g.id];
                  const right = g.status === "final" && p && ((g.home.winner && p === g.home.abbr) || (g.away.winner && p === g.away.abbr));
                  const wrong = g.status === "final" && p && !right;
                  return (
                    <td key={g.id} className="px-1 py-1 text-center">
                      {p ? (
                        <img src={teamLogoUrl(p)} alt={p} className={cn("mx-auto h-6 w-6 object-contain", wrong && "opacity-30", right && "rounded-full ring-2 ring-primary")} />
                      ) : (
                        <span className="text-muted-foreground">·</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center tabular-nums">{r.tiebreaker ?? "·"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.iAmDone && <p className="mt-2 text-sm text-muted-foreground">Picks for games that haven't started stay hidden until you finish yours.</p>}

      <h2 className="mb-1 mt-8 font-display text-2xl font-bold">Season standings</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Champion = most weeks won. Total correct picks breaks ties.
        Season scoring starts Week 5{data.week < 5 ? " — this week is a warm-up." : "."}
      </p>
      {data.season_totals.length > 0 ? (
        <div className="rounded-2xl border bg-card">
          {data.season_totals.map((s, i) => (
            <div key={s.userId} className="flex items-center justify-between border-b px-4 py-3 last:border-0">
              <span className="font-semibold">{i + 1}. {s.name}</span>
              <span className="tabular-nums text-muted-foreground">
                <b className="text-foreground">{s.weeksWon}</b> week{s.weeksWon === 1 ? "" : "s"} won · {s.correct} right
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">No season picks counted yet.</p>
      )}
    </section>
  );
}

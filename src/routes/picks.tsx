import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, Lock, X } from "lucide-react";
import { AppShell, LoadingScreen, PageTitle } from "@/components/fantasy/AppShell";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { WeekSelector } from "@/components/fantasy/WeekSelector";
import {
  getPickGameSummary,
  getPicksBoard,
  savePick,
  saveTiebreaker,
  type PickGame,
  type PickGameSummary,
  type PicksBoard,
} from "@/lib/picks.functions";
import { teamLogoUrl } from "@/lib/fantasy/hooks";
import { formatGameTime, useTimeZone } from "@/lib/timezone";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/picks")({
  head: () => ({
    meta: [
      { title: "Pick'em — La Familia" },
      { name: "description", content: "The family NFL pick'em: tap the helmet you think wins, Monday night total as the tiebreaker." },
      { property: "og:title", content: "Pick'em — La Familia" },
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
  const [summaryGame, setSummaryGame] = useState<PickGame | null>(null);
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
        <PageTitle title={`Week ${data.week} Pick'em`} subtitle="Tap the helmet you think wins. Monday night total breaks ties." />
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
          <p className="mt-2 text-sm text-muted-foreground">
            {data.week >= 5 && made === data.games.length && data.games.length > 0 && data.myTiebreaker == null
              ? "Last step: enter the Monday night total points to finish."
              : "Finish your picks and the Monday night total to see everyone else's."}
          </p>
        </div>
      )}
      {err && <p role="alert" className="mb-4 font-semibold text-destructive">{err}</p>}
      {data.games.length === 0 && <p className="text-lg text-muted-foreground">No games found for this week yet.</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {data.games.map((g) => {
          const locked = started(g);
          const mine = data.myPicks[g.id];
          const time = formatGameTime(g.startsAt, tz);
          const openSummary = () => {
            if (locked) setSummaryGame(g);
          };
          return (
            <div
              key={g.id}
              role={locked ? "button" : undefined}
              tabIndex={locked ? 0 : undefined}
              onClick={openSummary}
              onKeyDown={
                locked
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openSummary();
                      }
                    }
                  : undefined
              }
              className={cn(
                "rounded-2xl border bg-card p-3 shadow-sm",
                locked && "cursor-pointer transition-colors hover:bg-secondary/40",
              )}
              aria-label={
                locked ? `Open game summary: ${g.away.name} at ${g.home.name}` : undefined
              }
            >
              <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {g.status === "final" ? "Final" : g.status === "live" ? "Live" : time}
                  {g.network && g.status === "scheduled" ? ` · ${g.network}` : ""}
                  {g.overUnder != null && g.status === "scheduled" ? ` · O/U ${g.overUnder}` : ""}
                  {locked ? " · Tap for summary" : ""}
                </span>
                {locked && <Lock className="h-4 w-4" aria-label="Locked" />}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                {[g.away, null, g.home].map((t, i) =>
                  t ? (
                    (() => {
                      const final = g.status === "final";
                      const picked = mine === t.abbr;
                      const hit = final && picked && !!t.winner;
                      const miss = final && picked && !t.winner;
                      return (
                    <button
                      key={t.abbr}
                      type="button"
                      disabled={locked}
                      onClick={(e) => {
                        e.stopPropagation();
                        void choose(g, t.abbr);
                      }}
                      className={cn(
                        "relative flex flex-col items-center rounded-xl border-2 p-2 transition-colors",
                        final
                          ? picked
                            ? hit
                              ? "border-green-600 bg-green-600/10"
                              : "border-red-600 bg-red-600/10"
                            : t.winner
                              ? "border-green-600/40"
                              : "border-transparent opacity-50"
                          : picked
                            ? "border-primary bg-primary/10"
                            : "border-transparent hover:bg-secondary",
                        !final && locked && !picked && "opacity-50",
                      )}
                    >
                      {t.score != null && g.status !== "scheduled" && (
                        <span className={cn("font-display text-2xl tabular-nums leading-none mb-1", t.winner ? "font-black" : "font-semibold")}>
                          {t.score}
                        </span>
                      )}
                      <img src={teamLogoUrl(t.abbr)} alt="" className="h-16 w-16 object-contain" />
                      <span className="mt-1 text-center text-sm font-bold leading-tight">{t.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[t.record, g.status === "scheduled" ? t.spread : undefined].filter(Boolean).join(" · ")}
                      </span>
                      {picked && (
                        <span
                          className={cn(
                            "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-white",
                            hit ? "bg-green-600" : miss ? "bg-red-600" : "bg-primary text-primary-foreground",
                          )}
                        >
                          {miss ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />} Your pick
                        </span>
                      )}
                    </button>
                      );
                    })()
                  ) : (
                    g.status === "live" ? (
                      <span key={`at-${i}`} className="flex flex-col items-center font-display font-bold leading-tight text-destructive tabular-nums">
                        <span className="text-lg">{g.liveTop ?? "LIVE"}</span>
                        {g.liveClock && <span className="text-base text-foreground">{g.liveClock}</span>}
                      </span>
                    ) : (
                      <span key={`at-${i}`} className="font-display text-lg font-bold text-muted-foreground">
                        {g.status === "final" ? "FINAL" : "@"}
                      </span>
                    )
                  ),
                )}
              </div>
              {monday?.id === g.id && (
                <div
                  className="mt-3 flex items-center gap-2 border-t pt-3"
                  onClick={(e) => e.stopPropagation()}
                >
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
                    placeholder="—"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <GameSummaryDialog
        game={summaryGame}
        myPick={summaryGame ? data.myPicks[summaryGame.id] ?? null : null}
        open={!!summaryGame}
        onOpenChange={(open) => {
          if (!open) setSummaryGame(null);
        }}
      />

      <Notebook data={data} meId={user?.id} />
    </>
  );
}

function GameSummaryDialog({
  game,
  myPick,
  open,
  onOpenChange,
}: {
  game: PickGame | null;
  myPick: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fetchSummary = useServerFn(getPickGameSummary);
  const { data, isPending, isError } = useQuery({
    queryKey: ["pick-game-summary", game?.id],
    enabled: open && !!game?.id,
    queryFn: () => fetchSummary({ data: { eventId: game!.id } }),
    staleTime: 60_000,
  });

  const pickHit =
    game?.status === "final" &&
    myPick &&
    ((game.home.winner && myPick === game.home.abbr) || (game.away.winner && myPick === game.away.abbr));
  const pickMiss = game?.status === "final" && myPick && !pickHit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto rounded-2xl p-0">
        <DialogTitle className="sr-only">
          {game ? `${game.away.name} at ${game.home.name} summary` : "Game summary"}
        </DialogTitle>
        {!game ? null : isPending ? (
          <p className="p-6 text-muted-foreground">Loading game summary…</p>
        ) : isError || !data ? (
          <p className="p-6 text-muted-foreground">Couldn&apos;t load that summary right now.</p>
        ) : (
          <GameSummaryBody summary={data} myPick={myPick} pickHit={!!pickHit} pickMiss={!!pickMiss} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function GameSummaryBody({
  summary,
  myPick,
  pickHit,
  pickMiss,
}: {
  summary: PickGameSummary;
  myPick: string | null;
  pickHit: boolean;
  pickMiss: boolean;
}) {
  const qLabels = ["1", "2", "3", "4", "OT"];
  const maxQ = Math.max(summary.away.quarters.length, summary.home.quarters.length, 4);
  return (
    <div className="p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{summary.status}</p>
      {summary.headline ? (
        <h2 className="mt-1 font-display text-xl font-bold leading-snug">{summary.headline}</h2>
      ) : (
        <h2 className="mt-1 font-display text-xl font-bold leading-snug">
          {summary.away.name} {summary.away.score} – {summary.home.score} {summary.home.name}
        </h2>
      )}
      {summary.blurb && <p className="mt-2 text-sm leading-snug text-muted-foreground">{summary.blurb}</p>}

      {myPick && (
        <p
          className={cn(
            "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white",
            pickHit ? "bg-green-600" : pickMiss ? "bg-red-600" : "bg-primary",
          )}
        >
          {pickMiss ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          Your pick: {myPick}
          {pickHit ? " · hit" : pickMiss ? " · miss" : ""}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50 text-muted-foreground">
              <th className="px-3 py-2 text-left font-semibold">Team</th>
              {Array.from({ length: maxQ }, (_, i) => (
                <th key={qLabels[i] ?? i} className="px-1 py-2 text-center font-semibold">
                  {qLabels[i] ?? i + 1}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-semibold">T</th>
            </tr>
          </thead>
          <tbody>
            {[summary.away, summary.home].map((t) => (
              <tr key={t.abbr} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <img src={teamLogoUrl(t.abbr)} alt="" className="h-6 w-6 object-contain" />
                    {t.abbr}
                  </span>
                </td>
                {Array.from({ length: maxQ }, (_, i) => (
                  <td key={i} className="px-1 py-2 text-center tabular-nums">
                    {t.quarters[i] ?? "—"}
                  </td>
                ))}
                <td className="px-3 py-2 text-center font-display text-lg font-bold tabular-nums">
                  {t.score ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary.scoring.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-2 font-display text-base font-bold">Scoring</h3>
          <ul className="space-y-2">
            {summary.scoring.map((p, i) => (
              <li key={`${p.score}-${i}`} className="grid grid-cols-[2rem_1fr_auto] gap-2 text-sm">
                <span className="font-semibold text-muted-foreground">
                  {p.period != null ? `Q${p.period}` : "—"}
                </span>
                <span className="leading-snug">{p.text}</span>
                <span className="tabular-nums text-muted-foreground">{p.score}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.leaders.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-2 font-display text-base font-bold">Leaders</h3>
          <ul className="space-y-1.5">
            {summary.leaders.map((l) => (
              <li
                key={`${l.team}-${l.category}-${l.name}`}
                className="grid grid-cols-[2.5rem_5.5rem_1fr] gap-2 text-sm"
              >
                <span className="font-bold text-muted-foreground">{l.team}</span>
                <span className="text-muted-foreground">{l.category.replace(/ Yards$/, "")}</span>
                <span>
                  <span className="font-semibold">{l.name}</span>{" "}
                  <span className="text-muted-foreground">{l.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
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
        Champion = most total correct picks. Weeks won breaks ties.
        Season scoring starts Week 5{data.week < 5 ? " — this week is a warm-up." : "."}
      </p>
      {data.season_totals.length > 0 ? (
        <div className="rounded-2xl border bg-card">
          {data.season_totals.map((s, i) => (
            <div key={s.userId} className="flex items-center justify-between border-b px-4 py-3 last:border-0">
              <span className="font-semibold">{i + 1}. {s.name}</span>
              <span className="tabular-nums text-muted-foreground">
                <b className="text-foreground">{s.correct}</b> right · {s.weeksWon} week{s.weeksWon === 1 ? "" : "s"} won
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

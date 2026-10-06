import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useState } from "react";
import { AppShell, LoadingScreen } from "@/components/fantasy/AppShell";
import { MatchupBoard, TeamCrest, teamRecord, teamTotals } from "@/components/fantasy/MatchupBoard";
import { WeekSelector } from "@/components/fantasy/WeekSelector";
import { playersQueryOptions, useLeague, useWeekData, useWeeksData } from "@/lib/fantasy/hooks";
import { InsightsProvider } from "@/components/fantasy/PlayerInsights";
import { NeedsAttention } from "@/components/fantasy/NeedsAttention";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { MatchupRecap } from "@/components/fantasy/MatchupRecap";
import { WeekInReview } from "@/components/fantasy/WeekInReview";
import { useTimeZone } from "@/lib/timezone";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "La Familia — Weekly Matchups" },
      {
        name: "description",
        content:
          "A private family fantasy football league: head-to-head matchups, live points and big, easy-to-read rosters.",
      },
      { property: "og:title", content: "La Familia — Weekly Matchups" },
      {
        property: "og:description",
        content: "Head-to-head family fantasy matchups with live NFL players and clear scoreboards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <Suspense fallback={<LoadingScreen />}>
        <MatchupsPage />
      </Suspense>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell>
      <p role="alert" className="text-lg">
        {error instanceof Error ? error.message : String(error)}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => <AppShell>Nothing here.</AppShell>,
});

function MatchupsPage() {
  const { league, byId } = useLeague();
  const { user } = useAuth();
  const tz = useTimeZone();
  const [week, setWeek] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [scoresAsOf, setScoresAsOf] = useState<Date | null>(null);
  const activeWeek = week ?? league?.currentWeek ?? 1;
  const weekData = useWeekData(activeWeek);
  useWeeksData(Math.max(0, (league?.currentWeek ?? 1) - 1));

  // Quiet freshness clock — updates whenever week data refreshes (no rule changes).
  useEffect(() => {
    setScoresAsOf(new Date());
  }, [weekData]);

  if (!league) return <LoadingScreen label="Drafting your family league…" />;

  const pairs = league.schedule[activeWeek - 1] ?? [];
  const myIdx = league.teams.findIndex((t) => !!user && t.userId === user.id);
  const found = pairs.findIndex((p) => p[0] === myIdx || p[1] === myIdx);
  const myIndex = myIdx >= 0 && found >= 0 ? found : 0;
  const selected = Math.min(picked ?? myIndex, Math.max(0, pairs.length - 1));
  const pair = pairs[selected];
  const home = pair ? league.teams[pair[0]] : undefined;
  const away = pair ? league.teams[pair[1]] : undefined;
  const asOfLabel = scoresAsOf
    ? scoresAsOf.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: tz,
      })
    : null;

  return (
    <>
      <WeekInReview league={league} byId={byId} />

      {weekData.stale && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-base font-semibold text-amber-900">
          The live NFL feed is retrying — showing the last scores we received. Everything
          updates itself once the feed answers again.
        </div>
      )}
      <InsightsProvider week={league.currentWeek} scoring={league.scoring}>
        <NeedsAttention league={league} byId={byId} />
      </InsightsProvider>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:flex sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {league.name}
          </h1>
          <p className="mt-1 text-base text-muted-foreground sm:text-lg">
            Week {activeWeek} matchups
            {asOfLabel && !weekData.stale ? (
              <span className="text-sm"> · Scores as of {asOfLabel}</span>
            ) : null}
          </p>
        </div>
        <WeekSelector week={activeWeek} onChange={(w) => { setWeek(w); setPicked(null); }} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pairs.map((p, i) => {
          const h = league.teams[p[0]];
          const a = league.teams[p[1]];
          if (!h || !a) return null;
          const ht = teamTotals(h, activeWeek, league, byId);
          const at = teamTotals(a, activeWeek, league, byId);
          return (
            <button
              key={i}
              onClick={() => setPicked(i)}
              className={cn(
                "rounded-2xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-secondary/50",
                i === Math.min(selected, pairs.length - 1) && "ring-2 ring-primary",
              )}
            >
              {[
                { team: h, total: ht },
                { team: a, total: at },
              ].map(({ team, total }) => {
                const pregame = activeWeek >= league.currentWeek && total.actual < 0.05;
                const shown = pregame ? total.projected : total.actual;
                return (
                <div key={team.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-1">
                  <TeamCrest team={team} />
                  <span className="truncate text-base font-semibold">
                    {team.name}{" "}
                    <span className="text-sm font-medium tabular-nums text-muted-foreground">
                      ({teamRecord(team, league, byId)})
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="font-display text-xl font-bold tabular-nums">
                      {shown.toFixed(1)}
                    </span>
                    {pregame && (
                      <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        proj
                      </span>
                    )}
                  </span>
                </div>
                );
              })}
            </button>
          );
        })}
      </div>

      {home && away && (
        <InsightsProvider week={activeWeek} scoring={league.scoring}>
          <MatchupBoard league={league} byId={byId} week={activeWeek} home={home} away={away} />
          <MatchupRecap league={league} byId={byId} week={activeWeek} home={home} away={away} />
        </InsightsProvider>
      )}
    </>
  );
}

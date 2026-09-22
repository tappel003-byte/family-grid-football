import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { AppShell, LoadingScreen } from "@/components/fantasy/AppShell";
import { MatchupBoard, TeamCrest, teamTotals } from "@/components/fantasy/MatchupBoard";
import { WeekSelector } from "@/components/fantasy/WeekSelector";
import { playersQueryOptions, useLeague, useWeekData } from "@/lib/fantasy/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "Family Football — Weekly Matchups" },
      {
        name: "description",
        content:
          "A private family fantasy football league: head-to-head matchups, live points and big, easy-to-read rosters.",
      },
      { property: "og:title", content: "Family Football — Weekly Matchups" },
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
        {error.message}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => <AppShell>Nothing here.</AppShell>,
});

function MatchupsPage() {
  const { league, byId } = useLeague();
  const [week, setWeek] = useState<number | null>(null);
  const [selected, setSelected] = useState(0);
  const activeWeek = week ?? league?.currentWeek ?? 1;
  useWeekData(activeWeek);

  if (!league) return <LoadingScreen label="Drafting your family league…" />;

  const pairs = league.schedule[activeWeek - 1] ?? [];
  const pair = pairs[Math.min(selected, pairs.length - 1)];
  const home = pair ? league.teams[pair[0]] : undefined;
  const away = pair ? league.teams[pair[1]] : undefined;

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:flex sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {league.name}
          </h1>
          <p className="mt-1 text-base text-muted-foreground sm:text-lg">
            Week {activeWeek} matchups
          </p>
        </div>
        <WeekSelector week={activeWeek} onChange={(w) => setWeek(w)} />
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
              onClick={() => setSelected(i)}
              className={cn(
                "rounded-2xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-secondary/50",
                i === Math.min(selected, pairs.length - 1) && "ring-2 ring-primary",
              )}
            >
              {[
                { team: h, total: ht.actual },
                { team: a, total: at.actual },
              ].map(({ team, total }) => (
                <div key={team.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-1">
                  <TeamCrest team={team} />
                  <span className="truncate text-base font-semibold">{team.name}</span>
                  <span className="font-display text-xl font-bold tabular-nums">
                    {total.toFixed(1)}
                  </span>
                </div>
              ))}
            </button>
          );
        })}
      </div>

      {home && away && (
        <MatchupBoard league={league} byId={byId} week={activeWeek} home={home} away={away} />
      )}
    </>
  );
}

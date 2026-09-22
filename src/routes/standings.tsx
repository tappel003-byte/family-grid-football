import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { AppShell, LoadingScreen, PageTitle } from "@/components/fantasy/AppShell";
import { TeamCrest, teamTotals } from "@/components/fantasy/MatchupBoard";
import { playersQueryOptions, useLeague } from "@/lib/fantasy/hooks";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import type { League } from "@/lib/fantasy/league";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/standings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "Standings — Family Football" },
      {
        name: "description",
        content: "Win-loss records and total points for every team in the family league.",
      },
      { property: "og:title", content: "Standings — Family Football" },
      {
        property: "og:description",
        content: "Win-loss records and total points for every team in the family league.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <Suspense fallback={<LoadingScreen />}>
        <StandingsPage />
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

type Row = {
  teamIndex: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  lastResult: "W" | "L" | "T" | null;
};

function computeStandings(league: League, byId: Map<string, SlimPlayer>): Row[] {
  const rows: Row[] = league.teams.map((_, i) => ({
    teamIndex: i,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    lastResult: null,
  }));

  const weeksPlayed = Math.max(0, league.currentWeek - 1);
  for (let w = 1; w <= weeksPlayed; w++) {
    const pairs = league.schedule[w - 1] ?? [];
    for (const [h, a] of pairs) {
      const home = league.teams[h];
      const away = league.teams[a];
      if (!home || !away) continue;
      const hs = teamTotals(home, w, league, byId).actual;
      const as = teamTotals(away, w, league, byId).actual;
      const hr = rows[h]!;
      const ar = rows[a]!;
      hr.pointsFor += hs;
      hr.pointsAgainst += as;
      ar.pointsFor += as;
      ar.pointsAgainst += hs;
      if (hs > as) {
        hr.wins++;
        ar.losses++;
        hr.lastResult = "W";
        ar.lastResult = "L";
      } else if (as > hs) {
        ar.wins++;
        hr.losses++;
        ar.lastResult = "W";
        hr.lastResult = "L";
      } else {
        hr.ties++;
        ar.ties++;
        hr.lastResult = "T";
        ar.lastResult = "T";
      }
    }
  }

  rows.sort(
    (x, y) =>
      y.wins * 2 + y.ties - (x.wins * 2 + x.ties) || y.pointsFor - x.pointsFor,
  );
  return rows;
}

function StandingsPage() {
  const { league, byId } = useLeague();
  if (!league) return <LoadingScreen label="Setting up your league…" />;

  const rows = computeStandings(league, byId);
  const weeksPlayed = Math.max(0, league.currentWeek - 1);

  return (
    <>
      <PageTitle
        title="Standings"
        subtitle={
          weeksPlayed === 0
            ? "The season kicks off this week — records show once week 1 is in the books."
            : `Through week ${weeksPlayed} · ${weeksPlayed} game${weeksPlayed === 1 ? "" : "s"} played`
        }
      />

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b bg-secondary/50 text-sm uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-3 sm:px-5">#</th>
              <th className="px-1 py-3">Team</th>
              <th className="px-2 py-3 text-center sm:px-5">Rec</th>
              <th className="hidden px-3 py-3 text-right sm:table-cell">PF</th>
              <th className="hidden px-3 py-3 text-right sm:table-cell">PA</th>
              <th className="hidden px-3 py-3 text-right sm:table-cell">Diff</th>
              <th className="px-3 py-3 text-center sm:px-5">Last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const team = league.teams[row.teamIndex]!;
              const diff = row.pointsFor - row.pointsAgainst;
              return (
                <tr
                  key={team.id}
                  className={cn(
                    "border-b last:border-b-0 transition-colors hover:bg-secondary/40",
                    i === 0 && row.wins + row.losses + row.ties > 0 && "bg-primary/5",
                  )}
                >
                  <td className="px-3 py-3 sm:px-5">
                    <span className="font-display text-xl font-bold tabular-nums">{i + 1}</span>
                  </td>
                  <td className="px-1 py-3">
                    <Link
                      to="/team/$teamId"
                      params={{ teamId: team.id }}
                      className="flex min-w-0 items-center gap-3 rounded-lg hover:underline"
                    >
                      <TeamCrest team={team} />
                      <span className="min-w-0">
                        <span className="block truncate font-display text-lg font-bold">
                          {team.name}
                        </span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {team.owner}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-2 py-3 text-center font-display text-xl font-bold tabular-nums sm:px-5">
                    {row.wins}-{row.losses}
                    {row.ties > 0 ? `-${row.ties}` : ""}
                  </td>
                  <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">
                    {row.pointsFor.toFixed(1)}
                  </td>
                  <td className="hidden px-3 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {row.pointsAgainst.toFixed(1)}
                  </td>
                  <td
                    className={cn(
                      "hidden px-3 py-3 text-right font-semibold tabular-nums sm:table-cell",
                      diff > 0 && "text-green-700 dark:text-green-400",
                      diff < 0 && "text-red-700 dark:text-red-400",
                    )}
                  >
                    {diff > 0 ? "+" : ""}
                    {diff.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-center sm:px-5">
                    {row.lastResult ? (
                      <span
                        className={cn(
                          "inline-grid h-8 w-8 place-items-center rounded-full font-display text-base font-bold text-white",
                          row.lastResult === "W" && "bg-green-700 dark:bg-green-600",
                          row.lastResult === "L" && "bg-red-700 dark:bg-red-600",
                          row.lastResult === "T" && "bg-muted-foreground",
                        )}
                      >
                        {row.lastResult}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { AppShell, LoadingScreen } from "@/components/fantasy/AppShell";
import { RosterTable } from "@/components/fantasy/RosterTable";
import { TeamCrest, teamTotals } from "@/components/fantasy/MatchupBoard";
import { InsightsProvider } from "@/components/fantasy/PlayerInsights";
import { WeekSelector } from "@/components/fantasy/WeekSelector";
import { playersQueryOptions, useLeague, useWeekData } from "@/lib/fantasy/hooks";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/my-team")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "My Team — La Familia Fantasy Football" },
      {
        name: "description",
        content: "Set your starters, bench players and optimize your own lineup each week.",
      },
      { property: "og:title", content: "My Team — La Familia Fantasy Football" },
      {
        property: "og:description",
        content: "Set your starters, bench players and optimize your own lineup each week.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <Suspense fallback={<LoadingScreen />}>
        <MyTeamPage />
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
  notFoundComponent: () => <AppShell>That team is not in the league.</AppShell>,
});

function MyTeamPage() {
  const { league, byId } = useLeague();
  const { user } = useAuth();
  const [week, setWeek] = useState<number | null>(null);
  const activeWeek = week ?? league?.currentWeek ?? 1;
  useWeekData(activeWeek);

  if (!league) return <LoadingScreen label="Setting up your league…" />;

  const team = league.teams.find((t) => !!user && t.userId === user.id);

  if (!team) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-lg">
        <p className="font-display text-2xl font-bold">No team yet</p>
        <p className="mt-2 text-muted-foreground">
          Your account isn't linked to a team. Ask the commissioner to hook you up, or take a
          look at{" "}
          <Link to="/teams" className="font-semibold text-primary underline-offset-4 hover:underline">
            all the teams
          </Link>
          .
        </p>
      </div>
    );
  }

  const totals = teamTotals(team, activeWeek, league, byId);

  return (
    <>
      <div className="mb-5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 sm:flex sm:justify-between">
        <div className="col-span-2 flex min-w-0 items-center gap-4 sm:col-span-1">
          <TeamCrest team={team} size="lg" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <h1 className="truncate font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {team.name}
              </h1>
            </div>
            <p className="truncate text-base text-muted-foreground sm:text-lg">
              Your team · {totals.actual.toFixed(1)} pts (proj {totals.projected.toFixed(1)})
            </p>
          </div>
        </div>
        <WeekSelector week={activeWeek} onChange={setWeek} />
      </div>
      <InsightsProvider week={activeWeek} scoring={league.scoring}>
        <RosterTable team={team} league={league} byId={byId} week={activeWeek} editable />
      </InsightsProvider>
    </>
  );
}

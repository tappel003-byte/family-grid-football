import { createFileRoute, notFound } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { AppShell, LoadingScreen } from "@/components/fantasy/AppShell";
import { RosterTable } from "@/components/fantasy/RosterTable";
import { TeamCrest, teamTotals } from "@/components/fantasy/MatchupBoard";
import { WeekSelector } from "@/components/fantasy/WeekSelector";
import { playersQueryOptions, useLeague } from "@/lib/fantasy/hooks";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/team/$teamId")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "Team Roster — Family Football" },
      { name: "description", content: "Set your starters, swap players and optimize your lineup." },
      { property: "og:title", content: "Team Roster — Family Football" },
      {
        property: "og:description",
        content: "Set your starters, swap players and optimize your lineup.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <Suspense fallback={<LoadingScreen />}>
        <TeamPage />
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

function TeamPage() {
  const { teamId } = Route.useParams();
  const { league, byId } = useLeague();
  const { user, isCommissioner } = useAuth();
  const [week, setWeek] = useState<number | null>(null);

  if (!league) return <LoadingScreen label="Setting up your league…" />;
  const team = league.teams.find((t) => t.id === teamId);
  if (!team) throw notFound();

  const activeWeek = week ?? league.currentWeek;
  const totals = teamTotals(team, activeWeek, league, byId);

  return (
    <>
      <div className="mb-5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 sm:flex sm:justify-between">
        <div className="col-span-2 flex min-w-0 items-center gap-4 sm:col-span-1">
          <TeamCrest team={team} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {team.name}
            </h1>
            <p className="truncate text-base text-muted-foreground sm:text-lg">
              {team.owner} · {totals.actual.toFixed(1)} pts (proj {totals.projected.toFixed(1)})
            </p>
          </div>
        </div>
        <WeekSelector week={activeWeek} onChange={setWeek} />
      </div>
      <RosterTable team={team} league={league} byId={byId} week={activeWeek} />
    </>
  );
}

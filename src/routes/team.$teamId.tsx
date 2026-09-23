import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Suspense, useState } from "react";
import { AppShell, LoadingScreen } from "@/components/fantasy/AppShell";
import { RosterTable } from "@/components/fantasy/RosterTable";
import { TeamCrest, teamTotals } from "@/components/fantasy/MatchupBoard";
import { InsightsProvider } from "@/components/fantasy/PlayerInsights";
import { WeekSelector } from "@/components/fantasy/WeekSelector";
import { playersQueryOptions, useLeague, useWeekData } from "@/lib/fantasy/hooks";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/team/$teamId")({
  validateSearch: (search: Record<string, unknown>): { commish?: boolean } => {
    const v = search["commish"];
    return v === true || v === "true" || v === 1 || v === "1" ? { commish: true } : {};
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "Team Roster — La Familia" },
      { name: "description", content: "Set your starters, swap players and optimize your lineup." },
      { property: "og:title", content: "Team Roster — La Familia" },
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
  const search = Route.useSearch();
  const { league, byId } = useLeague();
  const { user, isCommissioner } = useAuth();
  const [week, setWeek] = useState<number | null>(null);
  const activeWeek = week ?? league?.currentWeek ?? 1;
  useWeekData(activeWeek);

  if (!league) return <LoadingScreen label="Setting up your league…" />;
  const team = league.teams.find((t) => t.id === teamId);
  if (!team) throw notFound();

  const totals = teamTotals(team, activeWeek, league, byId);
  const isOwner = !!user && team.userId === user.id;
  const commishMode = !!user && isCommissioner && !isOwner && search.commish === true;
  const canEdit = isOwner || commishMode;

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
      {commishMode && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
          <p className="min-w-0 flex-1 text-base font-semibold">
            Commissioner mode: you are editing {team.owner ? `${team.owner}'s` : "this"} team. Changes show up in League Activity.
          </p>
          <Link
            to="/settings"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <X className="h-4 w-4" /> Close commissioner mode
          </Link>
        </div>
      )}
      {!canEdit && (
        <p className="mb-3 rounded-xl border bg-secondary/50 px-4 py-3 text-base text-muted-foreground">
          You can look at this roster, but only {team.owner || "its manager"} can change the lineup.
        </p>
      )}
      <InsightsProvider week={activeWeek} scoring={league.scoring}>
        <RosterTable
          team={team}
          league={league}
          byId={byId}
          week={activeWeek}
          editable={canEdit}
        />
      </InsightsProvider>
    </>
  );
}

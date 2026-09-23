import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { AppShell, LoadingScreen, PageTitle } from "@/components/fantasy/AppShell";
import { TeamCrest, teamTotals } from "@/components/fantasy/MatchupBoard";
import { useLeague } from "@/lib/fantasy/hooks";
import { useTradeBlock } from "@/components/fantasy/TradeFlag";
import { Handshake } from "lucide-react";
import { playersQueryOptions } from "@/lib/fantasy/hooks";

export const Route = createFileRoute("/teams")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "League Teams — La Familia" },
      {
        name: "description",
        content: "Every family team, owner and weekly projected total in one place.",
      },
      { property: "og:title", content: "League Teams — La Familia" },
      {
        property: "og:description",
        content: "Every family team, owner and weekly projected total in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <Suspense fallback={<LoadingScreen />}>
        <TeamsPage />
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
  notFoundComponent: () => <AppShell>No teams found.</AppShell>,
});

function TeamsPage() {
  const { league, byId } = useLeague();
  const { data: block = [] } = useTradeBlock();
  if (!league) return <LoadingScreen label="Setting up your league…" />;

  return (
    <>
      <PageTitle title="League Teams" subtitle={`${league.teams.length} family teams`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {league.teams.map((team, slot) => {
          const t = teamTotals(team, league.currentWeek, league, byId);
          const available = block
            .filter((row) => row.team_slot === slot)
            .map((row) => byId.get(row.player_id)?.name)
            .filter((name): name is string => !!name);
          return (
            <Link
              key={team.id}
              to="/team/$teamId"
              params={{ teamId: team.id }}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-secondary/50"
            >
              <TeamCrest team={team} size="lg" />
              <div className="min-w-0">
                <div className="truncate font-display text-xl font-bold">{team.name}</div>
                <div className="truncate text-base text-muted-foreground">{team.owner}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-bold tabular-nums">
                  {t.actual.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">proj {t.projected.toFixed(1)}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { AppShell, LoadingScreen, PageTitle } from "@/components/fantasy/AppShell";
import { TeamCrest, teamTotals } from "@/components/fantasy/MatchupBoard";
import { playersQueryOptions, useLeague, useWeeksData } from "@/lib/fantasy/hooks";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import type { FantasyTeam, League } from "@/lib/fantasy/league";
import { cn } from "@/lib/utils";

const SEMI_WEEK = 16;
const FINAL_WEEK = 17;

export const Route = createFileRoute("/playoffs")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "Playoff Bracket — La Familia 2026" },
      {
        name: "description",
        content:
          "The four-team La Familia playoff bracket: semifinals in week 16 and the championship in week 17.",
      },
      { property: "og:title", content: "Playoff Bracket — La Familia 2026" },
      {
        property: "og:description",
        content:
          "The four-team La Familia playoff bracket: semifinals in week 16 and the championship in week 17.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <Suspense fallback={<LoadingScreen />}>
        <PlayoffsPage />
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

type Record_ = { index: number; wins: number; losses: number; ties: number; pointsFor: number };

function records(league: League, byId: Map<string, SlimPlayer>): Record_[] {
  const rows: Record_[] = league.teams.map((_, i) => ({
    index: i,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
  }));
  const weeksPlayed = Math.min(15, Math.max(0, league.currentWeek - 1));
  for (let w = 1; w <= weeksPlayed; w++) {
    for (const [h, a] of league.schedule[w - 1] ?? []) {
      const home = league.teams[h];
      const away = league.teams[a];
      if (!home || !away) continue;
      const hs = teamTotals(home, w, league, byId).actual;
      const as = teamTotals(away, w, league, byId).actual;
      const hr = rows[h]!;
      const ar = rows[a]!;
      hr.pointsFor += hs;
      ar.pointsFor += as;
      if (hs > as) {
        hr.wins++;
        ar.losses++;
      } else if (as > hs) {
        ar.wins++;
        hr.losses++;
      } else {
        hr.ties++;
        ar.ties++;
      }
    }
  }
  return rows;
}

const points = (r: Record_) => r.wins * 2 + r.ties;
const better = (x: Record_, y: Record_) => points(y) - points(x) || y.pointsFor - x.pointsFor;

/** Two division winners get the top seeds, then the two best remaining records. */
function seeds(league: League, byId: Map<string, SlimPlayer>): Record_[] {
  const rows = records(league, byId).sort(better);
  const divisions = Array.from(
    new Set(league.teams.map((t) => t.division ?? "").filter(Boolean)),
  ).sort();

  if (divisions.length < 2) return rows.slice(0, 4);

  const winners = divisions
    .map((d) => rows.find((r) => (league.teams[r.index]?.division ?? "") === d))
    .filter((r): r is Record_ => !!r)
    .sort(better);
  const rest = rows.filter((r) => !winners.includes(r)).slice(0, 2);
  return [...winners, ...rest];
}

function PlayoffsPage() {
  const { league, byId } = useLeague();
  useWeeksData(Math.max(0, (league?.currentWeek ?? 1) - 1));
  if (!league) return <LoadingScreen label="Setting up your league…" />;

  const weeksPlayed = Math.min(15, Math.max(0, league.currentWeek - 1));
  const clinched = weeksPlayed >= 15;
  const ranked = seeds(league, byId);
  const teamOf = (r?: Record_) => (r ? league.teams[r.index] : undefined);

  const semiA = { home: ranked[0], away: ranked[3] };
  const semiB = { home: ranked[1], away: ranked[2] };

  const winnerOf = (home?: Record_, away?: Record_, week = SEMI_WEEK) => {
    if (league.currentWeek <= week) return undefined;
    const h = teamOf(home);
    const a = teamOf(away);
    if (!h || !a) return undefined;
    const hs = teamTotals(h, week, league, byId).actual;
    const as = teamTotals(a, week, league, byId).actual;
    if (hs === as) return undefined;
    return hs > as ? home : away;
  };

  const finalHome = winnerOf(semiA.home, semiA.away);
  const finalAway = winnerOf(semiB.home, semiB.away);
  const champ = winnerOf(finalHome, finalAway, FINAL_WEEK);

  return (
    <>
      <PageTitle
        title="Playoff Bracket"
        subtitle={
          clinched
            ? "Semifinals in week 16, championship in week 17."
            : `Projected seeds through week ${weeksPlayed} — the top four make it. Semifinals week 16, championship week 17.`
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold">Semifinals · Week 16</h2>
          <BracketGame
            league={league}
            byId={byId}
            week={SEMI_WEEK}
            home={semiA.home}
            away={semiA.away}
            seedHome={1}
            seedAway={4}
          />
          <BracketGame
            league={league}
            byId={byId}
            week={SEMI_WEEK}
            home={semiB.home}
            away={semiB.away}
            seedHome={2}
            seedAway={3}
          />
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold">Championship · Week 17</h2>
          <BracketGame
            league={league}
            byId={byId}
            week={FINAL_WEEK}
            home={finalHome}
            away={finalAway}
            placeholder="Semifinal winner"
          />
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold">Champion</h2>
          <div className="rounded-2xl border bg-card p-5 text-center shadow-sm">
            {champ && teamOf(champ) ? (
              <>
                <div className="mx-auto mb-3 w-fit">
                  <TeamCrest team={teamOf(champ)!} />
                </div>
                <p className="font-display text-2xl font-bold">{teamOf(champ)!.name}</p>
                <p className="text-base text-muted-foreground">{teamOf(champ)!.owner}</p>
              </>
            ) : (
              <p className="py-6 text-base text-muted-foreground">To be determined</p>
            )}
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h3 className="mb-2 font-display text-base font-bold">
              {clinched ? "Final seeds" : "Current seeding"}
            </h3>
            <ol className="space-y-1">
              {ranked.map((r, i) => {
                const team = teamOf(r);
                if (!team) return null;
                return (
                  <li key={team.id} className="flex items-center gap-2 text-base">
                    <span className="w-5 font-display font-bold tabular-nums">{i + 1}</span>
                    <Link
                      to="/team/$teamId"
                      params={{ teamId: team.id }}
                      className="min-w-0 truncate font-semibold hover:underline"
                    >
                      {team.name}
                    </Link>
                    <span className="ml-auto tabular-nums text-muted-foreground">
                      {r.wins}-{r.losses}
                      {r.ties > 0 ? `-${r.ties}` : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}

function BracketGame({
  league,
  byId,
  week,
  home,
  away,
  seedHome,
  seedAway,
  placeholder = "To be determined",
}: {
  league: League;
  byId: Map<string, SlimPlayer>;
  week: number;
  home?: Record_;
  away?: Record_;
  seedHome?: number;
  seedAway?: number;
  placeholder?: string;
}) {
  const teams = league.teams;
  const rows: Array<{ team?: FantasyTeam; seed?: number }> = [
    { team: home !== undefined ? teams[home.index] : undefined, seed: seedHome },
    { team: away !== undefined ? teams[away.index] : undefined, seed: seedAway },
  ];
  const scores = rows.map((r) =>
    r.team && league.currentWeek >= week ? teamTotals(r.team, week, league, byId).actual : null,
  );
  const leader =
    scores[0] !== null && scores[1] !== null && scores[0] !== scores[1]
      ? scores[0]! > scores[1]!
        ? 0
        : 1
      : -1;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      {rows.map((row, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-3 px-4 py-3",
            i === 0 && "border-b",
            leader === i && "bg-primary/5",
          )}
        >
          {row.team ? (
            <>
              <TeamCrest team={row.team} />
              <span className="min-w-0">
                <span className="block truncate font-display text-lg font-bold">
                  {row.seed ? `${row.seed}. ` : ""}
                  {row.team.name}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {row.team.owner}
                </span>
              </span>
              <span className="ml-auto font-display text-xl font-bold tabular-nums">
                {scores[i] === null ? "—" : scores[i]!.toFixed(1)}
              </span>
            </>
          ) : (
            <span className="py-2 text-base text-muted-foreground">{placeholder}</span>
          )}
        </div>
      ))}
    </div>
  );
}

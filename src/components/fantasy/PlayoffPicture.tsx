import { Link } from "@tanstack/react-router";
import { TeamCrest, teamTotals } from "@/components/fantasy/MatchupBoard";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import type { FantasyTeam, League } from "@/lib/fantasy/league";
import { cn } from "@/lib/utils";

const SEMI_WEEK = 16;
const FINAL_WEEK = 17;

type RecordRow = {
  index: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
};

function records(league: League, byId: Map<string, SlimPlayer>): RecordRow[] {
  const rows: RecordRow[] = league.teams.map((_, index) => ({
    index,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
  }));
  const weeksPlayed = Math.min(15, Math.max(0, league.currentWeek - 1));
  for (let week = 1; week <= weeksPlayed; week++) {
    for (const [homeIndex, awayIndex] of league.schedule[week - 1] ?? []) {
      const home = league.teams[homeIndex];
      const away = league.teams[awayIndex];
      const homeRecord = rows[homeIndex];
      const awayRecord = rows[awayIndex];
      if (!home || !away || !homeRecord || !awayRecord) continue;
      const homeScore = teamTotals(home, week, league, byId).actual;
      const awayScore = teamTotals(away, week, league, byId).actual;
      homeRecord.pointsFor += homeScore;
      awayRecord.pointsFor += awayScore;
      if (homeScore > awayScore) {
        homeRecord.wins++;
        awayRecord.losses++;
      } else if (awayScore > homeScore) {
        awayRecord.wins++;
        homeRecord.losses++;
      } else {
        homeRecord.ties++;
        awayRecord.ties++;
      }
    }
  }
  return rows;
}

const recordPoints = (row: RecordRow) => row.wins * 2 + row.ties;
const betterRecord = (left: RecordRow, right: RecordRow) =>
  recordPoints(right) - recordPoints(left) || right.pointsFor - left.pointsFor;

function playoffSeeds(league: League, byId: Map<string, SlimPlayer>): RecordRow[] {
  const rows = records(league, byId).sort(betterRecord);
  const divisions = Array.from(
    new Set(league.teams.map((team) => team.division ?? "").filter(Boolean)),
  ).sort();
  if (divisions.length < 2) return rows.slice(0, 4);

  const winners = divisions
    .map((division) => rows.find((row) => league.teams[row.index]?.division === division))
    .filter((row): row is RecordRow => Boolean(row))
    .sort(betterRecord);
  const rest = rows.filter((row) => !winners.includes(row)).slice(0, 2);
  return [...winners, ...rest];
}

export function PlayoffPicture({
  league,
  byId,
  showHeading = true,
}: {
  league: League;
  byId: Map<string, SlimPlayer>;
  showHeading?: boolean;
}) {
  const weeksPlayed = Math.min(15, Math.max(0, league.currentWeek - 1));
  const clinched = weeksPlayed >= 15;
  const ranked = playoffSeeds(league, byId);
  const teamOf = (row?: RecordRow) => (row ? league.teams[row.index] : undefined);
  const semiA = { home: ranked[0], away: ranked[3] };
  const semiB = { home: ranked[1], away: ranked[2] };

  const winnerOf = (home?: RecordRow, away?: RecordRow, week = SEMI_WEEK) => {
    if (league.currentWeek <= week) return undefined;
    const homeTeam = teamOf(home);
    const awayTeam = teamOf(away);
    if (!homeTeam || !awayTeam) return undefined;
    const homeScore = teamTotals(homeTeam, week, league, byId).actual;
    const awayScore = teamTotals(awayTeam, week, league, byId).actual;
    if (homeScore === awayScore) return undefined;
    return homeScore > awayScore ? home : away;
  };

  const finalHome = winnerOf(semiA.home, semiA.away);
  const finalAway = winnerOf(semiB.home, semiB.away);
  const champion = winnerOf(finalHome, finalAway, FINAL_WEEK);
  const championTeam = teamOf(champion);

  return (
    <section className="mt-10 border-t pt-8">
      {showHeading && (
        <div className="mb-5">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Current playoff picture</h2>
          <p className="mt-1 text-base text-muted-foreground">
            {clinched
              ? "Final seeds · semifinals week 16 · championship week 17"
              : `Projected through week ${weeksPlayed} · the top four make it`}
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4">
          <h3 className="font-display text-lg font-bold">Semifinals · Week 16</h3>
          <BracketGame league={league} byId={byId} week={SEMI_WEEK} home={semiA.home} away={semiA.away} seedHome={1} seedAway={4} />
          <BracketGame league={league} byId={byId} week={SEMI_WEEK} home={semiB.home} away={semiB.away} seedHome={2} seedAway={3} />
        </div>

        <div className="space-y-4">
          <h3 className="font-display text-lg font-bold">Championship · Week 17</h3>
          <BracketGame league={league} byId={byId} week={FINAL_WEEK} home={finalHome} away={finalAway} placeholder="Semifinal winner" />
        </div>

        <div className="space-y-4">
          <h3 className="font-display text-lg font-bold">Champion</h3>
          <div className="rounded-lg border bg-card p-5 text-center shadow-sm">
            {championTeam ? (
              <>
                <div className="mx-auto mb-3 w-fit"><TeamCrest team={championTeam} /></div>
                <p className="font-display text-2xl font-bold">{championTeam.name}</p>
                <p className="text-base text-muted-foreground">{championTeam.owner}</p>
              </>
            ) : (
              <p className="py-6 text-base text-muted-foreground">To be determined</p>
            )}
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h3 className="mb-2 font-display text-base font-bold">{clinched ? "Final seeds" : "Current seeding"}</h3>
            <ol className="space-y-1">
              {ranked.map((row, index) => {
                const team = teamOf(row);
                if (!team) return null;
                return (
                  <li key={team.id} className="flex items-center gap-2 text-base">
                    <span className="w-5 font-display font-bold tabular-nums">{index + 1}</span>
                    <Link to="/team/$teamId" params={{ teamId: team.id }} className="min-w-0 truncate font-semibold hover:underline">
                      {team.name}
                    </Link>
                    <span className="ml-auto tabular-nums text-muted-foreground">
                      {row.wins}-{row.losses}{row.ties > 0 ? `-${row.ties}` : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
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
  home?: RecordRow | undefined;
  away?: RecordRow | undefined;
  seedHome?: number | undefined;
  seedAway?: number | undefined;
  placeholder?: string;
}) {
  const rows: Array<{ team: FantasyTeam | undefined; seed: number | undefined }> = [
    { team: home ? league.teams[home.index] : undefined, seed: seedHome },
    { team: away ? league.teams[away.index] : undefined, seed: seedAway },
  ];
  const scores = rows.map((row) =>
    row.team && league.currentWeek >= week ? teamTotals(row.team, week, league, byId).actual : null,
  );
  const firstScore = scores[0] ?? null;
  const secondScore = scores[1] ?? null;
  const leader =
    firstScore !== null && secondScore !== null && firstScore !== secondScore
      ? firstScore > secondScore ? 0 : 1
      : -1;

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      {rows.map((row, index) => (
        <div key={index} className={cn("flex items-center gap-3 px-4 py-3", index === 0 && "border-b", leader === index && "bg-primary/5")}>
          {row.team ? (
            <>
              <TeamCrest team={row.team} />
              <span className="min-w-0">
                <span className="block truncate font-display text-lg font-bold">{row.seed ? `${row.seed}. ` : ""}{row.team.name}</span>
                <span className="block truncate text-sm text-muted-foreground">{row.team.owner}</span>
              </span>
              <span className="ml-auto font-display text-xl font-bold tabular-nums">
                {scores[index] === null ? "—" : scores[index]?.toFixed(1)}
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

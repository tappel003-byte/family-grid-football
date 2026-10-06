import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getPlayerNews } from "@/lib/player-news.functions";
import { getTeamResearch } from "@/lib/team-research.functions";
import { ordinal } from "@/lib/injury-outlook";
import { Bookmark, ChevronDown, Newspaper } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { League } from "@/lib/fantasy/league";
import { ownedIds } from "@/lib/fantasy/league";
import type { PlayerNews } from "@/lib/market.functions";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import {
  gameInfoFor,
  headshotUrl,
  marketQueryOptions,
  scoreFor,

  teamLogoUrl,
  trendingQueryOptions,
  usePlayers,
} from "@/lib/fantasy/hooks";
import { formatGameTime, useTimeZone } from "@/lib/timezone";
import { listMyWatchlist, setWatched } from "@/lib/fantasy/community";
import { ByeBadge, isOnBye, matchupFor, useInsights } from "./PlayerInsights";
import { InjuryBadge } from "./PlayerCell";
import { AddDropButton } from "./AddDropButton";
import { cn } from "@/lib/utils";
import { depthLabel, usePractice } from "./ResearchTags";
import { ScoringSummary } from "./ScoringSummary";

/** Everything the card shows, already computed by the Players list rows. */
export type PlayerCardRow = {
  player: SlimPlayer;
  rank: number;
  owner: string | null;
  proj: number;
  own: { owned: number; started: number; change: number } | null;
  news: PlayerNews | null;
  last3Avg: number;
  seasonPts: number;
  seasonAvg: number;
  adds: number;
  drops: number;
  rec: { label: string; reason: string; level: string } | null;
};

const COMPACT = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border bg-card px-1 py-2 text-center">
      <div className={cn("font-display text-lg font-bold tabular-nums", strong && "text-primary")}>
        {value}
      </div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Grid({ cols, children }: { cols: 2 | 3 | 4; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid gap-1.5",
        cols === 2 && "grid-cols-2",
        cols === 3 && "grid-cols-3",
        cols === 4 && "grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}

/** Full player card, opened by tapping a player anywhere on the Players screen. */
export function PlayerSheet({
  row,
  posRank,
  week,
  league,
  open,
  onOpenChange,
}: {
  row: PlayerCardRow;
  posRank: number | null;
  week: number;
  league: League | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { player } = row;
  const insights = useInsights();
  const queryClient = useQueryClient();
  const { players: allPlayers } = usePlayers();
  const byIdMap = useMemo(
    () => new Map(allPlayers.map((p) => [p.id, p])),
    [allPlayers],
  );
  const { data: watchedIds = [] } = useQuery({
    queryKey: ["my-watchlist"],
    queryFn: listMyWatchlist,
    enabled: open,
  });
  const isWatched = watchedIds.includes(player.id);
  const timeZone = useTimeZone();
  const game = gameInfoFor(player.team, week);
  const kickoff = formatGameTime(game?.startsAt, timeZone);
  const onBye = isOnBye(insights, player, week);
  const m = matchupFor(insights, player);
  const info = insights?.players[player.id];
  const score = league ? scoreFor(player, week, league) : null;
  const started = game?.status === "live" || game?.status === "final";
  const headlinePts = started && score ? score.actual : row.proj;

  const fetchNews = useServerFn(getPlayerNews);
  const { data: rawPlayerNews } = useQuery({
    queryKey: ["player-news", player.id],
    queryFn: () => fetchNews({ data: { sleeperId: player.id } }),
    enabled: open,
    staleTime: 1000 * 60 * 15,
    retry: false,
  });
  // Only keep stories from the last 7 days; older ones drop off.
  const playerNews = (rawPlayerNews ?? []).filter((n) => {
    if (!n.published) return false;
    const t = new Date(n.published).getTime();
    return Number.isFinite(t) && Date.now() - t <= 1000 * 60 * 60 * 24 * 7;
  });
  const practice = usePractice(player);
  const depth = depthLabel(player);
  const fetchResearch = useServerFn(getTeamResearch);
  const { data: research } = useQuery({
    queryKey: ["team-research"],
    queryFn: () => fetchResearch(),
    enabled: open,
    staleTime: 1000 * 60 * 45,
    refetchOnMount: "always",
  });
  const offenseRank =
    player.pos === "DEF"
      ? undefined
      : research?.offenseRankByTeam[player.team === "WSH" ? "WAS" : player.team];
  const injuryOutlook = research?.injuries[player.id];

  const skill = player.pos !== "DEF" && player.pos !== "K";
  const newsBody = row.news ? (
    <>
      <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block font-semibold leading-snug">{row.news.headline}</span>
        {row.news.description && (
          <span className="mt-1 block leading-snug text-foreground/85">{row.news.description}</span>
        )}
        <span className="block text-xs text-muted-foreground">Latest news · ESPN{row.news.link ? " · Tap for full story" : ""}</span>
      </span>
    </>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-2xl p-4 sm:max-w-md">
        <DialogTitle className="sr-only">{player.name} — full player card</DialogTitle>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <img
              src={headshotUrl(player.id, player.pos, player.team)}
              alt=""
              className={cn(
                "h-16 w-16 rounded-full bg-muted object-cover ring-1 ring-border",
                player.injury?.toUpperCase().startsWith("OUT") &&
                  "opacity-70 ring-2 ring-injury-out",
              )}
              onError={(e) => {
                e.currentTarget.src = teamLogoUrl(player.team);
              }}
            />
            {player.pos !== "DEF" && (
              <img
                src={teamLogoUrl(player.team)}
                alt=""
                className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background p-[1px] ring-1 ring-border"
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-display text-xl font-bold leading-tight">{player.name}</span>
              <InjuryBadge injury={player.injury} />
              <ByeBadge player={player} week={week} />
            </div>
            <p className="mt-0.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {player.pos === "DEF"
                ? `${player.team} Defense`
                : `#${player.number ?? "—"} · ${player.team} · ${player.pos}${
                    player.age ? ` · Age ${player.age}` : ""
                  }`}
            </p>
            {player.injury && player.injuryBodyPart && (
              <p className="text-sm font-semibold text-injury-out">
                {player.injury} · {player.injuryBodyPart}
                {player.injuryNotes ? ` (${player.injuryNotes.toLowerCase()})` : ""}
              </p>
            )}
            {injuryOutlook?.cardLine && (
              <p className="text-sm font-semibold text-injury-out">{injuryOutlook.cardLine}</p>
            )}
            {practice && (
              <p
                className={cn(
                  "text-sm font-semibold",
                  practice === "DNP" ? "text-injury-out" : "text-foreground/80",
                )}
              >
                Practice: {practice === "DNP" ? "Did not practice" : "Limited"} · latest report
              </p>
            )}
            {(depth || offenseRank != null) && (
              <p className="text-sm text-muted-foreground">
                {depth && offenseRank != null
                  ? `${depth} on the ${ordinal(offenseRank)}-ranked offense`
                  : depth
                    ? `Depth chart: ${ordinal(player.depth!)} ${player.pos} for ${player.team}`
                    : `${ordinal(offenseRank!)}-ranked offense`}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {row.owner ? `Rostered by ${row.owner}` : "Free agent"}
            </p>
          </div>
        </div>

        <Button
          variant={isWatched ? "default" : "outline"}
          className="w-full font-semibold"
          onClick={() => {
            void (async () => {
              try {
                await setWatched(player.id, !isWatched);
                await queryClient.invalidateQueries({ queryKey: ["my-watchlist"] });
                toast.success(
                  isWatched
                    ? `Removed ${player.name} from your watchlist`
                    : `Added ${player.name} to your watchlist`,
                );
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not update your watchlist.");
              }
            })();
          }}
        >
          <Bookmark className="mr-2 h-4 w-4" fill={isWatched ? "currentColor" : "none"} />
          {isWatched ? "On your watchlist" : "Add to watchlist"}
        </Button>

        {/* This week */}
        <Section title={`Week ${week}`}>
          <div className="rounded-xl border bg-secondary/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold leading-snug">
                  {onBye
                    ? "Bye week"
                    : kickoff
                      ? `${kickoff} · ${game?.network ?? "TV TBD"}`
                      : (game?.label ?? "")}
                </p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {onBye
                    ? "Scores 0 points this week"
                    : game?.status === "live"
                      ? "In progress"
                      : game?.status === "final"
                        ? "Final"
                        : "Hasn't started yet"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-bold tabular-nums text-primary">
                  {headlinePts.toFixed(1)}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {started ? "points" : "projected"}
                </p>
              </div>
            </div>
            {started && league && <ScoringSummary playerId={player.id} week={week} league={league} />}
            {m?.grade && (
              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
                  m.grade.grade === "great" && "bg-emerald-600 text-white",
                  m.grade.grade === "even" && "bg-secondary text-secondary-foreground",
                  m.grade.grade === "tough" && "bg-injury-out text-injury-out-foreground",
                )}
              >
                {m.home ? "vs" : "@"} {m.opponent} · {m.grade.label}
              </span>
            )}
          </div>
        </Section>

        {/* Add / claim straight from the card */}
        {league && !row.owner && (
          <div className="[&_button]:h-10 [&_button]:w-full [&_button]:text-base">
            <AddDropButton player={player} league={league} byId={byIdMap} />
          </div>
        )}

        {/* Waiver recommendation */}
        {row.rec && (
          <div className="rounded-xl bg-primary/10 p-3">
            <p className="font-display text-base font-bold text-primary">{row.rec.label}</p>
            <p className="text-sm text-muted-foreground">{row.rec.reason}</p>
          </div>
        )}

        {/* Game log — collapsed by default, just above Production */}
        {info?.gameLog && info.gameLog.length > 0 && (
          <details className="group rounded-xl border">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground [&::-webkit-details-marker]:hidden">
              Game log
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="divide-y border-t">
              {[...info.gameLog].reverse().map((g) => (
                <div key={g.week} className="flex items-center justify-between px-3 py-1.5 text-sm">
                  <span className="font-semibold">
                    W{g.week}{" "}
                    <span className="font-normal text-muted-foreground">
                      {g.opponent ? `${g.home ? "vs" : "@"} ${g.opponent}` : "Bye"}
                    </span>
                  </span>
                  <span className="font-display font-bold tabular-nums">
                    {g.pts === null ? "—" : g.pts.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Production */}
        <Section title="Production">
          <Grid cols={4}>
            <Stat label="Season pts" value={row.seasonPts.toFixed(1)} strong />
            <Stat label="Pts/game" value={row.seasonAvg.toFixed(1)} />
            <Stat label="Last 3 avg" value={row.last3Avg > 0 ? row.last3Avg.toFixed(1) : "—"} />
            <Stat label="Games" value={String(info?.games ?? 0)} />
          </Grid>
          <Grid cols={2}>
            <Stat label="Overall rank" value={`#${row.rank}`} />
            <Stat label={`${player.pos} rank`} value={posRank ? `#${posRank}` : "—"} />
          </Grid>
        </Section>


        {/* Usage */}
        {skill && info?.snapPct !== null && (
          <Section title="Usage">
            <Grid cols={3}>
              <Stat label="Snap share" value={`${info!.snapPct}%`} />
              <Stat
                label="Targets/gm"
                value={info!.targets > 0 ? info!.targets.toFixed(1) : "—"}
              />
              <Stat
                label="Roster trend"
                value={row.own ? `${row.own.change > 0 ? "+" : ""}${row.own.change}%` : "—"}
              />
            </Grid>
          </Section>
        )}

        {/* Ownership */}
        <Section title="Ownership">
          <Grid cols={3}>
            <Stat label="Rostered" value={row.own ? `${row.own.owned}%` : "—"} />
            <Stat label="Started" value={row.own ? `${row.own.started}%` : "—"} />
            <Stat
              label="Last 3 pts"
              value={info && info.last3.length ? info.last3.reduce((a, b) => a + b, 0).toFixed(1) : "—"}
            />
          </Grid>
        </Section>

        {/* Hype */}
        <Section title="Hype">
          <Grid cols={2}>
            <Stat label="Added (24h)" value={row.adds > 0 ? COMPACT.format(row.adds) : "—"} />
            <Stat label="Dropped (24h)" value={row.drops > 0 ? COMPACT.format(row.drops) : "—"} />
          </Grid>
        </Section>

        {/* News — this player's own ESPN news, else the league-wide headline */}
        {playerNews && playerNews.length > 0 ? (
          <Section title="Latest news · ESPN">
            <div className="space-y-1.5">
              {playerNews.map((n, i) => {
                const date = n.published
                  ? new Date(n.published).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : "";
                const body = (
                  <>
                    <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block font-semibold leading-snug">{n.headline}</span>
                      {n.description && (
                        <span className="mt-1 block leading-snug text-foreground/85">{n.description}</span>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        {date}
                        {n.link ? `${date ? " · " : ""}Full story` : ""}
                      </span>
                    </span>
                  </>
                );
                return n.link ? (
                  <a
                    key={i}
                    href={n.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-2 rounded-xl border p-3 text-sm hover:bg-secondary/50"
                  >
                    {body}
                  </a>
                ) : (
                  <div key={i} className="flex items-start gap-2 rounded-xl border p-3 text-sm">
                    {body}
                  </div>
                );
              })}
            </div>
          </Section>
        ) : (
          row.news &&
          (row.news.link ? (
            <a
              href={row.news.link}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-2 rounded-xl border p-3 text-sm hover:bg-secondary/50"
            >
              {newsBody}
            </a>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border p-3 text-sm">{newsBody}</div>
          ))
        )}

      </DialogContent>
    </Dialog>
  );
}

/**
 * Wraps any player row so tapping it opens the full card. Used on My Team,
 * team pages and matchups, where the Players list's precomputed row is absent.
 */
export function PlayerCardTrigger({
  player,
  week,
  league,
  className,
  children,
}: {
  player: SlimPlayer;
  week: number;
  league: League | null;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const insights = useInsights();
  const { data: market } = useQuery(marketQueryOptions);
  const { data: adds } = useQuery(trendingQueryOptions("add"));
  const { data: drops } = useQuery(trendingQueryOptions("drop"));
  const { players } = usePlayers();

  const ranks = useMemo(() => {
    const scored = players.map((p) => ({
      id: p.id,
      pos: p.pos,
      name: p.name,
      points: insights?.players[p.id]?.seasonPts ?? 0,
    }));
    const compare = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
      b.points - a.points || a.name.localeCompare(b.name);
    const overall = new Map<string, number>();
    [...scored].sort(compare).forEach((p, i) => overall.set(p.id, i + 1));
    const samePos = new Map<string, number>();
    scored
      .filter((p) => p.pos === player.pos)
      .sort(compare)
      .forEach((p, i) => samePos.set(p.id, i + 1));
    return { overall: overall.get(player.id) ?? 9999, pos: samePos.get(player.id) ?? null };
  }, [players, insights, player.id, player.pos]);

  const info = insights?.players[player.id];
  const own = market?.ownership[player.id] ?? null;
  const proj = league ? scoreFor(player, week, league).projected : 0;

  const row: PlayerCardRow = {
    player,
    rank: ranks.overall,
    owner: league?.teams.find((t) => ownedIds(t).includes(player.id))?.name ?? null,
    proj,
    own,
    news: market?.news[player.id] ?? null,
    last3Avg: info?.last3Avg ?? 0,
    seasonPts: info?.seasonPts ?? 0,
    seasonAvg: info?.seasonAvg ?? 0,
    adds: (adds ?? []).find((a) => a.id === player.id)?.count ?? 0,
    drops: (drops ?? []).find((a) => a.id === player.id)?.count ?? 0,
    rec: null,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${player.name}'s full player card`}
        className={cn("block w-full min-w-0 text-left", className)}
      >
        {children}
      </button>
      {open && (
        <PlayerSheet
          row={row}
          posRank={ranks.pos}
          week={week}
          league={league}
          open
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}


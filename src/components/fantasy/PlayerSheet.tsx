import type { ReactNode } from "react";
import { Newspaper } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { League } from "@/lib/fantasy/league";
import type { PlayerNews } from "@/lib/market.functions";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import { gameInfoFor, headshotUrl, scoreFor, teamLogoUrl } from "@/lib/fantasy/hooks";
import { formatGameTime, useTimeZone } from "@/lib/timezone";
import { ByeBadge, isOnBye, matchupFor, useInsights } from "./PlayerInsights";
import { InjuryBadge } from "./PlayerCell";
import { cn } from "@/lib/utils";

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
  const timeZone = useTimeZone();
  const game = gameInfoFor(player.team, week);
  const kickoff = formatGameTime(game?.startsAt, timeZone);
  const onBye = isOnBye(insights, player, week);
  const m = matchupFor(insights, player);
  const info = insights?.players[player.id];
  const score = league ? scoreFor(player, week, league) : null;
  const started = game?.status === "live" || game?.status === "final";
  const headlinePts = started && score ? score.actual : row.proj;

  const skill = player.pos !== "DEF" && player.pos !== "K";
  const newsBody = (
    <>
      <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block font-semibold leading-snug">{row.news!.headline}</span>
        <span className="block text-xs text-muted-foreground">Latest news · ESPN</span>
      </span>
    </>
  );

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
            <p className="text-sm text-muted-foreground">
              {row.owner ? `Rostered by ${row.owner}` : "Free agent"}
            </p>
          </div>
        </div>

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

        {/* Waiver recommendation */}
        {row.rec && (
          <div className="rounded-xl bg-primary/10 p-3">
            <p className="font-display text-base font-bold text-primary">{row.rec.label}</p>
            <p className="text-sm text-muted-foreground">{row.rec.reason}</p>
          </div>
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
          {info && info.last3.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {info.last3.map((pts, i) => (
                <span
                  key={i}
                  className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums"
                >
                  W{week - info.last3.length + i + 1}: {pts.toFixed(1)}
                </span>
              ))}
            </div>
          )}
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

        {/* News */}
        {row.news &&
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
          ))}
      </DialogContent>
    </Dialog>
  );
}

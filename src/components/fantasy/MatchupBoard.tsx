import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { League, FantasyTeam } from "@/lib/fantasy/league";
import { SLOTS } from "@/lib/fantasy/league";
import { gameInfoFor, scoreFor } from "@/lib/fantasy/hooks";
import { savedFinal, scoreOverride } from "@/lib/fantasy/store";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import { AlertTriangle } from "lucide-react";
import { PlayerCell, isInactive, isOnField } from "./PlayerCell";
import { PlayerCardTrigger } from "./PlayerSheet";
import { cn } from "@/lib/utils";
import { teamLogo } from "@/lib/fantasy/logos";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";



export function teamTotals(team: FantasyTeam, week: number, league: League, byId: Map<string, SlimPlayer>) {
  let actual = 0;
  let projected = 0;
  /** Projected points still to come from players whose games aren't over. */
  let remaining = 0;
  const past = week < league.currentWeek;
  for (const id of team.starters) {
    const p = id ? byId.get(id) : undefined;
    if (!p) continue;
    const s = scoreFor(p, week, league);
    actual += s.actual;
    projected += s.projected;
    if (past) continue;
    const g = gameInfoFor(p.team, week);
    if (!g || g.status === "final" || g.status === "none") continue;
    const share = g.status === "scheduled" ? 1 : Math.max(0, Math.min(1, (g.secondsLeft ?? 1800) / 3600));
    remaining += Math.max(0, s.projected) * share;
  }
  const slot = league.teams.findIndex((t) => t.id === team.id);
  const fixed = slot >= 0 ? scoreOverride(week, slot) : undefined;
  const saved = slot >= 0 && past ? savedFinal(week, slot) : undefined;
  const finalActual = fixed ?? saved ?? actual;
  const done = past || fixed != null;
  return {
    actual: Math.round(finalActual * 10) / 10,
    projected: Math.round((done ? finalActual : actual + remaining) * 10) / 10,
    remaining: done ? 0 : remaining,
    corrected: fixed != null,
  };
}

/** Chance the home team wins, from live projected totals and points still to play. */
function winChance(h: { projected: number; remaining: number }, a: { projected: number; remaining: number }) {
  const diff = h.projected - a.projected;
  const left = h.remaining + a.remaining;
  if (left < 0.5) return diff > 0 ? 1 : diff < 0 ? 0 : 0.5;
  const sd = Math.max(1, 1.6 * Math.sqrt(left));
  const z = diff / sd;
  return 1 / (1 + Math.exp(-1.702 * z));
}

function WinBar({ home, away, chance, done }: { home: FantasyTeam; away: FantasyTeam; chance: number; done: boolean }) {
  let hp = Math.round(chance * 100);
  if (!done) hp = Math.max(1, Math.min(99, hp));
  const ap = 100 - hp;
  const label = (p: number) => (done ? `${p}%` : p >= 99 ? ">99%" : p <= 1 ? "<1%" : `${p}%`);
  return (
    <div className="mt-2 w-full max-w-xs">
      <div className="flex justify-between text-xs font-bold tabular-nums">
        <span className={cn(hp >= ap ? "text-primary" : "text-muted-foreground")}>{label(hp)}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Win chance</span>
        <span className={cn(ap > hp ? "text-primary" : "text-muted-foreground")}>{label(ap)}</span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted" aria-label={`${home.name} ${hp}%, ${away.name} ${ap}%`}>
        <div className="h-full bg-primary transition-all duration-700" style={{ width: `${hp}%` }} />
        <div className="h-full flex-1 bg-muted-foreground/30" />
      </div>
    </div>
  );
}

/** Win-loss record from finished weeks (same math as Standings). */
export function teamRecord(team: FantasyTeam, league: League, byId: Map<string, SlimPlayer>) {
  const idx = league.teams.findIndex((t) => t.id === team.id);
  let w = 0, l = 0, t = 0;
  for (let wk = 1; wk < league.currentWeek; wk++) {
    for (const [h, a] of league.schedule[wk - 1] ?? []) {
      if (h !== idx && a !== idx) continue;
      const opp = league.teams[h === idx ? a : h];
      if (!opp) continue;
      const me = teamTotals(team, wk, league, byId).actual;
      const them = teamTotals(opp, wk, league, byId).actual;
      if (me > them) w++;
      else if (them > me) l++;
      else t++;
    }
  }
  return `${w}-${l}${t ? `-${t}` : ""}`;
}

/** How many starters are playing right now, how many haven't played, and game minutes left. */
function teamLiveStatus(team: FantasyTeam, week: number, byId: Map<string, SlimPlayer>) {
  let playing = 0;
  let yetToPlay = 0;
  let secondsLeft = 0;
  for (const id of team.starters) {
    const p = id ? byId.get(id) : undefined;
    if (!p) continue;
    const game = gameInfoFor(p.team, week);
    if (game?.status === "live") playing += 1;
    if (game?.status === "scheduled") yetToPlay += 1;
    secondsLeft += game?.secondsLeft ?? (game?.status === "scheduled" ? 3600 : 0);
  }
  return { playing, yetToPlay, minutesLeft: Math.round(secondsLeft / 60) };
}

function StatusBox({
  team,
  week,
  byId,
  projected,
  align = "left",
}: {
  team: FantasyTeam;
  week: number;
  byId: Map<string, SlimPlayer>;
  projected: number;
  align?: "left" | "right";
}) {
  const live = teamLiveStatus(team, week, byId);
  const rows: Array<[string, string]> = [
    ["Playing now", String(live.playing)],
    ["Yet to play", String(live.yetToPlay)],
    ["Proj total", projected.toFixed(1)],
    ["Mins left", String(live.minutesLeft)],
  ];
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className={cn("flex items-baseline gap-1.5", align === "right" && "justify-end")}>
            <dt className="truncate text-xs text-muted-foreground">{label}:</dt>
            <dd className="font-display text-sm font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TeamCrest({ team, size = "md" }: { team: FantasyTeam; size?: "md" | "lg" }) {
  const logo = teamLogo(team.name);
  const [zoom, setZoom] = useState(false);
  const box = size === "lg" ? "h-14 w-14" : "h-11 w-11";
  const initials = team.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  if (logo) {
    return (
      <>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setZoom(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setZoom(true);
            }
          }}
          aria-label={`View ${team.name} helmet`}
          title="Tap to enlarge"
          className={cn(
            "block shrink-0 cursor-zoom-in transition-transform hover:scale-110 active:scale-95",
            box,
          )}
        >
          <img
            src={logo}
            alt={`${team.name} logo`}
            className="h-full w-full object-contain drop-shadow-sm"
            loading="lazy"
          />
        </span>

        <Dialog open={zoom} onOpenChange={setZoom}>
          <DialogContent className="w-[calc(100vw-3rem)] max-w-sm rounded-2xl p-6">
            <DialogTitle className="text-center font-display text-xl font-bold">
              {team.name}
            </DialogTitle>
            <img
              src={logo}
              alt={`${team.name} logo`}
              className="mx-auto h-56 w-56 object-contain"
            />
            <p className="text-center text-sm text-muted-foreground">{team.owner}</p>
          </DialogContent>
        </Dialog>
      </>
    );
  }
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl font-display font-bold text-white",
        box,
        size === "lg" ? "text-2xl" : "text-lg",
      )}
      style={{ backgroundColor: team.color }}
    >
      {initials}
    </div>
  );
}



function Side({
  player,
  align,
  week,
  league,
  flagged,
}: {
  player: SlimPlayer | undefined;
  align: "left" | "right";
  week: number;
  league: League;
  flagged: boolean;
}) {
  if (!player) {
    return (
      <div className={cn("py-2 text-muted-foreground", align === "right" && "text-right")}>
        Empty slot
      </div>
    );
  }
  const s = scoreFor(player, week, league);
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg",
        flagged && "-mx-2 bg-injury-out/15 px-2 py-1",
        !flagged && isOnField(player, week) && "-mx-2 bg-live/10 px-2 py-1 ring-1 ring-live/50",
        align === "right" && "flex-row-reverse",
      )}
    >
      <PlayerCardTrigger player={player} week={week} league={league} className="flex-1">
        <PlayerCell player={player} align={align} week={week} />
      </PlayerCardTrigger>
      <div className={cn("shrink-0", align === "right" ? "text-left" : "text-right")}>
        <div className="font-display text-2xl font-bold tabular-nums">{s.actual.toFixed(1)}</div>
        <div className="text-xs text-muted-foreground">
          proj {s.projected.toFixed(1)}
        </div>
      </div>
    </div>
  );
}

function MobileSide({
  player,
  align,
  week,
  league,
  flagged,
}: {
  player: SlimPlayer | undefined;
  align: "left" | "right";
  week: number;
  league: League;
  flagged: boolean;
}) {
  if (!player) {
    return (
      <div
        className={cn(
          "flex min-h-28 items-center text-sm text-muted-foreground",
          align === "right" ? "justify-end text-right" : "justify-start",
        )}
      >
        Empty slot
      </div>
    );
  }

  const score = scoreFor(player, week, league);

  return (
    <div
      className={cn(
        "min-h-36 min-w-0 rounded-md p-2",
        align === "right" && "text-right",
        flagged && "bg-injury-out/15",
        !flagged && isOnField(player, week) && "bg-live/10 ring-1 ring-live/50",
      )}
    >
      <PlayerCardTrigger player={player} week={week} league={league}>
        <PlayerCell player={player} align={align} compact mobileMatchup week={week} />
      </PlayerCardTrigger>
      <div className={cn("mt-2 border-t border-border/70 pt-2", align === "right" && "text-right")}>
        <div className="font-display text-2xl font-bold tabular-nums">{score.actual.toFixed(1)}</div>
        <div className="text-xs font-medium text-muted-foreground">
          Projected {score.projected.toFixed(1)}
        </div>
      </div>
    </div>
  );
}

export function MatchupBoard({
  league,
  byId,
  week,
  home,
  away,
}: {
  league: League;
  byId: Map<string, SlimPlayer>;
  week: number;
  home: FantasyTeam;
  away: FantasyTeam;
}) {
  const h = teamTotals(home, week, league, byId);
  const a = teamTotals(away, week, league, byId);

  const inactivePlayers = [home, away].flatMap((team) =>
    team.starters
      .map((id) => (id ? byId.get(id) : undefined))
      .filter((p): p is SlimPlayer => !!p && isInactive(p.injury))
      .map((p) => ({ team, player: p })),
  );

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="border-b bg-secondary/60 p-4 sm:p-5">
        <div className="grid grid-cols-2 items-start gap-x-3 gap-y-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-3">
          <Link
            to="/team/$teamId"
            params={{ teamId: home.id }}
            className="order-1 flex min-w-0 flex-col items-center gap-2 text-center md:flex-row md:gap-3 md:text-left"
          >
            <TeamCrest team={home} size="lg" />
            <div className="min-w-0">
              <div className="text-balance font-display text-base font-bold leading-tight sm:text-lg md:truncate md:text-xl">
                {home.name}
              </div>
              <div className="truncate text-sm text-muted-foreground">
                <span className="font-semibold tabular-nums">({teamRecord(home, league, byId)})</span> {home.owner}
              </div>
              <div className="mt-1 font-display text-sm font-bold text-primary">Projected {h.projected.toFixed(1)}</div>
            </div>
          </Link>
          <div className="order-3 col-span-2 flex flex-col items-center text-center md:order-2 md:col-span-1">
            <div className="mb-1 rounded-md border bg-card px-2.5 py-1 font-display text-sm font-bold uppercase tracking-wider text-foreground shadow-sm">
              Week {week}
            </div>
            <div className="font-display text-3xl font-bold tabular-nums sm:text-5xl">
              {h.actual.toFixed(1)}
              <span className="mx-2 text-muted-foreground">–</span>
              {a.actual.toFixed(1)}
            </div>
            <WinBar
              home={home}
              away={away}
              chance={winChance(h, a)}
              done={week < league.currentWeek || (h.corrected && a.corrected) || (h.remaining + a.remaining < 0.01 && teamLiveStatus(home, week, byId).minutesLeft === 0 && teamLiveStatus(away, week, byId).minutesLeft === 0)}
            />
            {(h.corrected || a.corrected) && (
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Final score set by the commissioner
              </div>
            )}
          </div>
          <Link
            to="/team/$teamId"
            params={{ teamId: away.id }}
            className="order-2 flex min-w-0 flex-col items-center gap-2 text-center md:order-3 md:flex-row-reverse md:gap-3 md:text-right"
          >
            <TeamCrest team={away} size="lg" />
            <div className="min-w-0">
              <div className="text-balance font-display text-base font-bold leading-tight sm:text-lg md:truncate md:text-xl">
                {away.name}
              </div>
              <div className="truncate text-sm text-muted-foreground">
                <span className="font-semibold tabular-nums">({teamRecord(away, league, byId)})</span> {away.owner}
              </div>
              <div className="mt-1 font-display text-sm font-bold text-primary">Projected {a.projected.toFixed(1)}</div>
            </div>
          </Link>
          <div className="order-4 col-span-2 grid grid-cols-2 gap-3 border-t pt-3 sm:gap-6 md:col-span-3">
            <StatusBox team={home} week={week} byId={byId} projected={h.projected} />
            <StatusBox team={away} week={week} byId={byId} projected={a.projected} align="right" />
          </div>
        </div>
      </header>

      {inactivePlayers.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 border-b-2 border-injury-out bg-injury-out/15 px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-injury-out" />
          <p className="text-base font-semibold leading-snug">
            <span className="text-injury-out">Inactive players in starting slots:</span>{" "}
            {inactivePlayers.map(({ team, player }, i) => (
              <span key={player.id}>
                {i > 0 && ", "}
                <Link
                  to="/team/$teamId"
                  params={{ teamId: team.id }}
                  className="underline decoration-2 underline-offset-2 hover:text-injury-out"
                  aria-label={`Open ${team.name} roster to replace ${player.name}`}
                >
                  {player.name} ({team.name})
                </Link>
              </span>
            ))}
          </p>
        </div>
      )}

      <p className="border-b py-1.5 text-center text-xs italic text-muted-foreground">
        Tap any player for scoring summary
      </p>

      <div className="divide-y md:hidden">
        {SLOTS.map((slot, i) => {
          const hp = home.starters[i] ? byId.get(home.starters[i]!) : undefined;
          const ap = away.starters[i] ? byId.get(away.starters[i]!) : undefined;
          const hpOut = !!hp && isInactive(hp.injury);
          const apOut = !!ap && isInactive(ap.injury);
          return (
            <div key={`mobile-${slot}-${i}`} className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-stretch gap-1 px-2 py-3">
               <MobileSide player={hp} align="left" week={week} league={league} flagged={hpOut} />
              <div className="flex items-center justify-center border-x border-border/70 bg-secondary/45 px-1">
                <span className="text-center font-display text-xs font-bold uppercase text-muted-foreground">{slot}</span>
              </div>
               <MobileSide player={ap} align="right" week={week} league={league} flagged={apOut} />
            </div>
          );
        })}
      </div>

      <div className="hidden divide-y md:block">
        {SLOTS.map((slot, i) => {
          const hp = home.starters[i] ? byId.get(home.starters[i]!) : undefined;
          const ap = away.starters[i] ? byId.get(away.starters[i]!) : undefined;
          const hpOut = !!hp && isInactive(hp.injury);
          const apOut = !!ap && isInactive(ap.injury);
          return (
            <div
              key={`${slot}-${i}`}
              className="grid grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] items-center gap-4 p-4"
            >
              <Side
                player={hp}
                align="left"
                week={week}
                league={league}
                flagged={hpOut}
              />
              <div className="text-center font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
                {slot}
              </div>
              <Side
                player={ap}
                align="right"
                week={week}
                league={league}
                flagged={apOut}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { TeamCrest };

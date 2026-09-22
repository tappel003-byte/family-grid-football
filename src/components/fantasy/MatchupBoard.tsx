import { Link } from "@tanstack/react-router";
import type { League, FantasyTeam } from "@/lib/fantasy/league";
import { SLOTS } from "@/lib/fantasy/league";
import { scoreFor } from "@/lib/fantasy/hooks";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import { AlertTriangle } from "lucide-react";
import { PlayerCell, isInactive } from "./PlayerCell";
import { cn } from "@/lib/utils";

export function teamTotals(team: FantasyTeam, week: number, league: League, byId: Map<string, SlimPlayer>) {
  let actual = 0;
  let projected = 0;
  for (const id of team.starters) {
    const p = id ? byId.get(id) : undefined;
    if (!p) continue;
    const s = scoreFor(p, week, league);
    actual += s.actual;
    projected += s.projected;
  }
  return { actual: Math.round(actual * 10) / 10, projected: Math.round(projected * 10) / 10 };
}

function TeamCrest({ team, size = "md" }: { team: FantasyTeam; size?: "md" | "lg" }) {
  const initials = team.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl font-display font-bold text-white",
        size === "lg" ? "h-14 w-14 text-2xl" : "h-11 w-11 text-lg",
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
        align === "right" && "flex-row-reverse",
      )}
    >
      <PlayerCell player={player} align={align} />
      <div className={cn("shrink-0", align === "right" ? "text-left" : "text-right")}>
        <div className="font-display text-2xl font-bold tabular-nums">{s.actual.toFixed(1)}</div>
        <div className="text-xs text-muted-foreground">
          proj {s.projected.toFixed(1)} · {s.status}
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

  const inactiveNames = [home, away].flatMap((team) =>
    team.starters
      .map((id) => (id ? byId.get(id) : undefined))
      .filter((p): p is SlimPlayer => !!p && isInactive(p.injury))
      .map((p) => `${p.name} (${team.name})`),
  );

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b bg-secondary/60 p-4 sm:p-5">
        <Link
          to="/team/$teamId"
          params={{ teamId: home.id }}
          className="flex min-w-0 items-center gap-3 hover:opacity-80"
        >
          <TeamCrest team={home} size="lg" />
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-bold sm:text-xl">{home.name}</div>
            <div className="truncate text-sm text-muted-foreground">{home.owner}</div>
          </div>
        </Link>
        <div className="text-center">
          <div className="font-display text-3xl font-bold tabular-nums sm:text-5xl">
            {h.actual.toFixed(1)}
            <span className="mx-2 text-muted-foreground">–</span>
            {a.actual.toFixed(1)}
          </div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground sm:text-sm">
            Week {week} · proj {h.projected.toFixed(0)}–{a.projected.toFixed(0)}
          </div>
        </div>
        <Link
          to="/team/$teamId"
          params={{ teamId: away.id }}
          className="flex min-w-0 flex-row-reverse items-center gap-3 text-right hover:opacity-80"
        >
          <TeamCrest team={away} size="lg" />
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-bold sm:text-xl">{away.name}</div>
            <div className="truncate text-sm text-muted-foreground">{away.owner}</div>
          </div>
        </Link>
      </header>

      {inactiveNames.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 border-b-2 border-injury-out bg-injury-out/15 px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-injury-out" />
          <p className="text-base font-semibold leading-snug">
            <span className="text-injury-out">Inactive players in starting slots:</span>{" "}
            {inactiveNames.join(", ")}
          </p>
        </div>
      )}

      <div className="divide-y">
        {SLOTS.map((slot, i) => {
          const hp = home.starters[i] ? byId.get(home.starters[i]!) : undefined;
          const ap = away.starters[i] ? byId.get(away.starters[i]!) : undefined;
          const flagged = (hp && isInactive(hp.injury)) || (ap && isInactive(ap.injury));
          return (
            <div
              key={`${slot}-${i}`}
              className={cn(
                "grid grid-cols-1 items-center gap-2 p-3 md:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] md:gap-4 md:p-4",
                flagged && "bg-injury-out/10",
              )}
            >
              <div className="md:hidden">
                <span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold uppercase tracking-widest">
                  {slot}
                </span>
              </div>
              <Side player={hp} align="left" week={week} league={league} />
              <div className="hidden text-center font-display text-sm font-bold uppercase tracking-widest text-muted-foreground md:block">
                {slot}
              </div>
              <Side player={ap} align="right" week={week} league={league} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { TeamCrest };

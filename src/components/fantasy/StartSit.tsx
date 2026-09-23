import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WeekSelector } from "./WeekSelector";
import { injuryInfo, isInactive } from "./PlayerCell";
import { isOnBye, matchupFor } from "./PlayerInsights";
import { useAuth } from "@/lib/auth";
import { scoreFor, useLeague, useWeekData } from "@/lib/fantasy/hooks";
import { insightsQueryOptions } from "@/lib/insights.functions";
import { rosterIds } from "@/lib/fantasy/league";
import { isPlayerLocked } from "@/lib/fantasy/locks";
import type { League } from "@/lib/fantasy/league";
import type { InsightsData } from "@/lib/insights.functions";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import { cn } from "@/lib/utils";

type Reason = { tone: "good" | "bad" | "warn"; text: string };

type PlayerEval = {
  projected: number;
  score: number;
  wonPlay: boolean;
  playable: boolean;
  reasons: Reason[];
  tag: string | null;
  locked: boolean;
  out: boolean;
  bye: boolean;
};

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? "th"}`;
}

/** Weighs this week's projection plus injury, matchup and recent form. */
function evaluatePlayer(
  p: SlimPlayer,
  week: number,
  league: League,
  insights: InsightsData | null,
): PlayerEval {
  const s = scoreFor(p, week, league);
  const reasons: Reason[] = [];
  let score = s.projected;
  const injury = p.injury ? injuryInfo(p.injury) : null;
  const out = isInactive(p.injury);
  const bye = isOnBye(insights, p, week);
  const locked = isPlayerLocked(p, week, league);

  if (out) {
    score = -999;
    reasons.push({
      tone: "bad",
      text:
        injury?.tag === "D"
          ? "Doubtful — almost certainly won't play."
          : "Ruled OUT — he will not play and scores zero.",
    });
  } else if (bye) {
    score = -999;
    reasons.push({
      tone: "bad",
      text: `On a bye in week ${week} — his team doesn't play, so he scores zero.`,
    });
  } else {
    if (p.injury) {
      score -= 1.5;
      reasons.push({
        tone: "warn",
        text: "Questionable — a game-time decision. Check his status before kickoff.",
      });
    }
    const m = matchupFor(insights, p);
    if (m?.grade) {
      if (m.grade.grade === "great") {
        score += 1.5;
        reasons.push({
          tone: "good",
          text: `Great matchup ${m.home ? "vs" : "@"} ${m.opponent} — they give up the ${ordinal(m.grade.rank)}-most points to ${p.pos}s.`,
        });
      } else if (m.grade.grade === "tough") {
        score -= 1.5;
        reasons.push({
          tone: "bad",
          text: `Tough matchup ${m.home ? "vs" : "@"} ${m.opponent} — one of the stingiest defenses against ${p.pos}s.`,
        });
      }
    }
    const info = insights?.players[p.id];
    if (info && info.last3.length > 0) {
      const trend = info.last3Avg - info.seasonAvg;
      if (trend >= 2) {
        score += 1.5;
        reasons.push({
          tone: "good",
          text: `Playing hot — ${info.last3Avg.toFixed(1)} pts a game over his last 3, up from ${info.seasonAvg.toFixed(1)}.`,
        });
      } else if (trend <= -2) {
        score -= 1.5;
        reasons.push({
          tone: "bad",
          text: `Cooling off — ${info.last3Avg.toFixed(1)} pts a game over his last 3, down from ${info.seasonAvg.toFixed(1)}.`,
        });
      }
    }
  }

  if (locked) {
    reasons.push({
      tone: "warn",
      text: "His game already kicked off — his points are locked in.",
    });
  }

  return {
    projected: s.projected,
    score,
    wonPlay: out || bye,
    playable: !out && !bye,
    reasons,
    tag: injury?.tag ?? null,
    locked,
    out,
    bye,
  };
}

function PlayerPicker({
  value,
  onPick,
  onClear,
  players,
  excludeId,
  label,
}: {
  value: SlimPlayer | undefined;
  onPick: (id: string) => void;
  onClear: () => void;
  players: SlimPlayer[];
  excludeId?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? players.filter((p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase() === q)
      : players;
    return [...base].sort((a, b) => a.rank - b.rank).slice(0, 40);
  }, [players, query]);

  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-sm font-semibold text-muted-foreground">{label}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-auto w-full justify-between gap-2 px-3 py-2.5 text-left"
          >
            {value ? (
              <span className="min-w-0">
                <span className="block truncate font-display text-lg font-bold">{value.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {value.pos} · {value.team}
                  {value.injury ? ` · ${injuryInfo(value.injury)?.tag ?? ""}` : ""}
                </span>
              </span>
            ) : (
              <span className="py-2 text-base font-semibold text-muted-foreground">
                Tap to pick a player…
              </span>
            )}
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search players…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="max-h-72">
              <CommandEmpty>No players found.</CommandEmpty>
              {matches.map((p) => (
                <CommandItem
                  key={p.id}
                  disabled={p.id === excludeId}
                  value={p.id}
                  onSelect={() => {
                    onPick(p.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="gap-2"
                >
                  <span className="truncate font-semibold">{p.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {p.pos} · {p.team}
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  );
}

const REASON_ICON = { good: "✓", bad: "✗", warn: "!" } as const;

function PlayerCard({
  player,
  verdict,
}: {
  player: SlimPlayer;
  verdict: PlayerEval;
}) {
  return (
    <div className="min-w-0 rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold">{player.name}</p>
          <p className="text-sm text-muted-foreground">
            {player.pos} · {player.team}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold tabular-nums">
            {verdict.wonPlay ? "0.0" : verdict.projected.toFixed(1)}
          </p>
          <p className="text-xs text-muted-foreground">projected</p>
        </div>
      </div>
      {verdict.tag && (
        <span
          className={cn(
            "mt-2 inline-block rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wider",
            verdict.out
              ? "bg-injury-out text-injury-out-foreground"
              : "bg-injury-questionable text-injury-questionable-foreground",
          )}
        >
          {verdict.tag}
        </span>
      )}
      {verdict.bye && (
        <span className="mt-2 inline-block rounded-md bg-injury-questionable px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-injury-questionable-foreground">
          Bye
        </span>
      )}
      <ul className="mt-3 space-y-2">
        {verdict.reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-snug">
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white",
                r.tone === "good" && "bg-emerald-600",
                r.tone === "bad" && "bg-injury-out",
                r.tone === "warn" && "bg-injury-questionable",
              )}
            >
              {REASON_ICON[r.tone]}
            </span>
            <span className="text-foreground/90">{r.text}</span>
          </li>
        ))}
        {verdict.reasons.length === 0 && (
          <li className="text-sm text-muted-foreground">Nothing unusual this week.</li>
        )}
      </ul>
    </div>
  );
}

export function StartSit() {
  const { league, players, byId } = useLeague();
  const { user } = useAuth();
  const [week, setWeek] = useState<number | null>(null);
  const activeWeek = week ?? league?.currentWeek ?? 1;
  useWeekData(activeWeek);

  const scoring = league?.scoring;
  const { data: insights } = useQuery({
    ...insightsQueryOptions(activeWeek, scoring ?? ({} as never)),
    enabled: !!scoring,
  });

  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);

  const team = league?.teams.find((t) => !!user && t.userId === user.id);
  const myRoster = useMemo(() => {
    if (!team || !league) return [];
    const ids = [...rosterIds(team), ...(team.ir ?? [])];
    return ids.map((id) => byId.get(id)).filter((p): p is SlimPlayer => !!p);
  }, [team, league, byId]);

  if (!league) return null;

  const a = aId ? byId.get(aId) : undefined;
  const b = bId ? byId.get(bId) : undefined;
  const va = a ? evaluatePlayer(a, activeWeek, league, insights ?? null) : null;
  const vb = b ? evaluatePlayer(b, activeWeek, league, insights ?? null) : null;

  const quickPick = (id: string) => {
    if (id === aId) return;
    if (!aId) setAId(id);
    else if (!bId) setBId(id);
    else setBId(id);
  };

  let verdict: { tone: "good" | "bad" | "warn"; title: string; sub: string } | null = null;
  if (a && b && va && vb) {
    if (va.wonPlay && vb.wonPlay) {
      verdict = {
        tone: "bad",
        title: "Neither player will play this week",
        sub: "Both are out or on a bye — find someone else to start.",
      };
    } else if (a.pos !== b.pos && va.playable && vb.playable) {
      const better = va.score >= vb.score ? a : b;
      verdict = {
        tone: "good",
        title: "You can start both",
        sub: `${a.name} (${a.pos}) and ${b.name} (${b.pos}) play different positions — they don't compete for the same spot. If you can only use one, lean toward ${better.name}.`,
      };
    } else {
      const aWins = va.score >= vb.score;
      const winner = aWins ? a : b;
      const loser = aWins ? b : a;
      const wv = aWins ? va : vb;
      const lv = aWins ? vb : va;
      const gap = wv.score - lv.score;
      if (wv.wonPlay) {
        verdict = {
          tone: "good",
          title: `Start ${winner.name}, sit ${loser.name}`,
          sub: `${loser.name} won't play this week — ${winner.name} is the only real option.`,
        };
      } else if (gap <= 0.5) {
        verdict = {
          tone: "warn",
          title: "Too close to call",
          sub: `They're projected within half a point of each other. Go with your gut — or start ${winner.name} on the tiny edge.`,
        };
      } else {
        verdict = {
          tone: "good",
          title: `Start ${winner.name}, sit ${loser.name}`,
          sub:
            wv.locked && !lv.locked
              ? `${winner.name}'s game already kicked off, so his points are locked in — but he was the stronger play this week.`
              : `${winner.name} is the stronger play this week, by about ${gap.toFixed(1)} points.`,
        };
      }
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Start 'Em, Sit 'Em
          </h1>
          <p className="mt-1 text-base text-muted-foreground sm:text-lg">
            Pick two players and we'll tell you who to start.
          </p>
        </div>
        <WeekSelector week={activeWeek} onChange={setWeek} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
        <PlayerPicker
          label="First player"
          value={a}
          onPick={setAId}
          onClear={() => setAId(null)}
          players={players}
          excludeId={bId ?? undefined}
        />
        <p className="hidden pb-3 text-center font-display text-xl font-bold text-muted-foreground sm:block">
          vs
        </p>
        <PlayerPicker
          label="Second player"
          value={b}
          onPick={setBId}
          onClear={() => setBId(null)}
          players={players}
          excludeId={aId ?? undefined}
        />
      </div>

      {myRoster.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-semibold text-muted-foreground">
            Quick pick from your roster:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {myRoster.map((p) => {
              const chosen = p.id === aId || p.id === bId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => quickPick(p.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                    chosen
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card hover:bg-accent",
                  )}
                >
                  {p.name}
                  <span className="ml-1 text-xs opacity-70">{p.pos}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {verdict && (
        <div
          role="status"
          className={cn(
            "mt-5 rounded-2xl border-2 p-4 sm:p-5",
            verdict.tone === "good" && "border-emerald-600 bg-emerald-600/10",
            verdict.tone === "warn" && "border-injury-questionable bg-injury-questionable/10",
            verdict.tone === "bad" && "border-injury-out bg-injury-out/10",
          )}
        >
          <p className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            {verdict.title}
          </p>
          <p className="mt-1.5 text-base leading-snug text-foreground/90 sm:text-lg">
            {verdict.sub}
          </p>
        </div>
      )}

      {a && va && b && vb && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PlayerCard player={a} verdict={va} />
          <PlayerCard player={b} verdict={vb} />
        </div>
      )}

      {!a || !b ? (
        <div className="mt-5 rounded-2xl border bg-card p-4 text-base text-muted-foreground">
          Pick two players above — search anyone in the NFL, or tap a name from your roster.
        </div>
      ) : null}
    </div>
  );
}

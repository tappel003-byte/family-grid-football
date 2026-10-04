import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { League } from "@/lib/fantasy/league";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import { getPicksBoard } from "@/lib/picks.functions";
import { teamTotals, TeamCrest } from "./MatchupBoard";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const seenKey = (week: number) => `la-familia-review-seen-${week}`;

/** One-time recap of the week that just finished, shown the first time each person opens the app. */
export function WeekInReview({ league, byId }: { league: League; byId: Map<string, SlimPlayer> }) {
  const week = league.currentWeek - 1;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (week >= 1 && !localStorage.getItem(seenKey(week))) setOpen(true);
  }, [week]);

  const fetchBoard = useServerFn(getPicksBoard);
  const { data: board } = useQuery({
    queryKey: ["picks-board-review", week],
    enabled: open,
    queryFn: () => fetchBoard({ data: { week } }),
  });

  if (week < 1) return null;

  const games = (league.schedule[week - 1] ?? [])
    .map(([h, a]) => {
      const home = league.teams[h];
      const away = league.teams[a];
      if (!home || !away) return null;
      return { home, away, hs: teamTotals(home, week, league, byId).actual, as: teamTotals(away, week, league, byId).actual };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);
  if (!games.length) return null;

  const scores = games.flatMap((g) => [{ team: g.home, pts: g.hs }, { team: g.away, pts: g.as }]);
  const top = scores.reduce((a, b) => (b.pts > a.pts ? b : a));
  const byMargin = [...games].sort((x, y) => Math.abs(y.hs - y.as) - Math.abs(x.hs - x.as));
  const describe = (g: (typeof games)[number]) => {
    const homeWon = g.hs >= g.as;
    const [w, l, wp, lp] = homeWon ? [g.home, g.away, g.hs, g.as] : [g.away, g.home, g.as, g.hs];
    return { w, text: `${w.name} ${wp.toFixed(1)} – ${lp.toFixed(1)} ${l.name}`, margin: (wp - lp).toFixed(1) };
  };
  const blowout = describe(byMargin[0]!);
  const closest = describe(byMargin[byMargin.length - 1]!);

  const players = (board?.family ?? []).filter((f) => f.done);
  const best = players.length ? Math.max(...players.map((f) => f.correct)) : 0;
  const pickWinners = players.filter((f) => f.correct === best).map((f) => f.name.split(/\s+/)[0]);

  const close = () => {
    localStorage.setItem(seenKey(week), "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl p-5">
        <DialogTitle className="font-display text-2xl font-bold">Week {week} in Review</DialogTitle>
        <div className="space-y-3">
          <Row label="Top score">
            <span className="flex items-center gap-2">
              <TeamCrest team={top.team} />
              <span className="font-semibold">{top.team.name}</span>
              <span className="ml-auto font-display text-xl font-bold tabular-nums">{top.pts.toFixed(1)}</span>
            </span>
          </Row>
          <Row label={`Biggest blowout · ${blowout.margin} pts`}>{blowout.text}</Row>
          <Row label={`Closest game · ${closest.margin} pts`}>{closest.text}</Row>
          {pickWinners.length > 0 && (
            <Row label="Pick'em winner">
              {pickWinners.join(" & ")} · {best} right
            </Row>
          )}
        </div>
        <Button size="lg" className="mt-2 w-full font-semibold" onClick={close}>
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary/60 px-3 py-2.5">
      <p className="text-xs font-bold uppercase tracking-wide text-primary">{label}</p>
      <div className="mt-0.5 text-base">{children}</div>
    </div>
  );
}

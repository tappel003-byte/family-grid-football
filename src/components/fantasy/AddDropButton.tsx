import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { rosterIds, ownedIds, type League } from "@/lib/fantasy/league";
import { makeRosterMove } from "@/lib/fantasy/transactions.functions";
import { placeClaim } from "@/lib/fantasy/waivers.functions";
import { reloadLeague } from "@/lib/fantasy/store";
import {
  gameStatusFor,
  headshotUrl,
  marketQueryOptions,
  scoreFor,
  teamLogoUrl,
  trendingQueryOptions,
} from "@/lib/fantasy/hooks";
import {
  insightsQueryOptions,
  isOnBye,
  matchupFor,
} from "@/components/fantasy/PlayerInsights";
import { InjuryBadge } from "@/components/fantasy/PlayerCell";
import { cn } from "@/lib/utils";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import type { PlayerInsight } from "@/lib/insights.functions";
import type { Ownership } from "@/lib/market.functions";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

type CompareStats = {
  projection: number;
  positionRank: number | null;
  info: PlayerInsight | undefined;
  ownership: Ownership | undefined;
  adds: number;
  drops: number;
  matchup: string;
  age: number | null;
};

function PlayerCardHeader({ player, label }: { player: SlimPlayer; label: string }) {
  return (
    <div className="min-w-0 text-center">
      <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <img
        src={headshotUrl(player.id, player.pos, player.team)}
        alt=""
        className="mx-auto h-16 w-16 rounded-full bg-muted object-cover ring-1 ring-border sm:h-20 sm:w-20"
        onError={(event) => {
          event.currentTarget.src = teamLogoUrl(player.team);
        }}
      />
      <p className="mt-2 min-h-10 text-sm font-bold leading-tight sm:text-base">{player.name}</p>
      <div className="mt-1 flex min-h-6 flex-wrap items-center justify-center gap-1 text-xs font-semibold text-muted-foreground">
        <span>{player.team} · {player.pos}</span>
        <InjuryBadge injury={player.injury} size="sm" />
      </div>
    </div>
  );
}

function StatValue({ value, winner }: { value: string; winner?: boolean }) {
  return (
    <span className={cn("min-w-0 text-center font-bold tabular-nums", winner && "text-primary")}>
      {value}
    </span>
  );
}

function ComparisonRows({ left, right }: { left: CompareStats; right: CompareStats }) {
  const rows: Array<{ label: string; left: string; right: string; leftN: number | undefined; rightN: number | undefined; lower?: boolean }> = [
    { label: "Projected", left: fmt(left.projection), right: fmt(right.projection), leftN: left.projection, rightN: right.projection },
    { label: "Position rank", left: left.positionRank ? `#${left.positionRank}` : "—", right: right.positionRank ? `#${right.positionRank}` : "—", leftN: left.positionRank ?? undefined, rightN: right.positionRank ?? undefined, lower: true },
    { label: "Season points", left: left.info ? fmt(left.info.seasonPts) : "—", right: right.info ? fmt(right.info.seasonPts) : "—", leftN: left.info?.seasonPts, rightN: right.info?.seasonPts },
    { label: "Points / game", left: left.info ? fmt(left.info.seasonAvg) : "—", right: right.info ? fmt(right.info.seasonAvg) : "—", leftN: left.info?.seasonAvg, rightN: right.info?.seasonAvg },
    { label: "Last 3 avg", left: left.info ? fmt(left.info.last3Avg) : "—", right: right.info ? fmt(right.info.last3Avg) : "—", leftN: left.info?.last3Avg, rightN: right.info?.last3Avg },
    { label: "Last 3 games", left: left.info?.last3.length ? left.info.last3.map(fmt).join(" · ") : "—", right: right.info?.last3.length ? right.info.last3.map(fmt).join(" · ") : "—", leftN: undefined, rightN: undefined },
    { label: "Games played", left: left.info ? String(left.info.games) : "—", right: right.info ? String(right.info.games) : "—", leftN: left.info?.games, rightN: right.info?.games },
    { label: "Rostered", left: left.ownership ? `${fmt(left.ownership.owned)}%` : "—", right: right.ownership ? `${fmt(right.ownership.owned)}%` : "—", leftN: left.ownership?.owned, rightN: right.ownership?.owned },
    { label: "Started", left: left.ownership ? `${fmt(left.ownership.started)}%` : "—", right: right.ownership ? `${fmt(right.ownership.started)}%` : "—", leftN: left.ownership?.started, rightN: right.ownership?.started },
    { label: "Roster trend", left: left.ownership ? `${left.ownership.change > 0 ? "+" : ""}${fmt(left.ownership.change)}%` : "—", right: right.ownership ? `${right.ownership.change > 0 ? "+" : ""}${fmt(right.ownership.change)}%` : "—", leftN: left.ownership?.change, rightN: right.ownership?.change },
    { label: "Targets / game", left: left.info && left.info.targets > 0 ? fmt(left.info.targets) : "—", right: right.info && right.info.targets > 0 ? fmt(right.info.targets) : "—", leftN: left.info?.targets, rightN: right.info?.targets },
    { label: "Snap share", left: left.info?.snapPct !== null && left.info?.snapPct !== undefined ? `${left.info.snapPct}%` : "—", right: right.info?.snapPct !== null && right.info?.snapPct !== undefined ? `${right.info.snapPct}%` : "—", leftN: left.info?.snapPct ?? undefined, rightN: right.info?.snapPct ?? undefined },
    { label: "Recent adds", left: left.adds ? compact.format(left.adds) : "—", right: right.adds ? compact.format(right.adds) : "—", leftN: left.adds, rightN: right.adds },
    { label: "Recent drops", left: left.drops ? compact.format(left.drops) : "—", right: right.drops ? compact.format(right.drops) : "—", leftN: left.drops, rightN: right.drops, lower: true },
    { label: "Age", left: left.age ? String(left.age) : "—", right: right.age ? String(right.age) : "—", leftN: left.age ?? undefined, rightN: right.age ?? undefined, lower: true },
  ];
  return (
    <div className="mt-3 overflow-hidden rounded-md border">
      {rows.map((row) => {
        const leftNumber = row.leftN;
        const rightNumber = row.rightN;
        const comparable = leftNumber !== undefined && rightNumber !== undefined && leftNumber !== rightNumber;
        const leftWins = comparable && (row.lower ? leftNumber < rightNumber : leftNumber > rightNumber);
        const rightWins = comparable && (row.lower ? rightNumber < leftNumber : rightNumber > leftNumber);
        return (
          <div key={row.label} className="grid grid-cols-[1fr_6.25rem_1fr] items-center border-b px-2 py-2 text-xs last:border-b-0 sm:text-sm">
            <StatValue value={row.left} winner={leftWins} />
            <span className="text-center text-muted-foreground">{row.label}</span>
            <StatValue value={row.right} winner={rightWins} />
          </div>
        );
      })}
      <div className="grid grid-cols-[1fr_6.25rem_1fr] items-center px-2 py-2 text-xs sm:text-sm">
        <StatValue value={left.matchup} />
        <span className="text-center text-muted-foreground">Matchup</span>
        <StatValue value={right.matchup} />
      </div>
    </div>
  );
}

/** Add a free agent to your own team, or drop someone you already have. */
export function AddDropButton({
  player,
  league,
  byId,
  onDone,
}: {
  player: SlimPlayer;
  league: League;
  byId: Map<string, SlimPlayer>;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  const move = useServerFn(makeRosterMove);
  const claim = useServerFn(placeClaim);
  const [pending, setPending] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  // Comparison numbers for the drop picker — shares the page's cached insights.
  const { data: compareData } = useQuery({
    ...insightsQueryOptions(league.currentWeek, league.scoring),
    enabled: dropOpen,
  });
  const { data: market } = useQuery({ ...marketQueryOptions, enabled: dropOpen });
  const { data: adds } = useQuery({ ...trendingQueryOptions("add"), enabled: dropOpen });
  const { data: drops } = useQuery({ ...trendingQueryOptions("drop"), enabled: dropOpen });

  const positionRanks = useMemo(() => {
    const ranks = new Map<string, number>();
    const allPlayers = [...byId.values()];
    for (const position of new Set(allPlayers.map((candidate) => candidate.pos))) {
      allPlayers
        .filter((candidate) => candidate.pos === position)
        .sort((a, b) => {
          const pointsA = compareData?.players[a.id]?.seasonPts ?? 0;
          const pointsB = compareData?.players[b.id]?.seasonPts ?? 0;
          return pointsB - pointsA || a.name.localeCompare(b.name);
        })
        .forEach((candidate, index) => ranks.set(candidate.id, index + 1));
    }
    return ranks;
  }, [byId, compareData]);

  const addsById = useMemo(() => new Map((adds ?? []).map((entry) => [entry.id, entry.count])), [adds]);
  const dropsById = useMemo(() => new Map((drops ?? []).map((entry) => [entry.id, entry.count])), [drops]);

  const myTeam = user ? league.teams.find((t) => t.userId === user.id) : undefined;
  if (!myTeam) return null;

  const myIds = rosterIds(myTeam);
  const onMyTeam = myIds.includes(player.id);
  const rules = league.rules;
  const gameStarted = ["live", "final"].includes(gameStatusFor(player.team, league.currentWeek));
  // Wednesday opens free agency: unstarted players are instant adds until kickoff.
  const claimMode = rules.waiverMode === "waivers" && gameStarted;
  const locked = rules.waiverMode === "locked" && gameStarted;
  const cap = rules.positionLimits[player.pos] ?? 0;
  const atCap =
    cap > 0 &&
    myIds.filter((id) => byId.get(id)?.pos === player.pos).length >= cap;
  const ownedElsewhere = league.teams.some(
    (t) => t.id !== myTeam.id && ownedIds(t).includes(player.id),
  );
  if (ownedElsewhere) return null;
  // Players parked on injured reserve are managed from the My Team page.
  if ((myTeam.ir ?? []).includes(player.id)) return null;

  async function run(dropId: string | null, dropName: string) {
    setPending(true);
    try {
      await move({
        data: {
          addId: onMyTeam ? null : player.id,
          addName: player.name,
          addPos: player.pos,
          dropId,
          dropName,
        },
      });
      await reloadLeague();
      toast.success(
        onMyTeam
          ? `Dropped ${player.name}`
          : dropId
            ? `Added ${player.name}, dropped ${dropName}`
            : `Added ${player.name}`,
      );
      setDropOpen(false);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That move did not go through.");
    } finally {
      setPending(false);
    }
  }

  /** Waiver mode: put a pickup request in the queue instead of adding right away. */
  async function runClaim(dropId: string | null, dropName: string) {
    setPending(true);
    try {
      await claim({
        data: {
          playerId: player.id,
          playerName: player.name,
          playerPos: player.pos,
          playerTeam: player.team,
          dropId,
          dropName,
        },
      });
      toast.success(
        `Claim placed for ${player.name}. It processes Wednesday at 12:01 AM Eastern — lowest-ranked team picks first.`,
      );
      setDropOpen(false);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That claim did not go through.");
    } finally {
      setPending(false);
    }
  }

  const submit = claimMode ? runClaim : run;

  const rosterPlayers = myIds.flatMap((id) => {
    const rosterPlayer = byId.get(id);
    return rosterPlayer ? [rosterPlayer] : [];
  });
  const samePosition = rosterPlayers.filter((rosterPlayer) => rosterPlayer.pos === player.pos);
  const otherPositions = rosterPlayers.filter((rosterPlayer) => rosterPlayer.pos !== player.pos);
  const candidates = [...samePosition, ...otherPositions];
  const candidate = compareId ? byId.get(compareId) : undefined;

  const compareStats = (subject: SlimPlayer): CompareStats => {
    const matchup = matchupFor(compareData ?? null, subject);
    const matchupText = isOnBye(compareData ?? null, subject, league.currentWeek)
      ? "BYE"
      : matchup?.opponent
        ? `${matchup.home ? "vs" : "@"} ${matchup.opponent}${matchup.grade ? ` · ${matchup.grade.label}` : ""}`
        : "—";
    return {
      projection: scoreFor(subject, league.currentWeek, league).projected,
      positionRank: positionRanks.get(subject.id) ?? null,
      info: compareData?.players[subject.id],
      ownership: market?.ownership[subject.id],
      adds: addsById.get(subject.id) ?? 0,
      drops: dropsById.get(subject.id) ?? 0,
      matchup: matchupText,
      age: subject.age,
    };
  };

  if (onMyTeam) {
    return (
      <>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (locked) {
              toast.error(`${player.name}'s game has already started — he's locked this week.`);
              return;
            }
            setConfirmDrop(true);
          }}
          className="font-semibold"
        >
          Drop
        </Button>
        <Dialog open={confirmDrop} onOpenChange={setConfirmDrop}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Drop {player.name}?</DialogTitle>
              <DialogDescription>
                {claimMode
                  ? "They will go back on the free agent list, and families can put in a claim for them."
                  : "They will go back on the free agent list, and any family can pick them up."}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex justify-end gap-3">
              <Button variant="outline" disabled={pending} onClick={() => setConfirmDrop(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => void run(player.id, player.name)}
              >
                {pending ? "Dropping…" : "Yes, drop them"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const rosterFull = myIds.length >= rules.rosterLimit;
  const verb = claimMode ? "Claim" : "Add";
  const blocked = locked ? `${player.name}'s game has already started — he's locked this week.` : "";
  const dropLocked = (p: SlimPlayer) =>
    rules.lockAtKickoff && ["live", "final"].includes(gameStatusFor(p.team, league.currentWeek));

  function choose(drop: SlimPlayer | null) {
    if (atCap && drop?.pos !== player.pos) {
      toast.error(`You already carry ${cap} ${player.pos}s, the most allowed — drop a ${player.pos} for this one.`);
      return;
    }
    void submit(drop?.id ?? null, drop?.name ?? "");
  }

  return (
    <>
      <Button
        disabled={pending}
        variant={claimMode ? "outline" : "default"}
        onClick={() => {
          if (blocked) {
            toast.error(blocked);
            return;
          }
          setCompareId(null);
          setDropOpen(true);
        }}
        className="font-semibold"
        title={claimMode ? "His game has started — this claim waits until Wednesday" : "Add immediately"}
      >
        {verb}
      </Button>
      <Dialog open={dropOpen} onOpenChange={setDropOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
          {!candidate ? (
            <>
              <DialogHeader>
                <DialogTitle>{verb} {player.name}</DialogTitle>
                <DialogDescription>
                  {claimMode
                    ? "His game has started, so this claim waits until Wednesday at 12:01 AM Eastern."
                    : "Add now — free agency is first come, first served until his game starts."}{" "}
                  {rosterFull ? "Pick who comes off your roster. Tap Compare to see them side by side." : "You have an open spot, or you can drop someone."}
                </DialogDescription>
              </DialogHeader>
              {!rosterFull && (
                <Button disabled={pending} onClick={() => choose(null)} className="w-full font-bold">
                  {pending ? "Working…" : `${verb} ${player.name} — no drop`}
                </Button>
              )}
              <ul className="divide-y rounded-md border">
                {candidates.map((p) => {
                  const info = compareData?.players[p.id];
                  const lockedNow = dropLocked(p);
                  return (
                    <li key={p.id} className="flex items-center gap-3 p-2">
                      <img
                        src={headshotUrl(p.id, p.pos, p.team)}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full bg-muted object-cover"
                        onError={(e) => { e.currentTarget.src = teamLogoUrl(p.team); }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.pos} · {p.team}
                          {info ? ` · ${fmt(info.seasonPts)} pts · L3 ${fmt(info.last3Avg)}` : ""}
                          {lockedNow ? " · locked" : ""}
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setCompareId(p.id)}>
                        Compare
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Compare</DialogTitle>
                <DialogDescription>{player.name} vs {candidate.name}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-[1fr_2.5rem_1fr] items-start gap-2">
                <PlayerCardHeader player={player} label={verb} />
                <div className="pt-24 text-center text-xs font-bold text-muted-foreground">VS</div>
                <PlayerCardHeader player={candidate} label="Drop" />
              </div>
              <ComparisonRows left={compareStats(player)} right={compareStats(candidate)} />
              {dropLocked(candidate) ? (
                <p className="text-center text-sm font-semibold text-destructive">
                  {candidate.name} is locked because his game has started.
                </p>
              ) : (
                <Button
                  disabled={pending}
                  onClick={() => choose(candidate)}
                  className="min-h-12 w-full whitespace-normal px-3 py-2 font-bold"
                >
                  {pending
                    ? claimMode ? "Placing claim…" : "Making move…"
                    : claimMode
                      ? `Drop ${candidate.name} & Submit claim for ${player.name}`
                      : `Drop ${candidate.name} & Add ${player.name} now`}
                </Button>
              )}
              <Button variant="outline" className="w-full" onClick={() => setCompareId(null)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to my roster
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

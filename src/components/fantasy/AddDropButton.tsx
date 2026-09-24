import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const rows: Array<{ label: string; left: string; right: string; leftN?: number; rightN?: number; lower?: boolean }> = [
    { label: "Projected", left: fmt(left.projection), right: fmt(right.projection), leftN: left.projection, rightN: right.projection },
    { label: "Position rank", left: left.positionRank ? `#${left.positionRank}` : "—", right: right.positionRank ? `#${right.positionRank}` : "—", leftN: left.positionRank ?? undefined, rightN: right.positionRank ?? undefined, lower: true },
    { label: "Season points", left: left.info ? fmt(left.info.seasonPts) : "—", right: right.info ? fmt(right.info.seasonPts) : "—", leftN: left.info?.seasonPts, rightN: right.info?.seasonPts },
    { label: "Points / game", left: left.info ? fmt(left.info.seasonAvg) : "—", right: right.info ? fmt(right.info.seasonAvg) : "—", leftN: left.info?.seasonAvg, rightN: right.info?.seasonAvg },
    { label: "Last 3 avg", left: left.info ? fmt(left.info.last3Avg) : "—", right: right.info ? fmt(right.info.last3Avg) : "—", leftN: left.info?.last3Avg, rightN: right.info?.last3Avg },
    { label: "Rostered", left: left.ownership ? `${fmt(left.ownership.owned)}%` : "—", right: right.ownership ? `${fmt(right.ownership.owned)}%` : "—", leftN: left.ownership?.owned, rightN: right.ownership?.owned },
    { label: "Started", left: left.ownership ? `${fmt(left.ownership.started)}%` : "—", right: right.ownership ? `${fmt(right.ownership.started)}%` : "—", leftN: left.ownership?.started, rightN: right.ownership?.started },
    { label: "Roster trend", left: left.ownership ? `${left.ownership.change > 0 ? "+" : ""}${fmt(left.ownership.change)}%` : "—", right: right.ownership ? `${right.ownership.change > 0 ? "+" : ""}${fmt(right.ownership.change)}%` : "—", leftN: left.ownership?.change, rightN: right.ownership?.change },
    { label: "Targets / game", left: left.info && left.info.targets > 0 ? fmt(left.info.targets) : "—", right: right.info && right.info.targets > 0 ? fmt(right.info.targets) : "—", leftN: left.info?.targets, rightN: right.info?.targets },
    { label: "Snap share", left: left.info?.snapPct !== null && left.info?.snapPct !== undefined ? `${left.info.snapPct}%` : "—", right: right.info?.snapPct !== null && right.info?.snapPct !== undefined ? `${right.info.snapPct}%` : "—", leftN: left.info?.snapPct ?? undefined, rightN: right.info?.snapPct ?? undefined },
    { label: "Recent adds", left: left.adds ? compact.format(left.adds) : "—", right: right.adds ? compact.format(right.adds) : "—", leftN: left.adds, rightN: right.adds },
    { label: "Recent drops", left: left.drops ? compact.format(left.drops) : "—", right: right.drops ? compact.format(right.drops) : "—", leftN: left.drops, rightN: right.drops, lower: true },
  ];
  return (
    <div className="mt-3 overflow-hidden rounded-md border">
      {rows.map((row) => {
        const comparable = row.leftN !== undefined && row.rightN !== undefined && row.leftN !== row.rightN;
        const leftWins = comparable && (row.lower ? row.leftN < row.rightN : row.leftN > row.rightN);
        const rightWins = comparable && (row.lower ? row.rightN < row.leftN : row.rightN > row.leftN);
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
  // Comparison numbers for the drop picker — shares the page's cached insights.
  const { data: compareData } = useQuery({
    ...insightsQueryOptions(league.currentWeek, league.scoring),
    enabled: dropOpen,
  });
  const newGuy = compareData?.players[player.id];

  const myTeam = user ? league.teams.find((t) => t.userId === user.id) : undefined;
  if (!myTeam) return null;

  const myIds = rosterIds(myTeam);
  const onMyTeam = myIds.includes(player.id);
  const rules = league.rules;
  const claimMode = rules.waiverMode === "waivers";
  const locked =
    rules.waiverMode === "locked" &&
    ["live", "final"].includes(gameStatusFor(player.team, league.currentWeek));
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
        `Claim placed for ${player.name}. Waivers process in order — the team with the worse record picks first.`,
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
  const blocked = locked
    ? `${player.name}'s game has already started — he's locked this week.`
    : atCap
      ? `You already carry ${cap} ${player.pos}s, the most the league allows.`
      : "";

  return (
    <>
      <Button
        disabled={pending}
        onClick={() => {
          if (blocked) {
            toast.error(blocked);
            return;
          }
          if (rosterFull) setDropOpen(true);
          else void submit(null, "");
        }}
        className="font-semibold"
      >
        {claimMode ? "Claim" : "Add"}
      </Button>
      <Dialog open={dropOpen} onOpenChange={setDropOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Who comes off the roster?</DialogTitle>
            <DialogDescription>
              Your roster is full, so pick one player to{" "}
              {claimMode ? "let go if your claim wins" : "drop for"} {player.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <p className="text-sm font-semibold">
              Adding: {player.name} · {player.team} {player.pos}
            </p>
            <CompareLine info={newGuy} />
          </div>
          <ul className="divide-y">
            {myIds.map((id) => {
              const p = byId.get(id);
              const info = compareData?.players[id];
              return (
                <li key={id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold">
                      {p ? `${p.name} · ${p.team} ${p.pos}` : id}
                    </span>
                    <span className="flex items-center gap-2">
                      <CompareLine info={info} />
                      {info && newGuy ? (
                        <CompareDelta mine={newGuy.seasonAvg} theirs={info.seasonAvg} />
                      ) : null}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => void submit(id, p?.name ?? "")}
                    className="shrink-0"
                  >
                    {claimMode ? "Claim" : "Drop"}
                  </Button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Green means that player is outscoring {player.name} per game — think twice before
            dropping them.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

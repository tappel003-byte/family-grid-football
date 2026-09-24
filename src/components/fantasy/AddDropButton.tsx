import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
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
import { gameStatusFor } from "@/lib/fantasy/hooks";
import { insightsQueryOptions } from "@/components/fantasy/PlayerInsights";
import { cn } from "@/lib/utils";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import type { PlayerInsight } from "@/lib/insights.functions";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** One line of comparable numbers: season total and recent form. */
function CompareLine({ info, className }: { info: PlayerInsight | undefined; className?: string }) {
  if (!info) return <p className={cn("text-xs text-muted-foreground", className)}>No stats yet</p>;
  return (
    <p className={cn("text-xs text-muted-foreground tabular-nums", className)}>
      Season {fmt(info.seasonPts)} · Avg {fmt(info.seasonAvg)} · Last 3 {fmt(info.last3Avg)}
    </p>
  );
}

/** Green/red gap versus the player being added, based on season average. */
function CompareDelta({ mine, theirs }: { mine: number; theirs: number }) {
  const diff = Math.round((theirs - mine) * 10) / 10;
  if (Math.abs(diff) < 0.05) return <span className="text-xs text-muted-foreground">even</span>;
  const better = diff > 0;
  return (
    <span
      className={cn(
        "text-xs font-bold tabular-nums",
        better ? "text-green-600 dark:text-green-400" : "text-destructive",
      )}
      title={
        better
          ? "Averaging more per game than the player you would add"
          : "Averaging less per game than the player you would add"
      }
    >
      {better ? "+" : "−"}
      {fmt(Math.abs(diff))}/gm
    </span>
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
          <ul className="divide-y">
            {myIds.map((id) => {
              const p = byId.get(id);
              return (
                <li key={id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-base font-semibold">
                    {p ? `${p.name} · ${p.team} ${p.pos}` : id}
                  </span>
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => void submit(id, p?.name ?? "")}
                  >
                    {claimMode ? "Claim" : "Drop"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
import { BENCH_SIZE, SLOTS, rosterIds, type League } from "@/lib/fantasy/league";
import { makeRosterMove } from "@/lib/fantasy/transactions.functions";
import { reloadLeague } from "@/lib/fantasy/store";
import type { SlimPlayer } from "@/lib/sleeper.functions";

const ROSTER_LIMIT = SLOTS.length + BENCH_SIZE;

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
  const [pending, setPending] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);

  const myTeam = user ? league.teams.find((t) => t.userId === user.id) : undefined;
  if (!myTeam) return null;

  const myIds = rosterIds(myTeam);
  const onMyTeam = myIds.includes(player.id);
  const ownedElsewhere = league.teams.some(
    (t) => t.id !== myTeam.id && rosterIds(t).includes(player.id),
  );
  if (ownedElsewhere) return null;

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

  if (onMyTeam) {
    return (
      <>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setConfirmDrop(true)}
          className="font-semibold"
        >
          Drop
        </Button>
        <Dialog open={confirmDrop} onOpenChange={setConfirmDrop}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Drop {player.name}?</DialogTitle>
              <DialogDescription>
                They will go back on the free agent list, and any family can pick them up.
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

  const rosterFull = myIds.length >= ROSTER_LIMIT;

  return (
    <>
      <Button
        disabled={pending}
        onClick={() => (rosterFull ? setDropOpen(true) : void run(null, ""))}
        className="font-semibold"
      >
        Add
      </Button>
      <Dialog open={dropOpen} onOpenChange={setDropOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Who comes off the roster?</DialogTitle>
            <DialogDescription>
              Your roster is full, so pick one player to drop for {player.name}.
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
                    onClick={() => void run(id, p?.name ?? "")}
                  >
                    Drop
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

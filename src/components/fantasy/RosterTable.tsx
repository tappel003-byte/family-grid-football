import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, UserPlus, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FantasyTeam, League } from "@/lib/fantasy/league";
import { SLOTS, rosterIds, slotAccepts } from "@/lib/fantasy/league";
import { scoreFor } from "@/lib/fantasy/hooks";
import { isPlayable } from "@/lib/fantasy/projections";
import { makeRosterMove } from "@/lib/fantasy/transactions.functions";
import { setInjuredReserve } from "@/lib/fantasy/ir.functions";
import { updateLeague, reloadLeague } from "@/lib/fantasy/store";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import { AlertTriangle, CalendarOff } from "lucide-react";
import { isPlayerLocked } from "@/lib/fantasy/locks";
import { Lock } from "lucide-react";
import { PlayerCell, injuryInfo, isInactive } from "./PlayerCell";
import { TradeAvailableBadge, TradeFlagToggle, useTeamTradeBlock } from "./TradeFlag";
import { PlayerInsightChips, useInsights, isOnBye } from "./PlayerInsights";
import { cn } from "@/lib/utils";

function setTeam(league: League, teamId: string, fn: (t: FantasyTeam) => FantasyTeam): League {
  return { ...league, teams: league.teams.map((t) => (t.id === teamId ? fn(t) : t)) };
}

export function optimizeTeam(
  team: FantasyTeam,
  byId: Map<string, SlimPlayer>,
  league: League,
  week: number,
  insights?: import("@/lib/insights.functions").InsightsData | null,
  isLocked?: (player: SlimPlayer | undefined) => boolean,
): FantasyTeam {
  const ids = rosterIds(team);
  const ranked = ids
    .map((id) => byId.get(id))
    .filter((p): p is SlimPlayer => !!p)
    .sort((a, b) => scoreFor(b, week, league).projected - scoreFor(a, week, league).projected);

  const available = (p: SlimPlayer) =>
    isPlayable(p) && !isOnBye(insights ?? null, p, week);

  const used = new Set<string>();
  const locked = (id: string | null | undefined) =>
    !!id && !!isLocked && isLocked(byId.get(id));

  // Players whose game already started stay exactly where they are.
  const pinned = SLOTS.map((_, i) => (locked(team.starters[i]) ? team.starters[i]! : null));
  for (const id of pinned) if (id) used.add(id);
  for (const id of ids) if (locked(id) && !used.has(id)) used.add(id);

  const pick = (slot: string, healthyOnly: boolean) =>
    ranked.find(
      (p) => !used.has(p.id) && slotAccepts(slot, p.pos) && (!healthyOnly || available(p)),
    );

  const starters = SLOTS.map((slot, i) => {
    if (pinned[i]) return pinned[i];
    const player = pick(slot, true) ?? pick(slot, false);
    if (player) used.add(player.id);
    return player?.id ?? null;
  });

  return { ...team, starters, bench: ids.filter((id) => !used.has(id)) };
}

function projectedTotal(
  team: FantasyTeam,
  byId: Map<string, SlimPlayer>,
  league: League,
  week: number,
) {
  return team.starters.reduce((sum, id) => {
    const p = id ? byId.get(id) : undefined;
    return sum + (p ? scoreFor(p, week, league).projected : 0);
  }, 0);
}

export function RosterTable({
  team,
  league,
  byId,
  week,
  editable = true,
}: {
  team: FantasyTeam;
  league: League;
  byId: Map<string, SlimPlayer>;
  week: number;
  editable?: boolean;
}) {
  const [flash, setFlash] = useState<string | null>(null);
  const insights = useInsights();
  const move = useServerFn(makeRosterMove);
  const [pending, setPending] = useState(false);
  const [dropTarget, setDropTarget] = useState<SlimPlayer | null>(null);
  const irMove = useServerFn(setInjuredReserve);

  const irSlots = league.rules.irSlots ?? 0;
  const irIds = team.ir ?? [];
  const irPlayers = irIds.map((id) => byId.get(id)).filter((p): p is SlimPlayer => !!p);
  const irOpen = irSlots > 0 && irIds.length < irSlots;

  const moveToIR = async (p: SlimPlayer, toIR: boolean) => {
    setPending(true);
    try {
      await irMove({ data: { playerId: p.id, playerName: p.name, toIR } });
      await reloadLeague();
      toast.success(toIR ? `${p.name} moved to injured reserve` : `${p.name} is back on your bench`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That move did not go through.");
    } finally {
      setPending(false);
    }
  };

  const locked = (p: SlimPlayer | undefined) => isPlayerLocked(p, week, league);

  const teamSlot = league.teams.indexOf(team);
  const onBlock = useTeamTradeBlock(teamSlot);

  const swapIn = (slotIndex: number, benchId: string) => {
    updateLeague((l) =>
      setTeam(l, team.id, (t) => {
        const starters = [...t.starters];
        const out = starters[slotIndex] ?? null;
        starters[slotIndex] = benchId;
        const bench = t.bench.filter((id) => id !== benchId);
        if (out) bench.push(out);
        return { ...t, starters, bench };
      }),
    );
    setFlash(benchId);
    toast.success("Lineup updated");
  };

  const benchStarter = (slotIndex: number) => {
    updateLeague((l) =>
      setTeam(l, team.id, (t) => {
        const starters = [...t.starters];
        const out = starters[slotIndex];
        if (!out) return t;
        starters[slotIndex] = null;
        return { ...t, starters, bench: [...t.bench, out] };
      }),
    );
    toast.success("Player moved to bench");
  };

  const startBenchPlayer = (benchId: string) => {
    const p = byId.get(benchId);
    if (!p) return;
    const slotIndex = SLOTS.findIndex(
      (slot, i) => slotAccepts(slot, p.pos) && !team.starters[i],
    );
    const target =
      slotIndex >= 0 ? slotIndex : SLOTS.findIndex((slot) => slotAccepts(slot, p.pos));
    if (target < 0) {
      toast.error(`No starting spot for a ${p.pos}`);
      return;
    }
    swapIn(target, benchId);
  };

  const dropPlayer = async (p: SlimPlayer) => {
    setPending(true);
    try {
      await move({
        data: { addId: null, addName: p.name, addPos: p.pos, dropId: p.id, dropName: p.name },
      });
      await reloadLeague();
      toast.success(`Dropped ${p.name}`);
      setDropTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That move did not go through.");
    } finally {
      setPending(false);
    }
  };

  const optimize = () => {
    const before = projectedTotal(team, byId, league, week);
    const after = projectedTotal(
      optimizeTeam(team, byId, league, week, insights, locked),
      byId,
      league,
      week,
    );
    updateLeague((l) =>
      setTeam(l, team.id, (t) => optimizeTeam(t, byId, l, week, insights, locked)),
    );
    const gain = after - before;
    toast.success(
      gain > 0.05
        ? `Lineup optimized · +${gain.toFixed(1)} projected points`
        : "Your lineup was already the best projected one",
    );
  };

  const rows = SLOTS.map((slot, i) => ({
    slot,
    index: i,
    player: team.starters[i] ? byId.get(team.starters[i]!) : undefined,
  }));

  const benchPlayers = team.bench
    .map((id) => byId.get(id))
    .filter((p): p is SlimPlayer => !!p);

  const eligibleBench = (slot: string) => benchPlayers.filter((p) => slotAccepts(slot, p.pos));

  const inactiveStarters = rows
    .map((r) => r.player)
    .filter((p): p is SlimPlayer => !!p && isInactive(p.injury));

  const byeStarters = rows
    .map((r) => r.player)
    .filter((p): p is SlimPlayer => !!p && isOnBye(insights, p, week));

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-secondary/60 px-4 py-3 sm:flex sm:justify-between">
        <h2 className="truncate font-display text-xl font-bold">Starting Lineup</h2>
        {editable && (
          <Button onClick={optimize} className="shrink-0 text-base font-semibold">
            <Wand2 className="mr-2 h-4 w-4" /> Optimize Lineup
          </Button>
        )}
      </div>

      {inactiveStarters.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 border-b-2 border-injury-out bg-injury-out/15 px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-injury-out" />
          <p className="text-base font-semibold leading-snug">
            <span className="text-injury-out">
              {inactiveStarters.length === 1 ? "A player who won't play is" : "Players who won't play are"} in your starting lineup:
            </span>{" "}
            {inactiveStarters
              .map((p) => `${p.name} (${injuryInfo(p.injury)?.tag})`)
              .join(", ")}
            . Swap them out or hit Optimize Lineup.
          </p>
        </div>
      )}

      {byeStarters.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 border-b-2 border-injury-questionable bg-injury-questionable/20 px-4 py-3"
        >
          <CalendarOff className="mt-0.5 h-5 w-5 shrink-0 text-injury-questionable" />
          <p className="text-base font-semibold leading-snug">
            On bye this week and still starting:{" "}
            {byeStarters.map((p) => p.name).join(", ")}. They will score zero.
          </p>
        </div>
      )}


      <table className="w-full">
        <thead className="hidden border-b text-left text-xs uppercase tracking-widest text-muted-foreground md:table-header-group">
          <tr>
            <th className="w-20 px-4 py-2">Slot</th>
            <th className="px-4 py-2">Player</th>
            <th className="w-32 px-4 py-2">Game</th>
            <th className="w-24 px-4 py-2 text-right">Proj</th>
            <th className="w-24 px-4 py-2 text-right">Points</th>
            {editable && <th className="w-40 px-4 py-2 text-right">Move</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ slot, index, player }) => {
            const s = player ? scoreFor(player, week, league) : null;
            return (
              <tr
                key={`${slot}-${index}`}
                className={cn(
                  "block md:table-row",
                  player && isInactive(player.injury) && "bg-injury-out/10",
                  flash === player?.id && "bg-accent/40 transition-colors",
                )}
              >
                <td className="block px-4 pt-3 md:table-cell md:py-3">
                  <span className="rounded bg-secondary px-2 py-0.5 font-display text-sm font-bold uppercase tracking-widest">
                    {slot}
                  </span>
                </td>
                <td className="block px-4 py-2 md:table-cell md:py-3">
                  {player ? (
                    <div className="min-w-0">
                      <PlayerCell player={player} week={week} />
                      {!editable && onBlock.has(player.id) && (
                        <TradeAvailableBadge className="mt-1" />
                      )}
                      <PlayerInsightChips player={player} week={week} />
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Empty</span>
                  )}
                </td>
                <td className="block px-4 text-sm text-muted-foreground md:table-cell md:py-3">
                  {player ? "" : "—"}
                </td>
                <td className="hidden px-4 py-3 text-right text-lg tabular-nums md:table-cell">
                  {s ? s.projected.toFixed(1) : "—"}
                </td>
                <td className="block px-4 md:table-cell md:py-3 md:text-right">
                  <span className="font-display text-xl font-bold tabular-nums">
                    {s ? s.actual.toFixed(1) : "—"}
                  </span>
                  <span className="ml-2 text-sm text-muted-foreground md:hidden">
                    proj {s ? s.projected.toFixed(1) : "—"}
                  </span>
                </td>
                {editable && (
                  <td className="block px-4 pb-3 pt-2 md:table-cell md:py-3 md:text-right">
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      {locked(player) ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 text-sm font-semibold text-muted-foreground">
                          <Lock className="h-4 w-4" /> Game started
                        </span>
                      ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-9 px-3 font-semibold">
                            <ArrowLeftRight className="mr-1.5 h-4 w-4" /> Swap
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                          <DropdownMenuLabel>Bring in for {slot}</DropdownMenuLabel>
                          {eligibleBench(slot).length === 0 && (
                            <DropdownMenuItem disabled>No eligible bench player</DropdownMenuItem>
                          )}
                          {eligibleBench(slot).map((p) => (
                            <DropdownMenuItem
                              key={p.id}
                              disabled={locked(p)}
                              onSelect={() => swapIn(index, p.id)}
                            >
                              <span className="truncate">
                                {p.name} · {p.pos}
                                {locked(p) ? " · locked" : ""}
                              </span>
                              <span className="ml-auto tabular-nums">
                                {scoreFor(p, week, league).projected.toFixed(1)}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      )}
                      {player && (
                        <>
                          {!locked(player) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 px-3 font-semibold"
                              onClick={() => benchStarter(index)}
                            >
                              Bench
                            </Button>
                          )}
                          {irOpen && isInactive(player.injury) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 px-3 font-semibold"
                              disabled={pending}
                              onClick={() => void moveToIR(player, true)}
                            >
                              Injured reserve
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-3 font-semibold text-destructive"
                            disabled={pending}
                            onClick={() => setDropTarget(player)}
                          >
                            Drop
                          </Button>
                          <TradeFlagToggle
                            teamSlot={teamSlot}
                            playerId={player.id}
                            playerName={player.name}
                            listed={onBlock.has(player.id)}
                            className="ml-auto"
                          />
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="border-t bg-secondary/40 px-4 py-3 sm:flex sm:items-center sm:justify-between">
        <h3 className="font-display text-lg font-bold">Bench</h3>
        {editable && (
          <Link
            to="/players"
            search={{ f: "FA" }}
            className="mt-2 inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-semibold hover:bg-accent sm:mt-0"
          >
            <UserPlus className="mr-1.5 h-4 w-4" /> Pick up a free agent
          </Link>
        )}
      </div>
      <ul className="divide-y">
        {benchPlayers.map((p) => {
          const s = scoreFor(p, week, league);
          return (
            <li
              key={p.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <PlayerCell player={p} compact week={week} />
                {!editable && onBlock.has(p.id) && <TradeAvailableBadge className="mt-1" />}
                <PlayerInsightChips player={p} week={week} />
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <div className="text-right">
                  <div className="font-display text-lg font-bold tabular-nums">
                    {s.actual.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">proj {s.projected.toFixed(1)}</div>
                </div>
                {editable && (
                  <>
                    {locked(p) ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                        <Lock className="h-4 w-4" /> Locked
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 font-semibold"
                        onClick={() => startBenchPlayer(p.id)}
                      >
                        Start
                      </Button>
                    )}
                    {irOpen && isInactive(p.injury) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 font-semibold"
                        disabled={pending}
                        onClick={() => void moveToIR(p, true)}
                      >
                        IR
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 font-semibold text-destructive"
                      disabled={pending}
                      onClick={() => setDropTarget(p)}
                    >
                      Drop
                    </Button>
                    <TradeFlagToggle
                      teamSlot={teamSlot}
                      playerId={p.id}
                      playerName={p.name}
                      listed={onBlock.has(p.id)}
                      className="ml-auto"
                    />
                  </>
                )}
              </div>
            </li>
          );
        })}
        {benchPlayers.length === 0 && (
          <li className="px-4 py-6 text-muted-foreground">Bench is empty.</li>
        )}
      </ul>

      {irSlots > 0 && (
        <>
          <div className="border-t bg-secondary/40 px-4 py-3">
            <h3 className="font-display text-lg font-bold">
              Injured Reserve{" "}
              <span className="font-sans text-sm font-semibold text-muted-foreground">
                {irIds.length} of {irSlots}
              </span>
            </h3>
            <p className="text-sm text-muted-foreground">
              Park a hurt starter here to free up a roster spot. They score nothing while on IR.
            </p>
          </div>
          <ul className="divide-y">
            {irPlayers.map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
              >
                <PlayerCell player={p} compact week={week} />
                {editable && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => void moveToIR(p, false)}
                    >
                      Activate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      disabled={pending}
                      onClick={() => setDropTarget(p)}
                    >
                      Drop
                    </Button>
                  </div>
                )}
              </li>
            ))}
            {irPlayers.length === 0 && (
              <li className="px-4 py-6 text-muted-foreground">
                Nobody on injured reserve. Use the IR button next to a player who is out.
              </li>
            )}
          </ul>
        </>
      )}

      <Dialog open={!!dropTarget} onOpenChange={(o) => !o && setDropTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Drop {dropTarget?.name}?</DialogTitle>
            <DialogDescription>
              They will go back on the free agent list, and any family can pick them up.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex justify-end gap-3">
            <Button variant="outline" disabled={pending} onClick={() => setDropTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => dropTarget && void dropPlayer(dropTarget)}
            >
              {pending ? "Dropping…" : "Yes, drop them"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

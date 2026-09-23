import type { SlimPlayer } from "../sleeper.functions";
import { gameInfoFor } from "./hooks";
import type { League } from "./league";

/**
 * A player's lineup spot freezes once his NFL game has kicked off, the same way
 * ESPN locks players individually at scheduled gametime.
 */
export function isPlayerLocked(
  player: SlimPlayer | undefined,
  week: number,
  league: League,
): boolean {
  if (!player) return false;
  if (!league.rules.lockAtKickoff) return false;
  const status = gameInfoFor(player.team, week)?.status;
  return status === "live" || status === "final";
}

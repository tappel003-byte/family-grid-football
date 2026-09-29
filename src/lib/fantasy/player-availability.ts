import type { GameInfo } from "../nfl.functions";
import { lastWaiverRun } from "./waiver-cycle";

export type PlayerAvailability = "free-agent" | "waiver";

/**
 * A player stays on waivers from his most recent kickoff until the first
 * Wednesday 12:01am Eastern run after that kickoff. After that run he is a
 * free agent until his next kickoff.
 */
export function availabilityFromKickoffs(
  kickoffs: Array<string | number | Date | null | undefined>,
  now: number = Date.now(),
): PlayerAvailability {
  const mostRecentKickoff = kickoffs.reduce<number | null>((latest, value) => {
    if (value === null || value === undefined) return latest;
    const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
    if (!Number.isFinite(timestamp) || timestamp > now) return latest;
    return latest === null || timestamp > latest ? timestamp : latest;
  }, null);

  return mostRecentKickoff !== null && mostRecentKickoff >= lastWaiverRun(now)
    ? "waiver"
    : "free-agent";
}

/** Uses the schedule data already shown in the app, failing safely to Claim. */
export function availabilityFromGames(
  games: Array<GameInfo | undefined>,
  now: number = Date.now(),
): PlayerAvailability {
  const knownKickoffs = games.map((game) => game?.startsAt);
  const hasStartedGameWithoutTime = games.some(
    (game) => !game?.startsAt && (game?.status === "live" || game?.status === "final"),
  );
  if (hasStartedGameWithoutTime) return "waiver";
  return availabilityFromKickoffs(knownKickoffs, now);
}
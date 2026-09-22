import type { SlimPlayer } from "../sleeper.functions";

/** True when a player is healthy enough to start this week. */
export function isPlayable(player: SlimPlayer): boolean {
  const i = (player.injury ?? "").toUpperCase();
  return !(i === "OUT" || i === "IR" || i === "PUP" || i === "SUS" || i === "DNR");
}

import type { SlimPlayer } from "../sleeper.functions";
import type { StatLine } from "./scoring";

/** Deterministic 0..1 pseudo-random from a string seed. */
export function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const EMPTY: StatLine = {
  passYd: 0,
  passTd: 0,
  interception: 0,
  rushYd: 0,
  rushTd: 0,
  reception: 0,
  recYd: 0,
  recTd: 0,
  fumble: 0,
  fgMade: 0,
  xpMade: 0,
  defSack: 0,
  defInt: 0,
  defTd: 0,
};

/** Talent factor 0.35 - 1 based on a player's Sleeper search rank. */
function talent(player: SlimPlayer): number {
  const r = Math.min(player.rank, 400);
  return 1 - (r / 400) * 0.65;
}

export function projectedStats(player: SlimPlayer, week: number): StatLine {
  const t = talent(player);
  const wobble = 0.85 + seeded(`${player.id}-${week}-w`) * 0.3;
  const f = t * wobble;
  const s = (k: string) => seeded(`${player.id}-${week}-${k}`);
  const stats: StatLine = { ...EMPTY };

  switch (player.pos) {
    case "QB":
      stats.passYd = Math.round(120 + f * 210);
      stats.passTd = Math.round(f * 2.6 * 10) / 10;
      stats.interception = Math.round(s("int") * 1.4 * 10) / 10;
      stats.rushYd = Math.round(f * s("ru") * 45);
      stats.rushTd = Math.round(f * s("rtd") * 0.6 * 10) / 10;
      break;
    case "RB":
      stats.rushYd = Math.round(18 + f * 90);
      stats.rushTd = Math.round(f * 0.8 * 10) / 10;
      stats.reception = Math.round(f * (1 + s("rec") * 4) * 10) / 10;
      stats.recYd = Math.round(f * s("ry") * 45);
      stats.recTd = Math.round(f * s("rtd") * 0.3 * 10) / 10;
      stats.fumble = Math.round(s("fum") * 0.3 * 10) / 10;
      break;
    case "WR":
      stats.reception = Math.round((1 + f * 6) * 10) / 10;
      stats.recYd = Math.round(12 + f * 85);
      stats.recTd = Math.round(f * 0.7 * 10) / 10;
      stats.rushYd = Math.round(s("ru") * f * 8);
      break;
    case "TE":
      stats.reception = Math.round((1 + f * 4.5) * 10) / 10;
      stats.recYd = Math.round(8 + f * 60);
      stats.recTd = Math.round(f * 0.55 * 10) / 10;
      break;
    case "K":
      stats.fgMade = Math.round((0.7 + f * 1.8) * 10) / 10;
      stats.xpMade = Math.round((1 + f * 2.2) * 10) / 10;
      break;
    case "DEF":
      stats.defSack = Math.round((1 + f * 2.5) * 10) / 10;
      stats.defInt = Math.round((0.3 + f * 1.2) * 10) / 10;
      stats.defTd = Math.round(s("dtd") * 0.3 * 10) / 10;
      break;
  }
  return stats;
}

/** How far along a player's game is this week: 0 = not started, 1 = final. */
export function gameProgress(player: SlimPlayer, week: number, currentWeek: number): number {
  if (week < currentWeek) return 1;
  if (week > currentWeek) return 0;
  const r = seeded(`${player.team}-${week}-game`);
  if (r < 0.35) return 1;
  if (r < 0.6) return Math.round(r * 100) / 100;
  return 0;
}

export function gameStatusLabel(player: SlimPlayer, week: number, currentWeek: number): string {
  const p = gameProgress(player, week, currentWeek);
  if (p >= 1) return "Final";
  if (p <= 0) {
    const r = seeded(`${player.team}-${week}-slot`);
    const slots = ["Sun 1:00", "Sun 4:05", "Sun 4:25", "Sun 8:20", "Mon 8:15", "Thu 8:15"];
    return slots[Math.floor(r * slots.length)];
  }
  const q = Math.min(4, Math.max(1, Math.ceil(p * 4)));
  return `Q${q} live`;
}

export function actualStats(player: SlimPlayer, week: number, currentWeek: number): StatLine {
  const progress = gameProgress(player, week, currentWeek);
  const proj = projectedStats(player, week);
  if (progress <= 0) return { ...EMPTY };
  const variance = 0.55 + seeded(`${player.id}-${week}-v`) * 0.95;
  const out = { ...EMPTY };
  for (const k of Object.keys(proj) as Array<keyof StatLine>) {
    out[k] = Math.round(proj[k] * variance * progress * 10) / 10;
  }
  return out;
}

export function isPlayable(player: SlimPlayer): boolean {
  const i = (player.injury ?? "").toUpperCase();
  return !(i === "OUT" || i === "IR" || i === "PUP" || i === "SUS" || i === "DNR");
}

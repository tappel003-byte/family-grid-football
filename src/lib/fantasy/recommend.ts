import type { Ownership } from "../market.functions";

export type Recommendation = {
  level: "must" | "good" | "stream" | "pass";
  label: string;
  reason: string;
};

type Input = {
  free: boolean;
  own: Ownership | null;
  last3Avg: number;
  seasonAvg: number;
  projected: number;
  onBye: boolean;
  injury: string | null;
  matchup: "great" | "even" | "tough" | null;
  trendingAdds: number;
};

/**
 * Plain-language advice for a free agent, built from how the rest of the
 * country is using him plus his own recent scoring.
 */
export function recommendFor(i: Input): Recommendation | null {
  if (!i.free) return null;

  const out = ["OUT", "IR", "PUP", "SUS", "DNR"].includes((i.injury ?? "").toUpperCase());
  if (out) {
    return { level: "pass", label: "Not now", reason: "He is ruled out, so he would score nothing." };
  }
  if (i.onBye) {
    return { level: "pass", label: "Bye week", reason: "His team is off this week — he scores 0." };
  }

  const owned = i.own?.owned ?? 0;
  const started = i.own?.started ?? 0;
  const rising = (i.own?.change ?? 0) >= 1 || i.trendingAdds >= 5000;
  const hot = i.last3Avg >= i.seasonAvg + 2;

  if ((started >= 40 || i.last3Avg >= 12) && owned < 80) {
    return {
      level: "must",
      label: "Grab him",
      reason:
        started >= 40
          ? `Scoring ${i.last3Avg.toFixed(1)} a game and started in ${Math.round(started)}% of leagues.`
          : `Scoring ${i.last3Avg.toFixed(1)} a game over his last three — better than most benches.`,
    };
  }
  if (rising || hot || i.last3Avg >= 8) {
    return {
      level: "good",
      label: "Worth adding",
      reason: rising
        ? "People all over the country are picking him up right now."
        : `He is heating up — ${i.last3Avg.toFixed(1)} a game over his last three.`,
    };
  }
  if (i.matchup === "great" || i.projected >= 9) {
    return {
      level: "stream",
      label: "One-week fill-in",
      reason:
        i.matchup === "great"
          ? "Easy opponent this week — fine if you need a body."
          : "Decent projection this week if you have a hole to fill.",
    };
  }
  return { level: "pass", label: "Skip", reason: "Not scoring enough to help your lineup." };
}

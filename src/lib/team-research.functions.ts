import { createServerFn } from "@tanstack/react-start";
import { loadEspnIdMap, loadPlayerMeta, loadSchedule, loadState } from "./nfl-stats.server";
import {
  formatMissedLine,
  formatReturnDate,
  outlookFromReturn,
  type InjuryOutlook,
} from "./injury-outlook";

export type PlayerInjuryOutlook = {
  status: string;
  returnDate: string | null;
  returnLabel: string | null;
  /** e.g. "OUT · est. Wk 10" for the matrix chip. */
  matrixChip: string | null;
  /** Soft card line with games that may be missed. */
  cardLine: string | null;
  outlook: InjuryOutlook | null;
};

export type TeamResearch = {
  /** 1 = highest-scoring NFL offense so far this season. */
  offenseRankByTeam: Record<string, number>;
  /** Injury outlook keyed by Sleeper player id. */
  injuries: Record<string, PlayerInjuryOutlook>;
  fetchedAt: string;
};

const HEADERS = { Accept: "application/json", "User-Agent": "curl/8.0" };
const TTL = 1000 * 60 * 45;
let cache: { at: number; data: TeamResearch } | null = null;

const normTeam = (team: string) => (team === "WSH" ? "WAS" : team);

async function safeJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

function espnAthleteId(athlete: {
  id?: string | number;
  links?: Array<{ rel?: string[]; href?: string }>;
}): string | null {
  if (athlete.id != null) return String(athlete.id);
  for (const link of athlete.links ?? []) {
    const href = link.href ?? "";
    const match = href.match(/\/id\/(\d+)\//);
    if (match?.[1]) return match[1];
  }
  return null;
}

function walkStandings(node: unknown, out: Array<{ team: string; pointsFor: number }>) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walkStandings(item, out);
    return;
  }
  const row = node as {
    team?: { abbreviation?: string };
    stats?: Array<{ name?: string; value?: number }>;
  };
  if (row.team?.abbreviation && Array.isArray(row.stats)) {
    const pointsFor = row.stats.find((s) => s.name === "pointsFor")?.value;
    if (typeof pointsFor === "number") {
      out.push({ team: normTeam(row.team.abbreviation), pointsFor });
    }
  }
  for (const value of Object.values(row)) walkStandings(value, out);
}

function matrixChip(status: string, returnWeek: number | null): string | null {
  const upper = status.toUpperCase();
  const severe =
    upper.startsWith("OUT") ||
    upper.startsWith("IR") ||
    upper.includes("RESERVE") ||
    upper.startsWith("PUP") ||
    upper.startsWith("SUS");
  if (!severe && !upper.startsWith("DOUBT")) {
    if (upper.startsWith("QUESTION")) return "Q";
    return null;
  }
  const tag = upper.startsWith("IR") || upper.includes("RESERVE")
    ? "IR"
    : upper.startsWith("PUP")
      ? "PUP"
      : upper.startsWith("SUS")
        ? "SUS"
        : upper.startsWith("DOUBT")
          ? "D"
          : "OUT";
  return returnWeek ? `${tag} · est. Wk ${returnWeek}` : tag;
}

function cardLine(
  status: string,
  returnDate: string | null,
  outlook: InjuryOutlook | null,
): string | null {
  if (!returnDate && !outlook?.labels.length) return null;
  const parts: string[] = [];
  if (returnDate) parts.push(`ESPN estimate · return ${formatReturnDate(returnDate)}`);
  const missed = outlook ? formatMissedLine(outlook.labels) : null;
  if (missed) parts.push(missed);
  else if (status) parts.push(status);
  return parts.join(" · ") || null;
}

/** Offense ranks (1–32) plus ESPN injury return outlooks, cached ~45 minutes. */
export const getTeamResearch = createServerFn({ method: "GET" }).handler(
  async (): Promise<TeamResearch> => {
    if (cache && Date.now() - cache.at < TTL) return cache.data;

    const { season, week } = await loadState();
    const [standings, injuryFeed, idMap, schedule, meta] = await Promise.all([
      safeJson<unknown>("https://site.api.espn.com/apis/v2/sports/football/nfl/standings", {}),
      safeJson<{
        injuries?: Array<{
          injuries?: Array<{
            status?: string;
            details?: { returnDate?: string };
            athlete?: {
              id?: string | number;
              links?: Array<{ rel?: string[]; href?: string }>;
              team?: { abbreviation?: string };
            };
          }>;
        }>;
      }>("https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries", {}),
      loadEspnIdMap(),
      loadSchedule(season),
      loadPlayerMeta(),
    ]);

    const scored: Array<{ team: string; pointsFor: number }> = [];
    walkStandings(standings, scored);
    // Deduplicate if the walk hits the same team twice.
    const best = new Map<string, number>();
    for (const row of scored) best.set(row.team, Math.max(best.get(row.team) ?? 0, row.pointsFor));
    const ranked = [...best.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const offenseRankByTeam: Record<string, number> = {};
    ranked.forEach(([team], i) => {
      offenseRankByTeam[team] = i + 1;
    });

    const injuries: Record<string, PlayerInjuryOutlook> = {};
    for (const teamBlock of injuryFeed.injuries ?? []) {
      for (const row of teamBlock.injuries ?? []) {
        const status = row.status ?? "";
        if (!status || status === "Active") continue;
        const espnId = row.athlete ? espnAthleteId(row.athlete) : null;
        const sleeperId = espnId ? idMap[espnId] : undefined;
        if (!sleeperId) continue;
        const returnDate = row.details?.returnDate ? String(row.details.returnDate).slice(0, 10) : null;
        const team = normTeam(
          meta[sleeperId]?.team ?? row.athlete?.team?.abbreviation ?? "",
        );
        const outlook =
          returnDate && team
            ? outlookFromReturn(team, schedule, week, returnDate)
            : null;
        injuries[sleeperId] = {
          status,
          returnDate,
          returnLabel: returnDate ? formatReturnDate(returnDate) : null,
          matrixChip: matrixChip(status, outlook?.returnWeek ?? null),
          cardLine: cardLine(status, returnDate, outlook),
          outlook,
        };
      }
    }

    const data: TeamResearch = {
      offenseRankByTeam,
      injuries,
      fetchedAt: new Date().toISOString(),
    };
    cache = { at: Date.now(), data };
    return data;
  },
);

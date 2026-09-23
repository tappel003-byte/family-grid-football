import { createServerFn } from "@tanstack/react-start";
import { loadEspnIdMap, loadState } from "./nfl-stats.server";

export type Ownership = {
  /** Percent of national leagues where this player is on a roster. */
  owned: number;
  /** Percent of national leagues starting him this week. */
  started: number;
  /** Change in rostered percent over the last week. */
  change: number;
};

export type PlayerNews = {
  headline: string;
  published: string;
  link: string | null;
};

export type MarketData = {
  season: string;
  ownership: Record<string, Ownership>;
  news: Record<string, PlayerNews>;
};

type EspnPlayer = {
  id?: number;
  ownership?: { percentOwned?: number; percentStarted?: number; percentChange?: number } | null;
};

type EspnArticle = {
  headline?: string;
  published?: string;
  links?: { web?: { href?: string } };
  categories?: Array<{ type?: string; athlete?: { id?: number } }>;
};

let cache: { at: number; data: MarketData } | null = null;
const TTL = 1000 * 60 * 30;

async function safeJson<T>(url: string, fallback: T, headers?: Record<string, string>): Promise<T> {
  try {
    const res = await fetch(url, headers ? { headers } : undefined);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/** National rostered/started percentages plus the latest headline per player. */
export const getMarket = createServerFn({ method: "GET" }).handler(async (): Promise<MarketData> => {
  if (cache && Date.now() - cache.at < TTL) return cache.data;

  const { season } = await loadState();
  const [idMap, espnPlayers, newsFeed] = await Promise.all([
    loadEspnIdMap(),
    safeJson<EspnPlayer[]>(
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/players?view=kona_player_info`,
      [],
      {
        accept: "application/json",
        "x-fantasy-filter": JSON.stringify({
          players: {
            filterActive: { value: true },
            limit: 4000,
            sortPercOwned: { sortAsc: false, sortPriority: 1 },
          },
        }),
      },
    ),
    safeJson<{ articles?: EspnArticle[] }>(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50",
      {},
    ),
  ]);

  const ownership: Record<string, Ownership> = {};
  for (const p of espnPlayers) {
    const sleeperId = p.id ? idMap[String(p.id)] : undefined;
    if (!sleeperId || !p.ownership) continue;
    ownership[sleeperId] = {
      owned: Math.round((p.ownership.percentOwned ?? 0) * 10) / 10,
      started: Math.round((p.ownership.percentStarted ?? 0) * 10) / 10,
      change: Math.round((p.ownership.percentChange ?? 0) * 10) / 10,
    };
  }

  const news: Record<string, PlayerNews> = {};
  for (const art of newsFeed.articles ?? []) {
    if (!art.headline) continue;
    for (const c of art.categories ?? []) {
      if (c.type !== "athlete" || !c.athlete?.id) continue;
      const sleeperId = idMap[String(c.athlete.id)];
      if (!sleeperId || news[sleeperId]) continue;
      news[sleeperId] = {
        headline: art.headline,
        published: art.published ?? "",
        link: art.links?.web?.href ?? null,
      };
    }
  }

  const data: MarketData = { season, ownership, news };
  cache = { at: Date.now(), data };
  return data;
});

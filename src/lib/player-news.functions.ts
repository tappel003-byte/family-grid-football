import { createServerFn } from "@tanstack/react-start";
import { loadEspnIdMap } from "./nfl-stats.server";

export type PlayerNewsItem = {
  headline: string;
  description: string | null;
  published: string;
  link: string | null;
};

type EspnFeed = {
  feed?: Array<{
    headline?: string;
    description?: string;
    published?: string;
    links?: { web?: { href?: string } };
  }>;
};

const TTL = 1000 * 60 * 15;
const cache = new Map<string, { at: number; items: PlayerNewsItem[] }>();
let reverse: { src: Record<string, string>; map: Map<string, string> } | null = null;

function safeLink(href: unknown): string | null {
  if (typeof href !== "string") return null;
  try {
    const u = new URL(href);
    if (u.protocol !== "https:") return null;
    if (u.hostname !== "espn.com" && !u.hostname.endsWith(".espn.com")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Latest ESPN news for one player. Accepts only a Sleeper player ID; never throws. */
export const getPlayerNews = createServerFn({ method: "GET" })
  .inputValidator((data: { sleeperId: string }) => {
    const id = typeof data?.sleeperId === "string" ? data.sleeperId : "";
    return { sleeperId: /^[A-Za-z0-9]{1,12}$/.test(id) ? id : "" };
  })
  .handler(async ({ data }): Promise<PlayerNewsItem[]> => {
    try {
      if (!/^\d+$/.test(data.sleeperId)) return []; // defenses have no ESPN player news
      const hit = cache.get(data.sleeperId);
      if (hit && Date.now() - hit.at < TTL) return hit.items;

      const idMap = await loadEspnIdMap();
      if (!reverse || reverse.src !== idMap) {
        const map = new Map<string, string>();
        for (const [espn, sleeper] of Object.entries(idMap)) map.set(sleeper, espn);
        reverse = { src: idMap, map };
      }
      const espnId = reverse.map.get(data.sleeperId);
      if (!espnId || !/^\d{1,12}$/.test(espnId)) return [];

      const res = await fetch(
        `https://site.api.espn.com/apis/fantasy/v2/games/ffl/news/players?limit=3&playerId=${espnId}`,
        {
          headers: { "user-agent": "curl/8.0", accept: "application/json" },
          signal: AbortSignal.timeout(3000),
        },
      );
      if (!res.ok) return [];
      const json = (await res.json()) as EspnFeed;
      const items: PlayerNewsItem[] = (json.feed ?? [])
        .filter((a) => typeof a.headline === "string" && a.headline.trim())
        .map((a) => ({
          headline: a.headline!.trim(),
          description:
            a.description?.trim() && a.description.trim() !== a.headline!.trim()
              ? a.description.trim()
              : null,
          published: a.published ?? "",
          link: safeLink(a.links?.web?.href),
        }))
        .sort((a, b) => b.published.localeCompare(a.published))
        .slice(0, 3);
      cache.set(data.sleeperId, { at: Date.now(), items });
      return items;
    } catch {
      return [];
    }
  });

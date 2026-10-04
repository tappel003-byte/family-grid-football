import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PickTeam = { abbr: string; name: string; record: string; score: number | null; winner: boolean };
export type PickGame = {
  id: string;
  startsAt: string;
  network?: string | undefined;
  status: "scheduled" | "live" | "final";
  home: PickTeam;
  away: PickTeam;
};
export type FamilyRow = {
  userId: string;
  name: string;
  picks: Record<string, string>;
  tiebreaker: number | null;
  correct: number;
  done: boolean;
};
export type PicksBoard = {
  season: string;
  week: number;
  currentWeek: number;
  games: PickGame[];
  mondayGameId: string | null;
  myPicks: Record<string, string>;
  myTiebreaker: number | null;
  iAmDone: boolean;
  family: FamilyRow[];
  season_totals: Array<{ userId: string; name: string; correct: number; weeksWon: number }>;
};

const HEADERS = { Accept: "application/json", "User-Agent": "curl/8.0" };
const cache = new Map<string, { at: number; games: PickGame[] }>();

type Espn = {
  events?: Array<{
    id?: string;
    date?: string;
    status?: { type?: { state?: string; completed?: boolean } };
    competitions?: Array<{
      broadcasts?: Array<{ names?: string[] }>;
      competitors?: Array<{
        homeAway?: string;
        score?: string;
        winner?: boolean;
        records?: Array<{ summary?: string }>;
        team?: { abbreviation?: string; displayName?: string };
      }>;
    }>;
  }>;
};

async function seasonState() {
  try {
    const r = await fetch("https://api.sleeper.app/v1/state/nfl", { headers: HEADERS });
    const s = (await r.json()) as { season?: string; display_week?: number; week?: number };
    return { season: s.season ?? String(new Date().getUTCFullYear()), week: s.display_week ?? s.week ?? 1 };
  } catch {
    return { season: String(new Date().getUTCFullYear()), week: 1 };
  }
}

async function loadGames(season: string, week: number, current: number): Promise<PickGame[]> {
  const key = `${season}-${week}`;
  const hit = cache.get(key);
  const ttl = week < current ? 6 * 3600_000 : 60_000;
  if (hit && Date.now() - hit.at < ttl) return hit.games;
  let data: Espn = {};
  try {
    const r = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`,
      { headers: HEADERS },
    );
    if (r.ok) data = (await r.json()) as Espn;
  } catch {
    /* fall through */
  }
  const games: PickGame[] = [];
  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0];
    const side = (h: string): PickTeam | null => {
      const c = comp?.competitors?.find((x) => x.homeAway === h);
      const abbr = c?.team?.abbreviation;
      if (!c || !abbr) return null;
      return {
        abbr: abbr === "WSH" ? "WAS" : abbr,
        name: c.team?.displayName ?? abbr,
        record: c.records?.[0]?.summary ?? "",
        score: c.score != null && c.score !== "" ? Number(c.score) : null,
        winner: !!c.winner,
      };
    };
    const home = side("home");
    const away = side("away");
    if (!ev.id || !ev.date || !home || !away) continue;
    const t = ev.status?.type;
    games.push({
      id: ev.id,
      startsAt: ev.date,
      network: comp?.broadcasts?.[0]?.names?.[0],
      status: t?.completed ? "final" : t?.state === "in" ? "live" : "scheduled",
      home,
      away,
    });
  }
  games.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (games.length) cache.set(key, { at: Date.now(), games });
  return games.length ? games : hit?.games ?? [];
}

const started = (g: PickGame) => g.status !== "scheduled" || Date.parse(g.startsAt) <= Date.now();
const winnerOf = (g: PickGame) => (g.status !== "final" ? null : g.home.winner ? g.home.abbr : g.away.winner ? g.away.abbr : null);
/** The last game of the week is the Monday night tiebreaker game. */
const mondayOf = (games: PickGame[]) => games[games.length - 1] ?? null;
const mondayTotal = (g: PickGame | null) =>
  g && g.status === "final" ? (g.home.score ?? 0) + (g.away.score ?? 0) : null;

export const getPicksBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { week?: number }) => ({ week: d.week ? Math.min(18, Math.max(1, Math.round(d.week))) : undefined }))
  .handler(async ({ data, context }): Promise<PicksBoard> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const state = await seasonState();
    const week = data.week ?? state.week;
    const games = await loadGames(state.season, week, state.week);
    const monday = mondayOf(games);

    const [{ data: picks }, { data: ties }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("game_picks").select("user_id, week, game_id, team").eq("season", state.season),
      supabaseAdmin.from("pick_tiebreakers").select("user_id, week, total_points").eq("season", state.season),
      supabaseAdmin.from("profiles").select("id, display_name, email"),
    ]);
    const nameOf = (id: string) => {
      const p = profiles?.find((x) => x.id === id);
      return p?.display_name || p?.email?.split("@")[0] || "Family";
    };

    const byUserWeek = new Map<string, Record<string, string>>();
    for (const p of picks ?? []) {
      const k = `${p.user_id}:${p.week}`;
      const m = byUserWeek.get(k) ?? {};
      m[p.game_id] = p.team;
      byUserWeek.set(k, m);
    }
    const tieOf = (u: string, w: number) => ties?.find((t) => t.user_id === u && t.week === w)?.total_points ?? null;
    const isDone = (m: Record<string, string>) => games.length > 0 && games.every((g) => m[g.id] || started(g));

    const myPicks = byUserWeek.get(`${context.userId}:${week}`) ?? {};
    const iAmDone = isDone(myPicks);

    const users = [...new Set((picks ?? []).filter((p) => p.week === week).map((p) => p.user_id))];
    const family: FamilyRow[] = users.map((u) => {
      const m = byUserWeek.get(`${u}:${week}`) ?? {};
      const visible = iAmDone || u === context.userId ? m : Object.fromEntries(
        Object.entries(m).filter(([gid]) => {
          const g = games.find((x) => x.id === gid);
          return g ? started(g) : false;
        }),
      );
      return {
        userId: u,
        name: nameOf(u),
        picks: visible,
        tiebreaker: iAmDone || u === context.userId || (monday && started(monday)) ? tieOf(u, week) : null,
        correct: games.filter((g) => winnerOf(g) && m[g.id] === winnerOf(g)).length,
        done: isDone(m),
      };
    });
    const mt = mondayTotal(monday);
    family.sort((a, b) =>
      b.correct - a.correct ||
      (mt != null ? Math.abs((a.tiebreaker ?? 9999) - mt) - Math.abs((b.tiebreaker ?? 9999) - mt) : 0) ||
      a.name.localeCompare(b.name),
    );

    // Season totals across every week anyone has picked.
    const weeks = [...new Set((picks ?? []).map((p) => p.week))].filter((w) => w <= state.week);
    const totals = new Map<string, { correct: number; weeksWon: number }>();
    for (const w of weeks) {
      const wg = w === week ? games : await loadGames(state.season, w, state.week);
      const wm = mondayTotal(mondayOf(wg));
      const scores: Array<{ u: string; c: number; diff: number }> = [];
      for (const [k, m] of byUserWeek) {
        const [u, wk] = k.split(":");
        if (Number(wk) !== w || !u) continue;
        const c = wg.filter((g) => winnerOf(g) && m[g.id] === winnerOf(g)).length;
        const t = totals.get(u) ?? { correct: 0, weeksWon: 0 };
        t.correct += c;
        totals.set(u, t);
        scores.push({ u, c, diff: wm != null ? Math.abs((tieOf(u, w) ?? 9999) - wm) : 9999 });
      }
      const weekOver = wg.length > 0 && wg.every((g) => g.status === "final");
      if (weekOver && scores.length) {
        scores.sort((a, b) => b.c - a.c || a.diff - b.diff);
        const top = scores[0]!;
        const t = totals.get(top.u);
        if (t) t.weeksWon += 1;
      }
    }
    const season_totals = [...totals.entries()]
      .map(([userId, t]) => ({ userId, name: nameOf(userId), ...t }))
      .sort((a, b) => b.correct - a.correct || b.weeksWon - a.weeksWon);

    return {
      season: state.season,
      week,
      currentWeek: state.week,
      games,
      mondayGameId: monday?.id ?? null,
      myPicks,
      myTiebreaker: tieOf(context.userId, week),
      iAmDone,
      family,
      season_totals,
    };
  });

export const savePick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ week: z.number().int().min(1).max(18), gameId: z.string().max(40), team: z.string().max(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const state = await seasonState();
    const games = await loadGames(state.season, data.week, state.week);
    const g = games.find((x) => x.id === data.gameId);
    if (!g) throw new Error("That game isn't on this week's slate.");
    if (started(g)) throw new Error("That game has already kicked off.");
    if (data.team !== g.home.abbr && data.team !== g.away.abbr) throw new Error("Pick one of the two teams.");
    const { error } = await supabaseAdmin.from("game_picks").upsert(
      { user_id: context.userId, season: state.season, week: data.week, game_id: data.gameId, team: data.team, updated_at: new Date().toISOString() },
      { onConflict: "user_id,season,week,game_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveTiebreaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ week: z.number().int().min(1).max(18), total: z.number().int().min(0).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const state = await seasonState();
    const games = await loadGames(state.season, data.week, state.week);
    const monday = mondayOf(games);
    if (monday && started(monday)) throw new Error("Monday night has already kicked off.");
    const { error } = await supabaseAdmin.from("pick_tiebreakers").upsert(
      { user_id: context.userId, season: state.season, week: data.week, total_points: data.total, updated_at: new Date().toISOString() },
      { onConflict: "user_id,season,week" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

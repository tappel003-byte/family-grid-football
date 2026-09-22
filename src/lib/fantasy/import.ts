import type { SlimPlayer } from "../sleeper.functions";

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
const POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF", "DST", "D/ST", "PK", "FLEX", "BE", "IR"]);

/** Lowercase, strip accents/punctuation/suffixes so "Ja'Marr Chase Jr." -> "jamarr chase". */
export function normalizeName(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = base.split(" ").filter((w) => !SUFFIXES.has(w));
  return parts.join(" ");
}

const DEF_ALIASES: Record<string, string> = {
  cardinals: "ARI", falcons: "ATL", ravens: "BAL", bills: "BUF", panthers: "CAR",
  bears: "CHI", bengals: "CIN", browns: "CLE", cowboys: "DAL", broncos: "DEN",
  lions: "DET", packers: "GB", texans: "HOU", colts: "IND", jaguars: "JAX",
  chiefs: "KC", raiders: "LV", chargers: "LAC", rams: "LAR", dolphins: "MIA",
  vikings: "MIN", patriots: "NE", saints: "NO", giants: "NYG", jets: "NYJ",
  eagles: "PHI", steelers: "PIT", niners: "SF", seahawks: "SEA",
  buccaneers: "TB", titans: "TEN", commanders: "WAS",
};

export type ParsedLine = {
  raw: string;
  name: string;
  pos: string | null;
  team: string | null;
};

/** Pull a player name (plus any position/team hints) out of one messy roster line. */
export function parseRosterLine(raw: string): ParsedLine | null {
  const cleaned = raw
    .replace(/\(.*?\)/g, " ")
    .replace(/[,|\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  if (/^(bench|starters?|total|points|proj|opp|slot|player|lineup)$/i.test(cleaned)) return null;

  const tokens = cleaned.split(" ");
  let pos: string | null = null;
  let team: string | null = null;
  const nameWords: string[] = [];

  for (const token of tokens) {
    const upper = token.toUpperCase().replace(/[^A-Z/]/g, "");
    if (POSITIONS.has(upper)) {
      if (!pos && upper !== "FLEX" && upper !== "BE" && upper !== "IR") {
        pos = upper === "DST" || upper === "D/ST" ? "DEF" : upper === "PK" ? "K" : upper;
      }
      continue;
    }
    if (/^(Q|OUT|IR|D|SUS|PUP|DNR|NA|BYE)$/.test(upper)) continue;
    if (upper.length >= 2 && upper.length <= 3 && upper === token.replace(/[^A-Za-z]/g, "") && token === token.toUpperCase() && nameWords.length) {
      team = upper;
      continue;
    }
    if (/^\d/.test(token)) continue;
    nameWords.push(token);
  }

  const name = nameWords.join(" ").trim();
  if (!name || name.length < 2) return null;
  return { raw, name, pos, team };
}

export type MatchResult = {
  raw: string;
  status: "matched" | "ambiguous" | "missing";
  playerId: string | null;
  candidates: SlimPlayer[];
};

type Index = {
  byName: Map<string, SlimPlayer[]>;
  players: SlimPlayer[];
};

export function buildPlayerIndex(players: SlimPlayer[]): Index {
  const byName = new Map<string, SlimPlayer[]>();
  for (const p of players) {
    const key = normalizeName(p.name);
    const list = byName.get(key);
    if (list) list.push(p);
    else byName.set(key, [p]);
  }
  return { byName, players };
}

function scoreCandidate(p: SlimPlayer, line: ParsedLine): number {
  let score = 0;
  if (line.pos && p.pos === line.pos) score += 3;
  if (line.team && p.team === line.team) score += 2;
  score -= Math.min(p.rank, 2000) / 10000;
  return score;
}

/** Match one parsed line against the NFL player list. */
export function matchLine(line: ParsedLine, index: Index): MatchResult {
  const key = normalizeName(line.name);

  // Team defenses: "Eagles D/ST", "Philadelphia Eagles"
  if (line.pos === "DEF" || Object.keys(DEF_ALIASES).some((n) => key.endsWith(n))) {
    const nickname = Object.keys(DEF_ALIASES).find((n) => key.includes(n));
    const abbr = nickname ? DEF_ALIASES[nickname] : line.team;
    const def = index.players.find((p) => p.pos === "DEF" && p.team === abbr);
    if (def) return { raw: line.raw, status: "matched", playerId: def.id, candidates: [def] };
  }

  const exact = index.byName.get(key);
  if (exact?.length === 1) {
    return { raw: line.raw, status: "matched", playerId: exact[0]!.id, candidates: exact };
  }
  if (exact && exact.length > 1) {
    const ranked = [...exact].sort((a, b) => scoreCandidate(b, line) - scoreCandidate(a, line));
    const best = ranked[0]!;
    const decisive = (line.pos && best.pos === line.pos) || (line.team && best.team === line.team);
    return {
      raw: line.raw,
      status: decisive ? "matched" : "ambiguous",
      playerId: decisive ? best.id : null,
      candidates: ranked.slice(0, 6),
    };
  }

  // Fuzzy: last name + first initial, then substring
  const parts = key.split(" ");
  const last = parts[parts.length - 1] ?? "";
  const firstInitial = parts[0]?.[0] ?? "";
  const near = index.players.filter((p) => {
    const n = normalizeName(p.name);
    const np = n.split(" ");
    const nLast = np[np.length - 1] ?? "";
    return nLast === last || n.includes(key) || key.includes(n);
  });

  if (!near.length) return { raw: line.raw, status: "missing", playerId: null, candidates: [] };

  const ranked = near
    .map((p) => {
      const n = normalizeName(p.name);
      let s = scoreCandidate(p, line);
      if (n.startsWith(firstInitial)) s += 1;
      if (n === key) s += 5;
      return { p, s };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);

  const only = ranked.length === 1;
  const strong = only || (line.pos ? ranked[0]!.pos === line.pos && ranked[1]?.pos !== line.pos : false);
  return {
    raw: line.raw,
    status: strong ? "matched" : "ambiguous",
    playerId: strong ? ranked[0]!.id : null,
    candidates: ranked.slice(0, 6),
  };
}

export function matchRoster(text: string, index: Index): MatchResult[] {
  return text
    .split(/\r?\n/)
    .map(parseRosterLine)
    .filter((l): l is ParsedLine => !!l)
    .map((l) => matchLine(l, index));
}

/** Split a big paste into teams using "Team name:" header lines. */
export function splitTeamBlocks(text: string): Array<{ team: string; body: string }> {
  const blocks: Array<{ team: string; body: string }> = [];
  let current: { team: string; body: string[] } | null = null;
  for (const line of text.split(/\r?\n/)) {
    const header = line.match(/^\s*(?:team\s*:|#{1,3}\s*)?([^:]{2,40}):\s*$/i);
    if (header) {
      if (current) blocks.push({ team: current.team, body: current.body.join("\n") });
      current = { team: header[1]!.trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) blocks.push({ team: current.team, body: current.body.join("\n") });
  return blocks;
}

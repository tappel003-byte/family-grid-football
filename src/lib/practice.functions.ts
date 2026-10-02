import { createServerFn } from "@tanstack/react-start";
import { loadState } from "./nfl-stats.server";

export type PracticeStatus = "DNP" | "Limited";
export type PracticeReport = { week: number; byGsis: Record<string, PracticeStatus> };

const TTL = 1000 * 60 * 60 * 6;
const EMPTY: PracticeReport = { week: 0, byGsis: {} };
let cache: { at: number; season: string; report: PracticeReport } | null = null;

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function seasonNow(): string {
  const d = new Date();
  // NFL season runs into January/February of the next calendar year.
  return String(d.getUTCMonth() < 2 ? d.getUTCFullYear() - 1 : d.getUTCFullYear());
}

/** Parses the nflverse injuries CSV into the latest week's DNP/Limited statuses. Throws if unreadable. */
export function parsePracticeCsv(text: string): PracticeReport {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = parseLine(lines[0] ?? "");
  const iWeek = head.indexOf("week");
  const iGsis = head.indexOf("gsis_id");
  const iStatus = head.indexOf("practice_status");
  const iType = head.indexOf("season_type");
  if (iWeek < 0 || iGsis < 0 || iStatus < 0) throw new Error("format changed");
  const rows = lines.slice(1).map(parseLine).filter((r) => iType < 0 || r[iType] === "REG");
  const week = rows.reduce((m, r) => Math.max(m, Number(r[iWeek]) || 0), 0);
  const byGsis: Record<string, PracticeStatus> = {};
  for (const r of rows) {
    if (Number(r[iWeek]) !== week || !r[iGsis]) continue;
    const s = (r[iStatus] ?? "").toLowerCase();
    if (s.startsWith("did not")) byGsis[r[iGsis]] = "DNP";
    else if (s.startsWith("limited")) byGsis[r[iGsis]] = "Limited";
  }
  return { week, byGsis };
}

/** Only return statuses when the file's week is the app's current NFL week. */
export function forCurrentWeek(report: PracticeReport, currentWeek: number): PracticeReport {
  return report.week > 0 && report.week === currentWeek ? report : { week: report.week, byGsis: {} };
}

async function loadReport(): Promise<PracticeReport> {
  const season = seasonNow();
  if (cache && cache.season === season && Date.now() - cache.at < TTL) return cache.report;
  try {
    const res = await fetch(
      `https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_${season}.csv`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) throw new Error("bad status");
    const report = parsePracticeCsv(await res.text());
    cache = { at: Date.now(), season, report };
    return report;
  } catch {
    return cache?.report ?? EMPTY;
  }
}

/** Latest-week practice report (DNP / Limited only) from the public nflverse file. Never throws. */
export const getPracticeReport = createServerFn({ method: "GET" }).handler(
  async (): Promise<PracticeReport> => {
    try {
      const [report, state] = await Promise.all([loadReport(), loadState()]);
      return forCurrentWeek(report, state.week);
    } catch {
      return EMPTY;
    }
  },
);

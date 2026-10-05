/** Pure helpers: turn an ESPN return date + schedule into games that may be missed. */

export type OutlookGame = {
  week: number;
  date: string;
  home: string;
  away: string;
};

export type InjuryOutlook = {
  /** Non-bye games before the listed return date. */
  gamesMissed: number;
  /** First week on/after the return date that the team plays, when known. */
  returnWeek: number | null;
  /** Short labels in order, e.g. "@ BUF", "bye", "vs KC". */
  labels: string[];
};

const norm = (team: string) => (team === "WSH" ? "WAS" : team);

function dayKey(value: string): string {
  return value.slice(0, 10);
}

function formatLabel(team: string, game: OutlookGame): string {
  const home = norm(game.home) === team;
  const opp = home ? norm(game.away) : norm(game.home);
  return home ? `vs ${opp}` : `@ ${opp}`;
}

/**
 * Games (and byes) from currentWeek until the ESPN return date.
 * A game on the return date itself is treated as possibly available — not missed.
 */
export function outlookFromReturn(
  teamRaw: string,
  schedule: OutlookGame[],
  currentWeek: number,
  returnDateIso: string,
): InjuryOutlook {
  const team = norm(teamRaw);
  const returnDay = dayKey(returnDateIso);
  if (!team || !/^\d{4}-\d{2}-\d{2}$/.test(returnDay)) {
    return { gamesMissed: 0, returnWeek: null, labels: [] };
  }

  const labels: string[] = [];
  let gamesMissed = 0;
  let returnWeek: number | null = null;

  for (let week = Math.max(1, currentWeek); week <= 18; week++) {
    const game = schedule.find(
      (g) => g.week === week && (norm(g.home) === team || norm(g.away) === team),
    );
    if (!game) {
      // Bye — only keep it if we're still before the return window closes.
      labels.push("bye");
      continue;
    }
    const gameDay = dayKey(game.date);
    if (gameDay < returnDay) {
      labels.push(formatLabel(team, game));
      gamesMissed++;
      continue;
    }
    returnWeek = week;
    break;
  }

  // Drop leading byes before any missed game (noise before the window starts).
  while (labels[0] === "bye") labels.shift();

  return { gamesMissed, returnWeek, labels };
}

/** "Likely misses @ BUF, bye, then vs KC". */
export function formatMissedLine(labels: string[]): string | null {
  if (!labels.length) return null;
  if (labels.length === 1) return `Likely misses ${labels[0]}`;
  if (labels.length === 2) return `Likely misses ${labels[0]}, then ${labels[1]}`;
  const head = labels.slice(0, -1).join(", ");
  const last = labels[labels.length - 1]!;
  return `Likely misses ${head}, then ${last}`;
}

export function formatReturnDate(iso: string): string {
  const day = dayKey(iso);
  const dt = new Date(`${day}T12:00:00Z`);
  if (!Number.isFinite(dt.getTime())) return day;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][n % 10] ?? "th"}`;
}

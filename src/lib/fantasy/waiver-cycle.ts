/** Waivers run every Wednesday at 12:01am Eastern (handles daylight saving). */
const ZONE = "America/New_York";
const DAY = 24 * 60 * 60 * 1000;
const RUN_MINUTE = 1;

/** Minutes Eastern time is offset from UTC at a given moment (e.g. -240 or -300). */
function easternOffsetMinutes(at: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - Math.floor(at / 60000) * 60000) / 60000);
}

/** UTC ms for 12:01am Eastern on the Eastern calendar date containing `at`. */
function easternRunTime(at: number): number {
  const off = easternOffsetMinutes(at);
  const local = new Date(at + off * 60000);
  const guess = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, RUN_MINUTE);
  return guess - easternOffsetMinutes(guess - off * 60000) * 60000;
}

/** Most recent waiver run at or before `now`. */
export function lastWaiverRun(now: number = Date.now()): number {
  let mid = easternRunTime(now);
  for (let i = 0; i < 8; i++) {
    const weekday = new Date(mid + easternOffsetMinutes(mid) * 60000).getUTCDay();
    if (weekday === 3 && mid <= now) return mid;
    mid = easternRunTime(mid - DAY / 2);
  }
  return mid;
}

/** Next waiver run strictly after `now`. */
export function nextWaiverRun(now: number = Date.now()): number {
  const last = lastWaiverRun(now);
  // One week later at 12:01am Eastern, re-anchored across a DST change.
  return easternRunTime(last + 7 * DAY + 3 * 60 * 60 * 1000);
}

export function formatRunTime(ms: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(ms));
}

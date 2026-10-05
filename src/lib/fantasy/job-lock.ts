/**
 * Short-lived league job lock so Wednesday waivers and trade accepts
 * don't overwrite each other. Expires automatically if a worker dies.
 */

const LOCK_MS = 1000 * 90;

export async function withLeagueJob<T>(
  admin: any,
  leagueId: string,
  job: string,
  fn: () => Promise<T>,
): Promise<T> {
  const until = new Date(Date.now() + LOCK_MS).toISOString();
  const nowIso = new Date().toISOString();

  const { data: taken, error: takeError } = await admin
    .from("league")
    .update({ job_lock: job, job_lock_until: until })
    .eq("id", leagueId)
    .or(`job_lock.is.null,job_lock_until.lt."${nowIso}"`)
    .select("id");

  if (takeError) {
    // Migration not applied yet — keep old behavior mid-season.
    if (/job_lock|column|schema cache|does not exist/i.test(takeError.message ?? "")) {
      return fn();
    }
    throw new Error(takeError.message);
  }
  if (!taken?.length) {
    throw new Error("Another roster update is already running — try again in a moment.");
  }

  try {
    return await fn();
  } finally {
    await admin
      .from("league")
      .update({ job_lock: null, job_lock_until: null })
      .eq("id", leagueId)
      .eq("job_lock", job);
  }
}

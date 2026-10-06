/**
 * Instant add/drop can't yank a player whose game is live/final (points vanish).
 * Waiver claims wait until Wednesday, so naming that same player as the drop is fine.
 */
export function dropBlockedForMove(opts: {
  claimMode: boolean;
  dropGameLocked: boolean;
}): boolean {
  return !opts.claimMode && opts.dropGameLocked;
}

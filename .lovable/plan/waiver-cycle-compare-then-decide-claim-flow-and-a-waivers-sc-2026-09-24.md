# Waiver cycle, compare-then-decide claim flow, and a Waivers screen

## The weekly cycle (Eastern time)
```text
Wed 12:00am ET  Waiver run: all pending claims process, worst record picks first
Wed -> kickoff  Free agency: any unowned player whose game hasn't started = instant add/drop
At his kickoff  That player locks to waivers for the rest of the week
Anytime         You can submit a waiver claim; it waits for the next Wed 12:00am run
```
- After the run, every player nobody won becomes an instant pickup, first come first served. Standings don't matter.
- Once a player's game starts (Thu, Sun, or Mon), nobody can instantly add him. A claim is still allowed and waits for next Wednesday.
- Runs automatically even if nobody opens the app. Commissioners keep a "Run waivers now" backup button.
- Your earlier test claim is still pending. It will process in the next run unless you cancel it on the Waivers screen.

## Claim flow (Players page)
1. Tap the player's button. It clearly says **Add** (instant) or **Claim** (waiver) before you tap.
2. **Your full roster opens.** Every player is listed, with the same position at the top. You are never forced to drop a player at the same position, so you can pick up a kicker and drop a receiver. Each row shows season points, last-3 average, and a **Compare** chip.
3. **Compare** opens the detailed side-by-side cards with every stat we track (projection, position rank, season/avg/last 3, rostered and started %, trends, usage, matchup, age, and more). The stronger number in each row is highlighted.
4. From there: **Back to my roster** to choose someone else, or the final button:
   - Free agency: "Drop X & Add Y" (happens right away)
   - Waivers: "Drop X & Claim Y" (saved for Wednesday)
5. If your roster has an open spot, you can add or claim without dropping anyone, and Compare is still available.
Roster size and position caps still apply.

## Waivers screen (More menu)
- **Status banner:** "Next waiver run: Wed 12:00am ET," shown in your own time zone.
- **Your claims:** pending claims with Cancel, plus your recent wins and losses.
- **League claim list:** all pending claims in pick order.
- **Recent results:** what happened in the last run.

## Technical details
- `rules.ts`/`waivers.functions.ts`: replace `nextWaiverRun` with a DST-safe "most recent / next Wednesday 00:00 America/New_York" calculation. A claim is ready if it was created before the latest run boundary. `placeClaim` accepts claims anytime.
- A player is eligible for an instant add when he is unowned, has no pending claim created before the last run boundary, and his game status for the current week is not live or final (reuse `gameInfoFor`). The server re-checks this in the add path (`claim.functions.ts`). If the game has started, it returns "claim instead".
- Automatic run: a weekly pg_cron job at Wed 04:00 and 05:00 UTC (one of these is midnight ET depending on daylight saving; the handler exits unless it is actually past the boundary) calls a new `/api/public/run-waivers` route secured with the existing cron auth helper. Shared processing logic moves into a `.server.ts` helper used by both the cron route and `runWaivers`.
- `AddDropButton.tsx`: two-step dialog (roster list with Compare chips, then compare view). Remove the arrows, the counter, and the same-position restriction.
- New `src/routes/waivers.tsx` plus `NAV_MORE` entry in `AppShell.tsx`; head metadata included.

## Verification
- Unit-check the run boundary across a daylight-saving change.
- Playwright at phone and desktop sizes, signed in as Tim: Add vs Claim label, roster list, Compare, Back, submitting a claim, a kicker pickup dropping a non-kicker, and the Waivers screen sections.

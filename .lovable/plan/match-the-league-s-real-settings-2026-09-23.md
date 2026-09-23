# Match the league's real settings

Bring the settings from your ESPN league into the Commissioner page, turned on the same way.

## What changes

**Lineup lock at kickoff**
Once a player's game has started, he can't be moved into or out of a lineup — his spot is locked for that week. Everyone else stays movable until their own game kicks off. A small lock marker shows on locked players so it's obvious why the buttons are gone. Commissioner can turn this off.

**Waivers turned on**
- Pickups become claims instead of instant grabs (this already exists; it gets switched on).
- Claims process on a set day each week — Wednesday by default — so nobody can grab a dropped player before then. The waiver day is a commissioner setting.
- Waiver order resets every week to the inverse of the standings (worst record picks first), automatically, instead of being rebuilt by hand. Commissioner can still reorder manually.

**Trade rules**
- No trade limit, no trade review — matching your league.
- Trade deadline stays a week setting (currently week 12).

**No keepers** — nothing to add; the app has never had keepers.

## Commissioner page

The House rules section gains:
- Lock lineups at kickoff (on/off)
- Waiver process day (day of week)
- Waiver order: auto-reset weekly to inverse standings (on/off)

Existing controls (roster size, IR spots, position caps, waiver mode, trade deadline) stay where they are.

## Technical notes

- `LeagueRules` gains `lockAtKickoff`, `waiverDay` (0-6), `autoWaiverOrder`; `normalizeRules` defaults them so existing league data keeps working. Stored in the existing `league.rules` JSON — no migration needed.
- Kickoff times come from the ESPN scoreboard feed already wired into `gameInfoFor`. Lineup lock is enforced in `RosterTable` (hide move controls) and again in `saveLeague`, which compares the submitted starters against the current ones and rejects any change involving a player whose game has started.
- `runWaivers` replaces the fixed 24-hour wait with "has the league's waiver day passed since the claim went in"; `waiverOrder` is recomputed from standings at the start of each run when `autoWaiverOrder` is on.

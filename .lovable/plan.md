# Finish player research: depth chart and practice status

Player news (Step 1) is done and in preview. This plan builds the other two items in one pass. Both only add information to what you see. They don't change scoring, lineups, waivers, trades, rosters, saved weeks, or the database.

## 1. Depth chart tag
- Show a small tag like "RB2" or "WR1" next to the player's name:
  - on the player card
  - on bench rows
  - on free-agent rows on the Players screen
- Starter rows on matchups stay as they are, so they don't get cluttered.
- Kickers, defenses, and players with no depth spot get no tag.
- On the player card, add one plain line, for example: "Depth chart: 2nd RB for KC".
- This comes from the same Sleeper player list the app already downloads, so it adds no new outside calls.

## 2. Practice status
- Show "Practice: DNP" (red) or "Practice: Limited" (amber) on the player card and roster rows. It shows even when the player has no injury tag.
- "Full" practice is never shown, since that's normal.
- On the card, add a short line with the days, for example: "Wed DNP · Thu Limited · latest report".
- The source is the free public NFL injury report file (nflverse). The server keeps a copy for 6 hours, so nobody waits on the download.
- If the file is missing, late, or changes format, the tag doesn't show. There's no error message and nothing else changes.

## How I'll check it before handing back
- Type and build checks are clean, and all existing tests pass.
- I'll sign in as you in the preview and check:
  - a starter, a backup, and a defense card show the right depth tag
  - a player listed as DNP or Limited shows the practice tag
  - your matchup total stays exactly the same
- It stays in preview until you say publish.

## Roll back
Restore the version before this edit from history. No data changes, so there's nothing to undo.

## Technical details
- Add `depth` and `depthPos` as optional fields on `SlimPlayer` in `src/lib/sleeper.functions.ts`, filled from `depth_chart_order` and `depth_chart_position`.
- New file `src/lib/practice.functions.ts`:
  - fetches nflverse `injuries_2026.csv` with a 5-second timeout and a 6-hour server cache
  - keeps the last good copy if a later download fails
  - keeps only the current week
  - matches players to Sleeper players by gsis_id, using Sleeper's `gsis_id` field
- UI changes only: `PlayerSheet.tsx`, `PlayerCell.tsx` (bench and free-agent rows), and `players.tsx`.
- Not touched: scoring, stat-line, results, waivers, player-availability, transactions, trades, roster-rules, IR, league/store, migrations.

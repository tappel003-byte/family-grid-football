# Player research add-ons: news, depth chart, practice status

Three display-only additions, built as three separate steps. You approve each one before the next starts. None of them touch scoring, lineups, waivers, trades, rosters, the database, or saved weeks — they only add things to look at.

Checked before writing this:
- Sleeper's player list already includes `depth_chart_order`, `depth_chart_position`, `gsis_id` and `espn_id` (checked on Josh Allen: QB, order 1). The app throws these away today.
- The nflverse 2026 practice file is reachable (about 107 KB, so small). Its practice column says "Did Not Participate In Practice", "Limited Participation in Practice" or "Full Participation in Practice", plus a week number and gsis_id.
- The app already links Sleeper players to ESPN IDs (`loadEspnIdMap`), so news can look up the right ESPN player.

## Step 1 — News for each player on the player card
- When someone opens a player card, ask for that one player's news. Nothing loads for rows that aren't opened.
- Show the 3 newest items: headline, short write-up, date ("Sep 30"), and a "Full story" link that opens ESPN.
- This replaces the current single league-wide headline on the card. If the new lookup comes back empty, the card falls back to that old headline. If neither has anything, the News section is hidden.
- The newspaper icon on rows stays as it is (driven by the league-wide feed), so rows don't make extra calls.

## Step 2 — Depth chart tag
- Add the depth chart spot (e.g. "RB2") to the player data the app already loads.
- Show a small gray tag next to the position on the player card, on bench rows, and on free-agent rows on the Players screen. Starter rows stay exactly as they are.
- No tag for kickers or defenses, or when Sleeper has no depth chart spot for a player.

## Step 3 — Practice status
- Read the nflverse file on the server and keep only rows for the current week.
- Show "Practice: DNP", "Practice: Limited" or "Practice: Full" next to the injury tag on the card and on the same rows, only when the player has an injury tag. The card says "latest report", never live.
- If the file only has an older week, nothing is shown, so a stale Week 3 status never appears in Week 4.

## a. Files

Changed:
- `src/lib/sleeper.functions.ts` — add `depth` and `gsisId` to the player data (step 2; step 3 reuses gsisId). This only reads Sleeper.
- `src/components/fantasy/PlayerSheet.tsx` — News list (1), depth tag (2), practice tag (3).
- `src/components/fantasy/PlayerCell.tsx` — optional depth and practice tags, off by default (2, 3).
- `src/components/fantasy/RosterTable.tsx` — turn the tags on for bench rows only (2, 3).
- `src/routes/players.tsx` — turn the tags on for free-agent rows only (2, 3).
- `src/lib/fantasy/hooks.ts` — read-only query settings for news and practice (1, 3).

Added:
- `src/lib/player-news.functions.ts` — server lookup for one player's news (1).
- `src/lib/practice.functions.ts` and `src/lib/practice.server.ts` — download, read and cache the nflverse file (3).
- One small test file for the practice-file reader and status labels (3).

Confirmed out of scope: `scoring.ts`, `stat-line.ts`, `results.*`, `waivers.*`, `waiver-cycle.ts`, `player-availability.ts`, `transactions.*`, `trades.*`, `roster-rules.ts`, `ir.*`, `league.*`, `store.ts`, all migrations and database tables. `sleeper.functions.ts` is used by many screens, but the change only adds two new fields and leaves existing ones alone. Scoring reads stats from a different source, not this file.

## b. If a source is down or a player isn't found
- News: 3-second timeout. Any error, missing ESPN ID or empty result gives an empty list, and the section falls back or hides. No error message.
- Depth: a missing value means no tag.
- Practice: download errors, a changed file format, an unknown gsis_id, a different week or an unrecognized status all mean no tag. If a later download fails, the last good copy is kept.
- None of these can stop the card, rows, or the Add/Claim button from showing. They load separately from everything else.

## c. Speed
- News: each player's result is saved on the server for 15 minutes, and in the browser for 15 minutes. It only loads when a card is opened, so 10 family members can't come close to ESPN's limits.
- Depth: adds no new calls. It rides on the Sleeper download the app already makes every 6 hours.
- Practice: the server saves the parsed result for 6 hours. Since serverless copies can restart, each one may download the file again, but it's a single 107 KB download per copy, read in one quick pass and kept as a small player-to-status list for the current week only. Browsers ask for it once and reuse it. If a download takes more than 5 seconds, it's dropped.

## d. Testing and rollback
For each step, before you publish:
- Automated checks pass, plus the new practice tests (sample file in, correct label out, missing data gives nothing).
- I sign in as you in the preview and check the result on screen: open a well-known player's card (news shows / depth tag shows / practice shows), check that your starters look unchanged, and check a bench row and a free agent.
- A failure test: I temporarily point the lookup at a bad address in the test only, and confirm the section disappears quietly.
- Your matchup totals are compared before and after to prove scoring didn't move.
- Rollback: each step is its own saved edit. Restore the previous version from history and republish. No data was changed, so there's nothing to undo in the database.

## e. Worries on a live league
- These ESPN and nflverse feeds are free and unofficial, and could change without warning. That's why every one is designed to hide quietly.
- Practice reports come out Wed–Fri, and nflverse refreshes about once a day, so it can lag the real report by up to a day. Thursday-game players may show nothing early in the week.
- Sleeper's depth chart is sometimes stale after a mid-week injury. The tag is a hint, not gospel.
- Small risk: the practice-to-player match relies on gsis_id. Rookies or players who were just signed may have none, and those simply show no tag.
- Timing: I'd build and publish steps outside game windows (not Thursday night or Sunday) so a surprise never lands mid-game.

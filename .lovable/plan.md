# Player research add-ons — build Step 1 only (per-player news)

Display-only. This doesn't touch scoring, waivers, trades, rosters, lineups, the database, or saved weeks. Nothing gets published: the change stays in preview for you to test. Steps 2 and 3 are written down below but won't be built.

## Step 1 — News for each player on the player card (BUILD NOW)
- When someone opens a player card, ask for that one player's news. Nothing loads for rows that aren't opened.
- The browser sends only a Sleeper player ID. The server checks it's a short digit-only string (or a defense code like "KC", which has no ESPN news, so the answer is just empty).
- The server finds the ESPN ID by flipping the existing ESPN-to-Sleeper ID list. It never accepts an ESPN ID, web address, or anything else to fetch from the browser.
- The only address the server calls is `https://site.api.espn.com/apis/fantasy/v2/games/ffl/news/players?limit=3&playerId=<digits>`, and only after checking the ESPN ID is digits only.
- 3-second timeout. Results are saved on the server for 15 minutes per player, and in the browser for 15 minutes.
- Show the 3 newest items: headline, short write-up, date, and a "Full story" link to the ESPN page. Links only appear if they're https espn.com addresses.
- If the lookup comes back empty or fails, the card shows the old league-wide headline. If that's missing too, the News section is hidden. No error message ever shows.
- Row newspaper icons stay as they are, so rows make no new calls.

### Files (Step 1)
- Added: `src/lib/player-news.functions.ts` — server lookup (checks the ID, flips the ESPN ID list, one fixed ESPN address, timeout, cache).
- Changed: `src/components/fantasy/PlayerSheet.tsx` — the News section uses the new lookup, falling back to the old headline.
- Not touched: `scoring.ts`, `stat-line.ts`, `results.*`, `waivers.*`, `waiver-cycle.ts`, `player-availability.ts`, `transactions.*`, `trades.*`, `roster-rules.ts`, `ir.*`, `league.*`, `store.ts`, migrations, any database table. `nfl-stats.server.ts` (`loadEspnIdMap`) is only read, not edited.

### Verify before handing back
- Automated type and build checks are clean, and the existing tests still pass.
- Sign in as you in the preview, open a well-known player's card, and check that 3 news items with dates and links show. Open a defense card and check the section falls back or hides.
- Check that your matchup total is unchanged.
- Report: the files that changed, the commit hash and whether it's on GitHub main (checked through the GitHub site's public data, said plainly if not), and confirmation that nothing was published.

### Rollback
Restore the version before this edit from history. No data changes, so there's nothing to undo in the database.

## Step 2 — Depth chart tag (LATER, not built)
- Add optional `depth`/`depthPos` fields to the player data, so older data without them still works.
- Tag (e.g. "RB2") on the player card, bench rows, and free-agent rows only. Starter rows stay unchanged. Kickers, defenses, and players with no depth spot show no tag.

## Step 3 — Practice status (LATER, not built)
- Use the nflverse `injuries_2026.csv` file, matched to players by gsis_id. The server saves it for 6 hours with a 5-second download timeout, keeps only the current week, and keeps the last good copy if a later download fails.
- Show "Practice: DNP" or "Practice: Limited" whenever it applies, even if Sleeper has no injury tag. Never show "Full". Labeled "latest report", never live.
- Hidden on any failure, format change, missing match, or older week.

# Players screen: show all stats at once, grouped and sortable

## What you asked for
Every stat category visible on every player at the same time, organized into the same three groups as the Sort menu — Production (5), Ownership (3), Hype (3) — and each stat tappable to sort the whole list top-to-bottom. Example use: sort by Total points to find someone on your team with weak points worth dropping.

All eleven numbers already exist in the app (confirmed in the data layer): Projection, Total points, Season avg, Last 3 avg, Overall rank, Rostered %, Started %, Rising %, Trending adds, Trending drops, Best pickup.

## What changes on the Players screen

1. **Grouped stat panel on every player row.** Under each player's name/team/game info, show a compact stat block with three labeled mini-sections:
   - **PRODUCTION:** Proj · Pts · Avg · L3 · Rnk
   - **OWNERSHIP:** Rst% · Str% · Ris%
   - **HYPE:** Adds · Drops · Pickup (the recommendation label, e.g. "Worth adding")
2. **Tap any stat to sort.** Tapping a stat cell sorts the list by that category, top-to-bottom (best first; Best pickup sorts by recommendation strength). The active stat is highlighted so you can see what the list is sorted by. The existing "Sort:" dropdown stays and reflects the same choice.
3. **Phone layout:** the stat block is a wrapped grid of small cells (tiny label above each number) that fits the screen — no sideways scrolling. The old fixed right-side columns go away on phones.
4. **Desktop layout:** same grouped stat panel, roomier; player photos stay as they are.
5. Row keeps the existing extras: team owner line, kickoff day/time/channel, injury/BYE badges, matchup chip, news headline, watchlist bookmark, and Claim/Add button.

## Technical details (for reference)
- File: `src/routes/players.tsx` — replace the fixed-column `ROW_GRID`/`NumCol` header + row layout with a grouped `StatCell` grid; each cell calls `setSort(key)`.
- Values come from the already-loaded queries: insights (`proj`, `seasonPts`, `seasonAvg`, `last3Avg`), market (`own.owned`, `own.started`, `own.change`), trending (`adds`, `drops`), `player.rank`, and the pickup `rec`.
- No new data fetching, no backend changes.

## Verification
- Phone width (440px): all 11 stats visible per player, no sideways scrolling, tapping Pts sorts weakest scorers to the bottom, active stat highlighted.
- Desktop width: same panel renders cleanly with photos.
- Sort dropdown and stat taps stay in sync.

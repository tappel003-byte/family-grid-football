# Fix Pick'em picks snapping back

## What's happening
Picks are actually saving (Week 11 picks from tonight are in the database). But the backend only hands back the first 1,000 saved picks when it builds the Pick'em screen. The season just went over that number (1,020 picks), so the newest picks, this week's, get cut off. The screen briefly shows your pick, then refreshes, doesn't see it, and clears the helmet.

## Fix
- When the Pick'em screen loads, read every saved pick for the season, not just the first 1,000. Do the same for the tiebreaker totals.
- Do the same anywhere else that reads all picks for the season (the rivalry line and Week in Review), so they don't break later in the season too.
- Nobody needs to redo anything. Picks people already made tonight will show up once this is live.

## Technical details
- `src/lib/picks.functions.ts`: in `getPicksBoard`, `getRivalry`, and any other season-wide `game_picks` / `pick_tiebreakers` select, add a paged reader (`.range()` in 1000-row loops ordered by `week, game_id, user_id`). The Supabase default 1000-row cap is truncating results.
- Search the rest of the code (`rg "game_picks"`) for other unbounded season selects and give them the same paging.
- Check: confirm the board returns all 99 Week 11 picks, then tap a helmet in the preview while signed in and make sure it stays after the refresh.

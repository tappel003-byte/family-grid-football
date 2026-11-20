# Keep the 1,000 limit from hitting anywhere else

## Answer
Pick'em won't have this problem again. It now loads every pick no matter how many pile up. I checked the rest of the app for the same weak spot, and only one other place could run into it:

- **Weekly scores (standings and records):** these load every week's score the league has ever saved. That's about 180 a season, now at 100. It won't hit 1,000 for about five years, but when it did, standings and records would quietly come out wrong.

Nothing else is at risk. Chat only shows the latest 200 messages on purpose, and activity, waiver claims, and trades are all small and load differently.

## Fix
- Make weekly scores load in batches the same way Pick'em does now, so it never runs into the limit.

## Technical details
- `src/lib/fantasy/store.ts` line ~31: wrap the `weekly_results` select in a paged `.range()` loop (order by `week, team_slot`), the same approach as `readAll` in `picks.functions.ts`.

# Players screen: ESPN-style locked name column

Rebuild the Players list as a table where the player stays pinned on the left and all the stat columns scroll sideways, like the ESPN screenshot.

## What you'll see

- The player's name, position, team, and status badge sit in a locked left column. They stay put while you swipe.
- To the right, one continuous row of stat columns you can swipe through: Proj, Pts, Avg, L3, Rnk, Rst%, Str%, Ris%, Adds, Drops, Pickup.
- A heading row above the stats, also swiping in sync. Tap any heading to sort the whole list by it; tap again to flip high-to-low / low-to-high. The active heading is highlighted.
- The "Sort:" dropdown goes away — the headings are the sort control now. The Production / Ownership / Hype grouping goes away too, since every stat is visible.
- Free agent / owner line, watchlist bookmark, and the Add/Drop button stay with the player in the locked column so they're always reachable.
- News headline, pickup reason, and insight chips move into a tap-to-expand detail under the row, so the table stays tight.
- On wide screens the whole table fits without scrolling; the same layout is used, just roomier.

## Technical notes

- Single file change: `src/routes/players.tsx`.
- Structure: a horizontally scrolling container with a two-part row — left cell `sticky left-0 z-10` with a card background and a right border/shadow, right cells fixed-width (`w-16` / `w-20` for Pickup), `tabular-nums`, header row shares the same widths.
- Row heights kept uniform so the pinned column lines up with the scrolling stats.
- Sort state becomes `{ key, dir }`; existing sort comparators reused, with a direction flip.
- `StatCell`, `SORT_GROUPS`, the sort dropdown, and the scroll-close effect are removed; `SORTS`/`SORT_LABEL` and the existing `rankById` and data hooks stay as they are.
- Filters above the table (search, position pills, All/FA/Rostered, Watchlist) are untouched.
- Data sources unchanged — same Sleeper-backed values with league scoring.

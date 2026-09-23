# Players screen: ESPN-style locked name column, grouped stats

Rebuild the Players list as a table where the player stays pinned on the left and the stat columns for the chosen group scroll sideways, like the ESPN screenshots.

## What you'll see

- The player's name, position, team, and status badge sit in a locked left column. They stay put while you swipe sideways.
- To the right, only the columns of the group you picked:
  - Production: Proj, Pts, Avg, L3, Rnk
  - Ownership: Rst%, Str%, Ris%
  - Hype: Adds, Drops, Pickup
- A heading row above the stats scrolls in sync with them. Tap a heading to sort by it; tap the same heading again to flip between highest-first and lowest-first. A small arrow shows which way it's going.
- The dropdown stays, but it now just picks the group (Production / Ownership / Hype) — like ESPN's "Views" list. Picking a group sorts by its first column.
- Free agent / owner line, watchlist bookmark, and the Add/Drop button stay in the locked column so they're always reachable.
- News headline, pickup reason, and insight chips move into a tap-to-expand detail under the row so the table stays tight.
- On wide screens the same layout is used, just roomier — usually no sideways scrolling needed.

## Technical notes

- Single file change: `src/routes/players.tsx`.
- Structure: horizontally scrolling container; left cell `sticky left-0 z-10` with card background and right border/shadow; stat cells fixed width (`w-16`, `w-20` for Pickup), `tabular-nums`; header row shares the same widths and the same scroll container.
- `SORT_GROUPS` stays and becomes the column source: `group` state plus `sort` state `{ key, dir }`; existing comparators reused with a direction flip.
- The per-row `StatCell` grid and the old "Sort:" item list are removed; dropdown lists the three groups only. `SORTS`/`SORT_LABEL`, `rankById`, filters, and all data hooks stay unchanged.
- Row heights kept uniform so the pinned column lines up with the scrolling stats.

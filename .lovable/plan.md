# Tidy Player Research — ESPN-inspired

## Problem
The controls above the player list look thrown together: a search box, two loose chip rows, then a boxed "Sort by" card with 10 pills in no particular order. ESPN's Players screen (your screenshots) shows a tighter way.

## Suggestions (all in src/routes/players.tsx)

**1. One slim control bar instead of stacked rows**
- Search box and position chips share one compact band — smaller search, chips right beside it, wrapping if needed.
- Availability (All players / Free agents / On a team) becomes a small 3-way segmented control on the same band.
- Everything above the list shrinks to roughly half its current height.

**2. Sorts behind a single dropdown (ESPN's "Research ▾" move)**
- Replace the 10-chip card with one button that shows the current sort, e.g. "Sort: Projection ▾".
- Tapping it opens a menu with the 10 sorts grouped under small labels:
  - Production — Projection, Season avg, Last 3 avg, Overall rank
  - Ownership — Rostered %, Started %, Rising %
  - Hype — Trending adds, Trending drops, Best pickup
- Nothing is removed; the screen just stops shouting all 10 at once.

**3. ESPN-style list columns instead of stat tiles**
- Add a thin column header row: Player · Opp RK · %Rost · %Start · Proj.
- Numbers become right-aligned columns down the page (like ESPN's Available list) instead of a grid of tiles under each player — rows get shorter and easier to scan.
- Free-agent/owner line, injury/bye badges, and the Claim button stay.

## Kept the same
- All 10 sorts, all filters, big tap targets for the family, no sideways scrolling, Claim/Add buttons, news and recommendation lines.

## Verification
- Typecheck, then Playwright at 390px and 1280px: control bar fits, dropdown opens with three groups, columns align, sorting still works.

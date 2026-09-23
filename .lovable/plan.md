# Tidy the Player Research controls

## Problem
On the Players screen the controls above the list look thrown together: search box, two loose rows of chips, and a boxed "Sort by" card with 10 pills in a random order. The sort card especially reads as sloppy.

## Change (src/routes/players.tsx only)
1. **Group the sort chips into three labeled sections** inside the Sort by card, each with a small uppercase label:
   - **Production** — Projection, Season avg, Last 3 avg, Overall rank
   - **Ownership** — Rostered %, Started %, Rising %
   - **Hype** — Trending adds, Trending drops, Best pickup
   (All 10 sorts stay; nothing removed, just regrouped in a logical order.)
2. **Unify the control block visually** so it reads as one tidy panel instead of loose rows:
   - Put the search box, position chips, and availability chips inside the same bordered card as the sorts, separated by thin dividers, with tiny labels (Search / Position / Availability / Sort by).
   - Consistent chip sizing and rounding throughout (same height, same pill shape for filters; sorts keep their current pill look).
3. **Keep behavior identical**: active chips still highlight navy, all taps big enough for the family, no horizontal scrolling on phones, desktop layout unchanged apart from the new grouping.

## Verification
- Typecheck, then Playwright at 390px and 1280px: all groups visible, active sort highlighted, list still renders and sorts.

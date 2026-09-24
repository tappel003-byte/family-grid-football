# Make player rank match the selected position

Change the Players screen so the rank number answers the question being viewed.

## What will change

- When “All” positions is selected, keep ranking every player together by total La Familia fantasy points.
- When QB, RB, WR, TE, K, or DEF is selected, rank players only against others at that same position, beginning at #1.
- Keep rank based on season point totals, with projected points and player name used only to break ties consistently.
- Make the rank help text clearly say it is an overall rank in “All” and a position rank when a position is selected.
- Preserve the current sorting, availability filters, watchlist, stat groups, and table layout.
- Verify that the kicker view starts with kicker ranks rather than overall-player numbers, and that switching back to “All” restores overall ranks.

## Technical details

- Build both overall and per-position rank maps from the same La Familia scoring totals already used on the Players screen.
- Select the correct rank map from the active position filter before rendering and sorting the rows.
- Keep ranks independent of search and free-agent filters, so filtering does not renumber players inaccurately.

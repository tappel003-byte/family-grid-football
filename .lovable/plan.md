# Correct matchup player text alignment

Make each phone matchup row mirror cleanly around the center position column.

## What will change

- Keep the left player’s name, team/position, game details, score, and projection explicitly left-aligned.
- Keep the left player’s detail text immediately beside the player photo rather than allowing inherited alignment to push it inward.
- Keep the right player’s information right-aligned with the photo on the far right.
- Preserve the current row height, full-name line, center position column, projections, badges, and desktop layout.
- Check the result at the current phone width to confirm both sides are true mirror images without clipping.

## Technical details

- Tighten the mobile matchup alignment classes in `PlayerCell` and, if needed, the surrounding mobile score block in `MatchupBoard`.
- Apply explicit left/right text and flex alignment instead of relying on inherited alignment.

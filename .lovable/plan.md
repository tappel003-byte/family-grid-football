# Mirror matchup player alignment

Update matchup rows so the two teams read as opposing sides across phone, tablet, and desktop layouts.

## What will change

- Keep the left team’s player photo, name, team/position, game details, score, and projection left-aligned.
- Right-align the same information for the right team, with its player photo positioned on the far right.
- Keep the position column centered between both players.
- Apply the mirrored alignment to every matchup row and preserve the current row height, projections, game information, injury badges, and links.
- Check narrow phone and tablet widths to ensure long player names and game details wrap cleanly without colliding with the center position column.

## Technical details

- Add a left/right alignment option to the compact matchup player layout in `MatchupBoard`.
- Pass the appropriate alignment through to `PlayerCell` so its existing mirrored layout is used on the right side.
- Mirror the score and projection block beneath the right-side player information.
- Verify the matchup screen at phone, tablet, and desktop sizes.

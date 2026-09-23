# Simplify mobile matchup rows

## Goal
Make each mobile starter matchup read straight across: your player on the left, the opponent on the right, with each player's score and projection directly underneath that player.

## Changes
- Keep both players in the same row on phones instead of stacking them vertically.
- Use a consistent left-to-right order for both sides; stop reversing the opponent's player details.
- Put each player's actual points first beneath their name, followed by projection and kickoff time.
- Keep the position label centered between the two players so every row is easy to scan.
- Keep the red inactive warning, but ensure an OUT player's highlight stays within that player's half of the row rather than reading like a separate matchup row.
- Preserve the existing desktop layout.

## Verification
- Check the matchup on a phone-sized screen using the Josh Allen versus Jayden Daniels row.
- Confirm names, points, projections, kickoff times, injury status, and position labels remain readable without horizontal scrolling.
- Recheck desktop to confirm its current layout is unchanged.

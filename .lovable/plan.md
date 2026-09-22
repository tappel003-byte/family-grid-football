# Team helmet logos as icons

Yes — this is easy. Your sheet has all ten helmet logos in a 5 x 2 grid, so each one gets cut out and becomes that team's icon everywhere in the app, replacing the colored square with initials.

## What you'll see

- Each team shows its own helmet logo: on the matchup screen, My Team, Standings, Teams, Playoffs, Trades, and on the "claim your team" sign-in screen where everyone picks their helmet.
- The colored square with letters goes away.
- Any team without a logo keeps the colored square, so nothing breaks.

## The ten logos and who they belong to

| Logo on your sheet | Team in the app |
| --- | --- |
| Scottsdale Banthas | Scottsdale Banthas |
| Scottsdale Marauders | Scottsdale Maraders |
| Bizzer Bees | The Bizzer Beez |
| Milk Man | Milkman |
| Home-Run Touchdown | Homerun-Touchdown |
| What's Happening Again | Whats Happening Again |
| Cowboy Dudes | THE Cowboy Dudes |
| Pooper Bellies | Placitas Pooper Bellies |
| Max Pack | MaxPack |
| Mad Appel | Madappel |

If any of those pairings is wrong, say so and I'll switch it.

## How it gets built

1. Slice the uploaded sheet into ten tiles with an image script, trim the empty space around each helmet, and drop the grey checkerboard out so each one is a clean transparent PNG (the upload has the checkerboard baked in as real pixels, so it has to be removed, not just cropped).
2. Upload the ten PNGs as CDN assets and keep small pointer files in `src/assets/team-logos/`.
3. Add a lookup that maps a team slot to its logo.
4. Update `TeamCrest` in `src/components/fantasy/MatchupBoard.tsx` to render the logo image when one exists, falling back to the current initials tile. Use the same component on the claim-your-team cards in `AuthGate.tsx` so the helmets show at sign-in.
5. Check each cutout at full size before wiring it in, then publish.

## Note

The logos come straight out of your file, so the art stays exactly as you drew it — nothing is redrawn.

# Put help where it belongs

## What will change

- Add a small `?` beside the Production / Ownership / Hype selector on Players.
- Its explanation will change with the selected category, so it only defines what is currently visible:
  - **Production:** Proj, Pts, Avg, L3, Rnk
  - **Ownership:** Rst%, Str%, Ris%
  - **Hype:** Adds, Drops, Pickup
- Keep each definition short and plain-English, including that L3 means the player's average over their last three games.
- Remove the general `?` from the top navigation.
- Put that existing player-badge guide in the My Team heading, where lineup, injury, bye, matchup, snap, and target information is actually being used.

## Result

The top navigation becomes cleaner, Players explains only the stats currently on screen, and My Team keeps the broader player-information guide close to the roster.

## Technical details

- Reuse the existing popover and icon-button patterns.
- Make the Players guide data-driven from the selected stat group so its contents always match the visible columns.
- Move the existing badge legend trigger from the shared app header into the My Team title row without changing its explanations.
- Verify both placements on phone and desktop, including that neither help menu clips off-screen.

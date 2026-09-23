# Lock each lineup to its owner

## What will change
- Only the signed-in owner can see or use lineup controls on a team page.
- Commissioner status will not grant access to another family's lineup.
- The backend will accept lineup changes only for the caller's linked team.
- A lineup save may only rearrange that team's existing starters and bench; it cannot silently add, remove, or move another team's players.
- Add/drop and injured-reserve actions will also target only the caller's own team.

## Verification
- Confirm Tim can edit The Bizzer Beez.
- Confirm Tim sees another roster as view-only.
- Attempt a direct change to another team and confirm it is rejected or ignored.

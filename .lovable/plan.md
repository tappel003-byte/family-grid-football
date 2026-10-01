# Shade the bench players light gray

Use the same light gray already on the "Bench" header bar so the header and every bench player row read as one shaded block. Starters stay white.

## What changes
- Every bench player row gets the same light gray as the Bench header.
- The empty-bench message row gets it too.
- Applies everywhere rosters show: My Team and other teams' pages.

## Technical details
- `RosterTable.tsx`: add `bg-secondary/40` (matching the header at line 427) to bench `<tr>` rows and the "Bench is empty" row. No logic changes.
- Verify on My Team via Playwright screenshot, light theme, mobile width.

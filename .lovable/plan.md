# Commissioner editing only from the Commissioner screen

## The problem
Right now, any commissioner who opens another family's team from the Teams page can edit it. That happens because the team page turns on "Commissioner mode" whenever a commissioner views a team that isn't theirs, no matter how they got there.

## What will change
- Opening a team from **Teams** (or anywhere else) shows it view-only for everyone, commissioners included, unless it's your own team.
- Opening a team from **Commissioner > Fix a team** is the only way to get the Commissioner mode banner and the edit controls.
- "Close commissioner mode" still takes you back to the Commissioner screen, and the team goes back to view-only.
- Your own team stays editable from anywhere, same as now.

## Technical details
- The "Open team" links in the Fix a team section in `settings.tsx` add a `?commish=1` search param.
- `team.$teamId.tsx` gets `validateSearch` for an optional `commish` flag. Set `commishMode = isCommissioner && !isOwner && search.commish === true`.
- The server still checks the commissioner role, so a non-commissioner who adds the flag to the address gets nothing.

## Verification
- Tim opens Milk Man from Teams: it shows view-only.
- Tim opens Milk Man from Commissioner > Fix a team: the banner shows and he can edit.
- Tim's own Bizzer Beez stays editable from Teams.

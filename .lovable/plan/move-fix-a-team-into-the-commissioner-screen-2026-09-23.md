# Move "Fix a team" into the Commissioner screen

Only commissioners can open the Commissioner screen, so the team-fixing list belongs there instead of in the profile menu.

## Changes

1. **`src/components/fantasy/AppShell.tsx`** — remove the `FixTeamMenu` component and its use in `ProfileNav`, plus the now-unused `Wrench` icon import. The profile menu goes back to: My Account, Commissioner (commissioners only), Sign out.

2. **`src/routes/settings.tsx`** — add a new collapsible section, **"Fix a team"**, after the existing sections. It lists all ten teams (crest, team name, owner) and each row links to that team's page (`/team/$teamId`), where commissioner editing already works. Same collapsed-by-default style as the other sections.

## Verification

- Typecheck passes.
- Playwright check at phone width: signed in as Tim, confirm "Fix a team" no longer appears in the profile menu, and appears inside the Commissioner screen with all ten teams; tapping one opens that team's page in commissioner mode.

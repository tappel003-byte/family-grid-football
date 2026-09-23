# Jump from the inactive warning to your roster

## What you'll see
- On the Matchups page, each name in the red "Inactive players in starting slots" bar becomes a tappable link straight to that team's roster page.
- Example: tapping "Jayden Daniels (The Bizzer Beez)" opens your Bizzer Beez lineup so you can swap him out immediately.
- Same behavior for any family member — the link always goes to the team that owns that hurt player.
- The name keeps its red warning look, just underlined/subtle tap styling so it reads as a link.
- Desktop and phone both get this; nothing else on the matchup screen changes.

## Technical details
- In `src/components/fantasy/MatchupBoard.tsx`, build the inactive list with team id + player name, and render each name as a TanStack `Link` to `/team/$teamId` inside the existing warning bar.
- No backend, schema, or permission changes.

## Verification
- View a matchup containing an OUT starter, tap the player name in the warning bar, confirm it lands on that team's roster page, and confirm owners can edit while others see it view-only.

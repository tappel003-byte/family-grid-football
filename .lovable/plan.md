# Simplify navigation and group personal controls

## What will change
- Remove **Playoffs** from the More menu and place a **Current playoff picture** section beneath the division standings.
- Keep the existing `/playoffs` page working for old links, but make Standings the normal place to view playoff seeding and the bracket.
- Replace the wide “Tim Appel · Commissioner” header button and separate sign-out button with one compact person icon and first name.
- Opening that profile control will show the signed-in person, their team name, **My Account**, **Commissioner** for Tim and Scott only, and **Sign out**.
- Remove **Commissioner** from the More menu. Teams, Trades, and History remain there.
- Remove the standalone “Commissioner” subtitle under **My Account**; commissioner access will live in the personal menu beside the user’s team details.

## Phone layout
- Keep the main destinations easy to reach while allowing the header to wrap cleanly without clipped names or a separate sign-out control.
- Use a familiar person silhouette and short first name, with a compact menu sized for touch.

## Technical details
- Extract the existing playoff bracket/picture into a reusable section shared by Standings and the legacy Playoffs page.
- Derive the first name from the signed-in display name and gate the Commissioner link with the existing role check.
- Verify the header and menus on both phone and desktop widths, plus the Standings playoff picture.

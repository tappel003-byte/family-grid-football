# Commissioner roster help + cleaner Activity page

## What will change
- **Commissioners can fix any team.** You and Scott will see the lineup controls on every team page, not just your own. A small banner will say "Commissioner mode: you are editing Scott's team" so it's clear you're changing someone else's roster.
- **Commissioner help covers the full roster.** You can set the lineup, swap, bench, add or drop, and move players on or off IR for any team.
- **Every commissioner change is logged.** Activity will show entries like "Tim Appel (commissioner) changed Madappel's starting lineup" or "Scott Appel (commissioner) dropped X from The Bizzer Beez."
- **Everyday lineup moves leave Activity.** When owners change their own lineup, it won't be posted anymore. Activity keeps the bigger moves: adds, drops, waivers, IR, trades, the trade block, and all commissioner changes.
- **Filter menu on Activity.** A dropdown at the top will offer: All, Adds and drops, Trades, IR, and Commissioner changes.

## What stays the same
- Family members can still change only their own team.
- Kickoff locks still apply to everyone, including commissioners.

## Verification
- As Tim, edit another team's lineup and confirm the change saves and shows up in Activity as a commissioner change.
- Change The Bizzer Beez's own lineup and confirm it does not show up in Activity.
- Confirm each filter shows only its type of move.

## Technical details
- `team.$teamId.tsx`: `canEdit = owner || isCommissioner`; show the banner when a commissioner is editing another owner's team.
- `saveLeague`: for commissioners, use the target team's slot and apply the same checks (players can only be rearranged, kickoff locks still apply). Write a `commish_lineup` transaction only when the target team isn't the commissioner's own.
- Add/drop (`transactions.functions.ts`) and IR (`ir.functions.ts`): accept a target slot for commissioners and log it with `kind` prefixed `commish_`.
- Stop inserting `lineup` transactions for owners' own moves, and hide old `lineup` rows in the feed.
- `ActivityFeed`: add a filter dropdown that groups entries by `kind`, plus wording for `commish_*` entries. No database changes needed.

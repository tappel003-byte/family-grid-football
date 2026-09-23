# Finish La Familia’s league features

## Goal
Add the five family-league features Tim selected while keeping the phone experience simple and the existing navigation uncluttered.

## Build

1. **Weekly matchup recap**
   - Add a compact recap below each completed matchup.
   - Call out the winner, closest game or biggest win, highest scorer, best bench score, and an unlucky loss when the numbers support it.
   - Generate recaps from saved weekly results so every family member sees the same summary.

2. **Player watchlist**
   - Add a bookmark control on Player Research.
   - Add a Watchlist choice beside All players, Free agents, and On a team.
   - Keep each person’s watchlist private to their account.

3. **Trade block**
   - Let each owner mark players as available from My Team.
   - Show all available players together at the top of Trades.
   - Link each player directly into the existing trade offer flow.

4. **Trophy case**
   - Add championship, runner-up, and placement honors to each owner’s team/profile view using the existing season history.
   - Keep the treatment compact and text-led; do not use a trophy icon.

5. **League activity**
   - Expand the existing activity feed rather than creating another page.
   - Continue showing adds, drops, waiver wins, and accepted trades.
   - Add lineup changes and trade-block updates with the person and team responsible.
   - Place the full feed under More, while Player Research keeps only a short recent-activity preview.

## Phone experience
- No sideways scrolling.
- Large tap targets and short labels.
- New controls appear only where they are useful; the two-row navigation remains unchanged.

## Technical details
- Add account-scoped watchlist records and team/player trade-block records in Lovable Cloud with access rules.
- Add activity types without changing existing transaction history.
- Reuse saved weekly results and season history for recaps and profile honors.
- Add route metadata for any new page.
- Verify the five flows signed in as Tim on a 440px-wide screen and on desktop.

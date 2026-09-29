# Pre-launch audit and fix pass

Goal: before tomorrow night's roster switchover, check every path the family will actually use and fix anything broken the right way, not with a quick patch.

## 1. Clean up leftover test data
- Check for the test claim on Kyler Murray made while I was testing. If it's still pending, cancel it so it can't run in Wednesday's 12:01 AM waiver run.
- Check for any other test claims or transactions and remove them.

## 2. Test every path at the right moment
Each flow gets tested at the time of week when it matters, including right after the Tuesday week change:
- **Pickups:** Claim vs Add for players who play Thursday, Sunday, and Monday, and players on bye, checked on Tuesday, Wednesday after 12:01 AM, Thursday before and after kickoff, and Sunday.
- **Waiver run:** Wednesday processing order (lowest-ranked team first), drops, roster limits, and what happens when a claim fails.
- **Lineup locks:** a player can't be moved once his game has started, and bench/IR moves follow the same rule.
- **Scoring and matchups:** live points match the league's scoring settings, and your own matchup opens first.
- **Standings and the Tuesday week change:** finished weeks are saved once, records add up, and the week never moves backward.
- **Trades, drops, IR:** each finishes and shows up correctly in Activity.
- **Roster import:** a dry run of tomorrow's switchover on a copy (never the live league) to confirm ten rosters load and the Weeks 1–3 records match ESPN.

## 3. Fix what the tests find
- Fix the underlying cause of every failure and add a test so it can't come back.
- Recheck the full list after the fixes.

## 4. Report and publish
- Short plain-English list: what works, what I fixed, anything still open.
- Publish once everything passes.

## Technical details
- Automated tests fake the clock at each weekly boundary (Eastern time, including daylight-saving changes).
- Signed-in browser checks run as Tim against the preview.
- The import dry run uses a throwaway league row, which gets deleted afterward.

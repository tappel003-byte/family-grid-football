# Correct the waiver boundary

## Exact weekly behavior

```text
Before Wed 12:01am ET   Pending waiver claims wait
Wed 12:01am ET          Pending claims process, lowest-ranked team first
After processing        Free agency opens immediately
Wed through kickoff     Any unowned player is an instant Add/Drop
At that player's kickoff
                        Instant Add closes; Claim remains available
Next Wed 12:01am ET     Those locked-player claims process, then free agency reopens
```

- A claim may be submitted at any time for a player who has started or finished that week.
- On Wednesday after 12:01 AM, an unowned player whose game has not started must show **Add**, not **Claim**, and the roster move happens immediately.
- Standings priority applies only during the Wednesday waiver run. It does not apply to Wednesday-through-kickoff free-agent pickups.
- A player who has started or finished cannot be added immediately; their claim waits for the following Wednesday run.

## Fix the current mistake

- Remove the incorrect rule that claims entered on Wednesday wait merely because they were entered after Wednesday’s run.
- Make the server enforce the same Add-versus-Claim decision as the screen, using the player’s kickoff status so refreshes and stale screens cannot create the wrong action.
- Run a one-time catch-up for the currently pending claims that should have been handled this Wednesday, in inverse-standings order, while preserving roster limits and ownership checks.
- Update the Waivers screen wording so it plainly says free agency is open after Wednesday 12:01 AM and identifies only game-locked players as waiver claims.

## Keep the comparison flow

- Tapping Add or Claim opens the full roster.
- Any roster player can be selected; positions do not have to match unless a roster-position limit requires it.
- **Compare** opens the detailed side-by-side statistics.
- **Back to my roster** returns without committing.
- The final action says either **Drop X & Add Y now** or **Drop X & Submit claim for Y**, based on kickoff status.

## Verification

- On Wednesday after 12:01 AM Eastern, confirm an unstarted free agent is added immediately.
- Confirm a started or finished player creates a pending claim for next Wednesday.
- Confirm Tuesday claims process at Wednesday 12:01 AM in inverse-standings order.
- Confirm the same behavior on phone and desktop, signed in as Tim.

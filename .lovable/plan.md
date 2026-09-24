# Claim flow, waiver window, and a Waivers screen

## What you asked for
1. Tap Claim on a player → your full roster opens with a "Compare" chip next to each player → tap Compare for the side-by-side card view → go back, pick a different player, or submit the claim.
2. Waiver timing: a waiver claim can be submitted at any time. The weekly batch processes automatically Wednesday at 5:00am Eastern, after the prior week's games are over. After processing, unclaimed players can be added instantly until their own game kicks off. A claim submitted after the weekly batch waits for the following Wednesday rather than being granted immediately.
3. A Waivers screen in the More dropdown — that's where the waiver list lives.

## 1. Compare-chip claim flow (Players page)
Rework the drop dialog in `src/components/fantasy/AddDropButton.tsx` into two steps:
- **Step 1 — pick:** Your roster listed top to bottom (same position first), each row showing season points, last-3 average, and a "Compare" chip. Tapping the chip opens step 2 for that player. The old arrows/counter go away.
- **Step 2 — compare:** The existing side-by-side cards (claim player vs drop candidate, all tracked stats, stronger value highlighted), plus a "Back to my roster" button and the final action button naming both players ("Drop [X] & Claim [Y]").
Free agency when the roster isn't full, roster rules, kickoff locks, and error messages stay as they are.

## 2. Weekly waiver cycle and processing
In `src/lib/fantasy/waivers.functions.ts` and `src/lib/fantasy/rules.ts`:
- **Always accept claims:** A family member can submit or cancel a waiver claim at any time. Claims submitted after this week's run remain pending for the following Wednesday.
- **Processing:** Ready claims process Wednesday at 5:00am Eastern, worst record picking first — the existing claim-order logic is reused. The automatic run must not depend on a family member opening the app, so use one weekly scheduled database call for this genuinely time-based event. Commissioners keep a "Run waivers now" recovery button.
- **First-come-first-served:** After Wednesday's batch, any player who cleared waivers with no successful claim is an instant add until his own game kicks off. The Claim/Add button must clearly show which action will happen before it is tapped.
- **Sunday and game locks:** Once a player's game starts, he cannot be instantly added that week. A claim may still be entered, but it waits for the next Wednesday run after the week's games are complete.

## 3. Waivers screen (`/waivers`, added to the More dropdown)
- **Status banner:** Where we are in the cycle — "Claims process Wednesday at 5am Eastern", "Free agents available until kickoff", or "Claim saved for next Wednesday" — shown in the family's local time.
- **Your claims:** Pending claims with a "Cancel" button, plus your recent results (won/lost).
- **League claim list:** Every pending claim in pick order, so everyone sees who's ahead of them.
- **Recent results:** Last processed claims with what happened.

## Technical notes
- New file `src/routes/waivers.tsx`; one nav entry added to `NAV_MORE` in `src/components/fantasy/AppShell.tsx`.
- `placeClaim` continues accepting claims anytime; `runWaivers` gains an exact Wednesday 5:00am Eastern readiness rule; `nextWaiverRun` is corrected to calculate the next weekly run across daylight-saving changes.
- FCFS adds route through the existing roster-move path with a new per-player game-started check.
- One weekly scheduled database call triggers processing reliably even when nobody opens the app; no recurring polling.

## Verification
- Playwright at phone and desktop widths: Claim → roster list → Compare → side-by-side → submit; Waivers screen renders all three sections; instant Add changes to Claim at kickoff; a post-run claim remains queued for next Wednesday.
- Typecheck plus the preview console clean.

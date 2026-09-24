# Claim flow, waiver window, and a Waivers screen

## What you asked for
1. Tap Claim on a player → your full roster opens with a "Compare" chip next to each player → tap Compare for the side-by-side card view → go back, pick a different player, or submit the claim.
2. Waiver timing: claims open Wednesday 5:00am Eastern and process automatically Wednesday night. After that, unclaimed free agents are first-come-first-served until their game kicks off. Nobody can add a player whose game has already started.
3. A Waivers screen in the More dropdown — that's where the waiver list lives.

## 1. Compare-chip claim flow (Players page)
Rework the drop dialog in `src/components/fantasy/AddDropButton.tsx` into two steps:
- **Step 1 — pick:** Your roster listed top to bottom (same position first), each row showing season points, last-3 average, and a "Compare" chip. Tapping the chip opens step 2 for that player. The old arrows/counter go away.
- **Step 2 — compare:** The existing side-by-side cards (claim player vs drop candidate, all tracked stats, stronger value highlighted), plus a "Back to my roster" button and the final action button naming both players ("Drop [X] & Claim [Y]").
Free agency when the roster isn't full, roster rules, kickoff locks, and error messages stay as they are.

## 2. Waiver window and processing
In `src/lib/fantasy/waivers.functions.ts` and `src/lib/fantasy/rules.ts`:
- **Window:** Claims are accepted from Wednesday 5:00am Eastern. Before that, the app says "Waivers open Wednesday morning."
- **Processing:** All claims placed during the window process Wednesday night (about 10pm Eastern) automatically, worst record picking first — the existing claim-order logic is reused. Processing runs whenever anyone opens the app after that time, and commissioners keep a "Run waivers now" button, so no new scheduled jobs are needed.
- **First-come-first-served:** After Wednesday-night processing, a free agent can be added instantly until his game kicks off. Claims placed in the window for a player who plays Thursday still wait for Wednesday-night processing — standard weekly-waiver behavior.
- **Player lock:** Once a player's game starts, he can't be added or claimed by anyone for the rest of the week (currently only the "locked" waiver mode does this; it now applies in waiver mode too).

## 3. Waivers screen (`/waivers`, added to the More dropdown)
- **Status banner:** Where we are in the week — "Claims open now, process Wednesday night", "First come, first served until kickoff", or "Waivers open Wednesday 5am Eastern" — shown in the family's local time.
- **Your claims:** Pending claims with a "Cancel" button, plus your recent results (won/lost).
- **League claim list:** Every pending claim in pick order, so everyone sees who's ahead of them.
- **Recent results:** Last processed claims with what happened.

## Technical notes
- New file `src/routes/waivers.tsx`; one nav entry added to `NAV_MORE` in `src/components/fantasy/AppShell.tsx`.
- `placeClaim` gains window enforcement; `runWaivers` gains the Wednesday-night readiness rule; `nextWaiverRun` replaced by a weekly-window calculation (Eastern-based, stored as UTC hours).
- FCFS adds route through the existing roster-move path with a new per-player game-started check.
- No database changes; no new scheduled jobs.

## Verification
- Playwright at phone and desktop widths: Claim → roster list → Compare → side-by-side → submit; Waivers screen renders all three sections; before-Wednesday rejection message shows with a shifted clock.
- Typecheck plus the preview console clean.

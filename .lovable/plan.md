# Correct player totals and game information

## What I confirmed

- **Total points are not prominent enough.** They are buried in the small sentence below each player while the main right-hand number still shows projection, even after choosing “Total points.”
- **The statistics calculation is incomplete.** Total points, season average, and last-three average use a separate shortcut formula that omits two-point conversions, field-goal distance and misses, defensive recoveries, safeties, blocked kicks, and points allowed. This especially makes kicker and defense totals wrong.
- **Last-three average can be understated.** It currently counts a bye or a week the player did not play as a zero-game in the average.
- **Kickoff time and channel have an unreliable path.** The live schedule source currently returns full information, but the app’s published schedule helper is returning an error. The remaining fallback supplies only a date such as “Sun 9/27.”
- **The Players screen has no safe schedule fallback.** When full kickoff details are missing, it hides the game line entirely. Matchups and My Team separately print the date-only fallback, which is why the three screens disagree.

## Fix plan

### 1. Make the statistics trustworthy

- Replace the shortcut calculation with the same complete league-scoring calculation already used for weekly scores and projections.
- Cover every configured scoring category for quarterbacks, skill players, kickers, and defenses.
- Calculate last-three average from games actually played, excluding byes and true did-not-play weeks.
- Keep season totals based on completed games only and label them clearly as **Season points**.
- Cross-check representative players at every position against their raw game logs and the league’s scoring settings before showing the values.

### 2. Make “Total points” visible when selected

- When **Sort: Total points** is active, change the right-hand `Proj` column to `Pts` and show each player’s season total there in large type.
- Keep projection available when **Sort: Projection** is selected.
- Retain the supporting season and recent-form details without making the mobile row wider.

### 3. Fix date, kickoff time, and TV channel once for all three screens

- Consolidate schedule enrichment so Players, Matchups, and My Team all read the same game-information object.
- Repair the failing hosted schedule request and add a second server-side schedule fallback rather than depending on one fragile request.
- Preserve the richest known schedule record in cache so a date-only response cannot overwrite a record that already has kickoff time and channel.
- Always show a game line. Preferred format: **Sun 9/27 · 11:00 AM · FOX** in the member’s chosen time zone. If a network truly has not been announced, show **TV TBD** rather than silently omitting it.
- For live and completed games, retain the scheduled kickoff/channel alongside the live clock or final status.

### 4. Verify the real experience

- Verify Josh Allen and Bryce Young’s season totals by rebuilding them from completed weekly stat lines using La Familia’s scoring rules.
- Verify at least one quarterback, running back, receiver, tight end, kicker, and defense.
- Test Players, Matchups, and My Team at phone size and desktop size.
- Confirm the published-style hosted schedule request returns date, localized kickoff time, and channel—not only the local preview.
- Confirm there is no horizontal scrolling and no missing game line on any of the three screens.

## Technical details

- Use one complete raw-stat-to-score mapper for weekly, last-three, average, and season totals to prevent the formulas from drifting again.
- Keep schedule fields (`startsAt`, `network`, status, possession, fallback date) merged field-by-field instead of replacing the whole game record.
- Add focused tests for scoring categories and schedule fallbacks, then run the existing type checks and an end-to-end phone-sized check.

# Get the real league in and live by the weekend

Two things have to happen before Sunday: real rosters replace the sample teams, and everyone sees the same league instead of their own private copy in their own browser.

## 1. Shared league (required to go live)

Right now the league lives in each person's browser, so your mom would see a different league than you. Turning on the built-in backend stores one league everyone loads.

- One shared league record: teams, owners, rosters, scoring rules, current week, schedule.
- Anyone with the link can view. Only you (commissioner) can edit teams, rosters and settings — protected by a simple commissioner password you set once, kept server-side.
- No accounts, no signups for the family. Just a link.

## 2. Roster import (ESPN / Yahoo)

ESPN and Yahoo don't hand out private-league data, so the import is paste-based. It only has to be done once, and you can do it Saturday with everyone in the room.

New "Import league" screen under Commissioner:

- Set number of teams (8-10), then for each team: team name, owner name.
- For each team, paste its roster — one player per line, straight from the ESPN/Yahoo roster page. Messy lines are fine ("Ja'Marr Chase WR CIN Q", "Bijan Robinson, RB").
- The app matches each line to the real NFL player list (already loaded from Sleeper) by name, with position and team used to break ties. Defenses handled by team name.
- A review step shows each line as Matched / Needs a pick (a short dropdown of close names) / Not found, so nothing silently lands in the wrong place.
- Confirm builds the real league, auto-fills each starting lineup, and keeps the rest on the bench.
- Also lets you paste all teams at once in a single box using "Team name:" header lines, for speed.

Safety: importing replaces the sample league, with a confirm step. Existing sample league stays until you confirm.

## 3. Weekend-ready touches

- Schedule: auto-generated round-robin as today, plus the ability to edit which teams play each other in a given week if your real league's schedule differs.
- Set the current NFL week on import so scores line up with the real season.
- A share button on the home page that copies the league link.

## Technical notes

- Enable Lovable Cloud. Tables: `league` (single row: name, current_week, scoring JSON, schedule JSON), `teams` (name, owner, color, starters array, bench array, sort order). Public read via anon SELECT policies; writes through server functions guarded by a hashed commissioner passcode stored as a secret.
- Replace `src/lib/fantasy/store.ts` localStorage layer with TanStack Query against server functions; keep the existing `League`/`FantasyTeam` shapes so matchups, standings, roster and optimize logic are unchanged.
- New `src/lib/fantasy/import.ts`: name normalisation (strip punctuation, suffixes, accents), index of Sleeper players by normalised name + position, fuzzy fallback for near matches, defense alias table.
- New route `src/routes/import.tsx` for the paste-and-review flow; `settings.tsx` gains the passcode gate and schedule editor.

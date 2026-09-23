# Add a refresh button to the header

## Why
The app already syncs automatically: scores refresh every 2 minutes, and roster/lineup/trade changes push to all devices instantly. But phones that sleep or lose connection can silently drop the live connection, leaving someone looking at stale lineups without knowing it. A small refresh button in the header is a one-tap safety net — nobody has to wonder, they can just tap it.

## What to build
- **Header refresh button** (in `src/components/fantasy/AppShell.tsx`, next to the profile nav): a small refresh icon button, the same size/style as other header icons.
- **What it does** when tapped:
  1. Re-fetches the shared league (rosters, lineups, teams, trades, score corrections) using the existing `reloadLeague()` helper — already proven in Add/Drop, Trades, and Settings.
  2. Refetches the live week data (scores, game times, statuses) by invalidating the `nfl-week-v4` queries so every page pulls fresh numbers.
  3. Shows a brief spinning state on the icon while it runs, then settles — a clear visual confirmation it worked.
- **Everyone sees it** — it lives in the shared header, no permission needed; tapping it just reads the latest data, it changes nothing.

## Scope
- Header only (`AppShell.tsx`); no changes to pages, data, or sync logic.
- No impact on sign-in or anyone's saved data.

## Verification
- Claim a team in the preview, make a change in one tab, tap refresh in another, and confirm the change appears.
- Confirm the icon spins while refreshing and scores/lineups update.
- Typecheck passes.

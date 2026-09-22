# Finish La Familia Fantasy Football — all 26 items

A phased plan to take the app from "works with sample data" to "the family logs in and plays".
Items 1–11 are already done. Below are 12–26, grouped so each phase leaves the app usable.

## Phase 1 — Make it private and real (do first, before the family weekend)

**12. Private sign-in.** Family members sign in with Google or email. Nobody signed out can see the league; visitors land on a simple sign-in page with the league crest.

**13. Commissioner powers.** You and your brother get a commissioner badge. Only you two can edit scoring, weeks, schedules, team names, and imports. Everyone else sees those screens read-only.

**14. One person, one team.** Each account is linked to a team. You can only change lineups for your own team; other teams are view-only. Commissioner can change any team.

**16. Real rosters loaded.** Import all ten rosters (paste, screenshot, or search), set the real team names and owners, and set the league's real scoring rules. A checklist screen shows which teams are complete.

**18. Test on real devices.** Walk the whole flow on a phone, tablet, and laptop with two different family accounts.

**19 + 20. Domain and publish.** Buy the domain, connect it, and publish so family can reach it by name.

## Phase 2 — Real NFL scoring

**15. Real data replaces the simulation.** Live weekly stats and points from Sleeper's public feeds instead of the current made-up projections and clocks. Scores update through Sunday, matchups settle, and standings compute from real results. Kickoff times and game status come from the real schedule.

**17. Waivers and free agents.** Add and drop players for your own team, with roster-size limits and a record of every move so two people can't grab the same player.

## Phase 3 — Season-long league features

**24. Trades.** Propose a swap to another team; they accept or reject. Commissioner can veto.

**25. Playoffs.** Choose playoff weeks and team count; a bracket appears and advances automatically.

**23. Transaction rules and history.** Waiver settings, roster limits per position, and a league-wide activity feed.

**22. Commissioner corrections.** Edit the schedule and override matchup results when something goes wrong.

## Phase 4 — Year over year

**21. Season rollover.** At season end, archive the year into History (champion, standings) and start a fresh league for next year with the same members.

**26. Member management.** Invite links, remove members, reassign teams, and password recovery.

## Technical notes

- Auth: Lovable Cloud auth, Google plus email/password. Routes move under a protected layout; sign-in page stays public.
- Roles: separate `user_roles` table (`commissioner`, `member`) with a security-definer check; never stored on the profile. Team ownership via a `user_id` column on `teams`.
- Write access: league/teams/season_history currently allow anon read and are written by the service role. Replace with policies — commissioners write league/schedule/scoring/history, a member writes only their own team row.
- Real data (15): Sleeper `/stats/nfl/regular/{season}/{week}`, `/projections/...`, and `/state/nfl` for current week, cached server-side; scoring runs through the existing `scoreStats` with the league's real rules. Removes `projections.ts` simulation paths.
- Transactions (17/23/24): new `transactions` table (add/drop/trade, status, actor, timestamps) and server functions that validate roster limits and ownership atomically.
- Playoffs (25): store playoff config on the league row; bracket derived from standings at the cutoff week.
- Rollover (21): copies teams and members into a new league slug, writes the finished season into `season_history`.

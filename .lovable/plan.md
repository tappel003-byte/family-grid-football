# QA/QC pass before freezing the app

Goal: confirm La Familia is solid on phone and desktop, fix only real breakage, then publish and leave it alone.

## 1. Health checks (no changes)
- Build and type check are clean; no console errors on load.
- Look into the "Load failed" message in the console (probably a feed request cut off during refresh). Fix it only if it affects what people see.
- Server logs show no repeated errors.
- Run the security scan again and report what's left. Nothing gets changed without your OK.

## 2. Walk every screen, signed in as Tim, on phone (440px) and desktop (1280px)
- Sign-in: one-tap "Welcome back" works, and stays signed in after a refresh.
- Matchups: opens to your own matchup, left/right alignment is right, scores load.
- My Team: Swap/Bench/Drop, Optimize Lineup, help (?) popovers, IR.
- Players: filters, sorting, position ranks, stat groups, Add/Claim dialog, Compare cards, Back to my roster.
- Standings, Playoffs, Teams (view-only), Trades, History, Activity filters, Chat, Waivers, Account.
- Commissioner: settings sections, Fix a team, Run waivers now (look only, don't press).
- Header buttons: Refresh and the More menu open and close properly on phone.

## 3. Chrome/polish fixes (only if found)
- Clipped or wrapping text, overlapping buttons, broken images, dead links, empty screens with no message, pages missing a browser-tab title.
- Small, targeted fixes only. No new features and no redesigns.

## 4. Waiver timing check
- Re-run the Wednesday 12:01 AM Eastern check across daylight-saving changes, and confirm the weekly automatic run is still scheduled.

## 5. Wrap-up
- A short report: what was checked, what was fixed, and anything left for you to decide.
- Publish so the live site gets all the recent changes (one-tap sign-in, chat, waivers, compare cards).

## Technical notes
- Playwright with a minted Tim session (`lovable auth-session --json --self`), screenshots in /tmp/browser/qa.
- tsgo typecheck, dev-server log review, security--run_security_scan, cron.job query for weekly-waiver-run.
- Check that each route has its own head() title and description.

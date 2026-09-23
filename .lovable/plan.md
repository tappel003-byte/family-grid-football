# Stay signed in — "once per device, then never again"

## Goal
After someone signs in once on a phone, tablet or computer, they should never see the sign-in screen again on that device — not after closing the app, refreshing, or a new version being published. Worst case, they see one big "Continue as Ed — Bizzer Beez" button, one tap, no typing.

## What changes for the family
1. First visit: same as today — tap your team, type the family password.
2. Every visit after: straight into the app.
3. If the device ever loses the sign-in (browser cleanup, iPhone storage purge, etc.), the screen shows a large "Welcome back, [name] — tap to continue" button with their team crest. One tap signs them back in. A small "Not you? Pick a different team" link underneath.
4. "Sign out" in the profile menu is the only thing that makes the device forget them.
5. The "Keep me signed in" checkbox goes away — it's always on. (One less thing for Mom and Dad to get wrong.)

## Steps
1. Reproduce first: sign in on the published site, refresh, close/reopen, and simulate a new version, to confirm exactly where the sign-in is being dropped (the current "remember me" backup logic has a path that can sign people out on reload, which is the prime suspect).
2. Fix that path so a saved sign-in is always reused and refreshed quietly in the background.
3. Add the "remembered device" safety net: after a successful sign-in, the device remembers which team it belongs to. If the sign-in is ever missing, show the one-tap "Continue as…" screen, which signs them back in automatically.
4. Remove the checkbox; make Sign out clear the remembered team.
5. Verify on phone size: sign in, reload, clear the sign-in only, confirm the one-tap button appears and works, confirm Sign out fully forgets.

## Technical details
- `src/lib/auth.ts`: remove the `keepSignedIn()`/`ACTIVE_TAB_KEY` signOut branch in `useSession`; always keep the session backup; restore it before deciding the user is signed out. Keep `loading` true until restore finishes so the gate doesn't flash.
- New localStorage key `la-familia-device-team` = `{ slot, email, displayName, teamName }`, written after successful claim/sign-in, cleared in `signOut()`.
- `AuthGate.tsx`: when no session but a device-team record exists, render a "Continue as" screen; tapping calls the existing `claimTeam` flow's sign-in (same family password, already how every account signs in) via a small server function so the password is never stored on the device. Fallback link returns to the normal team picker.
- Preview vs. published domain still keep separate sign-ins (unchanged).

# Put League Chat in the "More" menu

## What went wrong
The refresh button isn't the problem. Two separate things happened:
1. I put League Chat in the menu under your name (tap "Tim"), not in the "More" menu you opened.
2. The chat hasn't been published yet, so it isn't on the live site at all.

## Fix
- Add "Chat" to the "More" menu, right under Activity.
- Take it out of the "Tim" menu so it only lives in one place.
- Check on a phone-sized screen that More → Chat opens the chat and a test message posts.
- Then you publish so the family sees it on lafamiliafantasyfootball.com.

## Technical details
- `src/components/fantasy/AppShell.tsx`: add `{ to: "/chat", label: "Chat" }` to `NAV_MORE`; remove the `/chat` link and the unused `MessageCircle` import from `ProfileNav`.

# Family Fantasy League

Build a clean, private family fantasy football web app designed for an 8-10 team league, optimized for everyone from teenagers to grandparents (simple, large clear typography, zero ads or betting clutter).

Key requirements:
1. Classic NFL Fantasy Style Layout:
   - High-priority laptop and tablet layouts: wide screen with full side-by-side head-to-head matchup view (starters facing starters at each position, top scoreboard with team logos and live point totals).
   - Clean, wide roster table with player headshot photos, team badges, positions, game status, injury tags (Q, OUT, IR), projected points, and current points.
   - Smooth mobile responsiveness for family members on phones.

2. NFL Players & Data:
   - Integrate Sleeper's free public NFL API (https://api.sleeper.app/v1/players/nfl, trending endpoints) for real NFL player rosters, headshots, positions, and injury statuses.
   - Support player research tab with trending adds/drops, search, and position filtering.

3. Core Features:
   - "Optimize Lineup" button on team rosters that automatically sets the highest projected healthy starters into starting slots.
   - Quick swap/bench controls for rosters.
   - Commissioner settings panel to adjust scoring rules (with standard and PPR presets) and manage league teams.
   - Week selector (Week 1 through 18) for schedules and weekly matchups.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://family-grid-football.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9e6d3f1b-c552-4593-bbf5-0683a61227a0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

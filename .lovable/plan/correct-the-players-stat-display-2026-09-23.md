# Correct the Players stat display

## What will change
- Keep the existing **Sort** dropdown with its three groups: Production, Ownership, and Hype.
- Show only the stats belonging to the currently selected group:
  - **Production:** Projection, Total points, Season average, Last 3 average, Overall rank.
  - **Ownership:** Rostered %, Started %, Rising %.
  - **Hype:** Trending adds, Trending drops, Best pickup.
- Display that selected group as one compact horizontal line on every player row.
- Selecting any item in the dropdown will both sort the list by that stat and switch the visible line to its group.
- Keep the active sorting column highlighted and keep the dropdown label synchronized.
- Remove the stacked three-group panel and the “tap any stat” instruction.

## Verification
- Confirm each dropdown choice shows only its group and sorts correctly.
- Check phone and desktop layouts for readable columns and no sideways scrolling.
- Confirm the dropdown still closes immediately when scrolling.

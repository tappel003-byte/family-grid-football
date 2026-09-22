# Team helmet logos — cleaner cutouts (back burner)

The ten helmets are live and working, but the cutout edges aren't as clean as we'd like — Milkman is the most noticeable (leftover flecks and rough edges from the background removal). This plan parks the proper fix until you're ready.

## What to do when we pick this up

1. **Re-cut from the original sheet**, not from the current cutouts (re-editing the cutouts would just bake in the existing artifacts).
2. Use the image editor with a tighter prompt per logo: "isolate this football helmet logo, remove the entire background, keep every edge of the helmet and wordmark crisp, no leftover pixels or halos."
3. Do Milkman first as the test case. If it comes out clean, batch the other nine the same way; if not, try one at a time with per-logo tweaks.
4. Swap the new files in under the same names in `src/assets/team-logos/` — no code changes needed, every screen picks them up automatically.
5. Eyeball each one on the matchup screen and the claim-your-team screen before publishing.

## Notes

- Nothing is broken in the meantime — the current helmets stay live.
- If any logo never comes clean from the sheet, the fallback is regenerating that single helmet from scratch in the same style.

## Technical details

- Files live in `src/assets/team-logos/*.png.asset.json` (CDN pointers); replacing a logo means creating a new asset pointer with the same filename via `lovable-assets create`.
- Mapping sheet → app team stays as-is (Milk Man → Milkman, etc.).

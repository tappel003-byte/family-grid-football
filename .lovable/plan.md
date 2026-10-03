# Fix the home-screen icon: crest on a seamless black tile

Phones don't allow see-through home-screen icons. They always draw a solid tile behind the icon, and the white box came from the off-white background we set. The fix is to use the crest's own black as the tile, so the icon looks like one finished badge with no frame.

## What changes
- **Home-screen icon (iPhone and Android):** the crest you just uploaded, enlarged to fill the tile, on the same deep black as its background. No white, no cream, no visible square edge.
- **Android "maskable" icon:** the same black tile, with a little extra margin so Android's round or squircle crop never cuts off the crown or the ring.
- **App manifest:** background and theme color set to black, so the launch splash matches the icon.
- **Header logo in the app:** stays the transparent floating crest. No change.
- **Browser tab icon:** stays the simple football. No change.

## Technical details
- Source: `/mnt/user-uploads/A98C2517-B05B-4CA5-890C-2597007B549F-2.png` (black background is kept, not cut out).
- `public/apple-touch-icon.png`: 180x180, crest at about 92% of the tile on solid #000.
- `public/icon-512.png` (purpose "any"): 512x512, crest at about 92% on #000.
- New `public/icon-512-maskable.png`: 512x512, crest at about 78% on #000; the manifest's maskable entry points here.
- `manifest.webmanifest`: `background_color` and `theme_color` set to `#000000`.
- `src/assets/league-crest.png` stays as it is.
- Check: open each file and confirm there's no white or cream pixel at the edges. Nothing gets published.

## After it's built
To see the new icon, delete the existing La Familia icon from your home screen and add it again. Phones save the old icon and don't refresh it on their own.

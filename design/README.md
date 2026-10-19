# ascend design

Visual identity and UI template for ascend: mint → blue, calm, private.

| File                                                               | What it is                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| [`tokens.json`](tokens.json)                                       | Source of truth for colors, light/dark theme, type, spacing, radii, sizes   |
| [`logo/ascend-icon.svg`](logo/ascend-icon.svg)                     | macOS app icon, 1024 × 1024, Big Sur grid (824 px tile, 100 px margin)      |
| [`logo/ascend-mark.svg`](logo/ascend-mark.svg)                     | The mark alone on transparent background (start page, about box, README)    |
| [`template/ascend-window.svg`](template/ascend-window.svg)         | Browser window template: tabs, toolbar, side panel, start page (1440 × 900) |
| [`template/ascend-styleguide.svg`](template/ascend-styleguide.svg) | Color ramps, gradient, type scale, buttons, tabs, address bar states        |
| `export/*.png`                                                     | PNG renders of the files above                                              |
| [`../build/icon.icns`](../build/icon.icns)                         | Finished macOS icon (16–1024 px, @1x/@2x) for packaging in Phase 7          |

## Concept

- **Mark:** two rising chevrons – "ascend" – on a mint → teal → blue gradient.
- **Color:** mint for "safe / private" (secure lock, accent), blue for strong
  actions and focus. Neutrals are slightly blue-green so the chrome feels calm.
- **Type:** the macOS system font (SF Pro). No web fonts, so nothing is
  downloaded (privacy rule 2).
- **Layout:** Vivaldi-style side panel rail on the left, tabs on top, a
  shield in the toolbar for the blocker (Phase 3).

## Using the files in DesignCraft

DesignCraft's own `.pcraft` format is not documented, so these files are kept
as open formats. Open DesignCraft and import or drag in:

- the **SVG** files if you want editable vector layers (each region is a named
  group, e.g. `tab-strip`, `address-bar`, `side-panel`), or
- the **PNG** files in `export/` as a flat reference layer.

Save your working copy as `.pcraft` in this folder if you like. When you
change colors, update `tokens.json` too, so the app's CSS stays in sync.

## Regenerating exports (macOS built-in tools only)

```sh
cd design
sips -s format png logo/ascend-icon.svg --out export/ascend-icon-1024.png
sips -s format png template/ascend-window.svg --out export/ascend-window.png
sips -s format png template/ascend-styleguide.svg --out export/ascend-styleguide.png
```

`sips` ignores SVG filters (shadows) and `stroke-opacity`, so the icon uses
solid colors only for its glyph. To rebuild `build/icon.icns`, scale the
1024 PNG to 16, 32, 128, 256 and 512 px (plus @2x) into an `ascend.iconset`
folder with `sips -z` and run `iconutil -c icns ascend.iconset`.

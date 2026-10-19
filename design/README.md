# ascend design

Visual identity and UI template for ascend. Flat colour, Times for display, no gradients.

| File                                                               | What it is                                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [`tokens.json`](tokens.json)                                       | Source of truth for colors, light/dark theme, type, spacing, radii, sizes        |
| [`logo/ascend-icon.svg`](logo/ascend-icon.svg)                     | App icon source: Times “a” with grain, Big Sur grid (824 px tile, 100 px margin) |
| [`logo/ascend-mark.svg`](logo/ascend-mark.svg)                     | The “a” alone on transparent background (start page, about box, README)          |
| [`template/ascend-window.svg`](template/ascend-window.svg)         | Browser window template: tabs, toolbar, side panel, start page (1440 × 900)      |
| [`template/ascend-styleguide.svg`](template/ascend-styleguide.svg) | Six-colour palette, type scale, buttons, tabs, address bar states                |
| `export/*.png`                                                     | PNG renders of the files above                                                   |
| [`scripts/render-icon.swift`](scripts/render-icon.swift)           | Renders the icon and mark PNGs with exact glyph size and grain                   |
| [`../build/icon.icns`](../build/icon.icns)                         | Finished macOS icon (16–1024 px, @1x/@2x) for packaging in Phase 7               |

## Concept

- **Mark:** a large lowercase Times New Roman “a” in ink on a flat mint tile,
  with film grain. The letter is the icon; it fills about 60 % of the tile.
- **Colour:** six flat colours, each with one job (see `tokens.json`). Paper
  and ink carry the interface. Teal marks links, focus and secure state.
  Mint appears only in the icon and selections. No gradients anywhere.
- **Type:** Times New Roman for display (the mark, wordmark, start page), SF
  Pro for the interface. Both ship with macOS, so nothing is downloaded
  (privacy rule 2). Times and dates use tabular figures.
- **Texture:** grain only on the icon and mark, never on UI text.
- **Layout:** hairlines instead of shadows and cards. The start page shows the
  mark, the address field and recently visited pages; no promotional numbers.
- **Accessibility:** every text pair meets WCAG AA (body text ≥ 4.5:1).

### Font license note

Times New Roman is a Monotype font bundled with macOS. Rendering it into the
icon and screenshots is fine for this project. Before a public release, check
Monotype's terms for using it in a logo, or switch to the metric-compatible
Tinos (Apache-2.0), which looks almost identical.

## Using the files in DesignCraft

[DesignCraft](https://github.com/storytold/designcraft) (MIT / Apache-2.0)
saves native `.designcraft` documents (from v0.9.0). Until its CLI is set up,
import or drag in:

- the **SVG** files for editable vector layers (each region is a named group,
  e.g. `tab-strip`, `address-bar`, `side-panel`), or
- the **PNG** files in `export/` as a flat reference layer.

Planned: register `designcraft-cli mcp` for this project (read root
`design/`, write root `design/designcraft/`) so the templates can be built
directly as `.designcraft` files. When you change colors in DesignCraft,
update `tokens.json` too, so the app's CSS stays in sync.

## Regenerating exports (macOS built-in tools only)

```sh
# Icon and mark with grain (Swift + AppKit, deterministic output)
swift design/scripts/render-icon.swift design/export
# Templates
cd design
sips -s format png template/ascend-window.svg --out export/ascend-window.png
sips -s format png template/ascend-styleguide.svg --out export/ascend-styleguide.png
```

`sips` ignores SVG filters, so only the Swift-rendered icon and mark PNGs
show the grain. To rebuild `build/icon.icns`, scale the
1024 PNG to 16, 32, 128, 256 and 512 px (plus @2x) into an `ascend.iconset`
folder with `sips -z` and run `iconutil -c icns ascend.iconset`.

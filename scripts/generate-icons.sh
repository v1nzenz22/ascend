#!/usr/bin/env bash
# Scales the full-bleed web icon into the PNGs the app ships in public/icons/.
#
# macOS only (uses the built-in `sips`), run manually with `npm run icons`
# after changing design/export/ascend-icon-web-1024.png. It is deliberately
# NOT part of `npm run build`, so the app builds on any system; the generated
# PNGs are committed instead.
set -euo pipefail

# Run from the repo root, wherever the script is called from.
cd "$(dirname "$0")/.."

SRC=design/export/ascend-icon-web-1024.png
OUT=public/icons

if ! command -v sips >/dev/null 2>&1; then
  echo "generate-icons: sips not found (macOS only)" >&2
  exit 1
fi

mkdir -p "$OUT"
# The same full-bleed image serves as "any" and "maskable": the cropped "a"
# stays recognisable inside the maskable safe zone (centred circle, 80 %).
# So icon-512.png is listed twice in the manifest (vite.config.ts) instead of
# writing an identical icon-maskable-512.png.
sips -z 192 192 "$SRC" --out "$OUT/icon-192.png" >/dev/null
sips -z 512 512 "$SRC" --out "$OUT/icon-512.png" >/dev/null
# iOS home-screen icon. iOS rounds the corners itself.
sips -z 180 180 "$SRC" --out "$OUT/apple-touch-icon-180.png" >/dev/null

echo "generate-icons: wrote $OUT/{icon-192,icon-512,apple-touch-icon-180}.png"

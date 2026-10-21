#!/usr/bin/env bash
# Checks the production build (dist/) for addresses of other websites.
#
# Why: the app must never contact a server the user did not ask for (no CDN,
# no analytics, no crash reporting). The Playwright tests catch requests that
# actually happen; this check also catches URLs in code paths the tests never
# run. Run it after `npm run build` (or use `npm run verify`).
#
# 1. Every http(s):// URL found in dist/ must be on the exact allowlist below.
# 2. No file may mention a known tracker or CDN host, with or without "https://".
#
# Binary files (PNG, later wasm) are scanned too, so nothing hides in them.
# So is the Cloudflare `_headers` file: its CSP must not name other hosts.
set -euo pipefail

# Run from the repo root, wherever the script is called from (a relative
# folder argument is resolved first, so it still points to the same place).
if [[ $# -gt 0 && "$1" != /* ]]; then set -- "$PWD/$1"; fi
cd "$(dirname "$0")/.."

# The folder to check; tests pass a different one.
DIST="${1:-dist}"

# Each entry is one exact URL and why it is harmless. Add a URL only after
# checking where it comes from and that the app never requests it.
ALLOWED=(
  # Dexie: links in error messages (text only, never fetched).
  "http://bit.ly/2kdckMn"
  "https://tinyurl.com/y2uuvskb"
  # Workbox (inside sw.js): link in an error message (text only, never fetched).
  "https://bit.ly/wb-precache"
  # PNG icons: XML namespace names in the image metadata written by macOS
  # `sips`. They are identifiers, not addresses that anything loads.
  "http://ns.adobe.com/exif/1.0/"
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  # SVG namespace for createElementNS in src/ui/dom.ts (identifier, never fetched).
  "http://www.w3.org/2000/svg"
)

# Hosts that must never appear anywhere in the build (case-insensitive,
# extended regex).
FORBIDDEN='google-analytics\.com|googletagmanager|sentry|fonts\.googleapis|unpkg|jsdelivr|cdn\.'

if [[ ! -d "$DIST" ]]; then
  echo "check-dist: $DIST/ not found, run 'npm run build' first" >&2
  exit 1
fi

failed=0

# LC_ALL=C: treat files as plain bytes, so binary files cannot break grep.
# -a: read binary files as text. -o: print only the matched URL.
found=$(LC_ALL=C grep -raohE "https?://[A-Za-z0-9._~:/?#@!\$&+,;=%-]+" "$DIST" | sort -u || true)

while IFS= read -r url; do
  [[ -z "$url" ]] && continue
  allowed=0
  for entry in "${ALLOWED[@]}"; do
    if [[ "$url" == "$entry" ]]; then
      allowed=1
      break
    fi
  done
  if [[ $allowed -eq 0 ]]; then
    echo "check-dist: URL not on the allowlist: $url" >&2
    LC_ALL=C grep -ralF "$url" "$DIST" | sed 's/^/  found in: /' >&2
    failed=1
  fi
done <<<"$found"

forbidden=$(LC_ALL=C grep -raoiE "$FORBIDDEN" "$DIST" | sort -u || true)
if [[ -n "$forbidden" ]]; then
  echo "check-dist: forbidden host names found:" >&2
  echo "$forbidden" | sed 's/^/  /' >&2
  failed=1
fi

if [[ $failed -ne 0 ]]; then
  exit 1
fi

count=$(grep -c . <<<"$found" || true)
echo "check-dist: OK ($count allowed URLs, no forbidden hosts)"

#!/usr/bin/env bash
# Self-test for check-dist-urls.sh: builds small fake dist folders and checks
# that the script accepts the allowed ones and rejects the others.
# Run with `npm run test:scripts`.
set -euo pipefail

cd "$(dirname "$0")/.."
CHECK=scripts/check-dist-urls.sh
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

failures=0

# expect <pass|fail> <description> <file content>
expect() {
  local want=$1 name=$2 content=$3
  local dir="$TMP/$name"
  mkdir -p "$dir"
  printf '%s\n' "$content" >"$dir/app.js"
  if bash "$CHECK" "$dir" >/dev/null 2>&1; then got=pass; else got=fail; fi
  if [[ "$got" == "$want" ]]; then
    echo "ok   $name"
  else
    echo "FAIL $name: expected $want, got $got"
    failures=$((failures + 1))
  fi
}

expect pass no-urls 'console.log("hello")'
expect pass allowed-urls 'e("see http://bit.ly/2kdckMn"); f("https://tinyurl.com/y2uuvskb")'
expect fail unknown-url 'fetch("https://example.com/api")'
expect fail allowed-prefix-only 'fetch("https://bit.ly/2kdckMn/extra")'
expect fail analytics-host-without-scheme 'load("//www.google-analytics.com/a.js")'
expect fail cdn-host 'import("//cdn.example.org/lib.js")'
expect fail jsdelivr 'x="JSDelivr.net"'

# A URL hidden in a binary file is found too.
mkdir -p "$TMP/binary"
printf '\x89PNG\x00\x01https://tracker.example/p\x00' >"$TMP/binary/icon.png"
if bash "$CHECK" "$TMP/binary" >/dev/null 2>&1; then
  echo "FAIL binary: expected fail, got pass"
  failures=$((failures + 1))
else
  echo "ok   binary"
fi

# The Cloudflare `_headers` file (generated from security.config.ts) is
# scanned like every other file. It holds no URLs, so it passes; a URL that
# sneaks into it (e.g. a CDN in the CSP) is caught.
mkdir -p "$TMP/headers-ok" "$TMP/headers-cdn"
printf "/*\n  Content-Security-Policy: default-src 'self'; frame-ancestors 'none'\n/sw.js\n  Cache-Control: no-cache\n" >"$TMP/headers-ok/_headers"
printf "/*\n  Content-Security-Policy: script-src 'self' https://cdn.example.org\n" >"$TMP/headers-cdn/_headers"
if bash "$CHECK" "$TMP/headers-ok" >/dev/null 2>&1; then
  echo "ok   headers-file"
else
  echo "FAIL headers-file: expected pass, got fail"
  failures=$((failures + 1))
fi
if bash "$CHECK" "$TMP/headers-cdn" >/dev/null 2>&1; then
  echo "FAIL headers-file-cdn: expected fail, got pass"
  failures=$((failures + 1))
else
  echo "ok   headers-file-cdn"
fi

# A missing folder is an error, not a silent pass.
if bash "$CHECK" "$TMP/does-not-exist" >/dev/null 2>&1; then
  echo "FAIL missing-dist: expected fail, got pass"
  failures=$((failures + 1))
else
  echo "ok   missing-dist"
fi

if [[ $failures -ne 0 ]]; then
  echo "check-dist-urls.test: $failures failure(s)" >&2
  exit 1
fi
echo "check-dist-urls.test: all passed"

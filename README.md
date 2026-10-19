# ascend

A private, local-first desktop browser for macOS.

ascend is built on [Electron](https://www.electronjs.org/) and TypeScript. It
does not phone home: no telemetry, no crash reports, no update checks and no
cloud sync. Everything it stores (history, bookmarks, settings) stays on your
machine.

> **Status:** early development (Phase 1 – project foundation).
> Not usable as a browser yet. See [ROADMAP.md](ROADMAP.md).

## Privacy principles

1. **Zero telemetry.** Neither the browser, the build scripts nor any
   dependency may send usage data.
2. **No external request without explicit consent.** This includes update
   checks, crash reports, and fonts or icons from CDNs.
3. **Local data only.** History, bookmarks and settings never leave the
   device. No cloud sync.
4. **HTTPS-only by default.**
5. **Ad and tracker blocking** with Brave's `adblock-rust` and the EasyList /
   EasyPrivacy filter lists (planned, Phase 3).

## Requirements

- macOS on Apple Silicon (arm64). Other platforms are not supported.
- Node.js 24 LTS, pinned in [`.node-version`](.node-version). We recommend
  [fnm](https://github.com/Schniz/fnm), which reads this file automatically.
- Xcode Command Line Tools (`xcode-select --install`), needed to compile
  native modules.

## Getting started

Setup instructions will be added once the app can be built (Phase 2).

### Known build-time network access

Installing dependencies talks to the network. These requests are expected and
happen only when you run them yourself:

- `npm install` downloads packages from the npm registry.
- The `electron` package downloads its prebuilt binary from GitHub during
  installation.

The running browser itself makes no request that you did not trigger.

## License

[Mozilla Public License 2.0](LICENSE).

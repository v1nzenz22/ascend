# Deploying ascend to Cloudflare Pages

ascend is a static app: `npm run build` writes everything into `dist/`, and
any static host can serve it. We use **Cloudflare Pages with its Git
integration** (decision D14-A in `docs/design/phase-3-core.md`):

- Cloudflare's GitHub app builds every push to `main` and publishes `dist/`.
- No deploy tool (no `wrangler`) and no API token on the developer's
  computer, so there is no CLI telemetry setting that could be forgotten.
- Cost: Cloudflare gets **read access to this one private repository**.
  Limit the GitHub app to this repository only.

The app makes no requests to other sites. Honest limit: Cloudflare, as the
host, sees the IP address and request metadata of every page load (as any
web host does). This cannot be switched off.

## Build settings

| Setting                | Value                                         |
| ---------------------- | --------------------------------------------- |
| Framework preset       | None                                          |
| Production branch      | `main`                                        |
| Build command          | `npm run build`                               |
| Build output directory | `dist`                                        |
| Root directory         | `/` (leave empty)                             |
| Environment variable   | `NODE_VERSION` = `24` (production)            |
| Preview deployments    | **None** (Settings → Builds → Branch control) |

Notes:

- `NODE_VERSION=24` matches `.node-version`. The build image (v3) also reads
  `.node-version`, the variable makes the choice explicit. If a build fails
  with an unknown Node version, check the build log and the list of versions
  in Cloudflare's build image docs.
- Cloudflare runs `npm ci` itself (it sees `package-lock.json`), so the build
  uses exactly the locked dependency versions.
- No other environment variables and no secrets are needed. Never add API
  keys here: the app has none, and everything in the build is public.
- `base` in `vite.config.ts` stays `/`: the app is served at the root of
  `<project>.pages.dev`.
- Choose a project name without personal data (e.g. `ascend-app`). It becomes
  part of the public URL.

## Security headers (`_headers`)

`npm run build` writes `dist/_headers`, which Cloudflare Pages reads and turns
into HTTP headers. It is generated from `security.config.ts` (the same source
as the `<meta>` Content Security Policy in `index.html`), so never edit it by
hand. It sets:

- `Content-Security-Policy`: the meta policy plus `frame-ancestors 'none'`
  (only works as a header).
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Cross-Origin-Opener-Policy: same-origin`, `X-Frame-Options: DENY`.
- `Permissions-Policy`: camera, microphone, geolocation, payment, USB and
  interest cohorts off. Phase 4 switches the camera to `camera=(self)` for
  the barcode scanner.
- `Cache-Control: no-cache` for `sw.js`, `manifest.webmanifest`, `/` and
  `/index.html`, so a new version is found on the next start; one year
  (`immutable`) for the hashed files in `/assets/`.

No HSTS header: `*.pages.dev` is already on the browsers' HSTS preload list.
Add HSTS only together with a custom domain.

## Cloudflare features that must stay off

These features inject scripts or rewrite HTML. That would be telemetry and
would also break the Content Security Policy.

| Feature                                        | Where                                              |
| ---------------------------------------------- | -------------------------------------------------- |
| Web Analytics                                  | Pages project → Metrics → Web Analytics            |
| Preview deployments                            | Pages project → Settings → Builds → Branch control |
| Zaraz                                          | Zone (only with a custom domain)                   |
| Rocket Loader                                  | Zone → Speed (only with a custom domain)           |
| Email Obfuscation                              | Zone → Scrape Shield (only with a custom domain)   |
| Speed Brain / prefetch hints, Cloudflare Fonts | Zone → Speed (only with a custom domain)           |
| Bot Fight Mode / JavaScript challenges         | Zone → Security (only with a custom domain)        |
| Pages Functions logs / Logpush                 | Not used (no Functions in Phase 3)                 |

With only `*.pages.dev` (recommended for now), the zone features do not
apply. Re-check this table when adding a custom domain.

## Manual steps (one time)

1. Create a Cloudflare account (free plan) with an email address of your
   choice. Turn on two-factor authentication.
2. Workers & Pages → Create → Pages → **Connect to Git**. Install the
   Cloudflare GitHub app and grant it access to **only the `ascend`
   repository** (not "All repositories").
3. Select the repository. Enter a project name without personal data, the
   production branch `main`, framework preset "None", build command
   `npm run build`, output directory `dist`, and the environment variable
   `NODE_VERSION` = `24`. Save and deploy.
4. Settings → Builds → Branch control: set preview deployments to **None**.
5. Metrics: make sure Web Analytics is **off**.
6. After the first deploy, check the headers from a terminal (this request is
   made by you, on purpose):

   ```sh
   curl -sI https://<project>.pages.dev/ | grep -i -E 'content-security|x-frame|referrer|permissions'
   curl -sI https://<project>.pages.dev/sw.js | grep -i cache-control
   ```

   Expected: the CSP ends with `frame-ancestors 'none'`, and `sw.js` has
   `Cache-Control: no-cache`.

7. On the iPhone: open the URL in Safari → Share → "Zum Home-Bildschirm".
   Open the app once, switch on flight mode, open it again: it must start.
8. Optional, later: a custom domain. Then go through the zone features above
   again and consider adding HSTS.

## Every deploy

Push to `main`. Cloudflare builds and publishes within a few minutes. Open
apps notice the new version the next time they come to the front and offer
"Neu laden" (see `src/app/update.ts`); nothing is replaced while someone is
typing.

To roll back: Pages project → Deployments → pick an older deployment →
"Rollback to this deployment".

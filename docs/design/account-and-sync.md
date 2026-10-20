# Account, sync and device connections

Status: proposal, waiting for the user's decisions (§11). Nothing in this
document is implemented. It changes a core decision from Phase 0 ("no account,
no cloud, local only"), so the privacy rules in `CLAUDE.md`, the README and the
ROADMAP must be updated **before** any code is written (drafts in §9).

This document describes **what** we would build and **why**. It contains
sketches (tables, message shapes), not finished code.

Statements marked **(verify)** depend on browser or vendor behaviour that
changes often. `researcher` should confirm them, with sources, before the
phase that needs them starts.

## 1. What the user asked for

- An **account without an email address** (exact method still open).
- The app stays **private**, but an account and a server are needed to
  - sync between iPhone and desktop browser,
  - connect services: Strava, Apple Health import, later Fitbit / Google
    Health.
- Logging stays **fully offline**; sync happens when a connection exists
  (offline-first + sync).
- Unchanged: zero telemetry, no third-party tracking, no CDN, requests only
  by user action (with one new, explained exception: background sync for
  users who switched it on, §3.6).
- Hosting: frontend on Cloudflare Pages (decided). Backend to be compared:
  Cloudflare Workers + D1 / R2 / Durable Objects, or self-hosted.

## 2. Guiding principles

| Principle                             | Consequence                                                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **The account is optional**           | The app keeps working without an account, forever. The account only adds sync and service connections. (Open question 2.)        |
| **The server is a dumb mailbox**      | It stores encrypted blobs and hands them back. It never reads, computes or analyses user data.                                   |
| **No personal data is asked for**     | No email, no name, no phone number, no birthday. The only thing the user keeps is a key.                                         |
| **The device is the source of truth** | IndexedDB stays the primary store. Sync copies changes between devices; the app never waits for the server to show or save data. |
| **Statistics stay on the device**     | Everything the user sees (totals, charts, streaks, "when do you log") is computed locally (§7).                                  |
| **No new crypto library**             | The browser's built-in WebCrypto (HKDF, AES-GCM, SHA-256) covers everything. Fewer dependencies = less to review.                |

## 3. Account without email

### 3.1 Options

| Option                                                                        | How it works                                                                                                                                                                                                                 | Complexity                                                                                                                        | Privacy                                                                                         | Offline / devices                                                                                                                        | Beginner readability                   |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **A. Account key** (random secret, like Mullvad's account number, but longer) | The device creates a random 128-bit key and shows it once (`ASC1-7K3M-…`). The key **is** the account: it identifies the account, logs in and unlocks the encryption key. The user saves it (file, print, password manager). | Low: WebCrypto only, ~3 small server routes, no new dependency                                                                    | Best: nothing personal; the server only sees a random ID                                        | Works in every browser and on every OS. New device: type or paste the key. Lost key + lost devices = data gone                           | High: one secret, one idea             |
| B. Passkey (WebAuthn)                                                         | Login with Face ID / Touch ID. The passkey lives in iCloud Keychain (or another passkey manager) and syncs between the user's Apple devices.                                                                                 | Medium–high: WebAuthn ceremonies, server-side verification library, PRF for encryption                                            | Very good: no personal data; phishing-resistant                                                 | Great on Apple devices. Windows/Linux browser: only via "use a phone" (QR + Bluetooth) or a second passkey. Lost Apple ID = passkey gone | Medium: many browser-specific details  |
| C. Username + password                                                        | Classic form                                                                                                                                                                                                                 | Medium: password hashing on server **and** a slow key-derivation function (Argon2 = wasm dependency) on the client for encryption | Weaker: usernames are often real names; reused/weak passwords make the encrypted data guessable | Works everywhere                                                                                                                         | High, but the security details are not |

Why **not C**: with end-to-end encryption the password also protects the
encryption key. Anyone who copies the server database can then try billions of
passwords offline; only a slow, memory-hard function (Argon2id) slows this
down, which needs a WebAssembly dependency and careful tuning for the iPhone.
Users also reuse passwords and pick usernames that identify them. A random
account key avoids all of this, because 128 random bits cannot be guessed.

### 3.2 Passkeys on iPhone and in the PWA – what we know

- WebAuthn passkeys work in Safari since iOS 16 and are stored in iCloud
  Keychain, synced end-to-end encrypted across the user's Apple devices.
  Whether the ceremony works reliably **inside the home-screen PWA**
  (standalone mode), not only in a Safari tab, must be tested on a real
  device. **(verify)**
- Other passkey managers (1Password, Bitwarden, Google Password Manager) can
  also store passkeys on iOS 17+. **(verify)**
- **Encryption needs the PRF extension.** A normal passkey only proves "this is
  the user"; it does not give the app a secret to unlock the encryption key.
  The WebAuthn `prf` extension returns a stable secret per passkey that can.
  State as far as known: Safari 18 / iOS 18 / macOS 15 support PRF for
  iCloud Keychain passkeys (early versions had bugs, e.g. with cross-device
  use); Chrome supports it with Google Password Manager and many security
  keys; Windows Hello support came late and third-party managers vary.
  **(verify)**
- Without PRF, a passkey can only log in. A new device would still need the
  account key to decrypt data, so passkeys alone save little.
- Losing the Apple ID (or leaving the Apple world) loses the passkey. Every
  account therefore needs a second way in: the account key.

### 3.3 Recommendation

**A first, B later as a convenience on top.**

- Phase "Account & sync" builds only the account key (simple, works on every
  device, no dependency).
- A later phase adds passkeys **with PRF** as a faster unlock on devices that
  support it. The account key remains the recovery method and the way to add
  devices where PRF is missing.
- The design below is ready for this: the encryption key is "wrapped"
  separately by each unlock method (§4.2), so adding a passkey does not
  re-encrypt any data.

### 3.4 Account key details (option A)

- **Creation** happens entirely on the device: 16 random bytes from
  `crypto.getRandomValues`. Nothing is sent before the user taps
  "Konto erstellen".
- **Format:** Crockford Base32 (no `I`, `L`, `O`, `U`; case-insensitive),
  26 characters + 2 check characters, shown in groups of four with a version
  prefix: `ASC1-7K3M-Q9TR-…`. The check characters catch typos before any
  request is made. Implemented in ~30 lines (`src/account/account-key.ts`), no
  word list needed. (Alternative: 12 words from a word list – easier to write
  down, but needs a bundled English list and German users gain little.)
- **Everything else is derived from it** with HKDF-SHA-256 (WebCrypto):

  | Derived value | HKDF `info`      | Used for                                                          |
  | ------------- | ---------------- | ----------------------------------------------------------------- |
  | `accountId`   | `ascend/v1/id`   | 16 bytes, hex. Public identifier the server uses as the row key   |
  | `authKey`     | `ascend/v1/auth` | Proves possession at login. Server stores only `SHA-256(authKey)` |
  | `wrapKey`     | `ascend/v1/wrap` | Unwraps the data key (§4.2). **Never leaves the device**          |

  So the user handles exactly one string. The server can never derive
  `wrapKey` from what it stores. A fast hash is fine here because the input is
  128 random bits, not a human password.

- **Saving the key:** after creation the app shows the key, offers "Als Datei
  speichern" (a small `.txt` download, created locally) and "Drucken", and
  asks the user to type the last group to confirm before the account is
  created on the server.
- **Adding a device:** enter the key (or paste it from a password manager).
  Later, with the barcode scanner from Phase 4, a logged-in phone can show
  the key as a QR code for another phone.
- **Multiple devices** are simply several sessions of the same account.
  Settings shows "Geräte" with a locally chosen name per session (stored
  encrypted) and a "Abmelden" button per device.
- **Lost key, at least one device still logged in:** Settings → "Neuen
  Kontoschlüssel erstellen" creates a new key, re-wraps the data key and
  replaces `authHash` on the server. No data is re-encrypted.
- **Lost key and all devices:** the server data is unreadable, by design.
  The user creates a new account. A JSON backup (Phase 3) is still the
  independent safety net; the UI says this plainly when the account is
  created.
- **Deleting the account:** one button, one request; the server deletes all
  rows immediately. Local data stays on the device.

### 3.5 Sessions

After login the server returns a random session token (32 bytes). The server
stores only its SHA-256 hash, the account ID and the creation **day** (not the
time). The device stores the token in IndexedDB (`syncState`, §5.4). Tokens
don't expire automatically while used; a session unused for 12 months is
removed by a daily cleanup (open detail, §11 note).

### 3.6 When does the app talk to the server?

The old rule "every request is triggered by the user" needs one explained
exception: once the user has created or joined an account, **sync runs on its
own**, because that is what the user asked for by switching it on.

| Option                                                                              | Privacy                                                                                | Convenience                            |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------- |
| A. Sync immediately after every change                                              | The server (and Cloudflare) can see the minute of every logged meal from request times | Highest                                |
| **B. Sync on app start, on returning to the app, and ~2 min after the last change** | Request times still show roughly when the app is used, but fewer and coarser           | High                                   |
| C. Only a "Jetzt synchronisieren" button                                            | Best                                                                                   | Low; users forget, devices drift apart |

**Recommendation: B**, plus the manual button and a setting "Automatisch
synchronisieren" (default on after joining an account). No push
notifications, no background sync API (unreliable on iOS anyway).

## 4. Sync and encryption

### 4.1 Overview

```
Device A (IndexedDB) ──encrypt──▶  server: { accountId, rid, seq, blob }  ◀──encrypt── Device B
              ◀──decrypt──  "give me everything after seq N"  ──decrypt──▶
```

- Every local record (food, entry, goal, setting) becomes one encrypted
  **blob** on the server.
- The server gives each stored blob an increasing number `seq` per account.
  A device remembers the highest `seq` it has seen and asks only for newer
  ones. This is the whole protocol.

### 4.2 Keys

| Key                         | What it is                                                             | Where it lives                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data key (DK)**           | Random AES-256-GCM key, created once per account on the first device   | Device: IndexedDB as a **non-extractable** `CryptoKey` (script can use it, not read its bytes). **(verify** structured-clone of `CryptoKey` in Safari IndexedDB) |
| Wrapped DK                  | DK encrypted with `wrapKey` (from the account key)                     | Server, so a new device can fetch and unwrap it                                                                                                                  |
| Wrapped DK (passkey, later) | DK encrypted with a key from the passkey's PRF output, one per passkey | Server, next to the credential ID                                                                                                                                |
| `idKey`                     | HKDF from DK, `info = ascend/v1/rid`, for HMAC-SHA-256                 | Derived on the device                                                                                                                                            |

Why a separate data key: changing the account key or adding a passkey only
re-wraps 32 bytes instead of re-encrypting all data.

### 4.3 What a blob contains

- **Record ID on the server (`rid`):** `HMAC(idKey, table + ":" + key)`,
  hex. Reason: some keys are meaningful (goals use the date `validFrom`,
  settings use names like `energyUnit`); hashing hides them.
- **Plaintext before encryption:**
  `{ v: 1, table, key, deleted: boolean, updatedAt, deviceId, record? }`
  (`record` absent when `deleted`).
- **Padding:** the JSON is padded with spaces to the next multiple of 256
  bytes, so blob sizes don't reveal e.g. how long a food name is.
- **Encryption:** AES-256-GCM, random 12-byte IV per blob, additional
  authenticated data = `accountId + rid`, so the server cannot swap blobs
  between records or accounts unnoticed. Stored as `version byte | IV |
ciphertext`.
- Deletes and updates look identical to the server.

### 4.4 Conflicts

Most data is append-mostly: entries are created once and rarely changed on two
devices at the same time. UUIDs (Phase 2, D5) already guarantee that new
records from two devices never collide.

| Option                                                                                                                            | Complexity        | Behaviour                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| **A. Last writer wins per record** using `updatedAt`, tie-break by `deviceId`; plus a conditional write on the server (`baseSeq`) | Low               | If the same entry is edited on two devices while offline, the later edit wins completely. Never loses whole records. |
| B. Per-field merge (amount from one device, label from the other)                                                                 | Medium            | Saves rare double edits; much more code and tests                                                                    |
| C. CRDT library (Automerge, Yjs)                                                                                                  | High + dependency | Perfect merges; large dependency, binary formats, hard to read                                                       |

**Recommendation: A.**

Sync run (one function, easy to test):

1. **Pull:** `GET /api/sync?since=<lastSeq>` in pages. For each blob: decrypt;
   if the local record has no pending change, apply it (put or delete). If it
   has a pending change, keep whichever `updatedAt` is newer (equal →
   larger `deviceId`); if the remote one wins, drop the local pending change.
   Save the new `lastSeq`.
2. **Push:** for every pending change, read the **current** local record (or
   note that it is gone → tombstone), encrypt, send
   `{ rid, baseSeq, blob }`. `baseSeq` is the `seq` this device last saw for
   that `rid` (or 0). The server writes only if its current `seq` for the
   `rid` still equals `baseSeq`; otherwise it answers "conflict" for that
   record and the client runs step 1 again. This closes the race where two
   devices push at nearly the same moment.
3. Remove the pushed items from the outbox.

Known limit: `updatedAt` comes from the device clock. A device whose clock is
hours wrong can win or lose a double edit wrongly. For one person's food log
this is acceptable; hybrid logical clocks would fix it at the cost of
readability.

Deletes: the server keeps tombstones (encrypted, see §4.3) **forever** – they
are small, and pruning them would force devices offline for a long time into a
full re-download. A food deleted on one device while an entry still points to
it is harmless: entries contain a snapshot.

### 4.5 Offline queue (outbox)

| Option                                                                                    | Notes                                                                                                                                                             |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. `outbox` table with primary key `[table+key]`**: "this record changed", nothing else | Writing the same record ten times offline leaves one row. The push reads the current record, so no stale copies. Deletions need no `deletedAt` in the main tables |
| B. `syncedAt` / dirty flag on every record                                                | Every query and index changes; a hard delete leaves nothing to sync → would need soft delete everywhere (rejected in Phase 2, D10)                                |
| C. Full change log (every operation with its data)                                        | Grows without limit; replays history that sync doesn't need                                                                                                       |

**Recommendation: A.** Phase 2's decision "hard delete, no `deletedAt`" stays
valid: tombstones exist only in the outbox (until pushed) and on the server.

How changes get into the outbox:

| Option                                                                                                                                                                                                    | Notes                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. One small module `src/db/write.ts`** with `saveRecord(table, record)` and `deleteRecord(table, key)`; it writes the record **and** the outbox row in the same Dexie transaction. All features use it | Explicit and readable. A unit test checks that every write path goes through it (and lint can forbid direct `.put`/`.delete` outside `src/db/`) |
| B. Dexie hooks (`creating`, `updating`, `deleting`)                                                                                                                                                       | Cannot be forgotten, but "magic": a beginner sees a `put` and doesn't know a second write happens                                               |
| C. Dexie DBCore middleware                                                                                                                                                                                | Most powerful, hardest to read                                                                                                                  |

**Recommendation: A.** Introduce `write.ts` already in **Phase 3** (without
the outbox). Then the sync phase changes one file instead of every feature.

The outbox is written **always** (with or without account): one code path,
and its size is bounded by the number of records. When the user creates or
joins an account, all existing records are added to the outbox once.

### 4.6 Data that is not synced

- `syncState` (session token, `lastSeq`, `deviceId`, data key): per device.
- Open Food Facts cache (Phase 4): can be fetched again; only foods the user
  saved as their own are synced. (Final decision in the Phase 4 design.)
- Data from the Strava **API** (§6.2): Strava's terms limit caching to
  7 days, so it stays local and expires.
- Settings that only make sense per device: none today. `SettingsMap` gets a
  comment listing device-only keys when the first one appears.

## 5. Dexie schema changes

### 5.1 Version 2 (sync phase)

```ts
db.version(2).stores({
  // "This record changed and must be pushed." Primary key [table+key]:
  // writing the same record again replaces the row.
  outbox: "[table+key], changedAt",
  // Device-only state: deviceId, accountId, session token, lastSeq,
  // seq per rid, data key. Never synced, never exported.
  syncState: "key",
});
```

| Table       | Row shape                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------ |
| `outbox`    | `{ table: 'foods' \| 'entries' \| 'goals' \| 'settings'; key: string; changedAt: string }` |
| `syncState` | `{ key: string; value: unknown }` with typed helpers like `settings` (Phase 2, D9)         |

The per-`rid` `seq` (for `baseSeq`) can live in a third small table
`remoteSeq: 'rid'` if the implementer prefers that over one large
`syncState` value; decision left to the implementation plan.

### 5.2 Migration

- **No `upgrade()` function needed**: existing tables don't change, only two
  new tables appear. Old version-1 data stays as it is.
- Existing records enter the outbox when the user **turns sync on**, not
  during the upgrade (otherwise every user without an account would carry a
  full outbox for no reason – harmless, but confusing).
- JSON import (Phase 3) writes through `write.ts`, so imported records are
  synced too.
- Test (rule 4 of §6.7 in the Phase 2 design): open a v1 database with v1
  data under v2, check data unchanged and both new tables empty.

### 5.3 Small additions before sync (no schema version needed)

Unindexed fields need no Dexie version (Phase 2, §6.7 rule 2):

- `Entry.loggedTzOffset?: number` – minutes from `getTimezoneOffset()` at
  logging time. Needed for "when do you log" statistics (§7). **Add it in
  Phase 3**, so the history is complete from the first real entry.
- `Entry.createdAt?`: not needed; `loggedAt` already is the creation instant.

### 5.4 JSON / CSV export

Unchanged. Export is a local dump of `foods`, `entries`, `goals`, `settings`;
`outbox` and `syncState` are **never** exported (they contain the session
token and the data key). The server never offers a plaintext export.

## 6. Server

### 6.1 Hosting options

| Option                                                                                                             | Complexity                                                          | Privacy                                                                                   | Cost / ops                                            | Beginner readability                |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------- |
| **A. Cloudflare Pages Functions (or Workers with static assets) + D1 (SQLite), same origin as the app (`/api/*`)** | Low: one SQL database, ~5 routes, no servers to maintain            | Cloudflare terminates TLS and sees IPs and request metadata (§6.4); bodies are ciphertext | Free tier likely enough for personal use; no patching | High: plain `fetch` handler + SQL   |
| B. Cloudflare Workers + Durable Objects (one object per account, SQLite storage)                                   | Medium: extra concept (objects, stubs); natural per-account locking | Same as A                                                                                 | Similar                                               | Medium                              |
| C. Self-hosted: small Node server + SQLite behind Caddy on a VPS or home server                                    | Medium–high: TLS, OS updates, backups, uptime, firewall             | Best control: no third party sees traffic (except the VPS provider); own log settings     | VPS ~5 €/month or own hardware; ops work is ongoing   | High code, but ops knowledge needed |

R2 (object storage) is not needed: blobs are small (hundreds of bytes).

**Recommendation: A.** Reasons:

- **Same origin**: the API lives under the app's own domain, so the CSP keeps
  `connect-src 'self'`, no CORS, no second domain.
- One provider for frontend and backend; deploys like the frontend.
- D1 is SQLite, and the server stores only opaque blobs, so moving to option
  C later is a copy of one SQLite database plus a small adapter (keep all SQL
  in one file, `server/storage.ts`).
- Durable Objects (B) become interesting only if many users sync heavily;
  the conditional write (`baseSeq`) already gives the needed consistency
  with D1.

Code location: a new top-level `server/` folder (or `functions/` if Pages
Functions require that name), separate from `src/`, with its own tests.
`CLAUDE.md`'s directory list must be extended.

### 6.2 Tables (D1 sketch)

```sql
CREATE TABLE accounts (
  id            TEXT PRIMARY KEY,   -- accountId (hex, derived from the account key)
  auth_hash     TEXT NOT NULL,      -- SHA-256(authKey)
  wrapped_dk    BLOB NOT NULL,      -- data key, wrapped by wrapKey
  next_seq      INTEGER NOT NULL DEFAULT 1,
  created_day   TEXT NOT NULL,      -- 'YYYY-MM-DD' only, for cleanup
  last_used_day TEXT NOT NULL
);
CREATE TABLE records (
  account_id TEXT NOT NULL,
  rid        TEXT NOT NULL,         -- HMAC, opaque
  seq        INTEGER NOT NULL,
  blob       BLOB NOT NULL,         -- encrypted, padded
  PRIMARY KEY (account_id, rid)
);
CREATE INDEX records_by_seq ON records (account_id, seq);
CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL,
  device_blob BLOB,                 -- encrypted device name
  created_day TEXT NOT NULL,
  last_used_day TEXT NOT NULL
);
-- Later: passkeys (credential_id, account_id, public_key, sign_count, wrapped_dk)
```

Deliberately missing: email, name, IP address, user agent, exact timestamps
of writes.

### 6.3 Routes

| Route                   | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `POST /api/account`     | Create: `{ accountId, authKey, wrappedDk }` → session token         |
| `POST /api/session`     | Log in: `{ accountId, authKey }` → session token + `wrappedDk`      |
| `DELETE /api/session`   | Log out this device                                                 |
| `GET /api/sync?since=N` | Pull blobs with `seq > N` (paged, e.g. 500)                         |
| `POST /api/sync`        | Push `[{ rid, baseSeq, blob }]` → new seqs or "conflict" per record |
| `PUT /api/account/key`  | Replace `auth_hash` + `wrappedDk` (new account key)                 |
| `DELETE /api/account`   | Delete account, sessions and records immediately                    |

The server compares `SHA-256(authKey)` with `auth_hash` in constant time.

### 6.4 What the server (and Cloudflare) can see

| Party                            | Sees                                                                                                                                   | Does not see                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| ascend server (our code, D1)     | Random account ID, number of records, padded blob sizes, the **day** of creation/last use                                              | Food names, amounts, dates, goals, settings, who the user is |
| Cloudflare (network + runtime)   | IP addresses, request times, paths, headers (incl. session token), sizes, TLS metadata; it runs our code and could in theory change it | Blob contents (encrypted before leaving the device)          |
| Operator of a self-hosted server | Same as Cloudflare for their machine                                                                                                   | Same                                                         |

Rules for our side:

- The Worker never writes IP addresses, user agents or timestamps to D1 or
  logs. No `console.log` of requests.
- Cloudflare **Workers Logs / observability off**, no Logpush, **Web
  Analytics off** (it injects a beacon), no Zaraz. Config is checked into
  the repo so `security-reviewer` can verify it.
- Abuse protection without storing IPs: Cloudflare's Rate Limiting binding
  (counters in memory, keyed by IP for account creation and by account ID for
  everything else), a per-account storage quota (e.g. 20 MB, far above
  normal use), and a body size limit.
- Inactive accounts: deleted after a long period without use (proposal:
  24 months, shown in the UI at creation). Needs the user's approval.

Honest limit, shown in the docs: **in any web app with end-to-end
encryption, whoever serves the JavaScript could ship code that steals keys.**
Here that is the ascend deployment on Cloudflare. The repo being open source,
a strict CSP and the service worker caching a fixed version reduce, but do not
remove, this risk. A native app (App Store phase) changes the trust model
only partly. The README should say this in one sentence.

### 6.5 Tooling note: Wrangler telemetry

Cloudflare's CLI `wrangler` (needed for deploys and local D1) **collects
anonymous usage metrics by default**. **(verify** current mechanism) This
conflicts with rule 1 (build scripts send no usage data). Mitigation: set
`send_metrics = false` in the checked-in Wrangler config and
`WRANGLER_SEND_METRICS=false` in every script, plus a hook check. If this
cannot be made reliable, deploy through Cloudflare's Git integration instead
of the local CLI.

## 7. Statistics: all local

The user wants "when do you log" (time-of-day distribution) and streaks. All
needed data is already on the device:

| Statistic                 | Computed from                                                                                     | Notes                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Logging time distribution | `Entry.loggedAt` (UTC instant) + `loggedTzOffset` (§5.3) → local hour 0–23 at the time of logging | Without the offset, a trip abroad would shift past entries. Shown as 24 bars (or 4 periods: morning/noon/evening/night) in SVG |
| Current / longest streak  | Distinct `Entry.date` values (`LocalDate`)                                                        | A streak counts consecutive days with ≥ 1 entry. Today without an entry does **not** break the streak until the day is over    |
| Days within goal          | Daily totals (`nutrientsForAmount`) vs the goal set valid on that day (D8)                        | Only for goals the user has set; no presets                                                                                    |
| Averages (week/month)     | Daily totals                                                                                      | "Incomplete" days (unknown nutrients) are marked, not counted as 0                                                             |

Implementation: pure functions in `src/domain/stats.ts` (input: arrays of
entries; output: plain numbers), tested with Vitest. A few thousand entries
are read with the `date` index in milliseconds; no precomputed tables needed.

With sync, each device computes its own statistics from the synced entries.
**Nothing is computed on or sent to the server.** Note the difference between
"when you log" (`loggedAt`) and "when you eat" (`date` + a future meal field);
the UI label must say "erfasst".

## 8. Device and service connections

### 8.1 Overview

| Source                          | Without server                                                                                                                       | Needs the backend for                                                    | Notes                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Strava – account export**     | Yes: user downloads the export ZIP from Strava, opens it in ascend; `activities.csv` (+ FIT/GPX) parsed locally                      | –                                                                        | Data the user exported themselves; Strava API terms don't apply. Primary path                                                                              |
| **Strava – API**                | No                                                                                                                                   | OAuth code → token exchange and token refresh need the **client secret** | Terms: cache ≤ 7 days, no AI/ML use of the data, new apps limited to **one athlete** until Strava approves more. Practically: only for the developer       |
| **Apple Health – export**       | Yes: Health app → "Alle Gesundheitsdaten exportieren" → `export.zip` (`export.xml`, often hundreds of MB) parsed locally in a stream | –                                                                        | Needs unzip (dependency proposal, §10) and a line-by-line parser (`<Record …/>` per line). Live access only with a native app (HealthKit, App Store phase) |
| Apple Health – Shortcuts bridge | Yes: an iOS Shortcut reads selected Health samples and saves a JSON file the user imports                                            | –                                                                        | Optional idea; no server, no App Store. To be explored by `researcher`                                                                                     |
| **Google Health API (Fitbit)**  | No                                                                                                                                   | OAuth with client secret; restricted scopes                              | Google verification and possibly a yearly security assessment for restricted health scopes; privacy policy required. Low priority (unchanged)              |

### 8.2 How the backend handles OAuth tokens

| Option                                                                                                                                                                                                                                                                                  | Privacy                                                                                | Features                                                                      | Complexity                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------- |
| **A. Stateless proxy**: server only adds the client secret to the token exchange/refresh and returns the tokens to the device. The device stores them in its encrypted, synced data (or device-only). API calls go through `/api/strava/*`, which forwards the token without storing it | Server never keeps tokens; E2EE stays intact                                           | Fetch only while the app is open and the user taps "Importieren"; no webhooks | Low                          |
| B. Server stores tokens, encrypted with a server-side key (Worker secret)                                                                                                                                                                                                               | Server (and anyone with the Worker secret) can read the user's Strava data at any time | Background fetch, webhooks                                                    | Medium                       |
| C. Server stores tokens wrapped with the user's data key                                                                                                                                                                                                                                | Like A at rest                                                                         | Still no background use (server cannot unwrap)                                | Medium; gains nothing over A |

**Recommendation: A.** It matches "requests only by user action" and "server
is a mailbox". The client secret is a Worker secret (`wrangler secret put`),
never in the repo. The OAuth redirect is a top-level navigation to Strava, so
the CSP's `connect-src` stays `'self'`. **(verify** whether Strava supports
PKCE or browser CORS – if it ever allows the exchange without a secret, the
proxy disappears.)

Strava API activities are stored in a device-only table with an expiry date
(fetched + 7 days) and are not synced. Activities imported from the export
file are the user's own data and are synced like everything else.

### 8.3 Order

File imports need no account and can be built at any time after Phase 3.
The Strava API comes after the account phase and is optional.

## 9. Changes to the privacy rules and docs

Not applied by this document. `docs-writer` (README, ROADMAP) and the main
session (CLAUDE.md) apply them after the user approves.

### 9.1 Draft for `CLAUDE.md` – section 「隐私与安全（硬性规则）」

```markdown
## 隐私与安全（硬性规则）

1. **零遥测**：应用、服务器、构建和部署脚本以及依赖都不得发送使用数据；没有第三方追踪、分析或崩溃上报 SDK。Cloudflare 的 Web Analytics、Workers Logs、Logpush 保持关闭；wrangler 的 metrics 必须关闭。
2. **本地优先**：数据首先存在设备的 IndexedDB 中。应用在没有账号、没有网络时必须完整可用；账号是可选的。
3. **隐私优先的账号**：账号不需要邮箱、姓名、电话或任何个人信息。账号只由设备本地生成的随机「账号密钥」（以后可加 passkey）构成。
4. **端到端加密**：同步到服务器的数据必须在设备上用 AES-GCM 加密；服务器只存密文、随机账号 ID 和认证哈希，永远看不到明文和密钥。服务器不做任何基于用户数据的计算；统计只在设备本地计算。
5. **最小化元数据**：服务器不保存 IP、User-Agent、精确时间戳；只保存日期粒度的创建/最后使用日。用户可以随时删除账号，服务器立即删除全部数据。
6. **网络请求**：外部请求（Open Food Facts、Strava 等）只能由用户主动触发；输入时不自动搜索，先查本地缓存。唯一例外：用户开启账号同步后，应用可以在启动、回到前台和修改后自动与自己的服务器同步（可在设置中关闭）。第三方服务的 OAuth 令牌不在服务器上保存（无状态代理）。
7. **不用 CDN**：字体用系统字体，wasm、图标等资源随应用一起部署。API 与应用同源（`/api/*`），CSP 保持 `connect-src 'self'`。
8. **密钥不进仓库**：代码和 Git 历史中不得有 API 密钥、client secret、token 或 `.env`；服务器密钥只用 `wrangler secret` 等托管方式保存。
9. **仓库中没有个人数据**：（原第 6 条，不变）

任何可能导致用户未触发、且不属于已开启同步的网络请求的改动：先停下来问用户。
```

### 9.2 Draft for the README "Privacy" table

```markdown
## Privacy

| Rule                            | What it means                                                                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No telemetry                    | ascend never sends usage data, crash reports or analytics – not from the app, not from the server.                                                       |
| Works offline, account optional | Everything is stored on your device first. Without an account ascend works fully offline, forever.                                                       |
| An account without an email     | If you want sync, ascend creates a random account key on your device. No email, no name, no phone number – nothing about you.                            |
| End-to-end encrypted sync       | Your data is encrypted on your device before it is synced. The server stores only encrypted data it cannot read. Statistics are computed on your device. |
| Minimal server records          | The server keeps no IP addresses and no exact times. Deleting your account deletes everything on the server immediately.                                 |
| You trigger every request       | ascend contacts Open Food Facts or Strava only when you tap search, scan or import. Sync runs automatically only after you turn it on.                   |
| Nothing from a CDN              | Fonts are system fonts; every other asset ships with the app.                                                                                            |

If you lose your account key and all your devices, nobody can recover your
synced data – not even us. Keep the key somewhere safe, and keep a JSON
backup. As with every web app, encryption relies on the app code delivered by
the ascend server being honest; the code is open source.
```

### 9.3 Other places that mention "no account"

To be updated together (by `docs-writer` / implementer in the right phase):
ROADMAP Phase 0 bullet "Data: local only, no account", the comment at the top
of `src/db/db.ts`, the manifest/`app.description` text "ohne Konto" in
`src/i18n/de.ts`, and the "Later" item 7 in the ROADMAP.

## 10. Dependency proposals (not approved, for later phases)

| Package                                              | Purpose                                            | License          | Size (approx., **verify**)     | Network / telemetry                                                                             | Phase          |
| ---------------------------------------------------- | -------------------------------------------------- | ---------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- | -------------- |
| `wrangler` (dev)                                     | Local D1, deploy of the API                        | MIT / Apache-2.0 | Large dev tool (tens of MB)    | **Usage metrics on by default → must be disabled** (§6.5); deploys contact Cloudflare by design | Account & sync |
| `@simplewebauthn/browser` / `@simplewebauthn/server` | Passkey registration/login, server verification    | MIT              | Browser part small (few kB gz) | None known                                                                                      | Passkeys       |
| `fflate`                                             | Unzip Strava / Apple Health exports in the browser | MIT              | ~10 kB gz                      | None (pure JS)                                                                                  | File imports   |

Not needed: any crypto library (WebCrypto), any sync/CRDT library, any HTTP
framework for the Worker (a plain `fetch` handler with a small route table is
enough for 7 routes; Hono (MIT) would be the fallback if routing grows).

## 11. Proposed phase plan

Principle: **first local and stable, then account.** Reasons: (1) sync
freezes the data format – every later change must be migrated on all devices
**and** inside encrypted server blobs, so the model should settle first;
(2) the user gets a usable app on the iPhone sooner; (3) the account stays
truly optional because the app already works without it. The only cost:
Phase 3 must prepare two small things (`write.ts`, `loggedTzOffset`).

| Phase                     | Content                                                                                                                 | Depends on               | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3 – Core (local)          | As in ROADMAP, **plus**: all writes through `src/db/write.ts`; `Entry.loggedTzOffset`; privacy texts updated (§9)       | 2                        | As before; plus: no feature calls `put`/`delete` outside `src/db/`; new entries have `loggedTzOffset`                                                                                                                                                                                                                                                                                              |
| 4 – Online food data      | Unchanged                                                                                                               | 3                        | Unchanged; decision which OFF data syncs (§4.6)                                                                                                                                                                                                                                                                                                                                                    |
| 5 – Insights (local)      | Streaks, logging-time distribution, averages, days within goal                                                          | 3                        | Pure functions with unit tests (incl. DST day, trip across time zones, today-without-entry streak rule); SVG charts accessible (text alternative); **no network request** in Playwright                                                                                                                                                                                                            |
| 6 – Account & sync        | Backend (Pages Functions + D1), account key, E2EE, outbox/sync, devices list, new account key, delete account, Dexie v2 | 3 (4 for OFF sync rules) | Two browser contexts (iPhone + desktop project) log offline, reconnect, end with identical data; concurrent edit → newer wins; delete syncs; D1 contains no plaintext (test reads raw rows and searches for a known food name); no IP/UA/time stored; app works with server unreachable; without account no request to `/api/*`; Wrangler metrics off; security-reviewer passes; real iPhone check |
| 7 – Activity file import  | Strava export ZIP, Apple Health export, imported activities synced                                                      | 3 (6 optional)           | 500 MB Health export parses on iPhone without crash (streaming); only user-chosen files read; no network                                                                                                                                                                                                                                                                                           |
| 8 – Passkeys              | Passkey login + PRF unlock where supported; account key stays as recovery                                               | 6                        | Works in the installed iPhone PWA and desktop Safari/Chrome; graceful fallback to account key when PRF is missing; adding/removing passkeys doesn't re-encrypt data                                                                                                                                                                                                                                |
| 9 – Strava API (optional) | Stateless OAuth proxy, manual import, 7-day expiry                                                                      | 6                        | Client secret only as Worker secret; server stores no tokens; API data deleted after 7 days and never synced; no AI use; attribution as required by Strava                                                                                                                                                                                                                                         |
| Later                     | Workout log, more languages, App Store version (HealthKit, Health Connect), Google Health API                           |                          |                                                                                                                                                                                                                                                                                                                                                                                                    |

Phases 5 and 7 are independent of the account and can swap places with 6
if the user wants sync sooner. Phase 6 must not start before Phase 3 is done.

## 12. Open questions for the user

1. **Login method:** start with an account key only (a random code the user
   saves; no email, works everywhere) and add passkeys later?
   _Recommended: yes (§3.3)._
2. **Account optional:** may the app keep working fully without an account,
   with the account only needed for sync and service connections?
   _Recommended: yes – keeps the offline promise and the privacy story simple._
3. **Server hosting:** Cloudflare Pages Functions + D1 on the same domain as
   the app (simple, free tier, portable to self-hosting later), or self-hosted
   from the start? _Recommended: Cloudflare (§6.1 A), with Wrangler telemetry
   disabled and logs off._
4. **Phase order:** keep "local first" (Phase 3 core, 4 Open Food Facts,
   5 statistics) before account & sync (Phase 6)? _Recommended: yes; if sync
   is more urgent, move statistics after sync, but not sync before Phase 3._
5. **Strava:** primarily file import (export ZIP, no server, no limits), and
   the Strava API only as an optional extra for personal use because of the
   one-athlete limit and the 7-day rule? _Recommended: yes._

Smaller details to confirm in the Phase 6 plan (not asked now): deletion of
inactive accounts after 24 months; storage quota per account; sync timing
option B (§3.6).

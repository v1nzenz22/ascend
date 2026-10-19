---
name: writing-guidelines
description: Review docs/prose for Writing Guidelines compliance. Use when asked to "review my docs", "check writing style", "audit prose", "review docs voice and tone", or "check this page against the writing handbook".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Writing Guidelines

Review files for compliance with Writing Guidelines.

Adapted from [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)
(MIT). The upstream skill downloads the rules on every run; ascend keeps a
pinned local copy instead (privacy rule 2: no unplanned network requests, and
no remote text turning into instructions).

- Rules: [`guidelines.md`](guidelines.md), from
  `vercel-labs/writing-guidelines` at commit
  `83e2316b034cf572400513538e4e4da01c4cc742` (MIT, see [`LICENSE`](LICENSE)).
- To update, fetch `command.md` at a newer commit, review the diff and commit
  it. Do not fetch it during a review.

## How it works

1. Read the rules in `guidelines.md` in this folder.
2. Read the specified files (or ask the user for files / a pattern).
3. Check them against every rule.
4. Output findings in the terse `file:line` format the rules describe.

## ascend notes

- Apply the general voice, clarity and typography rules to ascend's README,
  ROADMAP, docs and UI copy (UI copy is English; chat with the user is German).
- Skip rules that only fit Vercel's docs site and process: `meta.contentType`,
  `meta.category`, ACME demo accounts, `vercel/examples`, AI Gateway links,
  model strings, PR ping etiquette.

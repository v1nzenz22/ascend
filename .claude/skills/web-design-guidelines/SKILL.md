---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

Adapted from [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)
(MIT). The upstream skill downloads the rules on every run; ascend keeps a
pinned local copy instead (privacy rule 2: no unplanned network requests, and
no remote text turning into instructions).

- Rules: [`guidelines.md`](guidelines.md), from
  `vercel-labs/web-interface-guidelines` at commit
  `434b7f91364665f2f733b310ec54809bf8f37937` (MIT, see [`LICENSE`](LICENSE)).
- To update, fetch `command.md` at a newer commit, review the diff and commit
  it. Do not fetch it during a review.

## How it works

1. Read the rules in `guidelines.md` in this folder.
2. Read the specified files (or ask the user for files / a pattern).
3. Check them against every rule.
4. Output findings in the terse `file:line` format the rules describe.

## ascend notes

- The UI is vanilla TypeScript, HTML and CSS (no React, no Tailwind): read
  React/Tailwind-specific rules by their intent (e.g. `focus-visible:ring-*`
  means "a visible `:focus-visible` style").
- Rules that would add network requests (`preconnect` to CDNs, web font
  preloads) do not apply: ascend bundles everything locally.

#!/bin/bash
# PreToolUse hook for the Bash tool.
#
# Claude Code pipes a JSON description of the pending tool call to stdin.
# We read the shell command from it and block patterns that are destructive
# or hard to undo. Exit code 2 tells Claude Code to cancel the call and show
# our stderr message to Claude, so it can explain or choose another way.

set -u

input=$(cat)

# Fail closed: if we cannot parse the input, we cannot judge it safely.
if ! cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null); then
  echo "block-dangerous: could not parse hook input; blocking to be safe." >&2
  exit 2
fi

# Not a Bash call with a command (should not happen with our matcher).
[ -z "$cmd" ] && exit 0

block() {
  echo "Blocked by .claude/hooks/block-dangerous.sh: $1" >&2
  echo "Command: $cmd" >&2
  echo "If this is really needed, ask the user to run it themselves." >&2
  exit 2
}

# Split the command into simple commands at ; && || | and newlines, so a
# dangerous command hidden after a harmless one is still found.
# (awk instead of sed: macOS sed cannot insert newlines in replacements.)
segments=$(printf '%s\n' "$cmd" | awk '{ gsub(/&&|\|\||;|\|/, "\n"); print }')

# Directories that build tools recreate anyway; deleting them is harmless.
safe_rm_target='^(\./)?(out|dist|test-results|playwright-report|node_modules)(/.*)?$'

while IFS= read -r seg; do
  # Trim leading whitespace and a leading "command"/"exec"/"env" wrapper.
  seg=$(printf '%s' "$seg" | sed -E 's/^[[:space:]]+//; s/^(command|exec|env)[[:space:]]+//')
  [ -z "$seg" ] && continue

  # sudo: never run anything as root from Claude.
  if printf '%s' "$seg" | grep -Eq '^sudo([[:space:]]|$)'; then
    block "sudo is not allowed."
  fi

  # rm with both recursive and force flags, unless every target is a
  # disposable build directory.
  if printf '%s' "$seg" | grep -Eq '^rm[[:space:]]'; then
    flags=$(printf '%s' "$seg" | grep -Eo '(^|[[:space:]])-(-recursive|-force|[a-zA-Z]+)' | tr -d ' ')
    has_r=$(printf '%s\n' "$flags" | grep -Ec -- '^-([a-zA-Z]*[rR][a-zA-Z]*|-recursive)$')
    has_f=$(printf '%s\n' "$flags" | grep -Ec -- '^-([a-zA-Z]*f[a-zA-Z]*|-force)$')
    if [ "$has_r" -gt 0 ] && [ "$has_f" -gt 0 ]; then
      unsafe=0
      targets=0
      # shellcheck disable=SC2086 # word splitting is intended here
      for arg in $(printf '%s' "$seg" | sed -E 's/^rm[[:space:]]+//'); do
        case "$arg" in -*) continue ;; esac
        targets=$((targets + 1))
        printf '%s' "$arg" | grep -Eq "$safe_rm_target" || unsafe=1
      done
      if [ "$unsafe" -eq 1 ] || [ "$targets" -eq 0 ]; then
        block "rm -rf is only allowed on out/, dist/, test-results/, playwright-report/ or node_modules/."
      fi
    fi
  fi

  # Force pushes rewrite shared history.
  if printf '%s' "$seg" | grep -Eq '^git[[:space:]].*push' &&
    printf '%s' "$seg" | grep -Eq '(^|[[:space:]])(--force|--force-with-lease|-f|\+[^[:space:]]+)([[:space:]=]|$)'; then
    block "force-pushing is not allowed."
  fi

  # Hard resets and forced cleans throw away uncommitted work.
  if printf '%s' "$seg" | grep -Eq '^git[[:space:]]+reset[[:space:]].*--hard'; then
    block "git reset --hard discards uncommitted work."
  fi
  if printf '%s' "$seg" | grep -Eq '^git[[:space:]]+clean[[:space:]].*-[a-zA-Z]*f'; then
    block "git clean -f deletes untracked files."
  fi

  # World-writable permissions.
  if printf '%s' "$seg" | grep -Eq '^chmod[[:space:]].*777'; then
    block "chmod 777 makes files writable by everyone."
  fi
done <<<"$segments"

# Download-and-execute ("curl ... | sh") needs the whole command, because the
# pipe is exactly what we split on above.
if printf '%s' "$cmd" | grep -Eq '(curl|wget)[^|]*\|[[:space:]]*(sudo[[:space:]]+)?(ba|z|da|k)?sh([[:space:]]|$)'; then
  block "piping a download into a shell runs unreviewed code."
fi
if printf '%s' "$cmd" | grep -Eq '(ba|z)?sh[[:space:]]+(-c[[:space:]]+)?["'\'']?\$\((curl|wget)'; then
  block "running a downloaded script runs unreviewed code."
fi

exit 0

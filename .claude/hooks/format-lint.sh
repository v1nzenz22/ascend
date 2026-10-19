#!/bin/bash
# PostToolUse hook for Edit / Write / MultiEdit.
#
# After Claude changes a file, format it with Prettier and auto-fix lint
# problems with ESLint. Remaining lint errors are reported back to Claude
# (exit code 2 + stderr) so it fixes them right away.
#
# If node or the tools are not installed, this hook does nothing.

set -u

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
bin="$project_dir/node_modules/.bin"

# Hooks do not load ~/.zshrc, so fnm's node may be missing from PATH.
# Fall back to fnm's default Node installation.
if ! command -v node >/dev/null 2>&1; then
  fnm_default="$HOME/.local/share/fnm/aliases/default/bin"
  [ -x "$fnm_default/node" ] && PATH="$fnm_default:$PATH"
fi
command -v node >/dev/null 2>&1 || exit 0

file=$(jq -r '.tool_input.file_path // empty' 2>/dev/null) || exit 0
[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

# Only touch files inside this project, never e.g. ~/.claude files.
case "$file" in
  "$project_dir"/*) ;;
  *) exit 0 ;;
esac

# Never format dependencies or build output.
case "$file" in
  "$project_dir"/node_modules/* | "$project_dir"/out/* | "$project_dir"/dist/*) exit 0 ;;
esac

if [ -x "$bin/prettier" ]; then
  case "$file" in
    *.ts | *.tsx | *.js | *.mjs | *.cjs | *.json | *.md | *.css | *.html | *.yml | *.yaml)
      "$bin/prettier" --write --log-level warn "$file" >&2 || true
      ;;
  esac
fi

if [ -x "$bin/eslint" ]; then
  case "$file" in
    *.ts | *.tsx | *.js | *.mjs | *.cjs)
      if ! output=$("$bin/eslint" --fix "$file" 2>&1); then
        echo "ESLint found problems in $file:" >&2
        echo "$output" >&2
        exit 2
      fi
      ;;
  esac
fi

exit 0

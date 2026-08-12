#!/usr/bin/env bash
# Dispatch to shared hooks-lib. $HOME resolves per-OS (/Users/<user> on macOS,
# /c/Users/<user> on Windows Git Bash). Falls back to the in-repo vendor
# implementation (.claude/scripts/hooks-lib/) when present. Guards the derived
# (gitignored) memory/INDEX.md / history/INDEX.md only. Since #735 the records.mjs
# outputs (.claude/INDEX.md, .claude/decisions/INDEX.md) are gitignored too, so
# they can no longer be staged accidentally and need no guard entry.
LIB="$HOME/dev/Claude/hooks-lib/pre-commit-index-guard.sh"
[ -f "$LIB" ] && exec bash "$LIB" "$@"
VENDOR="$(cd "$(dirname "$0")/.." && pwd)/scripts/hooks-lib/pre-commit-index-guard.sh"
[ -f "$VENDOR" ] && exec bash "$VENDOR" "$@"
exit 0

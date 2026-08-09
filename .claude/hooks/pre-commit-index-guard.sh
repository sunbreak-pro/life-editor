#!/usr/bin/env bash
# Dispatch to shared hooks-lib. $HOME resolves per-OS (/Users/<user> on macOS,
# /c/Users/<user> on Windows Git Bash). Falls back to the in-repo vendor
# implementation (.claude/scripts/hooks-lib/) when present. Guards the derived
# (gitignored) memory/INDEX.md / history/INDEX.md only — the tracked
# .claude/INDEX.md and .claude/decisions/INDEX.md are records.mjs outputs that
# SHOULD be committed, and are not this guard's target.
LIB="$HOME/dev/Claude/hooks-lib/pre-commit-index-guard.sh"
[ -f "$LIB" ] && exec bash "$LIB" "$@"
VENDOR="$(cd "$(dirname "$0")/.." && pwd)/scripts/hooks-lib/pre-commit-index-guard.sh"
[ -f "$VENDOR" ] && exec bash "$VENDOR" "$@"
exit 0

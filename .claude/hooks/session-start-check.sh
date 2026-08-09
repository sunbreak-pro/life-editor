#!/usr/bin/env bash
# Dispatch to shared hooks-lib. $HOME resolves per-OS (/Users/<user> on macOS,
# /c/Users/<user> on Windows Git Bash). Falls back to the in-repo vendor
# implementation (.claude/scripts/hooks-lib/) when present — informational only,
# so the vendor script is optional and the chain ends in a silent no-op.
LIB="$HOME/dev/Claude/hooks-lib/session-start-check.sh"
[ -f "$LIB" ] && exec bash "$LIB" "$@"
VENDOR="$(cd "$(dirname "$0")/.." && pwd)/scripts/hooks-lib/session-start-check.sh"
[ -f "$VENDOR" ] && exec bash "$VENDOR" "$@"
exit 0

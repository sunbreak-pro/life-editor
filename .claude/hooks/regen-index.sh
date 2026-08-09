#!/usr/bin/env bash
# Dispatch to shared hooks-lib. $HOME resolves per-OS (/Users/<user> on macOS,
# /c/Users/<user> on Windows Git Bash). Falls back to the in-repo vendor
# implementation (.claude/scripts/hooks-lib/) so remote/web sessions without
# hooks-lib still regenerate the derived INDEX views. No-op when neither exists.
LIB="$HOME/dev/Claude/hooks-lib/regen-index.sh"
[ -f "$LIB" ] && exec bash "$LIB" "$@"
VENDOR="$(cd "$(dirname "$0")/.." && pwd)/scripts/hooks-lib/regen-index.sh"
[ -f "$VENDOR" ] && exec bash "$VENDOR" "$@"
exit 0

#!/usr/bin/env bash
# Dispatch to shared hooks-lib. $HOME resolves per-OS (/Users/<user> on macOS,
# /c/Users/<user> on Windows Git Bash). Falls back to the in-repo vendor
# implementation (.claude/scripts/hooks-lib/) — this is a security hook
# (plaintext-secret detection on .mcp.json), so it must run everywhere; warn
# on stderr when neither exists so "protection is OFF" never goes silent.
LIB="$HOME/dev/Claude/hooks-lib/pre-commit-mcp-check.sh"
[ -f "$LIB" ] && exec bash "$LIB" "$@"
VENDOR="$(cd "$(dirname "$0")/.." && pwd)/scripts/hooks-lib/pre-commit-mcp-check.sh"
[ -f "$VENDOR" ] && exec bash "$VENDOR" "$@"
echo "[pre-commit-mcp-check] WARNING: neither hooks-lib nor vendor found — plaintext-secret check is NOT running on this machine" >&2
exit 0

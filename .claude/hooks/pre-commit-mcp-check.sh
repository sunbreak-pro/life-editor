#!/usr/bin/env bash
# Dispatch to shared hooks-lib. $HOME resolves per-OS (/Users/<user> on macOS,
# /c/Users/<user> on Windows Git Bash), replacing the old absolute symlink that
# only worked on one machine.
# Security guard (plaintext-secret detection): unlike the other wrappers, warn
# on stderr when hooks-lib is absent so "protection is OFF" never goes silent.
LIB="$HOME/dev/Claude/hooks-lib/pre-commit-mcp-check.sh"
if [ ! -f "$LIB" ]; then
  echo "[pre-commit-mcp-check] WARNING: $LIB not found — plaintext-secret check is NOT running on this machine" >&2
  exit 0
fi
exec bash "$LIB" "$@"

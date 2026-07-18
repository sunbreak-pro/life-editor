#!/usr/bin/env bash
# Dispatch to shared hooks-lib. $HOME resolves per-OS (/Users/<user> on macOS,
# /c/Users/<user> on Windows Git Bash), replacing the old absolute symlink that
# only worked on one machine. No-op when hooks-lib is absent so a machine
# without it never fails SessionStart/PreToolUse.
LIB="$HOME/dev/Claude/hooks-lib/session-start-check.sh"
[ -f "$LIB" ] || exit 0
exec bash "$LIB" "$@"

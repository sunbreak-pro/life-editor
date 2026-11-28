#!/usr/bin/env bash
# Collect everything Claude Design needs into one upload folder.
# Usage (from the repo root):
#   bash .claude/docs/design/prototype/make-bundle.sh [capture-dir]
# capture-dir defaults to shots/2026-11-25-design-capture (the capture the
# README's table describes); without it, the newest shots/*-design-capture.
# Output: shots/claude-design-bundle/ (untracked; screenshots never enter git).
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
src="$root/.claude/docs/design/prototype"
out="$root/shots/claude-design-bundle"

capture="${1:-}"
if [ -z "$capture" ] && [ -d "$root/shots/2026-11-25-design-capture" ]; then
  capture="$root/shots/2026-11-25-design-capture"
fi
if [ -z "$capture" ]; then
  capture="$(ls -d "$root"/shots/*-design-capture 2>/dev/null | sort | tail -n 1 || true)"
fi

rm -rf "$out"
mkdir -p "$out/screenshots"

cp "$src/00-context.md" "$src/01-screens.md" "$src/02-interactions.md" \
  "$src/03-mock-data.json" "$out/"
cp "$root/shared/src/styles/tokens.css" "$out/tokens.css"

if [ -n "$capture" ] && [ -d "$capture" ]; then
  find "$capture" -maxdepth 1 -name '*.png' -exec cp {} "$out/screenshots/" \;
  echo "screenshots: $(ls "$out/screenshots" | wc -l) from $capture"
else
  echo "screenshots: none (no *-design-capture folder found)"
fi

echo "bundle ready: $out"
ls -1 "$out"

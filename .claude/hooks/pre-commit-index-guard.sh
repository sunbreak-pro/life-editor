#!/bin/bash
# Pre-commit hook: keep the derived INDEX.md files OUT of git, automatically.
# Registered as Claude Code PreToolUse matcher=Bash. Fires on every Bash call;
# filters to `git commit` and self-heals if INDEX would remain tracked.
#
# Strategy = AUTO-FIX (not block): if .claude/{memory,history}/INDEX.md is still
# in the index at commit time (force-added, or resurrected by a merge commit on a
# stale branch), this hook runs `git rm --cached` (NON-destructive — keeps the
# working file, which regen-index.sh rebuilds) so the commit proceeds WITHOUT it.
# Never blocks the workflow; INDEX simply can never end up committed.
#
# Why this matters: INDEX.md is a derived aggregate view (SSOT = each chat-*.md).
# Tracking it was the #1 parallel-chat merge-conflict source. See CLAUDE.md §9.
#
# `git ls-files` reflects the staging area, so:
#   - a removal commit (`git rm --cached` already done) → INDEX absent → no-op.
#   - a normal commit (INDEX untracked+ignored)        → INDEX absent → no-op.
#   - force-add / merge resurrection                   → INDEX present → auto-removed.

set -e

INPUT=$(cat)

COMMAND=$(printf '%s' "$INPUT" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get("tool_input", {}).get("command", ""))
except Exception:
    print("")
' 2>/dev/null || true)

# Only act on git commit invocations.
if ! printf '%s' "$COMMAND" | grep -qE '(^|;|&&|\|\|)[[:space:]]*git[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"

# Files still tracked (present in the index after any prior staging in this commit).
TRACKED=$(git -C "$ROOT" ls-files -- \
  .claude/memory/INDEX.md .claude/history/INDEX.md 2>/dev/null || true)

if [ -n "$TRACKED" ]; then
  git -C "$ROOT" rm --cached --quiet --ignore-unmatch \
    .claude/memory/INDEX.md .claude/history/INDEX.md >/dev/null 2>&1 || true
  cat >&2 <<EOF
[pre-commit-index-guard] NOTE: auto-unstaged a git-ignored derived INDEX so this
commit stays clean. Affected:
$(printf '    %s\n' $TRACKED)
  INDEX.md is a derived view (SSOT = chat-*.md), kept out of git to prevent
  parallel-chat merge conflicts. Working copies are untouched (regen-index.sh
  rebuilds them). If you reached here from a merge that resurrected INDEX, this
  also records its removal. See CLAUDE.md §9 / .claude/hooks/regen-index.sh.
EOF
fi

exit 0

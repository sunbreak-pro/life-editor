#!/bin/bash
# Pre-commit hook: detect plaintext tokens in .mcp.json.
# Registered as Claude Code PreToolUse matcher=Bash.
# Fires on every Bash invocation; filters to git commit and aborts if secrets leaked.
#
# Background: 2026-05-17 incident where .mcp.json was committed with plaintext PAT,
# triggering GitHub Push Protection. Tokens must remain as ${VAR_NAME} references.

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

# Only inspect on git commit invocations (allow `git commit ...`, `git commit-tree`).
# Match start-of-string `git commit` followed by space, end, or `--`.
if ! printf '%s' "$COMMAND" | grep -qE '(^|;|&&|\|\|)[[:space:]]*git[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi

# Locate .mcp.json relative to project dir if available, else cwd.
ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
MCP_JSON="$ROOT/.mcp.json"

if [ ! -f "$MCP_JSON" ]; then
  exit 0
fi

# Detect plaintext token literals. Pattern: a known secret-bearing field whose value
# starts with a well-known token prefix instead of ${...}.
#
# Patterns of concern (extend as new providers appear):
#   sbp_           Supabase personal access token
#   sk-            OpenAI / Anthropic API key style
#   ghp_           GitHub classic PAT
#   gho_/ghu_/ghs_ GitHub OAuth/user/server tokens
#   github_pat_    GitHub fine-grained PAT
#   xoxb-/xoxp-    Slack
if grep -qE '"[A-Z][A-Z0-9_]*(TOKEN|KEY|SECRET|PASSWORD)":[[:space:]]*"(sbp_|sk-|ghp_|gho_|ghu_|ghs_|github_pat_|xoxb-|xoxp-)' "$MCP_JSON" 2>/dev/null; then
  cat >&2 <<EOF
[pre-commit-mcp-check] BLOCKED: .mcp.json contains plaintext secret.

  File: $MCP_JSON
  Required form: "TOKEN_NAME": "\${VAR_NAME}"
  Forbidden:     "TOKEN_NAME": "sbp_..." / "sk-..." / "ghp_..." etc.

  Reason: .mcp.json is tracked by git. Plaintext secrets cause immediate repo
  leakage. Supply the real value via shell env var (\$VAR_NAME) instead.

  See: .claude/CLAUDE.md §9 "作業時の鉄則" / feedback_mcp_json_token_placeholder.md
EOF
  exit 1
fi

exit 0

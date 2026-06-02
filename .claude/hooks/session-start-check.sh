#!/usr/bin/env bash
#
# SessionStart hook: .session-name 整合性検査（informational only・即 exit）
#
# 目的:
#   - 新規チャット開始時に .claude/comm/.session-name が未宣言／前チャットの値を
#     引き継いだ状態のまま作業が始まることを防ぐ
#   - 不整合があれば warning を outbox + 標準出力に出すだけ。セッションは止めない
#   - 警告を見たらユーザーは `echo <name> > .claude/comm/.session-name` で宣言する
#
# 検査ロジック:
#   A. 空文字 → 未宣言
#   B. "chat-" プレフィックス → task-tracker 仕様違反
#   C. "/", ".", "..", 空白を含む → パストラバーサル / 不正文字
#   C. 英数字・ハイフン・アンダースコア (`^[a-zA-Z0-9_-]+$`) 以外を含む
#      → 不正文字 / パストラバーサル (allowlist 方式)
#   D. 上記いずれでもないが .session-name の mtime が HEAD commit より 3 日以上古い
#      → 別チャット作業を引き継いだ可能性（要確認）
#   E. .claude/worktrees/*/ のいずれかに 24 時間以上 dirty 放置された worktree がある
#      → 別チャットの未 commit 作業が滞留している可能性（持ち主確認）
#   F. `.session-branch` が宣言されていて、現在の git branch と一致しない
#      → "1 chat = 1 worktree = 1 branch" ルール違反（CLAUDE.md §7.4）
#      → 担当 branch と異なる worktree で起動した可能性
#
# 起動条件:
#   .claude/settings.json の hooks.SessionStart に登録される
#

set -uo pipefail

# ROOT を動的検出（worktree 対応）。git toplevel が取れなければ
# main repo パスへフォールバック。これにより worktree 配下から
# Claude 起動された場合に worktree の .session-name / .session-branch を読む
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "/Users/newlife/dev/apps/life-editor")

# per-chat 機構が有効か判定。無効なら警告対象外なので即終了。
# マーカーは INDEX.md（旧 tracked / 現在は git 非追跡の派生物）または chat-*.md（tracked・SSOT）。
# INDEX.md は .gitignore 化されたため新規 clone で regen 前に不在のことがある。追跡される
# chat-*.md も見ることで regen-index.sh の実行順 / 成否に依存せず per-chat を検出する。
if [ ! -d "${ROOT}/.claude/memory" ]; then
  exit 0
fi
if [ ! -f "${ROOT}/.claude/memory/INDEX.md" ] && ! ls "${ROOT}"/.claude/memory/chat-*.md >/dev/null 2>&1; then
  exit 0
fi

SESSION_FILE="${ROOT}/.claude/comm/.session-name"
SESSION_NAME=$(cat "${SESSION_FILE}" 2>/dev/null | tr -d '[:space:]' || true)

WARNINGS=()

# A: 空文字
if [ -z "${SESSION_NAME}" ]; then
  WARNINGS+=("A: \`.session-name\` 未宣言 — \`echo <name> > .claude/comm/.session-name\` で宣言してください")
# B: chat- プレフィックス（task-tracker SKILL.md Step 0 と同じバリデーション）
elif [[ "${SESSION_NAME}" == chat-* ]]; then
  WARNINGS+=("B: \`chat-\` プレフィックス不要 — 現在値 \`${SESSION_NAME}\`。ファイル名側で \`chat-\` が付くため、ここでは素の名前（例 \`engineer\`）にしてください")
# C: 不正な文字 / パストラバーサル
elif [[ "${SESSION_NAME}" == *"/"* ]] || [[ "${SESSION_NAME}" == *".."* ]] || [[ "${SESSION_NAME}" == "." ]] || [[ "${SESSION_NAME}" == *" "* ]]; then
  WARNINGS+=("C: 不正な文字 / パストラバーサル — 現在値 \`${SESSION_NAME}\`。英数字・ハイフン・アンダースコアのみ使用してください")
else
  # D: mtime と HEAD commit timestamp の比較
  HEAD_TS=$(git -C "${ROOT}" log -1 --format=%ct 2>/dev/null || echo "")
  if [ -n "${HEAD_TS}" ] && [ -f "${SESSION_FILE}" ]; then
    # macOS / BSD stat 形式（life-editor は darwin 環境）
    SESSION_MTIME=$(stat -f %m "${SESSION_FILE}" 2>/dev/null || echo "")
    if [ -n "${SESSION_MTIME}" ]; then
      DIFF_SEC=$((HEAD_TS - SESSION_MTIME))
      THREE_DAYS=$((3 * 24 * 3600))
      if [ "${DIFF_SEC}" -gt "${THREE_DAYS}" ]; then
        WARNINGS+=("D: \`.session-name\` (\`${SESSION_NAME}\`) は最終 commit より 3 日以上古い — 別チャットの作業を引き継いだ可能性。\`cat .claude/comm/.session-name\` で念のため確認してください")
      fi
    fi
  fi
fi

# E: .claude/worktrees/*/ に 24h 以上 dirty 放置がないか（A-D の結果に関わらず常に走る）
if [ -d "${ROOT}/.claude/worktrees" ]; then
  for wt_dir in "${ROOT}/.claude/worktrees/"*/; do
    [ -d "${wt_dir}" ] || continue
    DIRTY_COUNT=$(git -C "${wt_dir}" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    if [ "${DIRTY_COUNT}" -eq 0 ]; then
      continue
    fi
    # 最古の変更時刻を取得（modified + untracked）
    # 「ANY ファイルが 24h 以上放置」を検知（NEWEST だと「全部新しい」ケースで fire しない）
    OLDEST_MTIME=0
    while IFS= read -r f; do
      [ -n "${f}" ] || continue
      full_path="${wt_dir}${f}"
      [ -e "${full_path}" ] || continue
      mt=$(stat -f %m "${full_path}" 2>/dev/null || echo 0)
      [ "${mt}" -gt 0 ] || continue
      if [ "${OLDEST_MTIME}" -eq 0 ] || [ "${mt}" -lt "${OLDEST_MTIME}" ]; then
        OLDEST_MTIME="${mt}"
      fi
    done < <(git -C "${wt_dir}" ls-files -mo --exclude-standard 2>/dev/null)
    if [ "${OLDEST_MTIME}" -gt 0 ]; then
      NOW_TS=$(date +%s)
      AGE_SEC=$((NOW_TS - OLDEST_MTIME))
      ONE_DAY=$((24 * 3600))
      if [ "${AGE_SEC}" -gt "${ONE_DAY}" ]; then
        AGE_HOURS=$((AGE_SEC / 3600))
        WARNINGS+=("E: worktree \`$(basename "${wt_dir}")\` に ${AGE_HOURS}h 以上放置の dirty ファイルあり (${DIRTY_COUNT} files 中、最古は ${AGE_HOURS}h 前) — 持ち主チャット確認推奨")
      fi
    fi
  done
fi

# F: .session-branch ↔ 現在の git branch 整合（CLAUDE.md §7.4 Multi-chat Worktree Policy）
# opt-in: `.session-branch` が存在する場合のみ検査。未設置プロジェクト / 未宣言チャットは無音
SESSION_BRANCH_FILE="${ROOT}/.claude/comm/.session-branch"
if [ -f "${SESSION_BRANCH_FILE}" ]; then
  DECLARED_BRANCH=$(cat "${SESSION_BRANCH_FILE}" 2>/dev/null | tr -d '[:space:]' || true)
  CURRENT_BRANCH=$(git -C "${ROOT}" branch --show-current 2>/dev/null || echo "")
  if [ -n "${DECLARED_BRANCH}" ] && [ -n "${CURRENT_BRANCH}" ] && [ "${DECLARED_BRANCH}" != "${CURRENT_BRANCH}" ]; then
    WARNINGS+=("F: \`.session-branch\` (\`${DECLARED_BRANCH}\`) と現在の branch (\`${CURRENT_BRANCH}\`) が不一致 — 1 chat = 1 worktree = 1 branch ルール (CLAUDE.md §7.4) 違反の可能性。担当 worktree から起動し直すか、\`.session-branch\` を現状に合わせて更新してください")
  fi
fi

# 警告がなければ静かに終了
if [ "${#WARNINGS[@]}" -eq 0 ]; then
  exit 0
fi

# outbox 先のチャット名フォールバック（パストラバーサル防止のため安全な名前のみ採用）
OUTBOX_NAME="${SESSION_NAME}"
if [ -z "${OUTBOX_NAME}" ] || \
   [[ "${OUTBOX_NAME}" == *"/"* ]] || \
   [[ "${OUTBOX_NAME}" == *".."* ]] || \
   [[ "${OUTBOX_NAME}" == "." ]] || \
   [[ "${OUTBOX_NAME}" == *" "* ]]; then
  OUTBOX_NAME="unknown"
fi

OUTBOX="${ROOT}/.claude/comm/outbox/${OUTBOX_NAME}"
mkdir -p "${OUTBOX}"
REPORT="${OUTBOX}/session-start-warnings.md"

TS=$(date '+%Y-%m-%d %H:%M:%S')

{
  printf '\n## %s  SessionStart warnings\n' "${TS}"
  for w in "${WARNINGS[@]}"; do
    printf -- '- %s\n' "${w}"
  done
} >> "${REPORT}"

# 標準出力（Claude が読む）— 1 行サマリ
printf '⚠️ SessionStart: .session-name 検査で警告 — 詳細: .claude/comm/outbox/%s/session-start-warnings.md を参照\n' "${OUTBOX_NAME}"

exit 0

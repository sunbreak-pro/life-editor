#!/usr/bin/env bash
#
# run-once.sh — Loop Engineering の1周「Observe → Act → Check」を手で1回だけ回す
#
#   Observe : Claude が PROMPT.md / TODO.md を読んで現状を把握する（Act の中で行う）
#   Act     : Claude を1回だけ非対話で起動し、TODO を1つ実装させる
#   Check   : check.sh で型チェック＋テストの合否を判定する
#
# ⚠️ このスクリプトは実行すると Claude が動く＝トークン課金が発生する。
#    check.sh と違ってタダではない。まずは安いタスクで1回だけ試すこと。
#
# 使い方:
#   bash scripts/loop-engine/run-once.sh
#

set -uo pipefail

# このスクリプト自身の場所（= scripts/loop-engine）。Mac のパスを直書きしない。
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Act: Claude を1回だけ非対話モード(-p)で起動 ---
# -p (--print) は「対話画面を出さず、与えた指示を実行して結果を返す」モード。
# PROMPT.md の中身をまるごと指示として渡す。
echo "▶ Act: Claude にタスクを1回やらせる..."
# claude の在り処をフルパスで固定（スクリプト実行時は PATH 設定が読まれない場合があるため）。
CLAUDE_BIN="/Users/newlife/.local/bin/claude"
# --permission-mode acceptEdits = ファイル編集を自動承認（無人で回すため）。
"${CLAUDE_BIN}" -p --permission-mode acceptEdits "$(cat "${DIR}/PROMPT.md")"

# --- Check: さっき作った審判を呼ぶ ---
echo ""
echo "▶ Check: 合否を判定..."
bash "${DIR}/check.sh"
RESULT=$?   # check.sh の終了コード(0=PASS / 1=FAIL)を受け取る

# --- 今回の結果を一言で ---
echo ""
if [ ${RESULT} -eq 0 ]; then
  echo "✅ このターンは PASS（変更が型チェック・テストを通った）"
else
  echo "✗ このターンは FAIL（Step 3 のループなら、ここで自動的にやり直しになる）"
fi

# この終了コードを、Step 3 のループが見て「続ける/止める」を決める
exit ${RESULT}

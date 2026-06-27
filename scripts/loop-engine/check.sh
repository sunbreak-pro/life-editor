#!/usr/bin/env bash
#
# check.sh — Loop Engineering の「Check（合否判定）」ブロック・最小版
#
# やること:
#   frontend の「型チェック(npm run build)」と「テスト(npm test)」を順番に走らせ、
#   両方とおれば PASS、どちらか落ちれば FAIL を表示して終わる。
#
# 特徴:
#   - AI(Claude)を呼ばない。だから何度実行してもタダ＆安全。
#   - これが後で「ループ」の中で繰り返し呼ばれる“合否判定”の本体になる。
#
# 使い方:
#   bash scripts/loop-engine/check.sh
#
# 終了コード(あとでループが見る信号):
#   0 = 全部PASS / 1 = どれか失敗 / 2 = そもそも実行できなかった
#

set -uo pipefail   # 未定義変数やパイプ途中の失敗を見逃さない安全設定

# --- このスクリプト自身の場所から、プロジェクトのルートを自動で割り出す ---
# （Mac のパスを直書きしないので、main でも worktree でも、移動・マージ後でも同じように動く）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # = scripts/loop-engine
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"                    # = リポジトリのルート（2 階層上）
FRONTEND="${ROOT}/frontend"

# frontend に移動できなければ、ここで止める(終了コード2)
cd "${FRONTEND}" || { echo "✗ frontend が見つからない: ${FRONTEND}"; exit 2; }

# --- 1. 型チェック ---
echo "▶ 1/2 型チェック (npm run build) を実行中..."
if npm run build >/tmp/loop-check-build.log 2>&1; then
  BUILD="PASS"
else
  BUILD="FAIL"
fi

# --- 2. テスト ---
echo "▶ 2/2 テスト (npm test) を実行中..."
if npm test >/tmp/loop-check-test.log 2>&1; then
  TEST="PASS"
else
  TEST="FAIL"
fi

# --- 結果のまとめ表示 ---
echo ""
echo "===== Check 結果 ====="
echo "  型チェック : ${BUILD}"
echo "  テスト     : ${TEST}"
echo "======================"

# --- どちらか失敗していたら、ログの末尾だけ見せて FAIL(1)で終わる ---
if [ "${BUILD}" = "FAIL" ] || [ "${TEST}" = "FAIL" ]; then
  echo ""
  echo "失敗の詳細(末尾20行だけ):"
  if [ "${BUILD}" = "FAIL" ]; then
    echo "--- build ログ ---"
    tail -20 /tmp/loop-check-build.log
  fi
  if [ "${TEST}" = "FAIL" ]; then
    echo "--- test ログ ---"
    tail -20 /tmp/loop-check-test.log
  fi
  exit 1
fi

echo "✅ すべて PASS"
exit 0

#!/usr/bin/env bash
#
# check.sh — Loop Engineering の「Check（合否判定）」ブロック・最小版
#
# やること:
#   生きている本流（shared + web）の「型チェック+ビルド」と「テスト(shared)」を
#   順番に走らせ、両方とおれば PASS、どちらか落ちれば FAIL を表示して終わる。
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

# 生きている本流（shared + web）が無ければ、ここで止める(終了コード2)
[ -d "${ROOT}/shared" ] || { echo "✗ shared が見つからない: ${ROOT}/shared"; exit 2; }
[ -d "${ROOT}/web" ]    || { echo "✗ web が見つからない: ${ROOT}/web"; exit 2; }

# --- 1. 型チェック + ビルド (shared → web) ---
echo "▶ 1/2 型チェック+ビルド (shared + web npm run build) を実行中..."
if npm --prefix "${ROOT}/shared" run build >/tmp/loop-check-build.log 2>&1 \
   && npm --prefix "${ROOT}/web" run build >>/tmp/loop-check-build.log 2>&1; then
  BUILD="PASS"
else
  BUILD="FAIL"
fi

# --- 2. テスト (shared vitest) ---
echo "▶ 2/2 テスト (shared npm test) を実行中..."
if npm --prefix "${ROOT}/shared" test >/tmp/loop-check-test.log 2>&1; then
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

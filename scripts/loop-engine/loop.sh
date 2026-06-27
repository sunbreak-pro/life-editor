#!/usr/bin/env bash
#
# loop.sh — Loop Engineering の Step 3「ループ化」
#
# やること:
#   run-once.sh（Observe → Act → Check の1周）を、
#   「PASS して全タスクが片付くまで」または「上限回数まで」繰り返す。
#
#   1周 = 子Claude が TODO を1つ実装 → check.sh（型＋テスト）で合否判定。
#   合否は終了コードで受け取る（0 = PASS / それ以外 = FAIL）。PASS で止める。
#
# ⚠️ お金の話（$0 厳守のため必読）:
#   このループは1周ごとに子Claude を1回起動する＝トークン課金が発生する。
#   最大 MAX_ITER 周なので「子Claude 最大 MAX_ITER 回分」が課金の上限。
#   実行前に必ずコスト上限を表示し、y で同意しない限り回さない。
#   TODO が空なら子Claude は1回も起動しない（＝$0）。
#   --dry-run を付ければ子Claude を起動せず（＝無料で）ループの挙動だけ確認できる。
#
# 使い方:
#   bash scripts/loop-engine/loop.sh             # 確認プロンプトあり（y で実行）
#   bash scripts/loop-engine/loop.sh --yes       # 確認を省いて実行（課金に同意済みのとき）
#   bash scripts/loop-engine/loop.sh --dry-run   # 子Claude を起動せず挙動だけ確認（無料）
#   MAX_ITER=5 bash scripts/loop-engine/loop.sh  # 上限回数を変える（課金の上限も変わる）
#
# 終了コード（あとで人や別スクリプトが見る信号）:
#   0 = 成功で停止（全タスク完了 & PASS、または最初から PASS）
#   1 = 停止（上限到達 / 連続無進捗 / タスクは尽きたが check が赤）
#   2 = そもそも実行できなかった（引数ミス等）
#

set -uo pipefail

# --- このスクリプト自身の場所（= scripts/loop-engine）。Mac のパスを直書きしない ---
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TODO="${DIR}/TODO.md"

# === 設定（環境変数で上書き可。例: MAX_ITER=5 bash loop.sh） ===
MAX_ITER="${MAX_ITER:-10}"            # 最大何周まわすか（課金の上限に直結）
MAX_NOPROGRESS="${MAX_NOPROGRESS:-2}" # 未完タスクが連続で減らなかったら止める回数

# === 引数（--dry-run / --yes） ===
DRY_RUN=0
ASSUME_YES=0
for arg in "$@"; do
  case "${arg}" in
    --dry-run) DRY_RUN=1 ;;
    --yes|-y)  ASSUME_YES=1 ;;
    *) echo "✗ 知らないオプション: ${arg}（使えるのは --dry-run / --yes）"; exit 2 ;;
  esac
done

# --- 未完タスク（- [ ]）の数を数える。ファイルが無ければ 0 を返す ---
# 注意: <!-- --> のコメント内は数えない。TODO.md 冒頭の「書き方の例」を
#       実タスクと誤認して、やることが無いのに子Claude を起動する（＝無駄な課金）のを防ぐ。
count_todo() {
  local n
  n=$(awk '
    /<!--/ { in_comment = 1 }
    in_comment == 0 && /^- \[ \]/ { n++ }
    /-->/  { in_comment = 0 }
    END    { print n + 0 }
  ' "${TODO}" 2>/dev/null)
  echo "${n:-0}"
}

# --- 1周の実体（dry-run なら子Claude を呼ばず check.sh だけ走らせる） ---
run_one_round() {
  if [ "${DRY_RUN}" -eq 1 ]; then
    echo "  [dry-run] Act（子Claude 起動）はスキップ。Check だけ実行して挙動を確認します。"
    bash "${DIR}/check.sh"
  else
    bash "${DIR}/run-once.sh"
  fi
  return $?
}

# === やることが最初から無いなら、課金ゲートを出さずに終わる（$0） ===
if [ "$(count_todo)" -eq 0 ]; then
  echo "TODO.md に未完タスク（- [ ]）がありません。子Claude は起動しません（課金なし）。"
  echo "現状の合否だけ確認します:"
  if bash "${DIR}/check.sh"; then
    echo "🎉 やることなし & PASS。"
    exit 0
  else
    echo "⚠️ やることなしですが check が赤です。手動で確認してください。"
    exit 1
  fi
fi

# === コスト上限の明記＋同意ゲート（$0 厳守。dry-run は無料なのでゲート不要） ===
if [ "${DRY_RUN}" -eq 0 ]; then
  echo "============================================================"
  echo " ⚠️  これは課金が発生する実行です（子Claude を起動します）"
  echo "    ・1周ごとに子Claude を1回起動 = トークン課金"
  echo "    ・最大 ${MAX_ITER} 周 = 子Claude 最大 ${MAX_ITER} 回分が課金の上限"
  echo "    ・未完タスク: $(count_todo) 件"
  echo "    ・無料で挙動だけ見たいなら、ここで中止して --dry-run を付けて再実行"
  echo "============================================================"
  if [ "${ASSUME_YES}" -eq 0 ]; then
    printf "本当に実行しますか？ (y/N): "
    read -r ans || ans=""
    case "${ans}" in
      y|Y|yes|YES) echo "→ 実行します" ;;
      *) echo "→ 中止しました（課金なし）"; exit 0 ;;
    esac
  fi
fi

# === ループ本体 ===
noprogress=0
prev_remaining="$(count_todo)"

for (( i=1; i<=MAX_ITER; i++ )); do
  echo ""
  echo "########## 周回 ${i} / ${MAX_ITER}（未完タスク: $(count_todo) 件） ##########"

  # 周回の途中で未完タスクが尽きたら、最後に1度 check して終わる
  if [ "$(count_todo)" -eq 0 ]; then
    echo "未完タスクが尽きました → 最終チェックして終了します。"
    if bash "${DIR}/check.sh"; then
      echo "🎉 全タスク完了 & PASS。成功で停止。"
      exit 0
    else
      echo "⚠️ タスクは尽きましたが check が赤です。手動で確認してください。"
      exit 1
    fi
  fi

  # 1周まわす（Act → Check）。戻り値は check の合否（0 = PASS）
  run_one_round
  result=$?

  now_remaining="$(count_todo)"

  # PASS かつ 未完タスクが残っていなければ、成功で停止
  if [ "${result}" -eq 0 ] && [ "${now_remaining}" -eq 0 ]; then
    echo "🎉 PASS かつ全タスク完了。成功で停止。"
    exit 0
  fi
  # PASS だが、まだ未完タスクが残っている → 次の周回へ
  if [ "${result}" -eq 0 ]; then
    echo "✅ 今周は PASS。まだ未完タスクが ${now_remaining} 件あるので続けます。"
  else
    echo "✗ 今周は FAIL（check が赤）。次の周回でやり直します。"
  fi

  # 無進捗の判定（未完タスクが減ったか）
  if [ "${now_remaining}" -ge "${prev_remaining}" ]; then
    noprogress=$(( noprogress + 1 ))
    echo "（無進捗 ${noprogress}/${MAX_NOPROGRESS}：未完タスクが減っていません）"
    if [ "${noprogress}" -ge "${MAX_NOPROGRESS}" ]; then
      echo "🛑 連続 ${MAX_NOPROGRESS} 回 無進捗。詰まっているので停止します（手動で確認を）。"
      exit 1
    fi
  else
    noprogress=0
  fi
  prev_remaining="${now_remaining}"
done

echo ""
echo "🛑 上限 ${MAX_ITER} 周に到達したので停止します（未完: $(count_todo) 件）。"
exit 1

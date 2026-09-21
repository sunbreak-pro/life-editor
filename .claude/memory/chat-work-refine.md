# MEMORY (chat-work-refine)

## 進行中

（なし）

## 直近の完了

- #1793 環境音をオンにするとホワイトノイズ的な雑音が重なる ✅（2026-09-21）: **PR #1797 open**（Refs #1793・merge = 人手 P-001）。切り分けの結果は**仮説 A（音源側）**で、`AudioContext.tsx` は非変更。5 本とも 320 kbps を名乗りながら 16.25 kHz でブリックウォール、かつギャップレスタグ無しで両端に無音があり 1 周ごとに 39〜139 ms 切れる。「サーッ」が符号化ノイズかまでは未確定（一定のヒスの床は検出されず）。次は音源差し替え — 条件は Issue コメントと `sounds.ts` ヘッダ
- #1792 未選択時の表示を「フリーセッション」にし見出しを「作業名」へ ✅（2026-09-21）: **PR #1795 open**（Closes #1792・merge = 人手 P-001）。Desktop / Mobile 両面の未選択表示と、シートの「選択を外す」行を「フリーセッション」に統一。見出しとシート見出しが 1 キーを共有していたため `work.todoSelector.sheetTitle` を新設。`scheduleScreen.*` の「紐づけ」2 本は別セクションのため対象外
- #1519 Todo / 予定選択シートに繰り返し予定が同名で並び日付が無い ✅（2026-09-06）: **PR #1539 open**（Closes #1519・merge = 人手 P-001）。7 日ウィンドウは維持したまま、予定の行に日付 + 開始時刻（終日は「終日」）を添えて区別できるようにした。`WorkTargetOption.subtitle?` を新設し、Mobile シートは 2 行目・Desktop は `MenuItem` の末尾スロットで出す
- #1475 開始 → 一時停止 → リセットしたセッションが未完了行として残り分析に混ざる ✅（2026-09-05）: **PR #1505 merged**（Closes #1475）。行を書いているのは reset ではなく pause と判明したため、集計側の単一判定 `isCountedSession`（未完了 かつ 1 分未満を除外）で塞いだ。既に DB にある id 18 / 19 も同時に分析から消える
- #1116 リンク先 Todo 未選択のタイマー開始で `Untitled todo` が自動生成される（ID も §4 違反） ✅（2026-08-27）: **PR #1143 merged**（Closes #1116）。#882 で入れた mint を撤去し `task_id = null` で記録（`timer_sessions.task_id` は nullable + FK なしで **DDL 変更なし**）。ID 側は `useTodoTreeAPI` の private 生成器を `generateTodoId` として shared util へ出し、朝刊クイック作成の `generateId("task")` も切替。本番の UUID task 行は報告済みの 1 件（削除済み）のみで後始末不要
- #946 Pomodoro Settings の 2 列でラベル行数が違うと入力欄が揃わない ✅（2026-08-16）: **PR #984 merged**（Closes #946）。grid セルの高さを使う構造修正（フィールドに `h-full` + キャプションに `grow`）で、en / ja のどちらでラベルが何行に折り返しても入力欄が下端で揃う。ピクセル固定は不採用

## 予定

- life-tags adoption（兄弟計画 `2026-07-11-life-tags-unification.md`・着手は合図待ち・work は影響小）

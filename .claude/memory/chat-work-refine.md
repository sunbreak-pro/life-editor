# MEMORY (chat-work-refine)

## 進行中

（なし）

## 直近の完了

- #1475 開始 → 一時停止 → リセットしたセッションが未完了行として残り分析に混ざる ✅（2026-09-05）: **PR #1505 open**（Closes #1475・merge = 人手 P-001）。行を書いているのは reset ではなく pause と判明したため、集計側の単一判定 `isCountedSession`（未完了 かつ 1 分未満を除外）で塞いだ。既に DB にある id 18 / 19 も同時に分析から消える
- #1116 リンク先 Todo 未選択のタイマー開始で `Untitled todo` が自動生成される（ID も §4 違反） ✅（2026-08-27）: **PR #1143 merged**（Closes #1116）。#882 で入れた mint を撤去し `task_id = null` で記録（`timer_sessions.task_id` は nullable + FK なしで **DDL 変更なし**）。ID 側は `useTodoTreeAPI` の private 生成器を `generateTodoId` として shared util へ出し、朝刊クイック作成の `generateId("task")` も切替。本番の UUID task 行は報告済みの 1 件（削除済み）のみで後始末不要
- #946 Pomodoro Settings の 2 列でラベル行数が違うと入力欄が揃わない ✅（2026-08-16）: **PR #984 merged**（Closes #946）。grid セルの高さを使う構造修正（フィールドに `h-full` + キャプションに `grow`）で、en / ja のどちらでラベルが何行に折り返しても入力欄が下端で揃う。ピクセル固定は不採用

## 予定

- life-tags adoption（兄弟計画 `2026-07-11-life-tags-unification.md`・着手は合図待ち・work は影響小）

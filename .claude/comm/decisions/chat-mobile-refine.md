# Decisions — chat-mobile-refine

> 自分の判断待ちのみ append（新しいものを上に）。回答は `ANSWERS.md` を参照。

（回答済み 3 件は 2026-08-09 に `.claude/decisions/` 台帳へ昇格済み — D-20260730-mobile-1 / D-20260730-mobile-2 / D-20260730-mobile-3。2026-08-12 昇格分 = D-20260810-mobile-1 / D-20260810-mobile-2 / D-20260810-mobile-3。台帳化とキューからの除去は chat-main が代行した）

### D-20260812-mobile-1: Mobile の Dayflow で Todo 行を「触れる」ようにするか（#691 実測 5 の積み残し）

- 背景: #691 Step 1 の実測（schedule-refine が本 Issue にコメント）が挙げた 5 点のうち、**1 / 2 / 3 / 4 は #691 の PR で実装した**（所要時間の表現 = 終了時刻 + 高さ / 進行中の行を現在線の下へ / 空き時間の区切り / 0 件の日の現在線）。残る **5「Todo 行が完了もできず詳細も開けない」だけを未着手で残している** — 実装が `CalendarTab.tsx` の外（`TaskDetailPanel` の Mobile 配線 = schedule-refine 担当ファイル）へ出るため（P-008）
- 実測の再掲: Todo 行は状態タグを持たない（`CalendarTab.tsx` の task チップに `status` を積んでいないため `AgendaList` の条件を満たさない）＝行から完了にできない。タップも `if (isWide) setTaskDetailId(...)` で narrow は no-op
- A: **#691 の後続 Issue として切る**（推奨 — 「見分けはつくのに触れない」を潰す。Kanban 側の `MobileTaskList` が既に `TaskDetailPanel` を BottomSheet で出しているので前例がある。ただし `TaskDetailPanel` は schedule-refine の担当ファイルなのでレーンの調整が要る）
- B: 現状維持（Dayflow は「予定の流れを読む」画面に徹し、Todo の操作は Schedule の Todo タブ / Kanban 側に寄せる）
- 放置時: B（現状維持）。#691 の PR は 1〜4 だけで着地しており、5 を入れないことで壊れるものは無い
- 期限感: いつでも。A なら chat-main への起票依頼が要る（本レーンの outbox 経由・D-20260802-sched-1 = B に従い実装 PR には載せない）

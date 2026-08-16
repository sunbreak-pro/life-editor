# Decision Queue — chat-schedule-refine

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

### D-20260816-sched-1: #897 のステップ 2「bulkCreate と updateFuture の共通部分を切り出す」を見送ってよいか

- 背景: Issue #897 / PR #929 / `shared/src/services/SupabaseScheduleItemsService.ts`。Issue 本文が挙げた共通部分 3 つを実測したところ、共通の中核が実在しなかった —「ルーチン由来の行の絞り込み」は bulkCreate が**これから INSERT する行へのメモリ上の述語**・updateFuture が**1 routine への DB クエリ**で同名の別物、「2 行分割の組み立て」は bulkCreate が既に共有 `scheduleItemToRows` を使い updateFuture はそもそも行を組み立てない、「冪等化オプション」は bulkCreate 専用
- A: **見送る（推奨 — 呼び出し元が 1 つずつの間接層を足すだけになり、Issue が減らしたい行数はむしろ増えるため）**。代わりに bulkCreate 内部の `fetchLiveRoutinePairKeys` / `routinePairKey` 切り出しに留める（PR #929 の現状）
- B: またぐ抽象を入れる（2 メソッドの外側に「ルーチン由来行の解決 → 2 行分割の書き込み」の共通レイヤを新設し、両方をその上に載せ替える）
- 放置時: A のまま（PR #929 は現状で完結している）。B を採るなら別 Issue を起票して独立 PR で行う
- 期限感: いつでも（#929 の merge をブロックしない）

（回答済みは `.claude/decisions/` 台帳へ昇格済み — D-20260801-sched-1（2026-08-09・chat-main 代行）/ D-20260810-sched-1〜5（2026-08-10・チャット回答を受けて当チャットが昇格）/ 2026-08-12 昇格分 = D-20260730-sched-1 / D-20260731-sched-2 / D-20260731-sched-3 / D-20260801-sched-2 / D-20260802-sched-1 / D-20260811-sched-1 / D-20260811-sched-2 / D-20260812-sched-1 / 2026-08-13 昇格分 = D-20260812-sched-2）

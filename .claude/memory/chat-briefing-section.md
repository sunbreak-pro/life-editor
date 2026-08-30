# MEMORY (chat-briefing-section)
> RETIRED: 2026-08-30 — worktree 廃止・書き手不在（D-20260830-main-1）

## 進行中

（なし）

## 直近の完了

- open-issue fanout 担当 4 件 + 手すき枠 1 件を一括で PR 化 ✅（2026-07-28・**#436 / #439 / #441 は merge 済み・#443（#361）と #446（#363）が open**）— #427 未宣言日の「保存済み」抑止 / #410 紙面行の ↗ を「アイコン＋編集」の右端揃えに / #431 materials brief の Notes 節棚卸し + db-conventions §12 / #361 Connect グラフの位置復元（案 1 で決着・根拠を Issue コメントに記録）/ #363 stale コメント sweep。**role-qa 独立監査の Important 3 件は各 PR へ反映済み**（#410 のタップ領域 + aria-label は merge に間に合った）。実ブラウザ検証は全件 merge 後 chat-main 側。`loadViewport` の無検証は outbox に起票依頼済み
- Issue #413 — Briefing の rightSidebar に Schedule の `TodayTodoTray`（#298）を流用配線し、残タスクを今日の候補へ配置可能に ✅（2026-07-27・**PR #422 + 追随 PR #426 とも merge 済み**。紙面の日付判定の UTC スライス（JST で終日タスクが常に前日扱い）は #426 で解消。wide 限定 = narrow に詳細パネルの開閉導線が無いため。実ブラウザ確認は chat-main）
- Issue #373 — Settings に「日付が変わる時刻」（0〜23 時）の select を追加し `useDayStartHourPref` へ配線 ✅（2026-07-27・**PR #415 merge 済み**。読み手側 `todayDateKey` / `getDayStartHour` は不変更。実ブラウザ確認は chat-main に残っている）

## 予定

（なし）

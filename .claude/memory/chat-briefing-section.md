# MEMORY (chat-briefing-section)

## 進行中

（なし）

## 直近の完了

- Issue #413 — Briefing の rightSidebar に Schedule の `TodayTodoTray`（#298）を流用配線し、残タスクを今日の候補へ配置可能に ✅（2026-07-27・**PR #422 merge 済み**。ただし role-qa 監査の BLOCKING 修正 = 紙面の日付判定の UTC スライス（JST で終日タスクが常に前日扱い）は merge に間に合わず、**追随 PR `claude/briefing-413-qa-followup` で別出し**。wide 限定 = narrow に詳細パネルの開閉導線が無いため。実ブラウザ確認は chat-main）
- Issue #373 — Settings に「日付が変わる時刻」（0〜23 時）の select を追加し `useDayStartHourPref` へ配線 ✅（2026-07-27・**PR #415 merge 済み**。読み手側 `todayDateKey` / `getDayStartHour` は不変更。実ブラウザ確認は chat-main に残っている）
- Issue #391 — モバイルの夕刊タブでも宣言(intention)を編集可に ✅（2026-07-27・PR #404 + 監査反映の追随 PR #406 が**両方 merge 済み**。狭幅の実ブラウザ検証は chat-main 側に残っている）

## 予定

（なし）

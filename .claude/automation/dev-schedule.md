# 週次開発スケジュール台帳 (SSOT)

> `schedule-management` スキルが本ファイルを読み書きし、Google Calendar (MCP) へミラーする。
> **台帳が正・GCal はミラー**。ユーザーは手動編集してよい（タスク差し替え / 進捗マーク）。
> 時間予算は恒久前提（CLAUDE.md §7.0 参照）。

**更新**: 2026-06-21 / by chat-weekly-dev-schedule
**反映先 calendarId**: `2201akonayu@gmail.com`（primary — 専用「開発」カレンダー無し）
**開発ブロック既定時刻**: 平日 21:00 JST 始 / 休日 13:00 JST 始

---

## 時間予算

- **平日 (Mon–Fri)**: 30–60 分/日（本業のため細切れ）
- **休日 (Sat・Sun・祝日)**: 4 時間以上/日

凡例: 区分 = 平日 / 休日 ・ 進捗 = ☐ 未 / 🔄 進行中 / ☑ 完了

---

## 今週 (2026-06-21 〜 2026-06-28)

| 日付        | 区分 | 予定タスク (Phase・plan 由来)                          | 予算 | GCal (eventId) | 進捗 |
| ----------- | ---- | ----------------------------------------------------- | ---- | -------------- | ---- |
| 06-21 (Sun) | 休日 | Phase 3 Electron — PR #79 レビュー反映 + macOS 起動確認 | 4h+  | —              | ☐    |
| 06-22 (Mon) | 平日 | initplan WARN 48 件 — advisor 再実測 + 原因メモ着手   | 45m  | —              | ☐    |
| 06-23 (Tue) | 平日 | web Phase 2 残 S9 — モバイルレスポンシブ 1 画面       | 45m  | —              | ☐    |
| 06-24 (Wed) | 平日 | Link UX (Obsidian 風) スケルトン精読 + 設計メモ        | 60m  | —              | ☐    |
| 06-25 (Thu) | 平日 | Notes password bcrypt 化 前調査 (Known-issue 027)     | 45m  | —              | ☐    |
| 06-26 (Fri) | 平日 | 週次レビュー + 台帳更新 + merged branch 整理メモ       | 30m  | —              | ☐    |
| 06-27 (Sat) | 休日 | initplan 一括化 migration 作成（ローカルファイル先行） | 4h+  | —              | ☐    |
| 06-28 (Sun) | 休日 | Link UX 実装 Step 1（cross-role link 基盤）            | 4h+  | —              | ☐    |

---

## 来週候補 (backlog)

- W4 (Analytics+Connect) PR 作成 → main merge（🛑 ユーザー判断・要実機目視 D1）
- Work セクション Mobile 統一 PR 作成 → merge（🛑 ユーザー判断）
- DU-E Calendar 2 ビュー再実装（DU-G 完了後）
- Phase 3 Step 10: GitHub Actions で Windows / Linux ビルド成否確認

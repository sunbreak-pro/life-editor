# MEMORY (chat-docs-workspace)

## 進行中

（なし）

## 直近の完了

- Schedule 再設計 Step 1（A-1 タスクの読み取り表示: `tasksToCalendarChips` 純ヘルパー + 3 コンポーネント task variant + TaskTreeProvider 配線 + CalendarTab 派生層マージ。role-qa PASS・Blocker 0。ユーザー直接指示につき起票は chat-main へ委譲不要の実装のみ）✅（2026-07-15）
- Issue #218 実装 → PR #242（day-start-hour pref の読み手側配線: `todayDateKey()` 契約定義 + daily/routine sync 4 箇所 + `useDayStartHourPref` + 単体テスト。settings UI / analytics 追随の起票依頼は outbox 経由で chat-main へ）✅（2026-07-11）
- 実装後所感の反映: 幅切替タブ廃止 → 全画面 wide 統一（v2 親計画 + orders 6 枚改訂・#181 に告知）+ オーケストレーター運用（計画書は chat-main・pull 徹底・1 行 boot 規約）を CLAUDE.md §7.4 / _TEMPLATE.md に明記 ✅（2026-07-11）

## 予定

- v2 Issue 2 枚（`[layout-standard]` 共通部品 / `[all]` adoption）の起票は Issue 駆動 dispatch 移行（2026-07-11 (2)）により chat-main の担当へ移管 — 本チャットは自分宛ラベルの Issue を待つ
- life-tags 親計画の Step 2（詳細設計追記）— layout v2 共通部品 merge 後

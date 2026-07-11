---
Status: IN PROGRESS
Created: 2026-07-11
Branch: claude/work-refine
Owner-chat: work-refine
Parent: 2026-07-11-layout-standard-v2.md
---

# Plan: work-refine orders — 担当 Issue + Layout Standard v2 adoption

> work-refine worktree の作業台帳。共通仕様の正本 = [親計画](./2026-07-11-layout-standard-v2.md)（転記しない）。担当の一次情報は常に `gh issue list -R sunbreak-pro/life-editor --label section:work --state open` + `--label shared-fix`（本計画は 2026-07-11 時点のスナップショット + セクション固有メモ）。

boot 行:

```text
計画書 .claude/docs/vision/plans/2026-07-11-work-refine-orders.md に従い、「今すぐ着手可」から実行してください。
```

---

## 今すぐ着手可（v2 部品を待たない）

- section:work の open Issue は **2026-07-11 時点で 0 件**
- **#181 work 行（v1 adoption）**: WorkScreen の `max-w-[720px]` + `px-8` 独自値 → 標準幅（reading）へ。モバイル側 wrapper の追随確認も。完了したら #181 の自分の行をチェック

## Layout Standard v2 adoption（v2 共通部品 merge 後 — 親計画 Step 4 以降）

- **work の本丸 = ヘッダー新設**（親計画 §2）: タイトル + 区切り線 + 右端アイコン群は shell（標準ヘッダー）が提供する → work 側の作業は、タイマー面との縦の余白・視覚的な重複の調整と表示確認
- **幅切替タブ**: 初期値は親計画 §5 の表が正（転記しない）。wide 時のタイマー面・統計行のレイアウト確認
- PomodoroSettings パネルが「区切り線の下で開閉」に変わった後の表示確認

## 後続: life-tags（[兄弟計画](./2026-07-11-life-tags-unification.md)参照・着手は合図待ち）

- work に folder 概念は無し → 影響小。共通タグフィルタ UI が入る際に adoption

---

## Scope (Touchable Paths)

```
web/src/work/**
shared/src/components/Work/**   ← 自セクション部品のみ（存在する場合）。shell 部品（AppShell / MainScreen / HeaderTabs / RightSidebar 系 / 標準ヘッダー）は編集禁止（単一書込者 = layout-standard）
.claude/docs/vision/plans/2026-07-11-work-refine-orders.md
```

## Steps

| #   | Step                         | Gate    | Acceptance                           |
| --- | ---------------------------- | ------- | ------------------------------------ |
| 1   | #181 work 行の消化           | 🤖      | #181 チェック + build/test pass      |
| 2   | v2 adoption（部品 merge 後） | 🤖 + 👀 | v2 adoption Issue の work 行チェック |

## Acceptance Criteria

- [ ] `cd shared && npm run build && npm run test` / `cd web && npm run build` pass
- [ ] 担当分（#181 / v2 adoption の work 行）がチェック済み
- [ ] 完了時: 本計画 Status 更新 + per-chat memory 更新（DoD）

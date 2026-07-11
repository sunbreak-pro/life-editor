---
Status: IN PROGRESS
Created: 2026-07-11
Branch: claude/settings-refine
Owner-chat: settings-refine
Parent: 2026-07-11-layout-standard-v2.md
---

# Plan: settings-refine orders — 担当 Issue + Layout Standard v2 adoption

> settings-refine worktree の作業台帳。共通仕様の正本 = [親計画](./2026-07-11-layout-standard-v2.md)（転記しない）。担当の一次情報は常に `gh issue list -R sunbreak-pro/life-editor --label section:settings --state open` + `--label shared-fix`（本計画は 2026-07-11 時点のスナップショット + セクション固有メモ）。

boot 行:

```text
計画書 .claude/docs/vision/plans/2026-07-11-settings-refine-orders.md に従い、「今すぐ着手可」から実行してください。
```

---

## 今すぐ着手可（v2 部品を待たない）

- section:settings の open Issue は **2026-07-11 時点で 0 件**
- **#181 settings 行（v1 adoption）**: SettingsScreen の `max-w-[768px]` 二重センタリング解消 → 標準幅へ。完了したら #181 の自分の行をチェック

## Layout Standard v2 adoption（v2 共通部品 merge 後 — 親計画 Step 4 以降）

- タイトル（h1）はあるが**区切り線が無い** → 標準セクションヘッダー（タイトル + 区切り線 + 右端アイコン群）へ移行し、自前 h1 + 説明文まわりの重複を整理
- **幅切替タブ**: 初期値は親計画 §5 の表が正（転記しない）。wide 時の設定カード列の伸び・行長の確認
- SettingsDetailPanel が「区切り線の下で開閉」に変わった後の表示確認

## 後続: life-tags（[兄弟計画](./2026-07-11-life-tags-unification.md)参照・着手は合図待ち）

- settings に tag 管理 UI を置くかは未定 — 兄弟計画の詳細設計後に判断

---

## Scope (Touchable Paths)

```
web/src/settings/**
shared/src/components/Settings/**   ← 自セクション部品のみ（存在する場合）。shell 部品（AppShell / MainScreen / HeaderTabs / RightSidebar 系 / 標準ヘッダー）は編集禁止（単一書込者 = layout-standard）
.claude/docs/vision/plans/2026-07-11-settings-refine-orders.md
```

## Steps

| #   | Step                         | Gate    | Acceptance                               |
| --- | ---------------------------- | ------- | ---------------------------------------- |
| 1   | #181 settings 行の消化       | 🤖      | #181 チェック + build/test pass          |
| 2   | v2 adoption（部品 merge 後） | 🤖 + 👀 | v2 adoption Issue の settings 行チェック |

## Acceptance Criteria

- [ ] `cd shared && npm run build && npm run test` / `cd web && npm run build` pass
- [ ] 担当分（#181 / v2 adoption の settings 行）がチェック済み
- [ ] 完了時: 本計画 Status 更新 + per-chat memory 更新（DoD）

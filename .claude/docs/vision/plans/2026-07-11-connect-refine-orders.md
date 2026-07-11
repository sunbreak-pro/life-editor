---
Status: IN PROGRESS
Created: 2026-07-11
Branch: claude/connect-refine
Owner-chat: connect-refine
Parent: 2026-07-11-layout-standard-v2.md
---

# Plan: connect-refine orders — 担当 Issue + Layout Standard v2 adoption

> connect-refine worktree の作業台帳。共通仕様の正本 = [親計画](./2026-07-11-layout-standard-v2.md)（転記しない）。担当の一次情報は常に `gh issue list -R sunbreak-pro/life-editor --label section:connect --state open` + `--label shared-fix`（本計画は 2026-07-11 時点のスナップショット + セクション固有メモ）。

boot 行:

```text
計画書 .claude/docs/vision/plans/2026-07-11-connect-refine-orders.md に従い、「今すぐ着手可」から実行してください。
```

---

## 今すぐ着手可（v2 部品を待たない）

- section:connect の open Issue は **2026-07-11 時点で 0 件**
- **#181 connect 行（v1 adoption）**: fluid variant 採用の確認（軽量）+ connect 内部ヘッダの rem gutter → px トークン（#180 Worklog の残課題）。完了したら #181 の自分の行をチェック

## Layout Standard v2 adoption（v2 共通部品 merge 後 — 親計画 Step 4 以降）

- ConnectHeader（自前の `border-b` 付きタイトルタブ）を**標準セクションヘッダーへ移行**し、MainScreen 側 sectionToolbar 経由だった rightSidebar トグル配線の重複を撤去
- **幅切替タブ**: 初期値は親計画 §5 の表が正（connect は推論値 — 表の注記参照）。narrow 時のグラフキャンバス挙動を実測 — 成立しない場合は親計画の未定事項ルートで報告（connect はタブ無効化検討の筆頭候補）
- graph settings / backlinks パネルが「区切り線の下で開閉」に変わった後の表示確認

## 後続: life-tags（[兄弟計画](./2026-07-11-life-tags-unification.md)参照・着手は合図待ち）

- Connect のリンクグラフ・タグは WikiTag 基盤そのもの → **改名・拡張の影響を直接受ける**。兄弟計画の Step 2（詳細設計）にレビュー参加を想定

---

## Scope (Touchable Paths)

```
web/src/connect/**
shared/src/components/Connect/**   ← 自セクション部品のみ。shell 部品（AppShell / MainScreen / HeaderTabs / RightSidebar 系 / 標準ヘッダー）は編集禁止（単一書込者 = layout-standard）
.claude/docs/vision/plans/2026-07-11-connect-refine-orders.md
```

## Steps

| #   | Step                         | Gate    | Acceptance                              |
| --- | ---------------------------- | ------- | --------------------------------------- |
| 1   | #181 connect 行の消化        | 🤖      | #181 チェック + build/test pass         |
| 2   | v2 adoption（部品 merge 後） | 🤖 + 👀 | v2 adoption Issue の connect 行チェック |

## Acceptance Criteria

- [ ] `cd shared && npm run build && npm run test` / `cd web && npm run build` pass
- [ ] 担当分（#181 / v2 adoption の connect 行）がチェック済み
- [ ] 完了時: 本計画 Status 更新 + per-chat memory 更新（DoD）

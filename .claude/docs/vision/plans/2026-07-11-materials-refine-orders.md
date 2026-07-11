---
Status: IN PROGRESS
Created: 2026-07-11
Branch: claude/materials-refine
Owner-chat: materials-refine
Parent: 2026-07-11-layout-standard-v2.md
---

# Plan: materials-refine orders — 担当 Issue + Layout Standard v2 adoption

> materials-refine worktree の作業台帳。共通仕様の正本 = [親計画](./2026-07-11-layout-standard-v2.md)（転記しない）。担当の一次情報は常に `gh issue list -R sunbreak-pro/life-editor --label section:materials --state open` + `--label shared-fix`（本計画は 2026-07-11 時点のスナップショット + セクション固有メモ）。

boot 行:

```text
計画書 .claude/docs/vision/plans/2026-07-11-materials-refine-orders.md に従い、「今すぐ着手可」から実行してください。
```

---

## 今すぐ着手可（v2 部品を待たない）

- **#118 Notes / Daily パスワードの平文保存**（type:bug・sev:important・area:security）: 平文 → ハッシュ / 暗号化へ。要件詳細は Issue 本文が正。**着手前に方式の詳細計画化を推奨**（保存形式変更 = 既存データの移行を伴う。sync（2 行分割モデル）への影響確認 — 必要なら `life-editor-sync-auditor` を通す）
- **#181 materials 行（v1 adoption）**: #189（Notes/Tasks の sidebar-list + main-editor flip）が merge 済みのため、**#181 記載の行番号・状況は陳腐化している可能性が高い** — main 取り込み後に再実測して残作業を判定し、#181 の自分の行をチェック

## Layout Standard v2 adoption（v2 共通部品 merge 後 — 親計画 Step 4 以降）

- タブ帯は HeaderTabs 済み → 標準セクションヘッダーへの乗り換え確認・トグルの trailing / hamburger 二形態の配線を標準へ
- **幅は全画面 wide 統一**（幅切替タブは 2026-07-11 廃止 — 親計画 §5）: 現状「Tasks=全幅・他 3 タブ=中央寄せ」の混在を解消し、Notes / Daily / Tags も全幅基準へ。各サブタブで表示崩れ確認

## 後続: life-tags（[兄弟計画](./2026-07-11-life-tags-unification.md)参照・着手は合図待ち）

- **materials は life-tags の最重量レーン**: Kanban の folder ビュー → tag ビュー後継 / Notes のフォルダツリー → タグフィルタ + グルーピング / folder → tag データ移行の UI 受け皿。兄弟計画の Step 2（詳細設計）にレビュー参加を想定

---

## Scope (Touchable Paths)

```
web/src/tasks/** / web/src/notes/** / web/src/daily/**
shared/src/**   ← #118 の保存経路（services / crypto）のみ。shell 部品（AppShell / MainScreen / HeaderTabs / RightSidebar 系 / 標準ヘッダー）は編集禁止（単一書込者 = layout-standard）
supabase/migrations/*.sql   ← #118 で必要な場合のみ・ローカル先行ルール
.claude/docs/vision/plans/2026-07-11-materials-refine-orders.md
```

## Steps

| #   | Step                                         | Gate    | Acceptance                                |
| --- | -------------------------------------------- | ------- | ----------------------------------------- |
| 1   | #181 materials 行の再実測 → 消化             | 🤖      | #181 チェック + build/test pass           |
| 2   | #118 方式の詳細計画化 → 実装                 | 🤖 + 🛑 | Issue close・既存データ移行の検証         |
| 3   | v2 adoption（部品 merge 後・幅タブ調整含む） | 🤖 + 👀 | v2 adoption Issue の materials 行チェック |

## Acceptance Criteria

- [ ] `cd shared && npm run build && npm run test` / `cd web && npm run build` pass
- [ ] 担当 Issue（#118 / #181・v2 adoption の materials 行）が close またはチェック済み
- [ ] 完了時: 本計画 Status 更新 + per-chat memory 更新（DoD）

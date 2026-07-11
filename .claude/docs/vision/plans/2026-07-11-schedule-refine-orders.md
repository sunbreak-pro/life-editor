---
Status: IN PROGRESS
Created: 2026-07-11
Branch: claude/schedule-refine
Owner-chat: schedule-refine
Parent: 2026-07-11-layout-standard-v2.md
---

# Plan: schedule-refine orders — 担当 Issue + Layout Standard v2 adoption

> schedule-refine worktree の作業台帳。共通仕様の正本 = [親計画](./2026-07-11-layout-standard-v2.md)（転記しない）。担当の一次情報は常に `gh issue list -R sunbreak-pro/life-editor --label section:schedule --state open` + `--label shared-fix`（本計画は 2026-07-11 時点のスナップショット + セクション固有メモ）。

boot 行:

```text
計画書 .claude/docs/vision/plans/2026-07-11-schedule-refine-orders.md に従い、「今すぐ着手可」から実行してください。
```

---

## 今すぐ着手可（v2 部品を待たない）

- **#185 Event / Routine 統合**（type:task・重量）: repeat 設定を Event 側に持たせて単一アイテム型へ。要件詳細は Issue 本文が正。**着手前に詳細計画化を推奨**（データモデル変更 — CLAUDE.md §4「Routine = Event の生成テンプレート」/ `db-conventions.md` / requirements tier-1 への波及が DoD。DDL はローカル先行 → ユーザー push）
- **#183 セグメント連結表示**（type:bug・sev:minor）: Day/Week/Month が 1 語に見える件。**#180 の SegmentedControl 修正（px-3 / gap-0.5）で解消済みの可能性が高い** — main を取り込んで実測し、直っていれば確認コメントを添えて close、残っていれば修正
- **#181 schedule 行（v1 adoption）**: タブ wrapper / gutter の標準化追随 + schedule 本文の rem gutter → px トークン（#180 Worklog の残課題）。完了したら #181 の自分の行をチェック

## Layout Standard v2 adoption（v2 共通部品 merge 後 — 親計画 Step 4 以降）

- ScheduleScreen は HeaderTabs の trailing に自前で rightSidebar トグルを配線している → **標準セクションヘッダーへ移行**し重複配線を撤去
- **幅切替タブ**: 初期値 wide（親計画の初期値表が正）。narrow 時にカレンダーグリッドが「詰まって醜い」場合は親計画の未定事項ルートで報告（そのセクションのみタブ無効化の検討材料）
- rightSidebar パネル（今日の流れ / item detail タブ — #187 成果）が「区切り線の下で開閉」に変わった後の表示確認

## 後続: life-tags（[兄弟計画](./2026-07-11-life-tags-unification.md)参照・着手は合図待ち）

- schedule に folder 概念は無く、Event へのタグ付与は既存 WikiTag 基盤のまま → 影響小。共通タグフィルタ UI が入る際に adoption

---

## Scope (Touchable Paths)

```
web/src/schedule/**
shared/src/**   ← Event/Routine 統合（#185）のデータモデル・Mapper 部分のみ。shell 部品（AppShell / MainScreen / HeaderTabs / RightSidebar 系 / 標準ヘッダー）は編集禁止（単一書込者 = layout-standard）
supabase/migrations/*.sql   ← #185 のみ・ローカル先行ルール
.claude/docs/vision/plans/2026-07-11-schedule-refine-orders.md
```

## Steps

| #   | Step                                          | Gate    | Acceptance                               |
| --- | --------------------------------------------- | ------- | ---------------------------------------- |
| 1   | #183 実測 → close or 修正                     | 🤖      | Issue コメント + （修正時）PR            |
| 2   | #181 schedule 行の消化                        | 🤖      | #181 チェック + build/test pass          |
| 3   | #185 詳細計画化 → 実装（DDL はユーザー push） | 🤖 + 🛑 | Issue DoD 全消化・requirements 追随      |
| 4   | v2 adoption（部品 merge 後）                  | 🤖 + 👀 | v2 adoption Issue の schedule 行チェック |

## Acceptance Criteria

- [ ] `cd shared && npm run build && npm run test` / `cd web && npm run build` pass
- [ ] 担当 Issue（#183 / #185 / #181・v2 adoption の schedule 行）が close またはチェック済み
- [ ] 完了時: 本計画 Status 更新 + per-chat memory 更新（DoD）

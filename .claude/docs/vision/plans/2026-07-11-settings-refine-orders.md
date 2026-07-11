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
- **#181 settings 行（v1 adoption）**: SettingsScreen の `max-w-[768px]` 二重センタリング解消 → 標準へ（幅基準は 2026-07-11 に wide 統一へ変更 — 親計画 §5）。完了したら #181 の自分の行をチェック

## Layout Standard v2 adoption（v2 共通部品 merge 後 — 親計画 Step 4 以降）

- [x] タイトル（h1）はあるが**区切り線が無い** → 標準セクションヘッダー（shell 所有）へ移行し、自前 h1 + 説明文の本文内タイトル行を撤去。孤立した i18n キー `settings.title` / `settings.pageDescription` も en/ja から除去（Issue #209 / PR — analytics #200・schedule #205 と同作法）
- **幅は全画面 wide 統一**（幅切替タブは 2026-07-11 廃止 — 親計画 §5）: settings 側の中央寄せ clamp は #193 で撤去済み。全幅化は shell（PageContainer・#203 layout-standard）の担当で、settings 本文は幅を持たない
- [ ] 👀 SettingsDetailPanel が「区切り線の下で開閉」／全幅時の設定カード列の伸び・行長 → **PR merge 後に chat-main で実ブラウザ実測**（§7.4・worktree では build/型検証まで）

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

- [x] `cd shared && npm run build && npm run test` / `cd web && npm run build` pass（build/web/lint green・vitest 803/803。※ `SupabaseDailiesUnifiedService.test.ts` の `setDailyPasswordUnified` は順序依存フレーキー = 本変更と無関係・別途要調査）
- [x] 担当分（v2 adoption の settings 行 = 本文内タイトル行撤去）がチェック済み（#181 v1 行は #193 で解消済み）
- [ ] 完了時: 本計画 Status 更新 + per-chat memory 更新（DoD） → life-tags 後続が残るため Status は IN PROGRESS 継続。v2 adoption 分は本コミットで完了記録

## Worklog

- 2026-07-11 (settings-refine): v2 adoption 実装。`web/src/settings/SettingsScreen.tsx` の本文内タイトル行（`<h1>settings.title` + `settings.pageDescription`）を撤去し shell の標準 SectionHeader に委譲。孤立 i18n キー 2 つを en/ja から除去。Issue #209 起票 → 実装 → 検証（build/web/lint/vitest すべて green・role-qa PASS）。実ブラウザ実測は §7.4 に従い chat-main で PR merge 後。

---
Status: In Progress
Created: 2026-07-05
Branch: claude/shell-impl
Owner-chat: shell-impl
Parent: .claude/docs/design/IA.md
Previous: .claude/docs/design/briefs/shell.md
---

# Plan: App Shell — 目標 IA 実装（ClaudeDesign import）

> ClaudeDesign 生成デザイン（project `c73cdbf4-1933-4a70-ac09-b843d2cee85c` / `App Shell.dc.html`・フレーム 1a〜1l）を意匠の正とし、
> 2026-07-05 承認の目標 IA（`IA.md`）のアプリシェルを `shared/src/components/` に実装する。

---

## Context

- **動機**: 目標 IA（サイドバー本流 5 + ユーティリティ枠 2 / Mobile 固定 4 + More / header タブ標準）が承認済みだが、現行 web は 10 フラットセクションのまま。ClaudeDesign の生成デザインが確定したので、シェルをコードに落とす
- **制約**: `lumen-*` トークンのみ（hex 直書き禁止）/ 主要コンテナ背景は完全不透明 / i18n は props 経由・en/ja 両 catalog / DataService 境界厳守（シェルは純表示のまま）/ `frontend/` は FROZEN / **SectionId からの terminal 除去は Issue #146 の別作業**（本作業では `web/src/MainScreen.tsx` のローカル `Section` 型のみ再編し、shared の `SectionId` には触れない）
- **Non-goals**（意図的にやらない）:
  - **Schedule の Calendar / Routines タブ分割** — CalendarView（台帳管理 UI）の置き場が D1 brief（schedule-v2 チャット）に委譲されており未決（`IA.md:34`）。schedule セクションは現行の積み上げ表示を維持し、タブ化は schedule-v2 実装に委ねる
  - **Analytics / Connect の画面内タブを HeaderTabs 標準へ差し替え** — 各画面の v2 チャットの領分。標準部品（HeaderTabs）を提供するところまでが本作業
  - **Toast / CommandPalette / OfflineBanner の意匠変更** — brief §3「残す意匠」。デザインの Toast（3px 絶対配置バンド + 角丸 12）は既存 `border-l-4` を置き換えない
  - **Mobile FAB（Quick capture）** — デザインでは任意要素（`sc-if showFab`）。シェルに create アクションの受け口が無いため見送り
  - **折畳サイドバーのスタイル付きツールチップ** — 既存の native `title` で機能同等。追加実装しない

### デザイン import レビュー（vs brief §3 / IA.md）— 差分と採用判断

| #   | 項目                                                                                                                                                                                                         | 判断                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 1   | サイドバー 2 グループ / アクティブ行標準（3px accent バー + accent-subtle 地 + accent 文字）/ header タブ標準（2px accent 下線 + バッジは意味のあるタブのみ）/ Mobile 固定 4 + More / セグメントコントロール | brief §3・IA.md と**完全一致** → そのまま実装                                                                    |
| 2   | ブランドマーク（24px 角丸 8・accent 地に白 1 文字）+ ⌘K キーキャップ表記                                                                                                                                     | デザインの新要素 → **採用**（SidebarNav に追加）                                                                 |
| 3   | ja セクション名 = 予定 / 資料 / つながり / 集中 / 分析 / 設定 / ゴミ箱                                                                                                                                       | brief §1 のサンプルデータ準拠 → **ja catalog を更新**（現行: スケジュール / コネクト / ワーク / アナリティクス） |
| 4   | Toast の意匠差（3px バンド + 角丸 12 vs 既存 border-l-4）                                                                                                                                                    | **既存維持**（brief「残す意匠」が規約側。差分として報告）                                                        |
| 5   | Mobile フレームの status bar / home indicator                                                                                                                                                                | デバイス装飾 → 実装対象外                                                                                        |
| 6   | タブ下の本文（Kanban プレースホルダ等）                                                                                                                                                                      | ダミー指定（brief §4）→ 実装対象外（既存ビューを流用）                                                           |

---

## Scope (Touchable Paths)

```
shared/src/components/NavItem.tsx
shared/src/components/SidebarNav.tsx
shared/src/components/AppShell.tsx
shared/src/components/BottomTabBar.tsx
shared/src/components/HeaderTabs.tsx        (新規)
shared/src/components/SegmentedControl.tsx  (新規)
shared/src/components/index.ts
shared/src/index.ts
shared/src/i18n/locales/en.json
shared/src/i18n/locales/ja.json
shared/tests/**                             (シェル部品テスト追加)
web/src/MainScreen.tsx
.claude/docs/vision/plans/2026-07-05-shell-implementation.md
.claude/memory/chat-shell-impl.md
.claude/history/chat-shell-impl.md
.claude/comm/outbox/chat-shell-impl.md
```

---

## 設計（コンポーネント API）

1. **NavItem** — `tone?: "default" | "muted"` を追加（ユーティリティ枠 = muted: `text-lumen-text-tertiary`、hover で `text-lumen-text-secondary`）。アクティブ標準を変更: `bg-lumen-accent-subtle` + アイコン / ラベルとも `text-lumen-accent` + `font-medium` + 左端 3px accent バー（absolute span・上下 7px 内側・右角丸）。行高 `h-9`（36px）
2. **SidebarNav** — `utilitySections?: SidebarNavSection[]` を追加。nav 構造 = 本流リスト → `mt-auto` スペーサ → 区切り線 → ユーティリティ（muted）。ブランドヘッダにアプリマーク（`bg-lumen-accent text-lumen-on-accent rounded-lumen-md`・`appName` の頭文字）。折畳時もマーク + トグルを併置。フッターの ⌘K 行に `shortcutHint`（キーキャップ風 `<kbd>`）を追加（labels に `shortcutHint?: string`）
3. **AppShell** — `utilitySections?: AppShellSection[]`（SidebarNav へ転送）+ `mobileSections?: AppShellSection[]`（Mobile の表示順を明示。デフォルト = `[...sections, ...utilitySections]`）。BottomTabBar へは mobile 順のリストを渡す（BottomTabBar の slice ロジックは現行維持 = 先頭 `maxBottomTabs` が固定タブ）
4. **BottomTabBar** — アクティブタブのラベルに `font-medium`（デザイン準拠の微修正のみ。API 不変）
5. **HeaderTabs**（新規・Desktop 標準）— `tabs: { id, label, badge? }[]` / `activeTab` / `onSelect`。下線式: コンテナ `border-b`、タブ `px-3 py-2 -mb-px text-sm`、アクティブ = `border-b-2 border-lumen-accent text-lumen-text font-medium`、非アクティブ = `border-transparent text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text rounded-t-lumen-sm`。バッジ = `bg-lumen-accent-subtle text-lumen-accent text-xs font-medium tabular-nums rounded-lumen-sm` の小型ピル。`role="tablist"` + 左右矢印キー対応。i18n は props 経由
6. **SegmentedControl**（新規・Mobile 標準）— `options: { id, label }[]` / `value` / `onChange`。トラック = `bg-lumen-bg-secondary rounded-lumen-md p-0.5`・等分割、アクティブ = `bg-lumen-bg text-lumen-text font-medium rounded-lumen-sm shadow-lumen-sm`。バッジなし（brief §4.2）
7. **i18n** — en: `section.materials: "Materials"` 追加。ja: `section.materials: "資料"` 追加 + `schedule: 予定 / connect: つながり / work: 集中 / analytics: 分析` に更新（tasks / notes / daily / tags のキーは Materials タブ・⌘K コマンドで続用）
8. **MainScreen（web・シェル配線のみ）** — ローカル `Section` 型を 7 種（schedule / materials / connect / work / analytics / settings / trash）に再編 + `materialsTab` state（tasks / notes / daily / tags）。Materials 本体 = HeaderTabs（wide）/ SegmentedControl（narrow・`useMediaQuery` で分岐）+ 既存 4 ビュー（KanbanView / NotesView / DailyView / WikiTagsManagementView。Provider 構成は現行踏襲）。`mobileSections` = schedule / materials / work / analytics / connect / settings / trash（先頭 4 が固定タブ → More = connect / settings / trash）。⌘K コマンド = 7 セクション + Materials 4 タブ。GlobalShortcuts の `NavSection`（tasks / daily / notes / schedule / tags）は host 側でマッピング（tasks 等 → materials + タブ切替）。`fluidSection` = connect / (materials && tasks タブ)。タスクの Kanban は fluid のまま、タブ列 + 本文を flex-col で組む

---

## Steps

| #   | Step                                                                                                             | Gate    | Acceptance                           |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------ |
| 1   | 計画書 commit                                                                                                    | 🤖 自律 | 本ファイルが branch に乗る           |
| 2   | shared 部品実装（NavItem / SidebarNav / AppShell / BottomTabBar / HeaderTabs / SegmentedControl / index / i18n） | 🤖 自律 | `cd shared && npm run build` exit 0  |
| 3   | shared テスト追加（HeaderTabs / SegmentedControl / SidebarNav 2 グループ / AppShell mobile 順）                  | 🤖 自律 | `cd shared && npm run test` 全 pass  |
| 4   | web MainScreen 配線（7 セクション + Materials タブ + ⌘K + ショートカットマッピング）                             | 🤖 自律 | `cd web && npm run build` exit 0     |
| 5   | session-verifier + role-qa 独立監査                                                                              | 🤖 自律 | Blocking 指摘 0                      |
| 6   | draft PR 作成                                                                                                    | 🤖 自律 | PR URL 提示（self-merge しない）     |
| 7   | 実画面の目視確認（dev server）                                                                                   | 👀 目視 | ユーザーが Desktop / Mobile 幅で確認 |
| 8   | PR merge                                                                                                         | 🛑 人手 | ユーザーが merge                     |

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run build` exit 0
- [ ] `cd shared && npm run test` 全 pass（新規シェル部品テスト含む）
- [ ] `cd web && npm run build` exit 0
- [ ] 変更 / 新規 `.tsx` に hex 直書きなし（`rg '#[0-9a-fA-F]{3,8}' <changed tsx>` が 0 件。lumen トークンのみ）
- [ ] shared の変更部品に `useTranslation()` / `getDataService()` 直呼びなし（純表示維持）
- [ ] Desktop: サイドバー = 本流 5（Schedule / Materials / Connect / Work / Analytics）+ 区切り + ユーティリティ 2（Settings / Trash・muted）+ フッター（⌘K + email + SignOut）
- [ ] Mobile: 固定 4 タブ = Schedule / Materials / Work / Analytics、More シート = Connect / Settings / Trash
- [ ] header タブ: アクティブ = 2px accent 下線 + text-primary + font-medium、バッジは Materials の Tasks のみ
- [ ] `SectionId`（shared 型）に変更なし（terminal は #146 の別作業）
- [ ] PR diff ±1200 行以内（部品 6 + 配線 + テストのため機能追加目安 500 を拡大。超過時は分割検討）

---

## Risks / Known Issues 参照

- worktree は node_modules / dotenv 非共有 → build 検証は本 worktree の npm install 済み環境で実施（memory `project_worktree_supabase_treeshake` — env 無し build の誤判定に注意。本作業はシェルのみで supabase 到達性に触れない）
- 並行チャット多数稼働中 → commit は pathspec 明示（`git add -A` 禁止・memory `feedback_task_tracker_parallel_chat_override`）
- 他チャットが `shared/src/components/` を触る可能性 → 本 worktree は独立 branch のため作業中の衝突なし。merge 時の競合は git-orchestrator で解消

---

## References

- vision: `.claude/docs/design/IA.md`（ナビ構成の正本）/ `.claude/docs/design/briefs/shell.md` §3（header タブ標準）
- デザイン: claude.ai/design project `c73cdbf4-1933-4a70-ac09-b843d2cee85c` / `App Shell.dc.html`（フレーム 1a=Desktop Light / 1b=Dark / 1c=折畳 / 1d=⌘K / 1e=offline / 1f=loading / 1g=タブ標準カタログ / 1h〜1l=Mobile）
- rules: `.claude/rules/frontend.md`（lumen トークン / 純表示 / i18n props）

---

## Worklog

- 2026-07-05: デザイン import 完了（DesignSync get_file・118KB）。brief §3 / IA.md との突き合わせで大枠一致を確認。差分 6 点の採用判断を Context 表に記録。Schedule タブ分割と Analytics / Connect のタブ標準差し替えを Non-goals として明示（他チャット委譲）

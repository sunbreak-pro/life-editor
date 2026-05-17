# Plan: UI/UX 品質 remediation（a11y / IME / motion 系統清算）

- **Status**: In-progress（M0 完了 / M1 進行中 / M2-M4 未着手）
- **Created**: 2026-05-17
- **Task**: MEMORY.md `project_web_first_migration.md` 関連レーン。`frontend-react-designer` スキル基準への既存 UI 整合
- **Project path**: /Users/newlife/dev/apps/life-editor
- **Branch**: refactor/web-first-v2

## Context

### 動機

`frontend-react-designer` スキル適合性検証 + frontend/src 全体（337 コンポーネント / 約96k行）の UI/UX 定量監査の結果、品質を直接損ねている負債が **a11y / IME / motion の 3 領域** に集約されると判明。スキルは正しい基準を要求しているが、既存資産へ一括適用する駆動が無かった（例: IME `isComposing` 漏れ 31〜32 ファイル、reduced-motion 対応コード/CSS 全ゼロ）。

### 既存プランとの関係（重複回避・厳守）

本計画は以下と **競合せず補完** する。スコープ境界を明示する：

- `2026-05-16-frontend-refactor-pre-migration.md`（親・制約 SSOT）: 「テスト追加が唯一許可された新規要素／それ以外は削減方向／新抽象レイヤー禁止」。本計画もこの制約に従う。
- `2026-05-16-phase5-giant-component-decomposition.md`: 巨大コンポーネント分割（監査 #6/#7 = `OneDaySchedule` / `CalendarView` / `ScheduleTimeGrid` / `RichTextEditor`）は **phase5 が所有**。本計画は扱わない。
- 共有 Dialog シェル / Spinner / EmptyState 新設（監査 #3/#4/#8）= phase5 **5-1 と同じ承認ゲート対象**（新抽象レイヤーのグレーゾーン）。本計画では実装せず、承認待ち項目として記録のみ。
- Platform 判定の脱 `isTauriMobile()`（監査 #5）= 親プラン A4/A5 同様 **移行作業そのもの**。本計画スコープ外、移行 Phase で対応。

### 制約（親プランから継承）

- 削除 / 統合 / 既存への集約方向のみ。新抽象レイヤー・新デザインシステム禁止。
- 例外として許可するのは: (a) IME ヘルパー 1 ファイル（31 ファイルに散在する ad-hoc パターンを 1 つに集約 ＝ 発散の正味削減・既存 `useConfirmableSubmit:25` パターンの一般化）、(b) reduced-motion CSS 1 ブロック（WCAG 2.3.3 必須・純増だが極小・代替不可）。両者とも着手前に本計画へ明記済。
- 並行チャット競合: migration Phase が `shared/`・`.claude/`（本計画書除く）を同時変更中。コミットはパス指定（`git add -A` 禁止、`git commit -- <pathspec>`）。

### Non-goals

- 巨大コンポーネント分割（phase5 所有）。
- 新規共有プリミティブの実装（承認ゲート・記録のみ）。
- Platform 判定リファクタ（移行 Phase）。
- Tier 3 凍結機能（Paper 系等）の a11y 改修。

## Steps

### M0 — 即効・低リスク（本セッションで完了）

- [x] M0-1. `frontend-react-designer` スキル欠陥修正: Anti-Pattern #5 の WikiTag 誤記訂正（6→5 Provider・CLAUDE.md §6.2 整合）、tokens-and-styling §1 を全15トークン化、スコープに既存 remediation を追記
- [x] M0-2. `index.css` に `@media (prefers-reduced-motion: reduce)` グローバルブロック追加（全 keyframes 6種 + 約530 transition を1ルールで抑制。監査 #2）

### M1 — IME 安全 Enter 系統清算（完了・QA PASS-with-fixes）

- [x] M1-1. `src/utils/imeSafe.ts` 新規 + `imeSafe.test.ts`（7件 pass）。`isImeComposing(e)` 1 関数、`useConfirmableSubmit:25` パターンの一般化
- [x] M1-2. 候補 32 ファイルを精査 → テキスト入力面の真の違反 28 + `useConfirmableSubmit` 任意置換に guard 追加。スキップ正当: TerminalPane / EventList / FolderSidebarContent / CellEditor DateEditor / ItemEditPopover search。`npm run build` PASS / 回帰なし（534 tests）
- [x] M1-3. role-qa 独立監査 = PASS-with-fixes（Blocker 0）。Important 1件 `useSlashCommand.ts:78` 防御的 guard 1行を本セッションで追補適用・build 再 PASS
- 残: コミットは未実施（ユーザー指示待ち）。並行チャットの Phase 2 migration が作業ツリーに co-reside のためコミット時は **パス限定ステージング必須**（`frontend/src` の IME 関連 + `imeSafe.*` のみ。Supabase/RLS/migration を巻き込まない）

### M2 — 既存ダイアログの WAI-ARIA 属性付与（新ファイル無し・純粋 remediation）

- [ ] M2-1. modal/dialog/popover 27 ファイルのうち `role="dialog"` 欠落 25 件に `role="dialog"` + `aria-modal="true"` + `aria-labelledby`（既存見出し id 参照）を付与。**新コンポーネント・新抽象は作らない**（属性追加のみ＝制約適合）
- [ ] M2-2. キーボード操作不能な `<div onClick>` 4 件（`RoutineDeleteConfirmDialog:24` / `IconPicker:55` / `SessionCompletionModal:63` / `FolderDropdown:49`）を `<button>` 化 or `role/tabIndex/onKeyDown` 付与
- [ ] M2-3. アイコンのみ `<button>` の `aria-label` 欠落補完（既存 `shared/IconButton` 利用箇所優先）
- 注: フォーカストラップ実装は共有シェル前提のため M2 では行わず M4 へ（承認ゲート）

### M3 — トークン整合（集約方向・制約適合）

- [ ] M3-1. Terminal 系 Catppuccin hex 15 件（`TerminalSection` / `TerminalTabBar` / `SplitDivider`）を `index.css @theme` の `--color-notion-terminal-*` トークンへ集約（ハードコード → 一元管理＝削減方向。Terminal は移行で再設計予定のため優先度中・移行と衝突しない範囲）
- [ ] M3-2. 主要コンテナ透明度違反 `bg-notion-bg/80` 12 件（`DailyView:197` / `NotesView:327` / `PaperTextNode:106` 他）を不透明トークンへ。新トークンが要る場合は §52 手順で `@theme` に追加（CLAUDE.md §6.4 / vision §5 適合確認）

### M4 — 承認ゲート項目（実装しない・記録のみ）

- [ ] M4-1. 共有 `<Dialog>` シェル（role/aria-modal/Escape/**フォーカストラップ**内蔵）= phase5 5-1 と統合。フォーカストラップはコード全体ゼロのため a11y 上は最重要。**ユーザー承認後に phase5 側で実装**
- [ ] M4-2. 共有 `Spinner` / `EmptyState` プリミティブ（Loading 12箇所・空状態14箇所のコピペ集約）= 新抽象グレーゾーン。**承認後**

## Files

| File                                                                          | Operation   | Notes                                                 |
| ----------------------------------------------------------------------------- | ----------- | ----------------------------------------------------- |
| `skill-lib/.../frontend-react-designer/SKILL.md`                              | Edit (完了) | Anti-Pattern #5 訂正・スコープ追記・reviewer 記述更新 |
| `skill-lib/.../references/tokens-and-styling.md`                              | Edit (完了) | §1 全15トークン化                                     |
| `frontend/src/index.css`                                                      | Edit (完了) | reduced-motion media query 追加                       |
| `frontend/src/utils/imeSafe.ts`                                               | Create (M1) | `isImeComposing` 1 関数のみ                           |
| `frontend/src/components/**`（IME 真の違反のみ）                              | Edit (M1)   | 早期 return 追加・差分最小                            |
| modal/dialog 25 ファイル                                                      | Edit (M2)   | role/aria 属性追加のみ                                |
| `RoutineDeleteConfirmDialog/IconPicker/SessionCompletionModal/FolderDropdown` | Edit (M2)   | キーボード操作可能化                                  |
| Terminal 3 + 透明度 12 ファイル + `index.css @theme`                          | Edit (M3)   | トークン集約                                          |
| （M4 は別計画 phase5 で実装・本計画では変更なし）                             | -           | 承認ゲート                                            |

## Verification

- [ ] `cd frontend && npm run build`（tsc -b）PASS — 各 M で実施（`tsc --noEmit` は無効・使わない）
- [ ] `cd frontend && npm run test` baseline 527 pass / 0 fail 維持（回帰検知の網）
- [ ] M0-2: DevTools で `prefers-reduced-motion: reduce` エミュレート → keyframes / transition が停止することを目視
- [ ] M1: 日本語 IME で変換確定 Enter が submit/改行を発火しない（代表 `TaskTreeInput` / `CellEditor` / `InlineEditableHeading`）。通常 Enter は従来どおり動く
- [ ] M2: キーボードのみ（Tab/Enter/Esc/矢印）で対象ダイアログを開閉・操作可能。スクリーンリーダーが「ダイアログ」を認識
- [ ] M3: `grep -rnE "['\"]#[0-9a-fA-F]{3,8}['\"]" frontend/src/components/Terminal` が 0 件。主要コンテナ `/80` 透明度違反 0 件
- [ ] role-qa（別コンテキスト）監査 PASS → task-tracker で HISTORY 記録・本計画 archive

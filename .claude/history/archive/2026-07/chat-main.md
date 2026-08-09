# HISTORY ARCHIVE (chat-main, 2026-07)

ローリングアーカイブ: `history/chat-main.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-07-26 - chat-main 宿題消化（outbox 起票依頼 17 件 → #360〜#376・code-reduction 計画書の回収と COMPLETED 化）

#### 概要

前日の worktree 再編（4 本体制 + Issue #352〜#356 起票）に続き、各レーン outbox に溜まっていた起票依頼を一括消化した。起票前に docs-consistency の実測必須則に従い主要 claim を spot check（savePositions の読み手不在 / softDeleteNoteUnified の assignment 非波及 / check.sh・labels.ts の stale コメント / CI に eslint ジョブ不在 / useDayStartHourPref・NoteNodeType/createFolder の現存）。

#### 変更点

- **起票 17 件**: code-reduction Step 14 = #360〜#364 / materials 系 = #365〜#369（`section:tags` ラベル新設・#368）/ editor-ux 系 = #370〜#372 / settings = #373 / briefing 事後記録 = #374(即 close）/ connect+materials folder 退役後段 = #375 / schedule 統合生成パネル = #376
- **カバー済み判定**: analytics タグ後継集計（materials 2026-07-11 依頼）= #334 の候補 3 / analytics「今日」追随 = #356 / Mobile 省略 Provider 記述乖離 = PR #326 で解消済み（起票不要）
- **計画書の回収と COMPLETED 化**: `2026-07-25-code-reduction.md` は origin/main・tracker ブランチ（#340/#343 merged）とも不在 → 一次結論は「Mac 側ローカル想定・差し戻し」だったが、ユーザー指摘（Windows でしか触っていない）を受けて再探索。セッション記録（`~/.claude/projects/`）の grep で **dev クローン**（`C:\Users\user\dev\life-editor\.claude\worktrees\code-reduction`・git 未追跡 `??`）に実体を特定し回収。実行記録（PR #338〜#351・A15 SUPERSEDED・A18 修理・C9/C10 非実行）+ 実測訂正（C4/C6/C2/A21/Step 7）を Worklog に転記し、Status: COMPLETED で `archive/` へ収録（PR #377 同梱）。**教訓: この PC は orca / dev の 2 クローン構成 — ファイル不在の結論を出す前に両クローンとセッション記録を探索すること**
- **ブランチ棚卸し**: ローカル 17 本中 16 本の PR MERGED を機械確認（`git branch -D` は deny ルールのため削除コマンドをユーザーへ提示・memory のクリーンアップ節を更新）。`claude/briefing-evening-patch-fix` のみ PR 無しで保留（中身確認まで削除しない）

### 2026-07-19 - Notes/Daily エディタ即クラッシュ修正（tiptap Suggestion PluginKey 衝突・PR #294）

#### 概要

Notes のアイテムクリックで詳細パネルが真っ白になる regression（#288 merge の [[ autocomplete 導入で顕在化）を Windows 機の chat-main で診断・修正。"/" スラッシュメニューと "[[" オートコンプリートが @tiptap/suggestion の共有デフォルト PluginKey に衝突し、両方を登録する Notes/Daily エディタが ProseMirror の RangeError でマウント時にクラッシュしていた。

#### 変更点

- **Root Cause**: `web/src/notes/slashCommand.ts` / `itemLinkSuggestion.ts` の両 `Suggestion({...})` が `pluginKey` 未指定 → 共有デフォルト `SuggestionPluginKey` に二重登録 → `RangeError: Adding different instances of a keyed plugin (suggestion$)`。実行時にのみ発生し型/build 検証は通過するため merge 前検出不可（運用どおり merge 後の chat-main 実ブラウザ確認で発覚）
- **Fix**: 各 Suggestion に module-level の固有 `PluginKey`（`"slashCommand"` / `"itemLinkSuggestion"`）を付与（2 files, +14 行・commit `11acaac0`）。一時 worktree `tmp-suggestion-key` 経由で push・push 後即削除（main 直 push 禁止準拠）
- **起票/追跡**: Issue #293（type:bug / sev:blocking / section:materials・DoD 付き）→ PR #294 が `Fixes #293`。issue-dispatch スキルは Windows 機に未配備のため gh 直接起票
- **検証**: web build（tsc -b --force + vite）0 / eslint 対象 2 ファイル 0 / role-qa 独立レビュー PASS（BLOCKING/IMPORTANT 0 — prosemirror-state の `Configuration` 実装を実測し、module-level PluginKey の複数エディタ共有はキー衝突判定が単一 EditorState 内のみのため安全と確証。MINOR 1 件 = const 配置の見た目のみ・見送り）。merge 後の実ブラウザ確認（Issue #293 DoD）は「予定」に登録

# HISTORY ARCHIVE (chat-main, 2026-07)

ローリングアーカイブ: `history/chat-main.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-07-19 - Notes/Daily エディタ即クラッシュ修正（tiptap Suggestion PluginKey 衝突・PR #294）

#### 概要

Notes のアイテムクリックで詳細パネルが真っ白になる regression（#288 merge の [[ autocomplete 導入で顕在化）を Windows 機の chat-main で診断・修正。"/" スラッシュメニューと "[[" オートコンプリートが @tiptap/suggestion の共有デフォルト PluginKey に衝突し、両方を登録する Notes/Daily エディタが ProseMirror の RangeError でマウント時にクラッシュしていた。

#### 変更点

- **Root Cause**: `web/src/notes/slashCommand.ts` / `itemLinkSuggestion.ts` の両 `Suggestion({...})` が `pluginKey` 未指定 → 共有デフォルト `SuggestionPluginKey` に二重登録 → `RangeError: Adding different instances of a keyed plugin (suggestion$)`。実行時にのみ発生し型/build 検証は通過するため merge 前検出不可（運用どおり merge 後の chat-main 実ブラウザ確認で発覚）
- **Fix**: 各 Suggestion に module-level の固有 `PluginKey`（`"slashCommand"` / `"itemLinkSuggestion"`）を付与（2 files, +14 行・commit `11acaac0`）。一時 worktree `tmp-suggestion-key` 経由で push・push 後即削除（main 直 push 禁止準拠）
- **起票/追跡**: Issue #293（type:bug / sev:blocking / section:materials・DoD 付き）→ PR #294 が `Fixes #293`。issue-dispatch スキルは Windows 機に未配備のため gh 直接起票
- **検証**: web build（tsc -b --force + vite）0 / eslint 対象 2 ファイル 0 / role-qa 独立レビュー PASS（BLOCKING/IMPORTANT 0 — prosemirror-state の `Configuration` 実装を実測し、module-level PluginKey の複数エディタ共有はキー衝突判定が単一 EditorState 内のみのため安全と確証。MINOR 1 件 = const 配置の見た目のみ・見送り）。merge 後の実ブラウザ確認（Issue #293 DoD）は「予定」に登録

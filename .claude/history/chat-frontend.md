# HISTORY (chat-frontend)

### 2026-06-30 - カラートークン rename (notion-* → ink-*) + ClaudeDesign Lumen UI 新4部品

#### 概要

セマンティックなカラートークンの名前空間を `notion-*` → `ink-*`（Cobalt Ink ブランド由来）へ全面 rename し PR #111 を作成。並行して ClaudeDesign(claude.ai/design) の Lumen UI プロジェクトで新4部品を生成・検証した。

#### 変更点

- **token rename**: `tokens.css` `@theme`（`--color-notion-*` / `--shadow-notion-*` → `--color-ink-*` / `--shadow-ink-*`）+ `shared/src` / `shared/tests` / `web/src` のクラス（`bg-/text-/border-/shadow-/ring-notion-*`）+ doc（`CLAUDE.md §6` / `rules/frontend.md` / `coding-principles.md` / `design-system/PRINCIPLES.md` / 移行SSOT）を 1:1 置換。93ファイル・803 ins/803 del。製品名 "Notion"(大文字) は保持、`archive/` `history/` `known-issues/` と `frontend/`(FROZEN) は対象外。
- **検証**: スコープ内残存 `notion-` = 0（grep）/ `npm run dev`(vite v8) で `--color-ink-*` 正常コンパイル・HTTP 200・起動エラーなし / 実機目視OK（透明落ちなし）。commit `66a4a2f3` → PR #111（base main）。
- **ClaudeDesign**: Lumen UI(0dc4e02c) に Toast/Toaster/useToast・Sheet・Sidebar/SidebarGroup/NavItem・Menu/MenuItem/MenuSeparator を生成。`_lumen-ext/` に実ソース・stories・css。a11y（role/aria-live/focus trap/キーボード）とトークン規律（hex は Modal scrim 1箇所のみ）良好。
- **調査知見**: Lumen UI は life-editor の DS ではなく独立汎用ライブラリ `@lumen/ui` のコンパイル済みミラー。新規部品の生成・バンドル再コンパイルは claude.ai 側の仕事、Claude Code 側の DesignSync ツールは同期専用（auto-memory `project_lumen_ui_claudedesign` に記録）。出荷には Lumen トークン → `ink-*` の橋渡しが要る。
- **トラブル**: dev 初回の白画面は `web/.env.local`(VITE_SUPABASE_*) 未配置が原因で rename とは無関係。worktree は env 非共有のため main から copy で解消（gitignore・コミット対象外）。

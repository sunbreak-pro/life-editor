# HISTORY (chat-frontend)

### 2026-07-04 - Connect→shared Toast + Analytics per-range fetch（follow-up #6/#7 集約・PR #116）

#### 概要

並行オーケストレーションの follow-up 2本（#6 Connect エラー表示の Toast 化 / #7 Analytics の per-range 取得）を1ブランチ `feat/connect-toast-analytics-perrange` に集約し、role-qa（判定 MERGE 可）を通して PR #116 として squash merge。これで fan-out（A/B/C/D/doc-sync/#6/#7 = #112〜#116）が完了した。

#### 変更点

- **#6 Connect Toast 化**: SelectedNodeCard の inline `role=alert` を廃止し `onLinkError` コールバックで通知するだけの presentational に戻す。shared に ToastProvider/useToast の consumption 層（`shared/src/context/ToastContext.tsx`）を新設し、web MainScreen が Theme→Toast→Sync 順でマウント。ConnectScreen が reject を握り潰さず伝播 → danger トースト表示。`ConnectGraphLabels.linkCreateFailed/linkDeleteFailed` を必須化（英語フォールバック廃止）。commit `9ef47fd8`。
- **#7 Analytics per-range fetch**: AnalyticsScreen の全履歴一括取得（`2020-01-01`〜today）を廃止し、選択 DateRange 単位のみ取得。AnalyticsFilterContext に `onDateRangeChange`（latest-ref）追加、AnalyticsView が `onScheduleRangeChange`/`scheduleLoading` を任意受領、ScheduleTab にロードスケルトン。DateRange 型のみ Analytics バレルから公開（provider/hook は internal 維持）。commit `72c0ef26`。
- **検証**: 集約ゲート全段 PASS（shared tsc -b / vitest 49 files 547 tests / web build）。role-qa 判定 MERGE 可（ブロッカーなし・任意 nit 4件）。merge 後リモートブランチ `feat/connect-toast-analytics-perrange` 削除。
- **orchestration**: parallel-orchestrator の fan-out 完了。A/B/C/D/doc-sync/#6/#7 が #112/#113/#114/#115/#116 として全て main（`ce73f06d`）に着地。

### 2026-06-30 - カラートークン rename (notion-* → ink-*) + ClaudeDesign Lumen UI 新4部品

#### 概要

セマンティックなカラートークンの名前空間を `notion-*` → `ink-*`（Cobalt Ink ブランド由来）へ全面 rename し PR #111 を作成。並行して ClaudeDesign(claude.ai/design) の Lumen UI プロジェクトで新4部品を生成・検証した。

#### 変更点

- **token rename**: `tokens.css` `@theme`（`--color-notion-*` / `--shadow-notion-*` → `--color-ink-*` / `--shadow-ink-*`）+ `shared/src` / `shared/tests` / `web/src` のクラス（`bg-/text-/border-/shadow-/ring-notion-*`）+ doc（`CLAUDE.md §6` / `rules/frontend.md` / `coding-principles.md` / `design-system/PRINCIPLES.md` / 移行SSOT）を 1:1 置換。93ファイル・803 ins/803 del。製品名 "Notion"(大文字) は保持、`archive/` `history/` `known-issues/` と `frontend/`(FROZEN) は対象外。
- **検証**: スコープ内残存 `notion-` = 0（grep）/ `npm run dev`(vite v8) で `--color-ink-*` 正常コンパイル・HTTP 200・起動エラーなし / 実機目視OK（透明落ちなし）。commit `66a4a2f3` → PR #111（base main）。
- **ClaudeDesign**: Lumen UI(0dc4e02c) に Toast/Toaster/useToast・Sheet・Sidebar/SidebarGroup/NavItem・Menu/MenuItem/MenuSeparator を生成。`_lumen-ext/` に実ソース・stories・css。a11y（role/aria-live/focus trap/キーボード）とトークン規律（hex は Modal scrim 1箇所のみ）良好。
- **調査知見**: Lumen UI は life-editor の DS ではなく独立汎用ライブラリ `@lumen/ui` のコンパイル済みミラー。新規部品の生成・バンドル再コンパイルは claude.ai 側の仕事、Claude Code 側の DesignSync ツールは同期専用（auto-memory `project_lumen_ui_claudedesign` に記録）。出荷には Lumen トークン → `ink-*` の橋渡しが要る。
- **トラブル**: dev 初回の白画面は `web/.env.local`(VITE_SUPABASE_*) 未配置が原因で rename とは無関係。worktree は env 非共有のため main から copy で解消（gitignore・コミット対象外）。

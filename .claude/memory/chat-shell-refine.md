# MEMORY (chat-shell-refine)

## 進行中

### ⏸️ #304 Epic: アプリ操作の Undo/Redo 有効化（着手日: 2026-07-20・子 PR 1 完了）

**対象**: shared UndoRedo 基盤 + 各 API フックの undoRedo? 引数 + ヘッダー UI（参照 = git tag pre-tauri-removal）

- 前回: 子 PR 1（基盤 + taskTree）完了 = PR #316（Part of #304・open）。UndoRedoManager グローバル1本スタック + Provider + Buttons + Toast + ⌘Z 配線 + taskTree auto-connect + 単体13件
- 現在: 子 PR 1 レビュー待ち。#304 は Epic なので open 継続（Issue にコメントで進捗・見送り範囲記載済み）
- 次: 子 PR 2 = 残ドメイン展開（schedule/daily/note の undoRedo 配線・Routine は複雑なら見送り）。基盤 merge 後に着手が小さい差分で済む

## 直近の完了

- #304 子 PR 1: Undo/Redo 基盤 + taskTree（PR #316・Part of #304。UndoRedoManager/Provider/Buttons/Toast/⌘Z・単体13件。ブランチ = claude/shell-refine-304-foundation）✅（2026-07-20）
- #306 ヘッダー常設コマンドパレット検索フィールド（PR #315・Closes #306。ブランチ = claude/shell-refine-306）✅（2026-07-20）
- #307 アイテム操作パネル汎用化（PR #314・Closes #307。ブランチ = claude/shell-refine-307）✅（2026-07-20）
- #305 メインコンテンツ幅を全セクション max-w-lumen-wide に統一（PR #313・Closes #305。PageContainer fluid を中央寄せ+1120px 上限化・MainScreen width マッピング整理。ブランチ = claude/shell-refine-305）✅（2026-07-20）

- #172 PostgREST list read ページネーション（PR #243・Closes #172。postgrestFetchAll.ts 新設・全 Supabase サービス適用・sync-auditor PASS with notes・Medium 2 件反映済み・db-conventions §11 新設。ブランチ = claude/shell-refine-172）✅（2026-07-11）
- #173 docs-lint 機械検査（PR #241・Closes #173。scripts/docs-lint.sh 4 検査 + CI ジョブ + 既存違反 8 件修正 + 完了プラン 3 本 archive 移動。ブランチ = claude/shell-refine-173）✅（2026-07-11）
- #197 Tauri 残骸除去 Stage B+C（PR #236 merged 2026-07-11・#197 closed）✅（2026-07-11）

## 予定

- #304 子 PR 2: 残ドメイン（schedule/daily/note）の undoRedo 配線。基盤 PR #316 merge 後に着手（Routine は複雑なら見送り）
- shell-refine の 4 PR（#313/#314/#315/#316）は merge = こうだいさん操作。merge 後の実ブラウザ実測は §7.4 に従い chat-main 側
- PR #241 / #243 の merge 後実測（#172 は 1000 行超データ）も chat-main 側
- 未移植機能の移植再開時は #197 コメントのインベントリ + git tag `pre-tauri-removal` を参照元にする

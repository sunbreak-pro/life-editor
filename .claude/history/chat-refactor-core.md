# HISTORY (chat-refactor-core)

### 2026-08-02 - desktop Windows ビルド整備（Issue #529・PR #534 merged）

#### 概要

Windows 向け NSIS ビルドを整備した。win アイコンは electron-builder の PNG→ICO 自動変換で `resources/icon.png` 単一ソースのまま配線し、`npm run build:win` のローカル実測（インストーラ生成 + アイコン抽出照合）と CI への desktop ジョブ追加（typecheck + electron-vite build。NSIS パッケージングは ubuntu runner 不可のため除外）まで完了。

#### 変更点

- **desktop**: `electron-builder.yml` に `win.icon: ../resources/icon.png` 追加 / `package.json` に author 追加 / README に Windows build 手順 + SmartScreen 注意を追記
- **CI**: `.github/workflows/ci.yml` に desktop install/typecheck/build ステップ追加・cache-dependency-path に desktop/package-lock.json 追加
- **docs**: 移行 SSOT Phase 3 に Windows NSIS ローカルビルド緑の日付入りメモ追記（実機起動は #530 = chat-main 担当）

### 2026-08-02 - MobileDrawer フォーカストラップ（Issue #517・PR #535 merged）

#### 概要

#508 で切り出した `useDialogA11y` を MobileDrawer に配線し、独自の Escape リスナーを撤去してダイアログ系の焦点管理（初期フォーカス・Tab トラップ・復帰・レイヤー積み）を共通 hook に統一した。

#### 変更点

- **shared/components**: `MobileDrawer.tsx` — 独自 document keydown リスナー撤去 → `useDialogA11y({ open, onClose })` の ref をパネルに接続（`tabIndex={-1}` 付与）
- **shared/tests**: `mobileDrawer.test.tsx` に配線テスト 2 件追加（open 時フォーカス移動 + close 時復帰 / Modal 積層時の「1 Esc = 1 レイヤー」）
- **備考**: パネルの `onMouseDown` stopPropagation は #470 アンチパターン候補として PR 本文で chat-main へ申し送り（スコープ外）

### 2026-07-30 - Phase B Step 9（MainScreen hooks 切り出し・Issue #465・計画最終実装ステップ）

#### 概要

Phase B（web 画面 hooks 切り出し）の最終弾。MainScreen（951 行）をナビゲーション側 `useShellNavigation`・表示定義側 `useShellChrome` + 表示組み立て専念の画面（約 690 行）に分割した（挙動変更ゼロ・shared/src 無改変）。DataService 分割計画の実装ステップは全完了（残り Step 10 = merge 後の実ブラウザ確認は chat-main 担当）。

#### 変更点

- **web/hooks**: `useShellNavigation.ts` 新設（section switch + Materials/Schedule/Analytics/Briefing タブ state + persistLastSection + nav ショートカット/new-task/「[[」item-nav の pending intent）/ `useShellChrome.tsx` 新設（コマンドパレット項目・registry 派生 nav リスト・タブ帯 defs・shell ラベル・Materials カウントバッジ）。コードは配管以外 verbatim 移動、`MaterialsTab` 型と関連定数も hooks 側へ移設
- **検証**: shared vitest 1273 pass / shared build / web build すべて exit 0・変更 3 ファイル lint 0 件・session-verifier PASS
- **計画書**: `2026-07-28-refactor-dataservice-split.md` を Status COMPLETED にして `archive/` へ移動

### 2026-07-29 - Phase B Step 2（NotesView hooks 切り出し・PR #463）

#### 概要

Phase B（web 画面 hooks 切り出し）の第 2 弾。NotesView（1313 行）をリスト導出側 `useNoteListState`・リンク側 `useNoteLinking`・デスクトップ行部品 `NoteListRows` + 表示専念の画面（約 890 行）に分割した（挙動変更ゼロ・shared/src 無改変）。

#### 変更点

- **web/notes**: `hooks/useNoteListState.tsx` 新設（タグ見出し折りたたみの永続化 + 検索 → タグ束ね → 並べ替え → タグ絞り込みの導出パイプライン + ソート/フィルタ UI の派生値）/ `hooks/useNoteLinking.ts` 新設（LinkPanel 候補・「[[」リンク先ローダと editor コールバック・タブ跨ぎ選択の引き継ぎ）/ `NoteListRows.tsx` 新設（draggable 行 + droppable タグ見出し。DnD の sensors/handlers は view 側の useNoteTagDnd のまま）。コードは配管以外 verbatim 移動
- **検証**: shared vitest 1273 pass / shared build / web build すべて exit 0・変更 4 ファイル lint 0 problems・session-verifier PASS
- **PR**: #463 open（`claude/refactor-07-notesview-hooks`・merge はユーザーゲート。残り = Phase B Step 3 = MainScreen）

### 2026-07-29 - Phase B Step 1（BriefingScreen hooks 切り出し・PR #462）

#### 概要

Phase B（web 画面 hooks 切り出し）の第 1 弾。BriefingScreen（850 行）をデータ側 `useBriefingData` と編集側 `useDailySections` の 2 hook + 表示専念の画面（約 290 行）に分割した（挙動変更ゼロ・shared/src 無改変）。

#### 変更点

- **web/briefing**: `hooks/useBriefingData.ts` 新設（7 ソース fetch + syncVersion 再取得・集計・夕刊表示リスト・tray 派生・DataService 書き込みハンドラ）/ `hooks/useDailySections.ts` 新設（夕刊エディタ + mood・宣言 draft/echo 照合・debounce flush・セクションマージ保存。夕刊と宣言が共有すべき直列保存チェーンを hook 内部に閉じ込め構造的に保証）。コードは配管以外 verbatim 移動（dep 配列への setDailyContent 追加のみ = stable setter で挙動不変）
- **検証**: shared vitest 1273 pass / shared build / web build すべて exit 0・変更 3 ファイル lint 0 problems・session-verifier PASS
- **PR**: #462 open（`claude/refactor-06-briefing-hooks`・merge はユーザーゲート。#461 とファイル非重複で独立）

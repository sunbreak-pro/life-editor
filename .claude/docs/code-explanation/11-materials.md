# Materials セクション

`activeSection === "materials"` で表示される画面。**Daily / Notes / Files の 3 タブ**で「素材を作る / 書き留める / 開く」を扱う。`activeSection === "connect"` (Note ↔ WikiTag のグラフ) もデータ的には Materials の延長なので本ドキュメントに含める。

## 概要

| Materials タブ | 中身                                             |
| -------------- | ------------------------------------------------ |
| **Daily**      | 日付ベースの日報 / 日記 (`dailies` テーブル)     |
| **Notes**      | ツリー構造のノート (`notes` テーブル + フォルダ) |
| **Files**      | OS のファイルシステム上のローカルファイル        |

Notes 側に Template / WikiTag が絡む。Files 側は OS ネイティブのファイルを Tauri 経由で読み書きする。

## A. ルートとタブ切替

| 役割                   | パス                                                                | 何をしている                                                   |
| ---------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| Section 親             | `frontend/src/components/Materials/MaterialsView.tsx`               | 3 タブ切替 (`daily` / `notes` / `files`)、右サイドバー差し込み |
| Section 差し込み       | `frontend/src/App.tsx` (`case "materials":`)                        | サイドナビ選択時の mount                                       |
| Connect (隣接 Section) | `frontend/src/components/Ideas/ConnectView.tsx` (`case "connect":`) | Note / Daily / WikiTag の関係グラフ                            |

`MaterialsView.tsx::loadMaterialsTab` で localStorage `STORAGE_KEYS.MATERIALS_TAB` から復元。旧 `IDEAS_TAB` からのマイグレーションも内包。

## B. タブ別の画面コンポーネント

### Daily タブ

| ファイル                                                | 役割                      |
| ------------------------------------------------------- | ------------------------- |
| `frontend/src/components/Ideas/DailyView.tsx`           | 選択日の日報を表示・編集  |
| `frontend/src/components/Ideas/DailySidebar.tsx`        | 日付リスト (右サイドバー) |
| `frontend/src/components/Ideas/TemplateContentView.tsx` | テンプレート選択時の表示  |

### Notes タブ

| ファイル                                                | 役割                        |
| ------------------------------------------------------- | --------------------------- |
| `frontend/src/components/Ideas/NotesView.tsx`           | 選択ノートのリッチエディタ  |
| `frontend/src/components/Ideas/MaterialsSidebar.tsx`    | ノートツリー (右サイドバー) |
| `frontend/src/components/Ideas/NoteTreeNode.tsx`        | ツリーの 1 ノード描画 + DnD |
| `frontend/src/components/Ideas/NoteNodeContextMenu.tsx` | ノード右クリックメニュー    |
| `frontend/src/components/Ideas/TemplateManager.tsx`     | テンプレート一覧と編集      |
| `frontend/src/components/Ideas/TemplateContentView.tsx` | テンプレート本文表示        |
| `frontend/src/components/Ideas/BacklinksPane.tsx`       | 逆リンクペイン              |

### Files タブ

| ファイル                                                    | 役割                      |
| ----------------------------------------------------------- | ------------------------- |
| `frontend/src/components/Materials/FileExplorerView.tsx`    | エディタ + プレビュー本体 |
| `frontend/src/components/Materials/FileExplorerSidebar.tsx` | フォルダ / ファイルツリー |
| `frontend/src/components/Materials/FileEditor.tsx`          | ファイル編集              |
| `frontend/src/components/Materials/FileEditorToolbar.tsx`   | ツールバー (保存 / 開く)  |
| `frontend/src/components/Materials/FileContextMenu.tsx`     | 右クリックメニュー        |
| `frontend/src/components/Materials/fileIcons.ts`            | ファイルタイプ別アイコン  |

### Connect (`activeSection === "connect"`)

| ファイル                                                                                 | 役割                                                |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `frontend/src/components/Ideas/ConnectView.tsx`                                          | Connect 画面本体                                    |
| `frontend/src/components/Ideas/Connect/TagGraphView.tsx`                                 | WikiTag を中心としたグラフ表示 (React Flow)         |
| `frontend/src/components/Ideas/Connect/ConnectPanel.tsx`                                 | 中央パネル                                          |
| `frontend/src/components/Ideas/Connect/ConnectSidebar.tsx`                               | サイドバー                                          |
| `frontend/src/components/Ideas/Connect/CanvasControls.tsx`                               | キャンバス操作 UI                                   |
| `frontend/src/components/Ideas/Connect/CurvedEdge.tsx`                                   | 曲線エッジ描画                                      |
| `frontend/src/components/Ideas/Connect/NoteNodeComponent.tsx` / `DailyNodeComponent.tsx` | グラフ上のノード描画                                |
| `frontend/src/components/Ideas/Connect/ItemEditPopover.tsx`                              | ノード編集ポップオーバー                            |
| `frontend/src/components/Ideas/Connect/reactFlowMerge.ts`                                | React Flow の state 差分マージ (純粋関数、テスト済) |
| `frontend/src/components/Ideas/Connect/forceLayout.ts`                                   | フォースレイアウト計算                              |
| `frontend/src/components/Ideas/Connect/layoutTemplates.ts`                               | レイアウトプリセット                                |
| `frontend/src/components/Ideas/Connect/tagGraphStorage.ts`                               | グラフ配置の永続化 (localStorage)                   |
| `frontend/src/components/Ideas/Connect/TagGraphSelectionContext.ts`                      | 選択状態の Context                                  |
| `frontend/src/components/Ideas/Connect/Paper/`                                           | Paper Board (Tier 3 凍結機能)                       |

## C. 状態管理 (Context / Provider)

| Context               | 値定義                                             | Provider                                                              |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| `DailyContext`        | `frontend/src/context/DailyContextValue.ts`        | `frontend/src/context/DailyContext.tsx`                               |
| `NoteContext`         | `frontend/src/context/NoteContextValue.ts`         | `frontend/src/context/NoteContext.tsx`                                |
| `TemplateContext`     | `frontend/src/context/TemplateContextValue.ts`     | `frontend/src/context/TemplateContext.tsx`                            |
| `WikiTagContext`      | `frontend/src/context/WikiTagContextValue.ts`      | `frontend/src/context/WikiTagContext.tsx`                             |
| `FileExplorerContext` | `frontend/src/context/FileExplorerContextValue.ts` | `frontend/src/context/FileExplorerContext.tsx` (Mobile では Optional) |

Provider 順序 (CLAUDE.md §6.2): Template → Daily → Note → FileExplorer → (... Schedule 系 ...) → WikiTag。

> ⚠️ Mobile では `FileExplorerProvider` 省略。共有コンポーネントは `useFileExplorerContextOptional` で `null` ガード。

## D. Hooks (Materials 系)

| Hook                                                                                                                     | パス                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useDailyContext` / `useDaily`                                                                                           | `frontend/src/hooks/useDailyContext.ts` / `useDaily.ts`                                                                                                       |
| `useNoteContext` / `useNotes`                                                                                            | `frontend/src/hooks/useNoteContext.ts` / `useNotes.ts`                                                                                                        |
| `useNoteTreeDnd` / `useNoteTreeMovement`                                                                                 | `frontend/src/hooks/useNoteTreeDnd.ts` / `useNoteTreeMovement.ts`                                                                                             |
| `useNoteDragOverIndicator`                                                                                               | `frontend/src/hooks/useNoteDragOverIndicator.ts`                                                                                                              |
| `useNoteConnections` / `useNoteLinksGraph` / `useNoteLinkSync` / `useNoteLinkSuggestion`                                 | `frontend/src/hooks/useNoteConnections.ts` / `useNoteLinksGraph.ts` / `useNoteLinkSync.ts` / `useNoteLinkSuggestion.ts`                                       |
| `useTemplateContext`                                                                                                     | `frontend/src/hooks/useTemplateContext.ts`                                                                                                                    |
| `useWikiTags` / `useWikiTagsOptional` / `useWikiTagAPI` / `useWikiTagGroups` / `useWikiTagSync` / `useWikiTagSuggestion` | `frontend/src/hooks/useWikiTags.ts` / `useWikiTagsOptional.ts` / `useWikiTagAPI.ts` / `useWikiTagGroups.ts` / `useWikiTagSync.ts` / `useWikiTagSuggestion.ts` |
| `useFileExplorerContext(Optional)` / `useFileExplorer`                                                                   | `frontend/src/hooks/useFileExplorerContext.ts` / `useFileExplorerContextOptional.ts` / `useFileExplorer.ts`                                                   |
| `useScreenLockContextOptional`                                                                                           | `frontend/src/hooks/useScreenLockContextOptional.ts` (Daily / Notes の編集ロック)                                                                             |

## E. データ層 / バックエンド

| 役割                         | パス                                                                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DataService インターフェース | `frontend/src/services/DataService.ts`                                                                                                                                                                                 |
| Tauri 実装                   | `frontend/src/services/TauriDataService.ts`                                                                                                                                                                            |
| Rust コマンド (ノート)       | `src-tauri/src/commands/note_commands.rs`                                                                                                                                                                              |
| Rust コマンド (ノートリンク) | `src-tauri/src/commands/note_link_commands.rs` / `note_connection_commands.rs`                                                                                                                                         |
| Rust コマンド (日報)         | `src-tauri/src/commands/daily_commands.rs`                                                                                                                                                                             |
| Rust コマンド (テンプレート) | `src-tauri/src/commands/template_commands.rs`                                                                                                                                                                          |
| Rust コマンド (WikiTag)      | `src-tauri/src/commands/wiki_tag_commands.rs` / `wiki_tag_connection_commands.rs` / `wiki_tag_group_commands.rs`                                                                                                       |
| Rust コマンド (ファイル)     | `src-tauri/src/commands/files_commands.rs` / `copy_commands.rs`                                                                                                                                                        |
| 型                           | `frontend/src/types/note.ts` / `noteLink.ts` / `daily.ts` / `template.ts` / `wikiTag.ts` / `fileExplorer.ts`                                                                                                           |
| 同期定数                     | `src-tauri/src/sync/sync_engine.rs` (`notes` / `dailies` / `wiki_tags` / `templates` は `VERSIONED_TABLES`、`wiki_tag_assignments` / `wiki_tag_connections` / `note_connections` は `RELATION_TABLES_WITH_UPDATED_AT`) |

## F. 主要関数 / メソッド

- `MaterialsView.tsx::MaterialsView` — 3 タブ切替 + 右サイドバー差し込み。Notes / Daily / Files の Context をまとめて消費し、ハンドラを子に流す
- `MaterialsView.tsx::handleCopyNoteToFiles` — Note を物理ファイルへエクスポート (`DataService.copyNoteToFile`)
- `NoteContext.tsx::NoteProvider` — `useNotes` を内包、`createNote` / `createFolder` / `softDeleteNote` / `updateNote` / `persistWithHistory` を公開
- `DailyContext.tsx::DailyProvider` — `dailies` / `selectedDate` / `upsertDaily` / `deleteDaily`
- `useNoteTreeMovement.ts` — ツリー上のノード移動の純粋関数群 (テスト済)
- `useNoteLinksGraph.ts` — Note ↔ WikiTag のグラフ計算 (Connect ビューで使用)
- `useNoteLinkSync.ts` — Note 本文中の `[[wikiLink]]` を `wiki_tag_assignments` / `note_connections` と同期
- `FileExplorerContext.tsx::FileExplorerProvider` — ファイルツリー、開いているタブ、`openFile` / `closeFile` / `openInSystem`
- `Connect/reactFlowMerge.ts::merge*` — React Flow の `nodes` / `edges` の incremental マージ (純粋関数、テスト済)
- `Connect/tagGraphStorage.ts::loadGraphLayout` / `saveGraphLayout` — グラフ配置の永続化

## G. 副作用 / 注意点

- **Note / Daily / Template / WikiTag は Cloud Sync 対象** (`VERSIONED_TABLES`)。スキーマ変更時は §7.3 の手順と Cloud D1 マイグレーション (`cloud/db/migrations/`) を同時に更新
- **Note 本文中の `[[wikiLink]]`** は `useNoteLinkSync` が `wiki_tag_assignments` と `note_connections` に書き込む。本文の parsing ロジックを変えると Connect グラフの構造が変わる
- **`useNoteTreeMovement` は純粋関数で副作用なし**だが、永続化は `NoteContext::persistWithHistory` 経由で UndoRedo 履歴を作る。手で `updateNote` を呼ぶと Undo に乗らないので注意
- **Mobile では `FileExplorerProvider` 省略**。Files タブ自体が Desktop 専用 (Mobile 必須セクション = Schedule / Work / Notes / Settings、CLAUDE.md §2)
- **Connect ビュー (`TagGraphView`)** は React Flow を使用。グラフ配置は `tagGraphStorage` で localStorage 永続化されるので、デバッグで状態をリセットしたい時は LS キーを確認
- **Materials の Connect グラフ** は WikiTag / NoteConnection / NoteLink を全部使うため、Notes / Daily 側のデータ表現を変えるとここが壊れやすい
- **Files タブの読み書きは Tauri の `fs` plugin 経由**。Web 移行 (`refactor/web-first-v2`) では OPFS / OS native bridge に置き換え予定

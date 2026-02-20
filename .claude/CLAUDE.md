# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Notionライクなタスク管理 + 環境音ミキサー + プレイリスト + ポモドーロタイマーを組み合わせた没入型個人タスク管理デスクトップアプリ（Sonic Flow）。Electron + SQLite でスタンドアロン動作（バックエンドサーバー不要）。

---

## 開発コマンド

### 起動（Electron + Vite同時起動）

```bash
npm run dev     # tsc → concurrently: Vite(5173) + tsc --watch + Electron
npm run build   # Frontend + Electron ビルド
npm run start   # ビルド後にElectron起動
```

### Frontend単体

```bash
cd frontend && npm run dev          # Vite開発サーバー (port 5173)
cd frontend && npm run build        # tsc -b && vite build
cd frontend && npm run lint         # ESLint
cd frontend && npm run test         # Vitest（単発実行）
cd frontend && npm run test:watch   # Vitest（ウォッチモード）
cd frontend && npx vitest run src/path/to/File.test.tsx  # 単一テスト実行
```

### Electron単体

```bash
cd electron && npx tsc              # 一回コンパイル
cd electron && npx tsc --watch      # ウォッチモード
```

### パッケージング

```bash
npm run dist        # electron-builder
npm run dist:mac    # macOS向け
npm run dist:win    # Windows向け
```

### ネイティブモジュール再ビルド

```bash
npx electron-rebuild -f -w better-sqlite3
```

---

## アーキテクチャ

### 全体構成

```
Renderer (React 19 + Vite)
  ↓ window.electronAPI.invoke(channel, ...args)
Preload (contextBridge, チャンネルホワイトリスト)
  ↓ ipcRenderer.invoke
Main Process (Electron 35)
  ↓ ipcMain.handle
Repository層 (better-sqlite3 → userData/sonic-flow.db)
```

セキュリティ: `contextIsolation=true`, `nodeIntegration=false`, `preload.ts`でチャンネルホワイトリスト制御。

### データ永続化

**SQLite (better-sqlite3)** でローカルファイルに永続化。DBファイル: `userData/sonic-flow.db`（WALモード）。スキーマバージョン: V21。

テーブル: tasks, timer_settings, timer_sessions, sound_settings, sound_presets, memos, ai_settings, task_templates, notes, calendars, pomodoro_presets, sound_tag_definitions, sound_tag_assignments, sound_display_meta, sound_workscreen_selections, routines, routine_tag_definitions, routine_tag_assignments, schedule_items, playlists, playlist_items

**localStorage は UI状態のみ**（16キー、`constants/storageKeys.ts`）: theme, font-size, language, sidebar開閉/幅, 通知ON/OFF, メモタブ, エフェクト音量, アクティブカレンダーID, フォルダフィルタ, ソートモード, カレンダーモード, タイマープレイリストID, アクティブプレイリストID, ルーティンタイムスロット, フォルダ移動確認スキップ。

### DataService 抽象化レイヤー（重要）

フロントエンドは `DataService` インターフェース経由でデータアクセス。直接IPCを呼ばない。

```
frontend/src/services/
├── DataService.ts          # インターフェース定義（全ドメインの操作）
├── ElectronDataService.ts  # IPC実装（window.electronAPI.invoke）
├── dataServiceFactory.ts   # シングルトンファクトリ
└── index.ts                # getDataService() エクスポート
```

各Context/hookは `getDataService()` 経由でデータ操作を行う。

### IPC チャンネル一覧

`preload.ts` の `ALLOWED_CHANNELS` で許可制御。プレフィックス規則:

- `db:tasks:*` / `db:timer:*` / `db:sound:*` / `db:memo:*` — DB CRUD
- `db:notes:*` / `db:calendars:*` — DB CRUD
- `db:customSound:*` — カスタムサウンド管理（blob含む）
- `db:routines:*` / `db:routineTags:*` / `db:scheduleItems:*` — Schedule系 CRUD
- `db:playlists:*` — プレイリスト・楽曲管理
- `data:export` / `data:import` / `data:reset` — JSON一括入出力・リセット
- `diagnostics:*` — ログ閲覧・メトリクス・システム情報
- `updater:*` — 自動更新（チェック・ダウンロード・インストール）
- `app:migrateFromLocalStorage` — 初回マイグレーション

### Electron メインプロセス構成

```
electron/
├── main.ts              # エントリポイント（BrowserWindow作成、dev/prod分岐）
├── preload.ts           # contextBridge + チャンネルホワイトリスト
├── logger.ts            # electron-log ラッパー
├── menu.ts              # アプリケーションメニュー定義
├── updater.ts           # electron-updater 自動更新処理
├── windowState.ts       # ウィンドウ状態永続化
├── types.ts             # メインプロセス型定義
├── database/
│   ├── db.ts            # better-sqlite3 シングルトン初期化
│   ├── migrations.ts    # テーブルスキーマ定義（V21）
│   └── *Repository.ts   # 12リポジトリ（task/timer/sound/memo/customSound/note/calendar/pomodoroPreset/routine/routineTag/scheduleItem/playlist）
├── ipc/
│   ├── registerAll.ts   # 全ハンドラ一括登録（個別try/catch付き）
│   ├── handlerUtil.ts   # エラーハンドリング共通化
│   ├── ipcMetrics.ts    # IPC応答時間自動計測
│   └── *Handlers.ts     # ドメイン別IPCハンドラ（16ファイル: task/timer/sound/memo/customSound/note/calendar/pomodoroPreset/routine/routineTag/scheduleItem/playlist/app/dataIO/diagnostics/updater）
```

### フロントエンド構成

**Context Provider スタック** (`main.tsx`):

```
StrictMode → ErrorBoundary → ThemeProvider → UndoRedoProvider → TaskTreeProvider → CalendarProvider → MemoProvider → NoteProvider → ScheduleProvider → TimerProvider → AudioProvider → App
```

**ルーティング**: React Routerなし。`App.tsx`が`activeSection`状態でセクション（tasks/memo/music/work/schedule/analytics/trash/settings/tips）を切り替え。

**レイアウト構成** (3カラム):

```
App (状態オーケストレーター)
├── Sidebar (240px固定, ナビゲーション)
├── SubSidebar (リサイズ可能160-400px)
│   └── TaskTree (Inbox + Projects + Completed)
└── MainContent (flex-1)
    └── TaskDetail | MemoView | WorkScreen | CalendarView | AnalyticsView | TrashView | Settings | Tips
```

WorkScreenはモーダルオーバーレイとしても表示可能（`isTimerModalOpen`）。

**TaskNode データモデル** (`types/taskTree.ts`):

- フラット配列 + `parentId`参照で階層を表現（ネストツリーではない）
- `type`: `'folder' | 'task'` — typeが振る舞いを決定
- フォルダは5階層までネスト可能（`MAX_FOLDER_DEPTH = 5`）、タスクはどこにでも配置可能
- ソフトデリート: `isDeleted`フラグ → TrashViewから復元可能（Tasks/Notes/Memos/Routines/CustomSounds が対応）

**グローバル Undo/Redo システム** (`components/shared/UndoRedo/`):

- コマンドパターン + ドメイン別スタック（taskTree/memo/note/calendar/routine/scheduleItem/playlist/sound）
- `UndoRedoManager` がドメインごとの undo/redo スタックを管理
- Cmd+Z / Cmd+Shift+Z でアクティブドメインの操作を元に戻す/やり直し
- INPUT/TEXTAREA/contenteditable 内ではスキップ（TipTap内蔵undoと競合しない）
- 除外: Timer操作、TipTap content更新、customSound add/remove（blob不可逆）

**主要フック**:

- `useTaskTreeAPI` — タスクツリーCRUD（IPC経由SQLite永続化）、内部で分割: `useTaskTreeCRUD` / `useTaskTreeDeletion` / `useTaskTreeMovement`
- `useTaskTreeHistory` / `useTaskTreeKeyboard` — Undo/Redo履歴管理・キーボード操作
- `useLocalSoundMixer` — サウンドミキサー状態管理（ボリューム、有効/無効）
- `useAudioEngine` — Web Audio APIによるリアルタイム再生・フェードイン/アウト
- `useCustomSounds` — カスタムサウンドメタデータ + IPC blob管理
- `usePlaylistPlayer` / `usePlaylistEngine` / `usePlaylistData` — プレイリスト再生制御・データ管理
- `useRoutines` / `useRoutineTags` / `useRoutineTagAssignments` — ルーティンCRUD・タグ管理
- `useAppCommands` / `useAppKeyboardShortcuts` — グローバルコマンド・ショートカット
- `useTimerContext` / `useTaskTreeContext` / `useAudioContext` / `useMemoContext` / `useNoteContext` / `useCalendarContext` / `useScheduleContext` — Context消費用ラッパー

**タイマーシステム**:

- `TimerContext`がクライアントサイド`setInterval`でカウントダウン
- `activeTask`（タイマー対象）と`selectedTaskId`（詳細表示対象）は独立
- WORK → BREAK → LONG_BREAK を自動遷移
- モーダルを閉じてもバックグラウンドで継続

**プレイリスト**: タイマー実行時に選択プレイリストを自動再生。楽曲をシーケンシャル再生（1曲ずつ順番→ループ）。DnD並び替え、シャッフル/リピート（off/one/all）、シークバー、ボリュームコントロール。

**ルーティンタグシステム**: ルーティンに多対多のカラータグ（Morning/Afternoon/Night等）を付与。`routine_tag_definitions` + `routine_tag_assignments` テーブルで管理。

**ドラッグ&ドロップ**: `@dnd-kit`使用。`moveNode`（並び替え）と`moveNodeInto`（階層移動）は別操作。循環参照防止あり。

**リッチテキスト**: TipTap (`@tiptap/react`) でタスクメモ編集（MemoEditor）。`React.lazy`で遅延ロード。スラッシュコマンド対応。

**IDはString型**: `"task-xxx"`/`"folder-xxx"`形式。

**i18n**: `react-i18next`使用。対応言語: en/ja。ロケールファイル: `frontend/src/i18n/locales/{en,ja}.json`。言語設定は`localStorage`（`sonic-flow-language`）に保存。

### テスト構成

テストファイルはソースと同じディレクトリに配置（`*.test.ts` / `*.test.tsx`）。Vitest + Testing Library + jsdom。

テストユーティリティ（`frontend/src/test/`）:

- `setup.ts` — localStorage/Notification/electronAPIのモック
- `mockDataService.ts` — DataServiceの全メソッドモック
- `renderWithProviders.tsx` — 全Providerラップ済みrender関数

---

## コーディング規約

| 種別            | 規則                  | 例                       |
| --------------- | --------------------- | ------------------------ |
| コンポーネント  | PascalCase            | `TaskList.tsx`           |
| フック          | camelCase + use接頭辞 | `useTasks.ts`            |
| 変数・関数      | camelCase             | `taskList`, `fetchTasks` |
| 定数            | SCREAMING_SNAKE_CASE  | `API_BASE_URL`           |
| Context Value型 | PascalCase            | `AudioContextValue.ts`   |

- Frontend: ESLint設定に従う
- コメントは必要最小限

---

## コミット規約

```
<type>: <subject>
```

type: `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore`

---

## 作業時の注意点

- **README.md更新必須**: コード変更の作業完了時は必ず以下を実施:
  1. 開発ジャーナルセクションに日付付きエントリを追加（降順、最新が先頭）
  2. 機能追加・削除時は「主な機能」セクションも更新
  3. アーキテクチャ変更時は「技術スタック」「セットアップ」セクションも更新
- **音源ファイル**: リポジトリにコミット禁止（`public/sounds/`は`.gitignore`対象）
- **IPC追加時**: `preload.ts`の`ALLOWED_CHANNELS`、`electron/ipc/`のハンドラ、`ElectronDataService.ts`の3箇所を更新

---

## ドキュメント体系

| ディレクトリ                           | 用途                                |
| -------------------------------------- | ----------------------------------- |
| `.claude/feature_plans/`               | 実装プラン（PLANNED / IN_PROGRESS） |
| `.claude/archive/`                     | 完了済みプラン                      |
| `.claude/docs/Application_Overview.md` | 仕様書                              |
| `.claude/docs/adr/`                    | アーキテクチャ決定記録              |
| `TODO.md`                              | ロードマップ                        |
| `CHANGELOG.md`                         | 完了タスク履歴                      |

ライフサイクル: `feature_plans/` → `archive/`

**プラン完了時の手順**:

1. プランファイル内の Status を `COMPLETED` に更新
2. `feature_plans/` から `archive/` へファイルを移動
3. `CHANGELOG.md` に完了内容を追記

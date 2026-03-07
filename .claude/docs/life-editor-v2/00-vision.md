# life-editor v2 — プロジェクトビジョン & 背景

## このドキュメントの目的

Sonic Flow（notion-timer）を「life-editor v2」へ進化させるための全体構想を記述する。
以降の Step 別計画書（01〜04）はこのドキュメントを前提とする。

---

## 1. なぜ作るのか

### 既存ツールの限界

現在、スケジュール管理に Google Calendar、タスク・メモ管理に Notion を使っている。
これらのツールには以下の課題がある:

- **AI 連携が閉じている**: Notion AI は Notion 内でしか動作しない。自分のワークフロー全体を横断する AI アシスタントが存在しない
- **カレンダーとタスクが分離**: Google Calendar と Notion のタスクは連動しない。手動で転記する手間がある
- **メモとスケジュールが紐付かない**: 会議のメモを後から探すのが大変。日付 → タスク → メモの自然な導線がない

### life-editor v1 の試行と教訓

Wails（Go + React）で life-editor v1 を開発した。得られた教訓:

- **Markdown ファイルベースのデータ管理は脆弱**: パースの複雑さ、構造化クエリの困難さ
- **ファイルツリー中心の UI は目的に合わない**: カレンダーがメインなのにファイル管理が前面に出てしまう
- **要件が広がりすぎた**: Notion 風リッチエディタ、Obsidian 風グラフビュー等、手を広げすぎて完成しなかった

### notion-timer（Sonic Flow）の資産

別プロジェクトとして開発した Sonic Flow は、すでに以下を実現している:

- カレンダー（月/週ビュー、タスク重なり処理、日付ナビゲーション）
- SQLite + Repository 層（15 リポジトリ、WAL モード）
- TipTap リッチエディタ（JSON 保存、SlashCommand）
- タスク管理（フォルダ階層、ソフト削除、Undo/Redo）
- ポモドーロタイマー、環境音ミキサー、Analytics
- i18n（日/英）、ダークモード、キーボードショートカット

**→ この Sonic Flow をベースに、ターミナル + MCP Server を追加するのが最小コストで最大の効果を得る方法。**

---

## 2. 何を作るのか

### 一言定義

**カレンダー中心の AI 連携ワークスペース**

ターミナルから Claude Code に自然言語で指示すると、MCP Server 経由で SQLite データベースが直接操作され、カレンダー UI にリアルタイム反映される。

### コアシナリオ

**朝の計画**:

1. アプリ起動 → カレンダーに今日の予定が表示
2. ターミナルで「今日のタスクの優先順位を整理して」と Claude に指示
3. Claude が MCP ツールでタスクを取得・再配置
4. カレンダーが即座に更新される

**予定の追加**:

1. カレンダーの日付クリック → ポップオーバーで予定作成
2. タスク詳細パネルでメモを記入
3. SQLite に即座に保存

**Claude による整理**:

1. 「今週の未完了タスクを来週に移動して」と指示
2. Claude が MCP ツールで一括更新
3. カレンダーに即座に反映

### 技術アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│  Electron App (life-editor v2)                  │
│                                                 │
│  ┌──────────────┐  ┌────────────────────────┐  │
│  │  Renderer     │  │  Main Process          │  │
│  │  (React 19)   │  │                        │  │
│  │               │  │  ┌──────────────────┐  │  │
│  │  Calendar     │←→│  │  IPC Handlers    │  │  │
│  │  Tasks        │  │  │  (既存 + 新規)    │  │  │
│  │  Memo         │  │  └──────────────────┘  │  │
│  │  Terminal     │  │                        │  │
│  │  Work         │  │  ┌──────────────────┐  │  │
│  │  Analytics    │  │  │  Terminal Manager │  │  │
│  │               │  │  │  (node-pty)      │  │  │
│  └──────────────┘  │  └──────────────────┘  │  │
│                     │                        │  │
│                     │  ┌──────────────────┐  │  │
│                     │  │  SQLite (WAL)    │  │  │
│                     │  │  sonic-flow.db   │  │  │
│                     │  └────────┬─────────┘  │  │
│                     └───────────┼────────────┘  │
└─────────────────────────────────┼───────────────┘
                                  │ (同一 DB ファイル)
┌─────────────────────────────────┼───────────────┐
│  MCP Server (別プロセス)         │               │
│                                  │               │
│  ┌──────────────────────────────┘               │
│  │  better-sqlite3 (読み書き)                    │
│  │  ← Claude Code が stdio で呼び出す           │
│  └──────────────────────────────────────────────│
└─────────────────────────────────────────────────┘
```

### 既存機能の扱い

**すべて保持する。** ポモドーロタイマー、環境音ミキサー、プレイリスト、Analytics、Tips — これらは動作しており削除のコストに見合わないため、そのまま残す。

---

## 3. 実装方針

### Phase A（本計画の対象）

既存の Sonic Flow に以下を追加し、日常使用を開始する:

| Step   | 内容                                          | 計画書                |
| ------ | --------------------------------------------- | --------------------- |
| Step 1 | ターミナルの追加（node-pty + xterm.js）       | `01-terminal.md`      |
| Step 2 | MCP Server の構築                             | `02-mcp-server.md`    |
| Step 3 | Claude Code 設定の自動化 + Claude 検知        | `03-claude-setup.md`  |
| Step 4 | UI 調整（デフォルト画面、Sidebar、StatusBar） | `04-ui-adjustment.md` |

### Phase B（Phase A 完了後に検討）

日常使用からのフィードバックで決定。候補:

- MCP ツールの拡充（分析系、提案系）
- Markdown エクスポート
- ルーティン/テンプレート連携強化
- アプリ内 Claude 統合（Anthropic API 直接利用）

---

## 4. 参照情報

### リポジトリ

| リポジトリ                   | パス                        | 用途                                              |
| ---------------------------- | --------------------------- | ------------------------------------------------- |
| **notion-timer（ベース）**   | `~/dev/apps/notion-timer/`  | 実装対象。ここに機能を追加する                    |
| **life-editor v1（参照元）** | `~/dev/Claude/life-editor/` | ターミナル実装、Claude 検知ロジックの移植時に参照 |

### life-editor v1 のターミナル関連コード（移植元）

| ファイル                                             | 内容                                       |
| ---------------------------------------------------- | ------------------------------------------ |
| `internal/terminal/session_manager.go`               | セッション管理、PTY 起動、イベント発行     |
| `internal/terminal/pane.go`                          | PTY ラッパー、リサイズ、OutputBuffer       |
| `internal/terminal/output_buffer.go`                 | 512KB リングバッファ                       |
| `internal/terminal/claude_detector.go`               | Claude Code 実行状態検知（正規表現ベース） |
| `internal/terminal/layout.go`                        | 分割ペインのツリー構造                     |
| `internal/terminal/osc_parser.go`                    | OSC エスケープシーケンス解析               |
| `internal/terminal/port_detector.go`                 | TCP LISTEN ポート検出                      |
| `frontend/src/components/terminal/TerminalPanel.tsx` | セッションタブ、レイアウト管理             |
| `frontend/src/components/terminal/TerminalPane.tsx`  | xterm.js インスタンス、I/O 処理            |
| `frontend/src/components/terminal/SplitLayout.tsx`   | 再帰的分割レイアウト                       |
| `frontend/src/store/sessionStore.ts`                 | Zustand ストア（セッション、メタデータ）   |
| `frontend/src/hooks/terminal/useSessionList.ts`      | セッション一覧の初期化・同期               |
| `frontend/src/hooks/terminal/useTerminalMetadata.ts` | イベントリスナー + ポーリング              |

### MCP 公式リファレンス

- MCP SDK: `@modelcontextprotocol/sdk`
- Claude Code の MCP 設定: `~/.claude/settings.json` の `mcpServers` フィールド
- 通信方式: stdio（stdin/stdout で JSON-RPC）

### 変換ルール（Go/Wails → Electron）

life-editor v1 のコードを notion-timer に移植する際の対応表:

| life-editor (Go + Wails)                                | notion-timer (Electron)                            |
| ------------------------------------------------------- | -------------------------------------------------- |
| `creack/pty`                                            | `node-pty`                                         |
| `runtime.EventsEmit(ctx, "event", data)`                | `mainWindow.webContents.send("event", data)`       |
| `EventsOn("event", callback)`                           | `window.electronAPI.on("event", callback)`         |
| Go Binding `import { Method } from '../wailsjs/go/...'` | `window.electronAPI.invoke("channel", ...)`        |
| `sync.Mutex`                                            | `better-sqlite3` の同期 API（排他制御不要）        |
| zustand ストア                                          | React Context（notion-timer の既存パターンに従う） |

---

## 5. 既存アーキテクチャの制約・注意点

### IPC チャンネル追加の手順（厳守）

notion-timer で新しい IPC チャンネルを追加する場合、**必ず以下の 3 箇所**を更新する:

1. `electron/preload.ts` の `ALLOWED_CHANNELS` に追加
2. `electron/ipc/` にハンドラファイル作成 → `registerAll.ts` に登録
3. `frontend/src/services/ElectronDataService.ts` にメソッド追加（DataService 抽象化経由）

### Context Provider の追加

新しい Context を追加する場合、`frontend/src/main.tsx` のプロバイダスタックに挿入する。
現在の順序: Theme → UndoRedo → TaskTree → Calendar → Memo → Note → Schedule → Timer → Audio → App

### SQLite 並行アクセス

アプリ（Electron main）と MCP Server の両方が同じ DB ファイルにアクセスする。

- WAL モード有効（既存設定）→ 並行読み込みは問題なし
- 書き込み競合: `PRAGMA busy_timeout = 5000` で待機
- MCP Server は独立プロセスのため、DB パスをコマンドライン引数で受け取る

### node-pty の Electron 統合

node-pty はネイティブモジュール。Electron のバージョンに合わせた rebuild が必要:

```bash
npx electron-rebuild -f -w better-sqlite3 -w node-pty
```

`package.json` の `postinstall` スクリプトを更新し、better-sqlite3 と node-pty の両方を rebuild すること。

### SectionId について

`frontend/src/types/taskTree.ts` で定義されている `SectionId` 型は現在:

```typescript
type SectionId =
  | "tasks"
  | "memo"
  | "work"
  | "analytics"
  | "trash"
  | "settings"
  | "tips";
```

**TerminalPanel は SectionId に追加しない。** ターミナルは独立した「セクション」ではなく、全セクション共通の下部パネルとして表示する（VSCode のターミナルと同じ位置づけ）。SectionId の変更は不要。

### フロントエンドの状態管理パターン

notion-timer は **React Context + カスタムフック** パターンを使用（zustand ではない）。
life-editor v1 の zustand ストアを移植する場合は Context に変換するか、新規で Context を作成する。

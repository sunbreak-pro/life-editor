# Step 2: MCP Server の構築

> 前提: `00-vision.md` と `01-terminal.md` が完了していること

## 目的

Claude Code が Life Editor の SQLite データベースにアクセスできる MCP Server を構築する。
これにより、ターミナル内の Claude Code から自然言語でタスク・スケジュール・メモを操作できるようになる。

---

## 方針

### やること

1. **独立した Node.js MCP Server を構築**: `mcp-server/` ディレクトリに配置
2. **既存の SQLite スキーマに対する CRUD ツールを公開**: タスク、スケジュール、メモ、ノートの読み書き
3. **DB 変更後のアプリ UI 更新の仕組み**: ポーリングベースで Renderer がデータを再取得

### やらないこと（Phase A では）

- リアルタイム通知（Unix Domain Socket 等での Push 通知）— ポーリングで開始
- 高度な分析ツール（週間サマリー、生産性レポート等）
- ルーティン操作ツール
- MCP Server の自動起動（手動 or Claude Code 設定で起動。Step 3 で自動化）

---

## MCP とは何か

MCP（Model Context Protocol）は Anthropic が策定したプロトコルで、AI モデル（Claude）が外部のデータやツールにアクセスするための標準仕様。

- **通信方式**: stdio（stdin/stdout で JSON-RPC メッセージをやり取り）
- **Claude Code の対応**: Claude Code はネイティブで MCP Server をサポート。`~/.claude/settings.json` に登録すると自動接続
- **SDK**: `@modelcontextprotocol/sdk` パッケージで簡単にサーバーを実装できる

---

## 技術構成

### ディレクトリ構造

```
Life Editor/
├── mcp-server/              ← 新規作成
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts         # エントリポイント（stdio MCP Server）
│       ├── db.ts            # SQLite 接続（better-sqlite3）
│       ├── tools.ts         # ツール定義・ルーティング
│       └── handlers/
│           ├── taskHandlers.ts
│           ├── scheduleHandlers.ts
│           └── memoHandlers.ts
```

### 依存パッケージ

- `@modelcontextprotocol/sdk` — MCP Server SDK
- `better-sqlite3` — SQLite アクセス（Electron 側と同じライブラリ）

### DB パスの受け渡し

MCP Server は独立プロセスとして起動されるため、DB ファイルのパスをコマンドライン引数で受け取る:

```bash
node mcp-server/dist/index.js /path/to/life-editor.db
```

Electron アプリの `userData` ディレクトリ内の DB ファイルと同じものを参照する。

---

## 公開ツール一覧

### タスク操作

| ツール名      | パラメータ                                                                              | 説明                           |
| ------------- | --------------------------------------------------------------------------------------- | ------------------------------ |
| `list_tasks`  | `status?` ("TODO"/"DONE"/"ALL"), `date_range?` ("YYYY-MM-DD..YYYY-MM-DD"), `folder_id?` | タスク一覧取得                 |
| `get_task`    | `id`                                                                                    | タスク詳細取得（content 含む） |
| `create_task` | `title`, `parent_id?`, `scheduled_at?`, `scheduled_end_at?`, `is_all_day?`              | タスク作成                     |
| `update_task` | `id`, `title?`, `status?`, `scheduled_at?`, `scheduled_end_at?`, `content?`             | タスク更新                     |
| `delete_task` | `id`                                                                                    | タスクのソフト削除             |

### メモ操作

| ツール名      | パラメータ            | 説明                  |
| ------------- | --------------------- | --------------------- |
| `get_memo`    | `date` ("YYYY-MM-DD") | デイリーメモ取得      |
| `upsert_memo` | `date`, `content`     | デイリーメモ作成/更新 |

### ノート操作

| ツール名      | パラメータ                 | 説明       |
| ------------- | -------------------------- | ---------- |
| `list_notes`  | `query?`                   | ノート検索 |
| `create_note` | `title`, `content?`        | ノート作成 |
| `update_note` | `id`, `title?`, `content?` | ノート更新 |

### スケジュール操作

| ツール名        | パラメータ            | 説明                                                |
| --------------- | --------------------- | --------------------------------------------------- |
| `list_schedule` | `date` ("YYYY-MM-DD") | 特定日の全予定取得（タスク + スケジュールアイテム） |

---

## 実装の方向性

### MCP Server のエントリポイント

`@modelcontextprotocol/sdk` の `Server` クラスと `StdioServerTransport` を使って stdio ベースの MCP Server を作成する。

基本的な流れ:

1. コマンドライン引数から DB パスを受け取る
2. better-sqlite3 で DB に接続（WAL モード、busy_timeout = 5000）
3. ツールを登録
4. StdioServerTransport で接続を開始

### ツールハンドラの実装

各ツールハンドラは:

1. 入力パラメータのバリデーション
2. SQL クエリの実行（better-sqlite3 の同期 API）
3. 結果を MCP レスポンスとして返却

**重要**: Life Editor の既存 Repository パターン（`electron/database/` 内）を参考にする。
同じテーブルに対する同じクエリを書くことになるが、MCP Server は独立プロセスなので Repository を直接 import はできない。SQL を直接書くか、共通モジュールに抽出するか検討する。

### content フィールドの扱い

タスクとメモの `content` フィールドは TipTap JSON 形式で保存されている。
MCP Server 経由で Claude が content を操作する場合:

- **読み取り**: JSON をそのまま返す。Claude はパース可能
- **書き込み**: プレーンテキストを受け取り、シンプルな TipTap JSON に変換する。または、Claude にTipTap JSON 形式を直接指示する

Phase A ではシンプルにプレーンテキストのみ対応し、TipTap JSON への変換は最小限にする。

### DB 変更 → アプリ UI 更新

MCP Server が DB を変更した後、Electron アプリの UI に反映する必要がある。

**Phase A のアプローチ: ポーリング**

Renderer 側で一定間隔（2秒）で DB を再クエリして差分を検知する。

**ポーリングの有効条件**: TerminalPanel が開いている間のみ有効にする。
TerminalPanel の開閉状態を管理する仕組み（Context, localStorage, またはコンポーネント内 state）を用意し、開いているときだけポーリングを実行する。

**ポーリング対象**: TaskTreeContext の `refetch` 相当の関数を呼び出し、タスク一覧を再取得する。
既存の TaskTreeContext に「外部からデータ再読み込みをトリガーする」関数を追加し、ポーリングフック（`useExternalDataSync` のようなもの）から呼び出す。

**ポーリング対象の範囲**: Phase A ではタスク一覧のみ。メモやノートは Claude が操作してもユーザーが画面遷移すれば再取得されるため、ポーリング不要。

**将来（Phase B）**: MCP Server から IPC 経由で Renderer にプッシュ通知を送る仕組みに切り替え可能。

---

## 参照すべき既存コード

### Life Editor のデータベース層

| ファイル                                      | 参照ポイント                      |
| --------------------------------------------- | --------------------------------- |
| `electron/database/migrations.ts`             | テーブルスキーマの正確な定義      |
| `electron/database/taskRepository.ts`         | タスク CRUD の SQL クエリ         |
| `electron/database/memoRepository.ts`         | メモ CRUD の SQL クエリ           |
| `electron/database/noteRepository.ts`         | ノート CRUD の SQL クエリ         |
| `electron/database/scheduleItemRepository.ts` | スケジュールアイテムの SQL クエリ |

### MCP SDK の使い方

`@modelcontextprotocol/sdk` の基本パターン:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "life-editor", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ツール一覧を返すハンドラ
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{ name: "...", description: "...", inputSchema: { ... } }]
}));

// ツール実行ハンドラ
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "list_tasks": return handleListTasks(request.params.arguments);
    // ...
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 注意事項

### SQLite 並行アクセス

- Electron アプリと MCP Server が同じ DB ファイルに同時アクセスする
- WAL モード + `busy_timeout = 5000` で対処
- 書き込みは排他的だが、5秒以内にロック取得できればリトライされる

### ビルドと実行

MCP Server は TypeScript で書き、`tsc` でコンパイルして `node` で実行する。
`mcp-server/package.json` に `build` スクリプトを用意する。

Claude Code からの起動コマンドは:

```
node /path/to/Life Editor/mcp-server/dist/index.js /path/to/life-editor.db
```

### タスク ID の形式

Life Editor のタスク ID は `"task-{timestamp}"` または `"folder-{timestamp}"` 形式。
MCP ツールのレスポンスにはこの ID をそのまま返す。

---

## 完了条件

- [ ] `mcp-server/` ディレクトリが作成され、`npm run build` でコンパイルできる
- [ ] `node mcp-server/dist/index.ts <db-path>` で MCP Server が起動する
- [ ] Claude Code から `list_tasks` でタスク一覧が取得できる
- [ ] Claude Code から `create_task` でタスクが作成でき、DB に反映される
- [ ] Claude Code から `update_task` でタスクが更新できる
- [ ] Claude Code から `get_memo` / `upsert_memo` でメモが操作できる
- [ ] MCP Server が DB を変更した後、アプリの UI が（ポーリングにより）更新される
- [ ] 既存機能が正常動作する

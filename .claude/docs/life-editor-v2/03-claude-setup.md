# Step 3: Claude Code 設定の自動化 + Claude 検知

> 前提: `01-terminal.md`（ターミナル動作）と `02-mcp-server.md`（MCP Server ビルド済み）が完了していること

## 目的

1. MCP Server を Claude Code に自動登録し、ユーザーが手動設定なしで Claude Code から life-editor のツールを使えるようにする
2. ターミナルで Claude Code の実行状態を検知し、UI に表示する

---

## Part 1: Claude Code 設定の自動登録

### やること

Electron アプリの起動時（または設定画面から）に、`~/.claude/settings.json` へ MCP Server の設定を自動書き込みする。

### Claude Code の MCP 設定の仕組み

Claude Code は `~/.claude/settings.json` の `mcpServers` フィールドを読み取り、登録された MCP Server に自動接続する。

```json
{
  "mcpServers": {
    "life-editor": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-server/dist/index.js",
        "/absolute/path/to/life-editor.db"
      ]
    }
  }
}
```

### 実装の方向性

**claudeSetup モジュール**を作成する。責務:

1. `~/.claude/settings.json` を読み取る（存在しなければ空オブジェクトで初期化）
2. `mcpServers["life-editor"]` エントリを追加/更新する
3. MCP Server のパス: Electron アプリのリソースディレクトリ内の `mcp-server/dist/index.js` の絶対パス
4. DB のパス: Electron の `app.getPath("userData")` + `/life-editor.db` の絶対パス
5. ファイルに書き戻す（既存の他の設定は保持する）

**呼び出しタイミング**:

- アプリ初回起動時（自動）
- 設定画面の「Claude Code 連携を設定」ボタン（手動）
- MCP Server のパスが変わった場合（アプリ更新後）

### 注意事項

- `~/.claude/settings.json` は Claude Code が管理するファイル。他の設定（permissions 等）を壊さないよう、必ずマージで更新する
- ファイルが存在しない場合は新規作成する
- パーミッションを変更しない（Claude Code が期待するパーミッションを保持）
- `~/.claude/` ディレクトリが存在しない場合は Claude Code がインストールされていないと判断し、スキップ or ユーザーに通知

---

## Part 2: Claude Code 実行状態の検知

### やること

ターミナルの PTY 出力を監視し、Claude Code の実行状態（idle / thinking / generating 等）を検知する。

### 検知すべき状態

| 状態         | 意味                             | 検知方法                          |
| ------------ | -------------------------------- | --------------------------------- |
| `idle`       | コマンド待ち or Claude 未起動    | シェルプロンプトの検出            |
| `thinking`   | Claude が応答を生成中            | スピナーやプログレス表示の検出    |
| `generating` | Claude がコード/テキストを出力中 | 連続的なテキスト出力の検出        |
| `tool_use`   | Claude がツールを実行中          | Read/Edit/Bash 等のツール名の検出 |
| `error`      | エラー発生                       | Error/Failed 等のパターン検出     |

### 実装の方向性

**claudeDetector モジュール**を作成する。life-editor v1 の `claude_detector.go` のロジックを TypeScript に移植する。

基本アプローチ:

1. PTY 出力を受け取るたびに ANSI エスケープコードを除去
2. テキストパターンマッチングでClaude Code の起動/終了/状態遷移を検知
3. 状態が変化したら Renderer に通知（`terminal:claudeStatus` イベント等）

### 検知パターン（life-editor v1 からの移植）

**Claude 起動検知**:

- シェルプロンプト + `claude` コマンドの入力を検出
- 正規表現: `(?:^|\n)\s*[\$❯›>]\s+claude\b`

**シェル復帰検知**（Claude 終了）:

- ベアプロンプトの検出（Claude が終了してシェルに戻った）
- 正規表現: `(?:^|\n)\s*[\$❯›>]\s*$`

**状態判定**:

- エラーパターン → error
- ツール名パターン（Read, Edit, Write, Bash, Glob, Grep, Agent 等）→ tool_use
- その他のアクティブ出力 → thinking/generating

### Renderer への通知

main process から Renderer へ `terminal:claudeStatus` イベントを送る。
Renderer 側で受け取り、StatusBar やターミナルタブに表示する。

---

## 参照すべき既存コード

| ファイル                                                        | 参照ポイント                                         |
| --------------------------------------------------------------- | ---------------------------------------------------- |
| `~/dev/Claude/life-editor/internal/terminal/claude_detector.go` | 検知ロジック（正規表現、状態遷移、ANSI 除去）        |
| `electron/main.ts`                                              | アプリ起動フロー（claudeSetup の呼び出しタイミング） |
| `electron/preload.ts`                                           | `onTerminalData` リスナー（Step 1 で追加済み）の拡張 |

---

## 完了条件

- [ ] アプリ起動時に `~/.claude/settings.json` に `life-editor` MCP Server が自動登録される
- [ ] 既存の Claude Code 設定（他の MCP Server 等）が壊されない
- [ ] ターミナルで `claude` コマンドを起動すると、Claude 状態が検知される
- [ ] Claude の状態（thinking/generating/tool_use/idle）が Renderer に通知される
- [ ] Claude Code から MCP ツール（`list_tasks` 等）が正常に使える
- [ ] 設定画面から Claude Code 連携の状態確認/再設定ができる
- [ ] 既存機能（カレンダー、タスク、メモ、Work、Analytics、Tips）が正常動作する

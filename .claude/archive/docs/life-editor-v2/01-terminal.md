# Step 1: ターミナルの追加

> 前提: `00-vision.md` を先に読むこと

## 目的

Electron アプリ内に PTY ベースのターミナルを組み込み、ユーザーが Claude Code をアプリ内から操作できるようにする。

---

## 方針

### やること

1. **Electron main process にターミナルマネージャを追加**: node-pty で PTY セッションを管理
2. **IPC ハンドラで Renderer と通信**: セッション作成・入出力・リサイズ
3. **フロントエンドに xterm.js ターミナルコンポーネントを追加**: PTY 出力の描画・ユーザー入力の送信
4. **レイアウトに TerminalPanel を統合**: 全画面共通の折りたたみ可能な下部パネル

### やらないこと（Phase A では）

- 分割ペイン（複数ペインの同時表示）— 単一セッション・単一ペインで開始
- セッションの Detach/Attach — Phase B で検討
- OSC エスケープシーケンス解析 — Phase B で検討
- ポート検出 — Phase B で検討

---

## 技術選定

| 要素           | 選定                            | 理由                                                            |
| -------------- | ------------------------------- | --------------------------------------------------------------- |
| PTY ライブラリ | `node-pty`                      | Electron 用の標準的な PTY ライブラリ。xterm.js 公式が推奨       |
| ターミナル描画 | `xterm.js` + `@xterm/addon-fit` | 業界標準のブラウザターミナルエミュレータ                        |
| レイアウト分割 | `allotment`                     | 既に Life Editor のカレンダーで使用実績あり（もしくは新規導入） |

---

## 実装の方向性

### Electron main process 側

**TerminalManager クラス**を作成する。責務:

- PTY セッションの作成（`/bin/zsh --login` で起動、CWD はホームディレクトリ）
- PTY への書き込み（ユーザー入力の転送）
- PTY のリサイズ（ターミナルサイズ変更時）
- PTY 出力の Renderer への転送（`mainWindow.webContents.send()` でプッシュ）
- PTY プロセスの終了処理
- アプリ終了時の全セッション破棄

**出力のバッチング**: PTY 出力は高頻度で発生するため、16ms 程度のバッチ間隔で Renderer に送る。life-editor v1 で実証済みのパターン。

### IPC ハンドラ

TerminalManager のメソッドに対応する IPC チャンネルを作成する。

必要なチャンネル:

- `terminal:create` — セッション作成
- `terminal:write` — データ書き込み
- `terminal:resize` — サイズ変更
- `terminal:destroy` — セッション破棄
- `terminal:data` — PTY 出力（main → renderer プッシュ）

**重要**: `terminal:data` は `invoke` ではなく `send`（main → renderer の一方向通知）。
preload.ts の `electronAPI` に `on` メソッドを追加して Renderer がリスンできるようにする。
現在は `onMenuAction` と `onUpdaterStatus` の 2 つだけ `on` リスナーがあるので、同じパターンで `onTerminalData` を追加する。

### Renderer（React）側

**TerminalPane コンポーネント**:

- xterm.js の Terminal インスタンスを管理
- FitAddon でコンテナサイズに自動フィット
- ResizeObserver でコンテナリサイズを検知 → fit → IPC で resize 通知
- ユーザー入力（`term.onData()`）→ IPC で write
- PTY 出力（`onTerminalData` リスナー）→ `term.write()` で描画
- macOS ショートカットの変換（Cmd+Backspace → kill line 等）

**TerminalPanel コンポーネント**:

- 折りたたみ可能な下部パネル
- 開閉トグルボタン
- 将来的にセッションタブを追加可能な構造にしておく

**レイアウト統合**:

- `App.tsx` の ContentArea と TerminalPanel を Allotment で縦分割
- TerminalPanel は全セクション（Calendar, Tasks, Memo, Work 等）で共通表示
- 開閉状態は localStorage で永続化

---

## 参照すべき既存コード

### life-editor v1（移植元）

| ファイル                                             | 参照ポイント                                          |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `internal/terminal/pane.go`                          | PTY 起動パラメータ（shell, env, cwd）、リサイズ処理   |
| `internal/terminal/session_manager.go`               | readPaneOutput の 16ms バッチングパターン             |
| `internal/terminal/output_buffer.go`                 | リングバッファの設計（Phase A では不要だが参考に）    |
| `frontend/src/components/terminal/TerminalPane.tsx`  | xterm.js 初期化、テーマ設定、キーボードショートカット |
| `frontend/src/components/terminal/TerminalPanel.tsx` | パネル UI、セッションタブ                             |

### Life Editor（既存パターン）

| ファイル                      | 参照ポイント                                          |
| ----------------------------- | ----------------------------------------------------- |
| `electron/preload.ts`         | `onMenuAction` パターン → `onTerminalData` の追加方法 |
| `electron/ipc/registerAll.ts` | ハンドラ登録パターン                                  |
| `electron/main.ts`            | アプリ起動フロー、TerminalManager の初期化タイミング  |
| `frontend/src/App.tsx`        | ContentArea のレイアウト構成                          |

---

## 注意事項

### node-pty のネイティブモジュール対応

node-pty は C++ ネイティブモジュールなので、Electron のバージョンに合わせた再ビルドが必要。

```bash
npm install node-pty
npx electron-rebuild -f -w node-pty
```

`package.json` の `postinstall` スクリプトに `electron-rebuild -f -w node-pty` を **既存の `better-sqlite3` rebuild と一緒に**追加する:

```bash
npx electron-rebuild -f -w better-sqlite3 -w node-pty
```

### preload.ts への on リスナー追加

ターミナル出力は `ipcMain.handle` → `invoke` パターンではなく、`mainWindow.webContents.send` → `ipcRenderer.on` パターンを使う。

現在の preload.ts にある `onMenuAction` / `onUpdaterStatus` と同じ形式で `onTerminalData` を追加する。`ALLOWED_CHANNELS` とは別の仕組み（`ipcRenderer.on` ベース）。

### TerminalManager のライフサイクル

- `app.whenReady()` 後、`createWindow()` の前後で TerminalManager を初期化
- `before-quit` イベントで全 PTY を破棄（DB の `closeDatabase()` と同様）
- `mainWindow` の参照が必要（`webContents.send` のため）→ ウィンドウ作成後に設定

### xterm.js のテーマ

life-editor v1 で使用していた Catppuccin Mocha テーマを使用。Life Editor のダークモードと調和する:

```
背景: #11111b / テキスト: #cdd6f4 / カーソル: #f5e0dc
```

---

## 完了条件

- [ ] `npm run dev` でアプリが起動する
- [ ] TerminalPanel を開閉できる
- [ ] ターミナルで `ls`, `echo hello` 等の基本コマンドが動作する
- [ ] ターミナルで `claude` コマンドが起動できる
- [ ] ターミナルのリサイズが正しく動作する（文字の折り返しが崩れない）
- [ ] アプリ終了時に PTY プロセスが残らない
- [ ] 既存機能（カレンダー、タスク、メモ、Work、Analytics）が正常動作する

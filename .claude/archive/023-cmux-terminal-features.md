# 023: cmux インスパイア ターミナル機能強化

**Status**: MERGED (Phase C, 2026-04-18) — 要点を `requirements/tier-1-core.md` §Terminal Future Enhancements（中期: 分割ペイン）に統合
**Created**: 2026-03-08
**Merge target**: `.claude/docs/requirements/tier-1-core.md` §Terminal
**Merge reason**: Socket API / マルチエージェント / ブラウザペインの 3 機能は Tier 1 Terminal の Boundary「やらない: 独自のリッチ出力レンダリング」と明示的に矛盾。分割ペイン / タブ UI のみ Merge 対象として Future Enhancements に残し、Socket API 系は ADR-0005 Phase 3（チャットバブル UI）で別途扱う方針。

---

## 概要

cmux（macOS ネイティブの AI エージェント向けターミナルアプリ）のコンセプトを参考に、Life Editor のターミナル機能を強化する。Socket API、通知システム、マルチエージェント管理、ブラウザペインの4フェーズで段階的に導入。

## cmux とは

macOS ネイティブの AI エージェント向けターミナルアプリ（Swift + AppKit）。主要機能:

- **Socket API**: JSON over Unix domain socket でエージェントがターミナルを制御
- **通知システム**: ペインリング、タブバッジ、OSC シーケンス対応
- **マルチエージェント管理**: 親子エージェントのオーケストレーション
- **ブラウザペイン**: WebKit ベースのブラウザをペイン内に配置

## Life Editor 既存資産との差分

| cmux 機能          | Life Editor 現状    | ギャップ     |
| ------------------ | ------------------- | ------------ |
| Socket API         | なし                | 外部制御不可 |
| 通知システム       | ClaudeDetector のみ | UI通知なし   |
| マルチエージェント | 単一検出            | 複数管理なし |
| ブラウザペイン     | なし                | 未実装       |

---

## Phase 1: Socket API 基盤

### 目的

外部プログラム（AI エージェント等）が Life Editor のターミナルをプログラム的に制御できるようにする。

### 新規ファイル

- `electron/socket/SocketServer.ts` — Unix domain socket サーバー
- `electron/socket/protocol.ts` — JSON-RPC ライクなメッセージ型定義
- `electron/socket/handlers.ts` — コマンドハンドラ（TerminalManager 連携）

### 仕様

- **ソケットパス**: `~/Library/Application Support/life-editor/life-editor.sock`
- **プロトコル**: JSON-RPC 2.0 ライク（method, params, id）
- **メソッド一覧**:
  - `terminal.create` — 新しいターミナルセッション作成
  - `terminal.write` — セッションにデータ送信
  - `terminal.resize` — ターミナルリサイズ
  - `terminal.destroy` — セッション終了
  - `terminal.list` — アクティブセッション一覧
  - `pane.split` — ペイン分割
  - `pane.focus` — ペインフォーカス
  - `pane.list` — ペイン一覧
  - `notification.send` — 通知送信
- **セキュリティ**: ソケットファイル権限 `0o600`（オーナーのみ read/write）
- **ライフサイクル**: `electron/main.ts` の `app.on('ready')` で起動、`app.on('will-quit')` で停止

### 接続点

- `electron/terminal/TerminalManager.ts` — セッション操作の委譲先

---

## Phase 2: 通知システム

### 目的

ターミナル内イベント（エージェント完了、長時間コマンド終了等）をユーザーに視覚的に通知する。

### 新規ファイル

- `electron/terminal/OscHandler.ts` — OSC シーケンスパーサー
- `frontend/src/components/Terminal/NotificationPanel.tsx` — 通知パネルUI
- `frontend/src/hooks/useNotifications.ts` — 通知状態管理フック
- `frontend/src/types/notification.ts` — 通知型定義

### 仕様

- **OSC パース**: OSC 777（通知）/ OSC 9（iTerm2 互換通知）のシーケンスをパース
- **通知タイプ**:
  - ペインリング（青いボーダーハイライト）
  - ヘッダーバッジ（未読数表示）
  - 通知パネル（履歴一覧）
- **ClaudeDetector 連携**: `thinking→idle` 状態遷移を完了通知に変換
- **IPC チャンネル**:
  - `terminal:notification` — Main→Renderer 通知送信
  - `notification:markRead` — Renderer→Main 既読マーク
  - `notification:list` — Renderer→Main 通知一覧取得

### 拡張基盤

- `electron/terminal/ClaudeDetector.ts` — 状態遷移イベント発火の追加

---

## Phase 3: マルチエージェントサポート

### 目的

複数の AI エージェント（Claude Code 等）を同時に管理し、親子関係やステータスを追跡する。

### 新規ファイル

- `electron/terminal/AgentSessionManager.ts` — エージェントセッション管理
- `frontend/src/components/Terminal/AgentIndicator.tsx` — エージェント状態表示UI
- `frontend/src/types/agentSession.ts` — エージェントセッション型定義

### 仕様

- **セッション管理**: エージェントID、親子関係、状態（idle/thinking/tool-use/error）を追跡
- **Socket API 連携**: `agent.spawn` / `agent.status` / `agent.kill` メソッド追加
- **クロスペイン監視**: リングバッファで各ペインの直近出力を保持、エージェント状態変化を検出
- **UI**: 各ターミナルタブにエージェントインジケーター（色付きドット + ステータス）

---

## Phase 4: ブラウザペイン統合（将来検討）

### 目的

ターミナルレイアウト内にブラウザペインを配置し、AI エージェントが Web コンテンツを操作可能にする。

### 変更点

- `frontend/src/types/terminalLayout.ts` — `TerminalLayoutNode` に `webview` バリアント追加
- `frontend/src/utils/terminalLayout.ts` — webview ノード用ユーティリティ
- `frontend/src/components/Terminal/SplitLayout.tsx` — webview ペインの描画対応

### 仕様

- **描画**: Electron `<webview>` タグ使用
- **セキュリティ**: CSP 調整、サンドボックス設定
- **Socket API**: `browser.navigate` / `browser.execute` / `browser.screenshot` メソッド追加
- **制約**: Electron の webview セキュリティモデルに準拠

---

## 重要ファイルパス（既存）

| ファイル                                           | 役割                               |
| -------------------------------------------------- | ---------------------------------- |
| `electron/terminal/TerminalManager.ts`             | Socket API 接続点                  |
| `electron/terminal/ClaudeDetector.ts`              | 通知・エージェント管理の拡張基盤   |
| `electron/main.ts`                                 | SocketServer ライフサイクル統合点  |
| `frontend/src/types/terminalLayout.ts`             | Phase 4 型拡張                     |
| `frontend/src/utils/terminalLayout.ts`             | レイアウトユーティリティ（再利用） |
| `frontend/src/components/Terminal/SplitLayout.tsx` | レイアウト描画（再利用）           |

## 依存関係

- Phase 1 → Phase 2（Socket API が通知送信に使われる）
- Phase 1 → Phase 3（Socket API がエージェント制御に使われる）
- Phase 3 → Phase 4（ブラウザペインの外部制御にエージェント管理が必要）

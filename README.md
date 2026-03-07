# Sonic Flow

## 概要

Notionライクなタスク管理に「環境音ミキサー」と「ポモドーロタイマー」を組み合わせた、没入型個人タスク管理アプリケーション。

### 主な機能

- **タスク管理**: 階層型タスクツリー（フォルダ/サブフォルダ/タスク）、ドラッグ&ドロップ並び替え（挿入ライン表示）、並び替え機能（手動/ステータス/スケジュール日）、完了タスク自動ソート、削除確認ダイアログ、カラー継承、ソフトデリート+ゴミ箱
- **タスク左右分割レイアウト**: Tasksセクションは左パネル（TaskTree + ヘッダー）と右パネル（TaskDetailPanel）の2カラム構成、タスク選択で右パネルにリアルタイム詳細表示（タイトル編集、フォルダ移動、カラーピッカー、再生ボタン、作業時間設定、ミニカレンダー、テキストメモ）、未選択時はタスク数サマリー表示
- **グローバルタイマー**: 画面遷移してもタイマーが継続するContextベースのポモドーロタイマー
- **タスク期限管理**: Flagアイコンでdue date設定、DateTimePickerで日時選択
- **集中タイマー**: WORK/BREAK/LONG_BREAK対応、ポモドーロ設定UI（Work/Break/Long Break/Sessions数を個別設定）、ドットインジケーター表示、プログレスバー、WORK完了時モーダル（延長5〜30分/休憩選択/タスク完了）、プリセット機能（保存・一括適用・削除）、休憩自動開始オプション（3秒カウントダウン）、一時停止中±5m時間調整、今日のセッションサマリー表示
- **Work画面**: LeftSidebarの「Work」セクションで常時アクセス可能、3タブ構成（Timer/Pomodoro/Music）。Timerタブにセッション完了・タスク完了ボタン（確認ダイアログ付き）+バックグラウンドサウンドボタン。PomodoroタブにDuration設定・プリセット・自動休憩開始トグル。Musicタブにサウンド管理+プレイリスト管理を統合
- **サイドバータイマー表示**: タイマー実行中はWork項目下にタスク名・残り時間・編集ボタンを表示
- **TaskTreeタイマー表示**: 実行中のタスク行に残り時間テキスト+ミニプログレスバーを表示
- **プレイリスト**: タイマー実行時に選択プレイリストを自動再生、楽曲をシーケンシャル再生（1曲ずつ順番に再生→ループ）、DnD並び替え、シャッフル/リピート（off/one/all）、シークバー、ボリュームコントロール、Timer タブにプレイリストセレクター+プレーヤーバー表示
- **サウンドライブラリ**: 6種の環境音（Rain, Thunder, Wind, Ocean, Birds, Fire）+ カスタムサウンドアップロード、プレビュー再生（ボリューム・シーク付き共有コントロール）、タグ管理・フィルタリング
- **外観設定**: ダークモード/ライトモード切替、フォントサイズ10段階スライダー（12px〜25px）
- **タスク完了演出**: チェックボックスでタスク完了時に紙吹雪アニメーション
- **セッション完了音**: WORKセッション完了時にエフェクト音再生（Settings画面で音量調整可能）
- **デスクトップ通知**: タイマーセッション完了時にブラウザ通知
- **グローバル Undo/Redo**: コマンドパターン + ドメイン別スタックで全セクションの操作を Cmd+Z / Cmd+Shift+Z で元に戻す/やり直し、各セクションヘッダーにボタン配置
- **キーボードショートカット**: Space（タイマー）、n（新規タスク）、Escape（モーダル閉じ）、Cmd/Ctrl+.（左サイドバー開閉）、Cmd/Ctrl+,（Settings遷移）、Cmd/Ctrl+1〜4（セクション切替: Tasks/Work/Analytics/Settings）、↑/↓（タスク移動）、Tab/Shift+Tab（インデント）、r（タイマーリセット）、Cmd/Ctrl+Shift+T（モーダル）、j/k/t/m（カレンダー操作）、Cmd/Ctrl+Z（Undo）、Cmd/Ctrl+Shift+Z（Redo）
- **ゴミ箱**: サイドバーからアクセス可能なトップレベルセクション、削除済みタスク・ノート・カスタムサウンドの復元・完全削除
- **Settings画面**: 右サイドナビ4タブ構成（General/Notifications/Data/Advanced）、外観設定、言語切替、通知設定
- **Tips画面**: ショートカット一覧（6カテゴリ/29件）、タスク/タイマー/カレンダー/メモ/アナリティクス/エディタの操作ガイド（7タブ構成）
- **リッチテキストエディタ**: TipTap拡張（Toggle List/Table/Callout/Image）、スラッシュコマンド対応、テキスト選択時Bubbleツールバー（Bold/Italic/Strikethrough/Code/Link/TextColor）
- **コマンドパレット**: ⌘Kで起動、16コマンド（Navigation/Task/Timer/View）をリアルタイム検索・実行
- **スケジュール（Tasksサブタブ）**: Tasksセクション内にScheduleタブとして統合。3サブタブ構成: Calendar（月/週ビュー）、Dayflow（1日タイムグリッド + Today Flowパネル）、Routine（ルーティンCRUD + テンプレート + 完了率統計）。月/週ビューはタスク日付別表示・フィルタリング・フォルダ別ビュー対応。Tasks/Memoモード切替、MemoモードはDaily memo+Notes を月表示で統合表示
- **タスクツリーフォルダフィルタ**: PROJECTSセクションにドロップダウンフィルター、フォルダ単位で表示絞り込み
- **アナリティクス**: 基本統計（総タスク数、完了率、フォルダ数）、作業時間グラフ（日/週/月別BarChart + タスク別横棒グラフ、Recharts）、総作業時間・セッション数・日平均サマリー
- **データ管理**: SQLite永続化（better-sqlite3）、JSON Export/Import、バックアップ付きインポート、全データリセット（自動バックアップ付き）
- **自由メモ（Notes）**: 日付に縛られないフリーフォームノート、ピン留め、全文検索、ソート切替（更新日/作成日/タイトル）、ソフトデリート対応
- **サウンドタグ**: Music画面でサウンドにカラータグ付与・フィルタリング、タグ管理パネル（名前編集・色変更・削除）
- **テンプレート**: タスクツリー構造をテンプレート保存・展開
- **自動アップデート**: electron-updater + GitHub Releases、ユーザー確認型ダウンロード・インストール
- **構造化ログ**: electron-logによるファイル出力、Settings画面でログ閲覧・フィルタ・エクスポート
- **パフォーマンス監視**: 全IPC応答時間を自動計測、Settings画面でチャネル別メトリクス表示
- **アプリ内ターミナル**: node-pty + xterm.js による統合ターミナル。Ctrl+`` ` ``で開閉、ドラッグで高さ調整、Catppuccin Mocha テーマ。全セクション共通の下部パネルとして表示
- **MCP Server (life-editor)**: Claude Code から自然言語でタスク・メモ・ノート・スケジュールを操作するための MCP Server。stdio 経由で SQLite DB に直接アクセス。11ツール対応（list_tasks/get_task/create_task/update_task/delete_task/get_memo/upsert_memo/list_notes/create_note/update_note/list_schedule）

### 技術スタック

- **Frontend**: React 19 (TypeScript) + Vite + Tailwind CSS v4 + @dnd-kit + TipTap + xterm.js + react-i18next + Recharts
- **Desktop**: Electron 35 + better-sqlite3 + node-pty + electron-builder
- **MCP Server**: Node.js + @modelcontextprotocol/sdk + better-sqlite3

---

## IPC チャンネル

フロントエンドからは `window.electronAPI.invoke(channel, ...args)` 経由でElectronメインプロセスと通信。

| ドメイン  | チャンネル                                                                              | 概要               |
| --------- | --------------------------------------------------------------------------------------- | ------------------ |
| Tasks     | `tasks:getTree` / `tasks:saveTree`                                                      | ツリー一括同期     |
| Tasks     | `tasks:create` / `tasks:update` / `tasks:delete` / `tasks:softDelete` / `tasks:restore` | タスクCRUD         |
| Timer     | `timer:getSettings` / `timer:updateSettings`                                            | タイマー設定       |
| Timer     | `timer:createSession` / `timer:updateSession` / `timer:getSessions`                     | セッション管理     |
| Sound     | `sound:getSettings` / `sound:updateSettings`                                            | サウンド設定       |
| Sound     | `sound:getPresets` / `sound:savePreset` / `sound:deletePreset`                          | プリセット管理     |
| Data I/O  | `data:export` / `data:import`                                                           | JSON Export/Import |
| Tags      | `tags:getAll` / `tags:create` / `tags:update` / `tags:delete`                           | タグ管理           |
| Templates | `templates:getAll` / `templates:save` / `templates:delete`                              | テンプレート管理   |
| Memos     | `memos:get` / `memos:save`                                                              | メモ管理           |
| AI        | `ai:getSettings` / `ai:updateSettings` / `ai:getAdvice`                                 | AIコーチング       |
| App       | `app:getVersion`                                                                        | アプリ情報         |

---

## セットアップ

### 前提条件

- Node.js 18+
- npm

### インストール

```bash
npm install    # postinstallでfrontend依存 + electron-rebuild自動実行
```

### 起動

```bash
npm run dev    # Vite(5173) + tsc --watch + Electron 同時起動
```

---

## ドキュメント

- [開発ガイド](.claude/CLAUDE.md)
- [仕様書](.claude/docs/Application_Overview.md)
- [アーキテクチャ決定記録](.claude/docs/adr/)
- [ロードマップ](TODO.md)
- [変更履歴](.claude/HISTORY.md)
- [完了履歴](CHANGELOG.md)
- [実装プラン](.claude/feature_plans/)

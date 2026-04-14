# Life Editor コード説明ドキュメント

## 目的

このドキュメント群は、Life Editor のコードベース全体を**ユースケース起点**で説明する。
UI操作 → 状態更新 → localStorage永続化の流れを追跡できる構成になっている。

## 想定読者

- Life Editor に初めて触れる開発者
- アーキテクチャの全体像を把握したい人
- 特定機能の実装詳細を確認したい人

## 推奨読み順

1. **[01-architecture-overview.md](./01-architecture-overview.md)** — フロントエンド中心アーキテクチャを把握
2. **[02-infrastructure.md](./02-infrastructure.md)** — エントリポイント・設定・共通基盤を理解
3. **興味のある機能フローへ** — 以下の一覧から選択

## ファイル一覧

### 基盤

| ファイル                                                     | 対象 | 概要                                                 |
| ------------------------------------------------------------ | ---- | ---------------------------------------------------- |
| [01-architecture-overview.md](./01-architecture-overview.md) | 全体 | フロントエンド中心アーキテクチャ + バックエンド概要  |
| [02-infrastructure.md](./02-infrastructure.md)               | 基盤 | エントリポイント・Context Provider・レイアウト・CORS |

### タスク管理（localStorage + TaskTree）

| ファイル                                               | 対象ユースケース | 概要                                                   |
| ------------------------------------------------------ | ---------------- | ------------------------------------------------------ |
| [10-task-create.md](./10-task-create.md)               | タスク作成       | TaskTreeInput → useTaskTree.addNode → localStorage保存 |
| [11-task-edit-title.md](./11-task-edit-title.md)       | タイトル編集     | インライン編集 → updateNode → localStorage保存         |
| [12-task-toggle-status.md](./12-task-toggle-status.md) | ステータス切替   | TODO/DONE切替 → completedAt管理                        |
| [13-task-delete.md](./13-task-delete.md)               | タスク削除       | ソフトデリート (isDeleted) → ゴミ箱から復元可能        |
| [14-task-view-lists.md](./14-task-view-lists.md)       | 一覧表示         | ツリー構造表示 (Inbox/Projects/Completed)              |
| [15-task-focus-mode.md](./15-task-focus-mode.md)       | WorkScreen       | タイマー + サウンドミキサー統合画面                    |

### タイマー（TimerContext + localStorage）

| ファイル                                                           | 対象ユースケース     | 概要                                |
| ------------------------------------------------------------------ | -------------------- | ----------------------------------- |
| [20-timer-settings.md](./20-timer-settings.md)                     | 設定管理             | TimerContext + localStorage永続化   |
| [21-timer-start-session.md](./21-timer-start-session.md)           | セッション開始       | startTimer → setInterval開始        |
| [22-timer-countdown-and-stop.md](./22-timer-countdown-and-stop.md) | カウントダウン＋停止 | interval制御 + WORK→BREAK遷移       |
| [23-timer-session-history.md](./23-timer-session-history.md)       | 履歴表示             | 未実装（Backend再統合時に実装予定） |

### サウンド（localStorage + useLocalSoundMixer）

| ファイル                                             | 対象ユースケース | 概要                              |
| ---------------------------------------------------- | ---------------- | --------------------------------- |
| [30-sound-settings.md](./30-sound-settings.md)       | 設定管理         | useLocalSoundMixer + localStorage |
| [31-sound-preset-crud.md](./31-sound-preset-crud.md) | プリセット管理   | localStorage保存・復元            |

## 実装状況マトリクス

| 機能領域              | フロントエンド UI |   フロントエンド State    |     バックエンド API     | 接続状態  |
| --------------------- | :---------------: | :-----------------------: | :----------------------: | :-------: |
| タスク管理 (TaskTree) |        ✅         |      ✅ localStorage      | ✅ (Phase 1 Task Entity) | ❌ 未接続 |
| タイマー              |        ✅         | ✅ Context + localStorage |            ✅            | ❌ 未接続 |
| サウンド              |       ✅ UI       |      ✅ localStorage      |            ✅            | ❌ 未接続 |
| サウンド再生          |        ❌         |            ❌             |            —             |     —     |
| AI コーチ             |        ❌         |            ❌             |            ❌            |     —     |
| 設定画面              |        ✅         |      ✅ localStorage      |            —             |     —     |

## 表記規約

- ファイルパスは `frontend/src/...` または `backend/src/main/java/com/lifeeditor/...` の相対形式
- 行番号は `ファイルパス:行番号` 形式（例: `App.tsx:8`）
- シーケンス図はテキストベースの矢印表記

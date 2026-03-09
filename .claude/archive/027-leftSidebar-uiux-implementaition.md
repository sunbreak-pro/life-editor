# Life Editor UI構成計画書

## — Left Sidebar / Header Tabs / Right Sidebar の再編 —

**作成日**: 2026-03-09
**ステータス**: COMPLETED

---

## 1. Left Sidebar 構成（確定方針）

```
━━━ メインワークスペース ━━━
☑ Tasks           タスクの管理・実行
💡 Ideas           思考の記録・接続・俯瞰（旧Memo + Connect統合）
📅 Schedule        時間軸の管理
▶ Work            集中環境
━━━━━━━━━━━━━━━━━━━━━━━━
📊 Analytics       振り返り・分析
⚙ Settings        設定（Trash含む）
```

**変更点**:

- Memo → **Ideas に名称変更 + Connect機能を統合**
- Schedule → **Tasksタブから独立セクションに昇格**

**i18n**:

- en: Ideas / ja: アイデア

---

## 2. 各セクションのヘッダータブ構成

### ☑ Tasks → [Tree] [Board]

| タブ      | 内容                                                      | ステータス           |
| --------- | --------------------------------------------------------- | -------------------- |
| **Tree**  | 既存のフォルダ/タスクツリー。D&D、5階層、ステータス管理   | 既存（名前変更のみ） |
| **Board** | カンバンビュー（TODO/DOING/DONE）。Taskをカードとして表示 | 将来候補             |

**Right Sidebar**: タスク詳細パネル（既存）+ 下部にバックリンク（`[[]]`タグ関連アイテム一覧）

---

### 💡 Ideas → [Daily] [Notes] [Search] [Tags] [Graph]

旧MemoセクションとConnectセクションを統合。「アイデアを書く → 繋げる → 俯瞰する」の一連の思考フローを1セクションに集約。

| タブ       | 内容                                                           | ステータス           |
| ---------- | -------------------------------------------------------------- | -------------------- |
| **Daily**  | 日付ベースのDailyメモ。日記・思考ログ。`[[]]`タグ対応          | 既存（タグ機能追加） |
| **Notes**  | フリーノート。アイデア・調査メモ。`[[]]`タグ対応               | 既存（タグ機能追加） |
| **Search** | `[[]]`タグによる横断検索。Task/Daily/Note/Schedule全てを横断   | 新規                 |
| **Tags**   | タグクラウド表示 + タグ管理（色変更・マージ・削除）            | 新規                 |
| **Graph**  | ネットワークグラフ。タグを介したエンティティ間の繋がりを可視化 | 新規（Phase 3）      |

**タブの並び順の意図**:

```
[Daily] [Notes]  |  [Search] [Tags] [Graph]
  書く・溜める        繋げる・俯瞰する
```

左の2つが「インプット（書く）」、右の3つが「アウトプット（発見・整理）」。
UIでディバイダを入れるかは実装時に判断。

**Right Sidebar**:

- Daily/Notes: バックリンクパネル — 開いているMemo/Noteの`[[]]`タグから関連アイテムを表示
- Search: 検索結果のプレビュー
- Tags: タグ詳細（使用回数、関連エンティティ一覧）
- Graph: ノードクリック時の詳細情報

---

### 📅 Schedule → [Calendar] [Dayflow] [Routine]

Tasksセクションから独立。「いつやるか」の時間軸管理に特化。

| タブ         | 内容                                          | ステータス            |
| ------------ | --------------------------------------------- | --------------------- |
| **Calendar** | 月/週表示。タスク・スケジュールアイテムを表示 | 既存（Tasksから移動） |
| **Dayflow**  | 1日の時間グリッド表示                         | 既存（Tasksから移動） |
| **Routine**  | 習慣管理。繰り返しタスクの設定・達成率        | 既存（Tasksから移動） |

**追加予定の機能**:

- Calendar上にMemoの日付マーカー表示（「このアイデアはいつ生まれたか」）
- Schedule アイテムへの `[[]]` タグ付与
- タスク作成時の保存先フォルダ: ディレクトリタグ廃止 → 検索/候補UIで選択

**Right Sidebar**: 選択した日のイベント詳細 + その日のMemo/Noteサマリー

---

### ▶ Work → [Timer] [Pomodoro] [Music]

変更なし。

| タブ         | 内容                         | ステータス |
| ------------ | ---------------------------- | ---------- |
| **Timer**    | ポモドーロタイマー表示・操作 | 既存       |
| **Pomodoro** | タイマー設定・プリセット管理 | 既存       |
| **Music**    | 環境音ミキサー・プレイリスト | 既存       |

---

### 📊 Analytics → [Overview] [Detail]

変更なし。将来的にタグ利用傾向やアイデア生成頻度の分析を追加する余地あり。

| タブ         | 内容                               | ステータス |
| ------------ | ---------------------------------- | ---------- |
| **Overview** | タスク完了率、作業時間サマリー     | 既存       |
| **Detail**   | チャート（作業時間、タスク別内訳） | 既存       |

---

### ⚙ Settings → [General] [Notifications] [Data] [Advanced] [Claude] [Shortcuts] [Tips] | [Trash]

変更なし。

---

## 3. Right Sidebar まとめ

| セクション              | Right Sidebar の内容                                          |
| ----------------------- | ------------------------------------------------------------- |
| **Tasks**               | タスク詳細パネル + バックリンク（`[[]]`タグ関連）             |
| **Ideas (Daily/Notes)** | バックリンクパネル（現在のMemo/Noteの`[[]]`タグ関連アイテム） |
| **Ideas (Search)**      | 検索結果プレビュー                                            |
| **Ideas (Tags)**        | タグ詳細（使用回数、関連エンティティ）                        |
| **Ideas (Graph)**       | ノード詳細                                                    |
| **Schedule**            | 日付詳細 + Memo/Noteサマリー                                  |
| **Work**                | WorkSidebarInfo（既存）                                       |
| **Analytics**           | なし（将来拡張可能）                                          |
| **Settings**            | サブナビゲーション（既存）                                    |

---

## 4. 既存UIからの移行

### SectionId の変更

```typescript
// 旧
type SectionId = "tasks" | "memo" | "work" | "analytics" | "trash" | "settings";

// 新
type SectionId =
  | "tasks"
  | "ideas"
  | "schedule"
  | "work"
  | "analytics"
  | "settings";
// "memo" → "ideas" に名称変更
// "schedule" を新規追加
// "trash" は settings 内のタブとして維持（既にそうなっている）
```

### Tasksセクションの変更

```
旧: Tasks → [Tasks] [Schedule] [Routine]
新: Tasks → [Tree] （将来: [Board]）

Schedule, Routine は独立セクション Schedule へ移動
```

### Memoセクションの変更

```
旧: Memo → [Daily] [Notes]
新: Ideas → [Daily] [Notes] [Search] [Tags] [Graph]

名称変更 + 3タブ追加
```

---

## 5. 全体レイアウト図（最終形）

```
┌─────────────────────────────────────────────────────────────┐
│ TitleBar: [life-editor] [◀] │ セクション名 [タブ...] │ [Undo] [Terminal] [▶] │
├──────────┬──────────────────────────────────┬───────────────┤
│          │                                  │               │
│ ☑ Tasks  │  Main Content                    │  Right        │
│ 💡 Ideas │  (セクション+タブに応じて変化)      │  Sidebar      │
│ 📅 Schedule│                                │  (バックリンク │
│ ▶ Work   │                                  │   詳細パネル   │
│ ───────  │                                  │   等)          │
│ 📊 Analytics│                               │               │
│ ⚙ Settings│                                │               │
│          ├──────────────────────────────────┤               │
│          │  Terminal (bottom dock)           │               │
├──────────┴──────────────────────────────────┴───────────────┘
```

---

## 6. 将来検討アイテム

| アイテム                         | 配置案                                             | 優先度 |
| -------------------------------- | -------------------------------------------------- | ------ |
| Quick Capture (即座メモ投げ込み) | グローバルショートカット or TitleBarボタン         | 高い   |
| Board (カンバン)                 | Tasks のヘッダータブ                               | 中     |
| Weekly Review (週次振り返り)     | Analytics のタブ追加 or 独立                       | 中     |
| Template管理                     | Settings内 or Ideas内                              | 低〜中 |
| Dashboard (ホーム画面)           | 起動時の最初の画面。今日のタスク+Memo+Schedule要約 | 要検討 |

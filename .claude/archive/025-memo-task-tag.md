# Life Editor 実装方針書 v2
## — Obsidian型 `[[]]` タグで全てを繋ぐアーキテクチャ —

**作成日**: 2026-03-08
**更新日**: 2026-03-08 (v2: タグ設計方針の大幅修正)
**対象**: Sonic Flow (notion-timer) → Life Editor

---

## 1. 現状のコードベース概観

### 1-1. 技術スタック
- **Desktop**: Electron 35 + better-sqlite3 (V22マイグレーション済)
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + TipTap 3 (リッチテキスト)
- **AI連携**: MCP Server (Claude Code 向け、11ツール定義済み)
- **その他**: @dnd-kit (D&D), xterm.js (ターミナル), Recharts (分析), react-i18next (多言語)

### 1-2. 既に実装されている主要機能

| 領域 | 機能 | 成熟度 |
|------|------|--------|
| **Tasks** | 5階層フォルダツリー、D&D並び替え、スケジューリング、ステータス管理、Undo/Redo | ★★★★ |
| **Memo (Daily)** | 日付ベースの1日1メモ、TipTapエディタ、ソフトデリート | ★★★ |
| **Notes** | フリーノート、タイトル+本文、全文検索、ピン留め | ★★★ |
| **Timer/Focus** | ポモドーロ、プリセット、セッション記録、グローバルタイマー | ★★★★ |
| **Schedule** | カレンダー（月/週表示）、Dayflow（時間グリッド）、ルーティン | ★★★ |
| **Sound/Music** | 環境音、カスタム音源、プレイリスト、タグフィルタ | ★★★★ |
| **タグ** | 4つの独立系統（Task/Note/Sound/Routine）| ★★★ |
| **MCP Server** | タスク/メモ/ノート/スケジュール CRUD (11ツール) | ★★★ |

---

## 2. 設計方針の転換: Obsidian型 `[[]]` タグ中心アーキテクチャ

### 2-1. 基本思想

**v1（旧案）**: ツリーを統合してNotionのようにデータを一元化する
**v2（確定方針）**: ツリーは独立のまま、`[[]]`タグが全エンティティを横断的に繋ぐ

```
┌──────────────────────────────────────────────────┐
│                  [[タグ]] レイヤー                 │
│  書きながら自然に生まれ、全ドメインを横断的に接続    │
│                                                   │
│    Tasks        Memo (Daily)       Notes          │
│   ┌──────┐     ┌──────────┐     ┌──────────┐     │
│   │ ツリー │     │ 日付リスト │     │ ノートリスト│     │
│   │ (独立) │     │  (独立)    │     │  (独立)    │     │
│   └──────┘     └──────────┘     └──────────┘     │
│       ↑               ↑               ↑          │
│       └───── [[タグ]] で相互接続 ─────┘           │
│                        ↓                          │
│              Schedule (Calendar)                   │
│             ┌──────────────────┐                  │
│             │ タグ付きイベント   │                  │
│             └──────────────────┘                  │
└──────────────────────────────────────────────────┘
```

### 2-2. 決定事項まとめ

| 項目 | 決定 |
|------|------|
| Task↔Note変換 | **なし** (廃止) |
| ツリー統合 | **なし** — 各セクションのツリーは独立 |
| 接続手段 | `[[]]` インラインタグ (Obsidian準拠) |
| 既存タグ(task_tag_definitions等) | **Task用は `[[]]` に完全置き換え** |
| Sound/Routineタグ | **別系統として維持** (音楽タグは性質が異なる) |
| ディレクトリタグ | **廃止** → Calendar等からの保存先は検索/候補で設定 |
| `[[]]` の挙動 | Obsidian準拠のバックリンク: タグ付与 + 同名Note/Memoが存在すればリンク |
| 文章外タグ | エディタ外からもタグを作成・付与可能 |
| Calendar連携 | Schedule にもタグ機能を実装 |
| 可視化 | 段階的: まずタグクラウド+リスト → 後にネットワークグラフ |

---

## 3. `[[]]` タグシステムの設計

### 3-1. 統一タグテーブル (新規)

既存の `task_tag_definitions` / `note_tag_definitions` を廃止し、1つに統合する。

```sql
-- 統一タグ定義
CREATE TABLE wiki_tags (
  id TEXT PRIMARY KEY,          -- "tag-xxxx"
  name TEXT NOT NULL UNIQUE,    -- タグ名 (例: "React", "閃き", "要調査")
  color TEXT,                   -- 表示色 (hex)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- タグ割り当て (全エンティティ共通)
CREATE TABLE wiki_tag_assignments (
  tag_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,      -- task-xxx / memo-YYYY-MM-DD / note-xxx / schedule-xxx
  entity_type TEXT NOT NULL,    -- 'task' | 'memo' | 'note' | 'schedule'
  source TEXT DEFAULT 'inline', -- 'inline' (文中の[[]]) | 'manual' (UIから手動付与)
  created_at TEXT NOT NULL,
  PRIMARY KEY (tag_id, entity_id)
);

CREATE INDEX idx_wiki_tag_name ON wiki_tags(name);
CREATE INDEX idx_wiki_tag_entity ON wiki_tag_assignments(entity_id);
CREATE INDEX idx_wiki_tag_type ON wiki_tag_assignments(entity_type);
```

**ポイント**:
- `entity_type` で横断検索: `WHERE tag_id = ? AND entity_type IN ('task', 'memo', 'note')`
- `source` で「文中から自動生成」と「UIから手動付与」を区別

### 3-2. `[[]]` インラインタグの挙動 (Obsidian準拠)

**入力時**:
1. TipTapエディタ内で `[[` を入力するとインラインサジェストパネルが表示
2. 既存タグが候補として表示される（インクリメンタル検索）
3. `]]` で閉じると:
   - 該当タグが wiki_tags に存在しなければ自動作成
   - wiki_tag_assignments に現在のエンティティとの紐付けを追加
   - エディタ内でリンク風のスタイリング（色付き、下線）

**クリック時**:
- `[[React]]` をクリック → 横断検索パネルが開き「React」タグが付いた全エンティティ(Task/Memo/Note/Schedule)を一覧表示
- 同名のNote (title = "React") が存在する場合は、その Noteへの直接遷移リンクも表示

**どこで使えるか**:
- Task の content (TipTap エディタ)
- Daily Memo の content
- Note の content
- Schedule アイテムの備考欄（将来拡張）

### 3-3. TipTap エクステンションの設計

```
新規 TipTap Extension: WikiTag
├── InputRule: /\[\[([^\]]+)\]\]/ でトリガー
├── Node Type: inline, atom
├── Attributes: { tagName: string, tagId: string }
├── Render: <span class="wiki-tag" data-tag-id="xxx">[[tagName]]</span>
└── onClick: openCrossSearchPanel(tagName)
```

`[[` 入力時のサジェストは、TipTapの `@tiptap/suggestion` (既存のSlashコマンドと同じ仕組み) を流用。

### 3-4. 既存タグからのマイグレーション

```
V23 マイグレーション:
1. wiki_tags テーブル作成
2. wiki_tag_assignments テーブル作成
3. task_tag_definitions → wiki_tags にデータ移行
4. task_tags → wiki_tag_assignments にデータ移行 (entity_type = 'task')
5. note_tag_definitions → wiki_tags にデータ移行 (重複名はmerge)
6. note_tags → wiki_tag_assignments にデータ移行 (entity_type = 'note')
7. 旧テーブルは DROP せず、バックアップとして一定期間残す
```

**Sound/Routineタグは移行しない**: 音楽系は性質が異なるためそのまま維持。

---

## 4. 各ドメインへの影響と変更内容

### 4-1. Tasks

| 変更点 | 内容 |
|--------|------|
| 既存タグUI | 既存のカラータグUIを `[[]]` タグUIに差し替え |
| Task content | TipTapエディタ内で `[[]]` が使用可能に |
| ディレクトリタグ | **廃止** |
| Calendarからの作成 | タグではなく「保存先フォルダ」を検索/候補で選択 |
| ツリー構造 | **変更なし** — フォルダ/タスクの階層は今のまま |

### 4-2. Memo (Daily)

| 変更点 | 内容 |
|--------|------|
| タグ機能 | `[[]]` によるタグ付けを新規追加 (現在はタグなし) |
| content | TipTapエディタ内で `[[]]` が使用可能に |
| Calendar連携 | Memo日付がCalendar上に表示 → 「このアイデアはいつ生まれたか」が可視化 |

### 4-3. Notes

| 変更点 | 内容 |
|--------|------|
| 既存タグ | note_tag_definitions → wiki_tags に移行 |
| content | TipTapエディタ内で `[[]]` が使用可能に |
| バックリンク | `[[NoteName]]` → 同名Noteが存在すればリンク先として表示 |

### 4-4. Schedule (Calendar)

| 変更点 | 内容 |
|--------|------|
| タグ機能 | Schedule アイテムにも `[[]]` タグを付けられるように拡張 |
| Task作成時 | ディレクトリタグ廃止 → 保存先フォルダを検索UI or ドロップダウンで指定 |
| Memo連携 | Calendar上でMemoの日付を表示し、「この日に何を考えていたか」がわかる |

### 4-5. Sound / Routine

| 変更点 | 内容 |
|--------|------|
| タグ | **変更なし** — 既存の sound_tag / routine_tag をそのまま維持 |

---

## 5. 横断検索 & 可視化

### 5-1. タグ横断検索パネル

**コマンドパレット (Cmd+K) の拡張**:
- `#タグ名` or `[[タグ名]]` で検索 → wiki_tag_assignments を横断クエリ
- 結果をエンティティタイプ別にグルーピング表示:

```
検索: [[React]]
────────────────────
📋 Tasks (3件)
  ・フロントエンド設計 (TODO)
  ・コンポーネント設計 (DONE)
  ・React Native調査 (TODO)

📓 Daily Memo (2件)
  ・2026-03-01: Reactの状態管理について...
  ・2026-02-15: Hooks設計パターン...

📝 Notes (1件)
  ・React ベストプラクティスまとめ

📅 Schedule (1件)
  ・3/10: React勉強会
```

**専用ビュー or 右パネルで表示** — 既存のセクションナビゲーションに影響しない。

### 5-2. 可視化ロードマップ

**ステップ1: タグクラウド + リスト** (Phase 1で実装)
- タグの使用頻度に応じたクラウド表示
- クリックで横断検索パネルに遷移
- 実装コスト: 低

**ステップ2: ネットワークグラフ** (Phase 3以降)
- ノード = エンティティ (Task/Memo/Note)
- エッジ = 共通タグで接続
- ライブラリ候補: react-flow, d3-force, cytoscape.js
- Obsidianのグラフビューに近い体験
- 実装コスト: 中〜高

---

## 6. 実装フェーズ

### Phase 0: `[[]]` タグ基盤構築
**テーマ**: 統一タグシステムの土台を作る

| やること | 詳細 |
|----------|------|
| DB: wiki_tags / wiki_tag_assignments 作成 | V23マイグレーション |
| DB: 既存タグデータ移行 | task_tags, note_tags → wiki_tag_assignments |
| TipTap WikiTag Extension | `[[]]` 入力 → サジェスト → タグ自動作成 |
| タグ管理UI | タグ一覧 / 色変更 / 削除 / マージ |
| Task/Note/Memoのタグ表示 | エディタ内の `[[]]` スタイリング + ヘッダーにタグチップ表示 |
| ディレクトリタグ廃止 | UI/ロジック/DBから削除 |
| Calendarからのタスク保存先 | フォルダ検索UIに切り替え |

**完了基準**: Task/Note/Memo全てで `[[]]` タグが作成・表示・検索できる

---

### Phase 1: 横断検索 + タグクラウド
**テーマ**: タグを通じた発見体験

| やること | 詳細 |
|----------|------|
| 横断検索パネル | Cmd+K拡張 or 専用パネルで全エンティティ横断検索 |
| `[[]]` クリック → 横断検索 | エディタ内タグクリックで関連コンテンツ一覧 |
| バックリンク表示 | Note/Memo/Task 詳細画面の下部に「このタグを使っている他のアイテム」を表示 |
| タグクラウドビュー | 新セクション or 既存セクションの一部として実装 |
| Schedule へのタグ拡張 | Schedule アイテムにも wiki_tag を紐付け可能に |
| Calendar上のMemo日付表示 | 「いつこのアイデアが生まれたか」の時間軸可視化 |

**完了基準**: タグをクリックするとTask/Memo/Note/Scheduleを横断して関連コンテンツが見つかる

---

### Phase 2: イミュータブルデータ + 編集ロック
**テーマ**: 思考の履歴を保全する (要件定義書 Phase A+B)

| やること | 詳細 |
|----------|------|
| memo_versions / note_versions | 追記型バージョン履歴 |
| バージョン履歴パネル | Clockアイコン → 履歴ビュー |
| 日次ロック | 日付変更 or 手動 or 時刻指定 → 本文読み取り専用化 |
| ロック後のタグ編集 | `[[]]` タグは後からでも追加・変更可能 |

---

### Phase 3: AI + ネットワークグラフ
**テーマ**: つながりの発見を自動化・可視化する

| やること | 詳細 |
|----------|------|
| AI類似性サジェスト | MCP Server 拡張: `search_similar_content` ツール追加 |
| ネットワークグラフ | タグ関係をノードグラフで可視化 |
| AI タグ提案 | MemoやNote作成時に内容から `[[]]` タグを自動提案 |

---

### Phase 4 (将来)

| 機能 | 概要 |
|------|------|
| iPhone対応 | React Native or PWA |
| Dataview的動的リスト | タグ条件でMemo/Note/Taskを動的一覧 |
| タグ間の関係定義 | 「ReactはJavaScriptの子タグ」のような階層 |

---

## 7. フェーズ依存関係

```
Phase 0: [[]] タグ基盤
  ↓ タグがないと横断検索できない
Phase 1: 横断検索 + タグクラウド
  ↓ タグが蓄積されないとロック時のメタデータ編集が活きない
Phase 2: イミュータブル + ロック
  ↓ 蓄積データがないとAI精度が出ない
Phase 3: AI + グラフ可視化
  ↓
Phase 4: モバイル / 高度機能
```

---

## 8. 懸念点と対策

### 8-1. `[[]]` タグの急増によるノイズ

**懸念**: 思いつくままにタグを作ると、微妙に違う表記のタグが乱立する（例: "React", "react", "ReactJS"）

**対策**:
- タグ名の正規化（小文字統一 or 大文字小文字区別を設定可能に）
- `[[` 入力時にサジェストを積極表示し、既存タグの再利用を促す
- タグマージ機能: 「ReactJS → React に統合」
- AI タグ提案 (Phase 3) で表記ゆれを自動検出

### 8-2. TipTap Extension の複雑性

**懸念**: `[[]]` のパース、サジェスト、DB同期を正しく動かすのは技術的に難しい

**対策**:
- TipTapの `@tiptap/suggestion` を最大限活用（Slashコマンドの実績あり）
- まずシンプルな InputRule ベースで MVP を作り、段階的にリッチにする
- テスト: TipTap JSON のシリアライズ/デシリアライズを Vitest で担保

### 8-3. 既存タグマイグレーションの安全性

**懸念**: task_tag_definitions → wiki_tags の移行中にデータが消えないか

**対策**:
- 旧テーブルは DROP しない（バックアップとして残す）
- マイグレーション前にエクスポート機能でバックアップを促すUI通知
- wiki_tags に移行完了後、旧テーブルとの差分チェックスクリプトを実行

### 8-4. Calendar保存先UIの変更

**懸念**: ディレクトリタグ廃止後、Calendarからタスクを作る際の「どのフォルダに入れるか」の操作性

**対策**:
- インクリメンタル検索付きフォルダセレクタ（既にTaskDetailに類似UIあり）
- 最近使ったフォルダを上位に表示
- デフォルト保存先の設定機能（未分類フォルダ or ユーザー指定）

### 8-5. パフォーマンス

**対策**:
- wiki_tag_assignments の複合インデックスで横断クエリを高速化
- `[[` サジェストは debounce 付き（100ms程度）
- タグクラウドはキャッシュ（タグ変更時のみ再計算）
- ネットワークグラフ (Phase 3) は WebWorker でレイアウト計算

---

## 9. この方針で解決される当初の課題

| 当初の課題 | 解決方法 |
|------------|----------|
| MemoとTaskが分離していて繋がりがない | `[[]]` タグで同じキーワードのMemo/Task/Noteが自動的に繋がる |
| アイデアをどう形にしていくか | Memoで `[[プロジェクト名]]` タグ → 横断検索で関連Taskを発見 → Task側で作業 |
| MemoとTasksのプロジェクトツリー的な可視化 | タグクラウド + 横断検索 → Phase 3でネットワークグラフ |
| Obsidian/Notionからの脱却 | Obsidianの `[[]]` + 独自のTimer/Sound/Scheduleで差別化 |
| カスタマイズ性 vs 学習コスト | `[[]]` は直感的。複雑な設定不要で「書くだけで繋がる」 |
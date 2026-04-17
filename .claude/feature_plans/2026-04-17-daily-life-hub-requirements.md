# Life Editor — 日常生活統合ハブ 要件整理書

**Status**: PLANNED
**Date**: 2026-04-17
**Related**: ADR-0005 (Claude Cognitive Architecture)

---

## 1. ビジョン

Life Editor を「AIと一緒に生活を設計する」日常のハブアプリケーションにする。
Notionのような汎用データベース基盤を活かし、タスク管理・スケジュール・知識管理・家計・学習を
一つのアプリケーション内で完結させる。特定用途のアプリ（家計簿アプリ等）を作るのではなく、
**Notion的な柔軟性でユーザーが自分の生活に合わせてデータベースを構築できる**ことがゴール。

---

## 2. 現在の機能マップ

### 2.1 コアデータ層（SQLite + DataService + MCP）

| 領域 | 機能 | 成熟度 | MCP対応 |
|------|------|--------|---------|
| タスク管理 | ツリー構造、フォルダ、ステータス、ソフトデリート | ◎ 完成 | ○ |
| スケジュール | 日次表示、ルーティン自動生成、テンプレート、一括作成、完了トグル | ◎ 完成 | ○ |
| ルーティン | 頻度設定(曜日/間隔)、リマインダー、グループ、タグ | ◎ 完成 | — |
| メモ | 日付ベース、ピン留め、パスワード保護、編集ロック | ◎ 完成 | ○ |
| ノート | ツリー構造、TipTapリッチテキスト、検索、接続(Note Connections) | ◎ 完成 | ○ |
| Wiki タグ | エンティティ横断タグ、グループ、接続、インラインタグ | ◎ 完成 | ○ |
| タイマー | ポモドーロ、プリセット、タスク紐付け、セッション記録 | ◎ 完成 | — |
| サウンド | 環境音ミキサー、プリセット、タグ、カスタムサウンド、プレイリスト | ◎ 完成 | — |
| データベース | Notion風テーブル (text/number/select/date/checkbox)、フィルタ/ソート/集計 | ○ 基本完成 | — |
| Paper Boards | ビジュアルキャンバス、ノード/エッジ、フレーム、Note連携 | ○ 基本完成 | — |
| ファイル管理 | ファイルエクスプローラー、添付ファイル | ○ 基本完成 | ○ |
| カレンダー | カレンダー管理（フォルダ的な構造） | △ 基盤のみ | — |
| 分析 | セクションあり（analytics） | △ 基盤のみ | — |
| ターミナル | portable-pty + xterm.js、Claude Code起動 | ◎ 完成 | — |
| データI/O | エクスポート/インポート/リセット | ○ 完成 | — |

### 2.2 インフラ層

| 項目 | 状態 |
|------|------|
| Tauri 2.0 + rusqlite (WAL) | ◎ 移行完了 |
| iOS (Tauri Mobile) | ○ 構築中 |
| MCP Server (30+ tools) | ◎ 安定稼働 |
| Cloud Sync (Hono + D1) | △ 設計中 |
| i18n (en/ja) | ◎ 完成 |
| UndoRedo | ◎ 完成 |

---

## 3. ギャップ分析 — 日常生活ハブに必要なもの

### 3.1 データベース強化（Notion的汎用性の完成）

**現状**: PropertyType 5種 (text/number/select/date/checkbox) + フィルタ/ソート/集計が実装済み。
基本的な家計簿やリストは既に作成可能。

**ギャップ**:

| 不足機能 | 用途例 | 優先度 |
|----------|--------|--------|
| `relation` プロパティ型 | DB間のリレーション（支出 → カテゴリDB） | 高 |
| `formula` プロパティ型 | 月次合計の自動計算、予算残高 | 高 |
| `rollup` プロパティ型 | リレーション先の集計（カテゴリ別合計） | 中 |
| `url` / `email` / `phone` プロパティ型 | 連絡先DB、リソース管理 | 低 |
| データベースビュー切替 (Board/Gallery/Calendar) | Kanban表示、カレンダー表示 | 中 |
| データベーステンプレート | 「家計簿テンプレ」「読書記録テンプレ」を一発作成 | 中 |
| MCP対応 (Database CRUD) | Claudeがデータベースを操作できるように | 高 |

**具体的ユースケース — 家計簿**:
- DB「月次支出」: 日付(date) / 金額(number) / カテゴリ(select) / メモ(text) / 固定費(checkbox)
- DB「カテゴリマスタ」: 名前(text) / 予算上限(number) / 色(select)
- relation で支出→カテゴリを紐付け、rollup でカテゴリ別合計、formula で予算残高
- → 現状 relation/formula/rollup が未実装だが、**select + number + 集計 (sum/avg) で簡易版は今でも可能**

### 3.2 外部サービス連携

#### Google Calendar 連携

**目的**: 既存の予定（仕事、プライベート）を life-editor のスケジュールに統合表示

**設計方針**:
- 読み取り専用の片方向同期（Google Calendar → life-editor）を基本とする
- schedule_items テーブルに `source` カラムを追加 (`local` / `google_calendar`)
- 外部イベントは編集不可、表示のみ
- 将来的に双方向同期は検討するが、初期は片方向で十分

**技術選択肢**:
| 方式 | メリット | デメリット |
|------|----------|------------|
| Google Calendar API (OAuth) | 正確、リアルタイム | OAuth フロー実装、トークン管理 |
| CalDAV プロトコル | 標準規格、Google以外にも対応 | 実装が複雑 |
| ICS URL 購読 | 最もシンプル、認証不要(公開URL) | 更新頻度制限、非公開カレンダー不可 |
| MCP経由 (google-calendar MCP) | Claudeが直接参照可能 | チャットUI前提、リアルタイム表示には不向き |

**推奨**: Phase 1 は ICS URL 購読（実装コスト最小）。Phase 2 で OAuth 連携。
Claudeからの参照は google-calendar MCP を併用。

#### Google Drive 連携

**目的**: Drive 上のドキュメントを life-editor のノートやWikiタグと紐付ける

**設計方針**:
- ファイルメタデータのインデックス化（タイトル、URL、更新日時）
- ノートから Drive ファイルへのリンク参照
- Drive 内の検索をlife-editor内から実行

**技術選択肢**:
| 方式 | メリット | デメリット |
|------|----------|------------|
| Google Drive API (OAuth) | フル機能 | OAuth実装、スコープ管理 |
| MCP経由 (google-drive MCP) | Claude経由で参照可能 | UI統合は別途必要 |

**推奨**: google-drive MCP を先行導入（Claudeからの参照）。
UI統合（ファイルピッカー等）は Phase 3。

#### NotebookLM + Gemini 連携

**目的**: YouTube等からの学習内容を life-editor に取り込み、知識として蓄積・整理する

**現在のワークフロー（手動）**:
1. YouTubeの動画を視聴
2. NotebookLM にソースとして追加、Audio Overview 等で要約
3. Gemini で深掘り・質問
4. 得た知識を（手動で）life-editor のノートに記録

**理想のワークフロー（統合後）**:
1. YouTubeの動画を視聴
2. NotebookLM で要約を生成
3. **life-editor に要約をインポート** → ノートとして保存
4. Wiki タグで既存知識と関連付け
5. Claude が「前回学んだXと今回のYは関連がある」と指摘

**技術的アプローチ**:

| 方式 | 説明 | 実現性 |
|------|------|--------|
| NotebookLM API | 公式APIでNotebookのソースや要約を取得 | △ API公開状況による |
| Gemini API | 動画URLからの要約生成をlife-editor内で実行 | ○ API利用可能 |
| クリップボード連携 | NotebookLMの要約をコピー → life-editorにペースト取り込み | ◎ 最もシンプル |
| ブラウザ拡張 | NotebookLM/Geminiページから直接life-editorに送信 | △ 開発コスト高 |
| Claude経由の要約 | YouTube URLをClaudeに渡し、MCP経由でノートに保存 | ○ 既存インフラ活用 |

**推奨**: 
- 短期: クリップボード + リッチペースト対応の強化（TipTap エディタ）
- 中期: Claude に YouTube URL を渡して要約 → MCP でノート保存（$0コスト）
- 長期: NotebookLM API が公開されれば直接連携

### 3.3 Claude 認知層（ADR-0005）

ADR-0005 で設計済み。要件整理としての位置づけ:

| フェーズ | 内容 | 日常生活ハブとの関係 |
|----------|------|---------------------|
| Phase 1: 記憶基盤 | claude_* テーブル + mcp-server-cognitive | 「こうだいは午前中に集中作業が得意」等のパターン学習 |
| Phase 2: 内省ループ | 日次/週次振り返り | スケジュール遵守率、タスク完了パターンの自動分析 |
| Phase 3: チャット UI | Claude Code ラッピング | 自然言語で「今日の予定見せて」「家計の今月の支出集計して」 |
| Phase 4: 自己最適化 | Eval駆動型改善 | 提案精度の向上、セーフガードの自動適用 |

**日常統合における Claude の役割**:
- スケジュール提案: ルーティン + パターン記憶に基づく最適スケジュール生成
- 家計分析: データベースの支出データから傾向分析（MCP経由）
- 知識整理: 新しいノートと既存Wiki タグの関連付け提案
- 振り返り支援: 日次メモ + スケジュール完了データから1日の要約生成

---

## 4. 統合アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│                   Life Editor UI                     │
│  ┌──────────┬──────────┬──────────┬────────────────┐ │
│  │ Schedule │ Tasks    │ Notes    │ Database       │ │
│  │ (Calendar│ (Tree)   │ (Wiki)   │ (Notion-like)  │ │
│  │  + GCal) │          │          │                │ │
│  └────┬─────┴────┬─────┴────┬─────┴───────┬────────┘ │
│       │          │          │             │          │
│  ┌────▼──────────▼──────────▼─────────────▼────────┐ │
│  │            DataService 抽象層                    │ │
│  └────────────────────┬────────────────────────────┘ │
│                       │                              │
│  ┌────────────────────▼────────────────────────────┐ │
│  │         Tauri IPC → rusqlite (SQLite)           │ │
│  │  ┌──────────────┬──────────────┬──────────────┐ │ │
│  │  │ life-editor  │ claude_*     │ sync_*       │ │ │
│  │  │ tables       │ tables       │ tables       │ │ │
│  │  │ (tasks,notes │ (memories,   │ (devices,    │ │ │
│  │  │  memos,dbs)  │  episodes,   │  versions)   │ │ │
│  │  │              │  safeguards) │              │ │ │
│  │  └──────────────┴──────────────┴──────────────┘ │ │
│  └─────────────────────────────────────────────────┘ │
│                       │                              │
│  ┌────────────────────▼────────────────────────────┐ │
│  │              Terminal + Chat Panel               │ │
│  │  Claude Code (PTY) → MCP Server(s)              │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
         │                              │
    ┌────▼────┐                    ┌────▼────┐
    │ MCP     │                    │ MCP     │
    │ Server  │                    │ Server  │
    │ (CRUD)  │                    │(Cognit.)│
    └────┬────┘                    └────┬────┘
         │                              │
    ┌────▼──────────────────────────────▼────┐
    │         SQLite (同一DB)                 │
    └────────────────────┬───────────────────┘
                         │
                    ┌────▼────┐
                    │ Cloud   │
                    │ Sync    │──→ D1 (Cloudflare)
                    │ (Hono)  │
                    └─────────┘

外部連携:
  ┌──────────┐   ICS/OAuth   ┌──────────────┐
  │ Google   │ ◄──────────── │ life-editor  │
  │ Calendar │               │ (Schedule)   │
  └──────────┘               └──────────────┘
  
  ┌──────────┐   MCP         ┌──────────────┐
  │ Google   │ ◄──────────── │ Claude Code  │
  │ Drive    │               │ (MCP経由)    │
  └──────────┘               └──────────────┘
  
  ┌──────────┐   手動/Claude  ┌──────────────┐
  │NotebookLM│ ──────────── ►│ life-editor  │
  │+ Gemini  │   要約取込    │ (Notes+Wiki) │
  └──────────┘               └──────────────┘
```

---

## 5. 実装フェーズ（優先順位）

### Phase 0: モバイル完成（現在進行中）
- Tauri iOS の安定化
- Safe Area 対応
- **完了が他の全フェーズの前提**

### Phase 1: Claude 記憶基盤 + Database MCP 対応
**期間目安**: Phase 0 完了後 1-2 週間
**依存**: Phase 0

1. SQLite に `claude_*` テーブル追加（ADR-0005 Phase 1）
2. `mcp-server-cognitive/` 骨格作成
3. `save_memory` / `recall_memories` / `retire_memory` 実装
4. 既存データベース機能の MCP ツール追加:
   - `list_databases` / `get_database` / `create_database`
   - `add_database_row` / `update_database_cell` / `query_database`
5. Claude がデータベースを自然言語で操作可能になる

**成果**: Claude が life-editor の全データ（タスク + スケジュール + メモ + ノート + DB）にアクセスし、
かつ自身の記憶を永続化できる状態。

### Phase 2: 日常ユースケース強化
**期間目安**: 2-3 週間
**依存**: Phase 1

1. データベースプロパティ型の追加:
   - `relation` 型（DB間リレーション）
   - `formula` 型（計算式）
2. データベーステンプレート機能:
   - 「家計簿」「読書記録」「習慣トラッカー」等のプリセット
3. Claude 内省ループ（ADR-0005 Phase 2）:
   - `reflect_on_day` / `analyze_patterns` 実装
   - ターミナルから起動可能
4. ノートのリッチペースト強化:
   - NotebookLM/Gemini からのコピペでフォーマット維持
   - 「Web Clip」的な取り込みUI

**成果**: 家計簿や読書記録をDB で管理し、Claude が日次振り返りを実行できる。

### Phase 3: 外部連携 + チャット UI
**期間目安**: 3-4 週間
**依存**: Phase 2

1. Google Calendar 連携:
   - ICS URL 購読（片方向同期）
   - スケジュール画面に外部イベント表示
2. チャットパネル（ADR-0005 Phase 3）:
   - Claude Code PTY 出力のパース → チャットバブル UI
   - 動的システムプロンプト構築
3. Cloud Sync（claude_* テーブル含む）
4. Google Drive MCP 連携（Claude経由のドキュメント参照）

**成果**: Google Calendar が統合表示され、チャットで自然言語操作が可能。

### Phase 4: 高度な統合
**期間目安**: 長期（必要に応じて）

1. データベース追加機能:
   - `rollup` 型
   - ビュー切替（Board / Gallery / Calendar）
2. Google Calendar OAuth 双方向同期
3. Claude 自己最適化（ADR-0005 Phase 4）
4. NotebookLM API 連携（API 公開後）
5. 分析ダッシュボード強化（analytics セクション）

---

## 6. 設計原則

1. **Notion的汎用性**: 特定用途のUIを作るのではなく、データベースの柔軟性で対応する
2. **Claude First**: 新しいデータ操作は必ず MCP ツールも同時に追加する
3. **段階的統合**: 外部サービスは最小限の実装（ICS→OAuth、クリップボード→API）から始める
4. **$0 追加コスト**: Claude 連携は Max サブスクリプション範囲内で完結させる
5. **オフライン動作**: 外部連携が切れてもローカルデータは完全に機能する
6. **既存資産活用**: 30+ MCP ツール、DataService 抽象化、Provider パターンを最大限再利用する

---

## 7. 今すぐ可能なこと（開発不要）

現在の life-editor でも以下は既に実現可能:

- **簡易家計簿**: Database で「日付/金額/カテゴリ(select)/メモ」テーブルを作成、sum 集計で月次合計
- **読書記録**: Database で「タイトル/著者/ステータス(select)/評価(number)/感想(text)」
- **習慣トラッカー**: Routine + Schedule Items の完了率で実質的に追跡中
- **知識管理**: Notes + Wiki Tags でタグベースのナレッジベース
- **学習記録**: Memo（日次）+ Notes（テーマ別）+ Wiki Tags（概念の関連付け）
- **Claude によるタスク操作**: ターミナルから Claude Code → MCP Server で全データ操作可能

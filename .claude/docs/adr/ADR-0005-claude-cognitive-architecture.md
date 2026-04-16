# ADR-0005: Claude Cognitive Architecture — 永続的記憶化・最適化・アプリ統合の設計思想

**Status**: PROPOSED
**Date**: 2026-04-16
**Deciders**: こうだい
**Context**: 調査書「Claude成長型ハーネス設計調査」の分析結果 + life-editor v2 テーマ「AIと一緒に生活を設計する」

---

## 1. 背景と動機

life-editor は既に MCP Server（30+ ツール）、SQLite 永続化、アプリ内ターミナル（Claude Code 連携）を持つ。
しかし現状、Claude の記憶は `.claude/` ディレクトリのファイルベース（開発タスクトラッカー）に限定されており、
**ユーザーの生活データ（タスク、スケジュール、メモ、ポモドーロ記録）から学習・成長する仕組み**が存在しない。

調査書が示す「自律進化型エージェント」のビジョンを life-editor に適用するには、
記憶の永続化、学習サイクル、マルチデバイス対応を段階的に設計する必要がある。

---

## 2. 設計判断

### 判断 1: Claude 記憶のプライマリストレージ → SQLite 新テーブル

**選択**: life-editor と同一の SQLite DB に `claude_*` プレフィックスのテーブル群を追加

**理由**:
- life-editor の生活データと JOIN して横断分析が可能（例：タスク完了率 × 時間帯パターン）
- MCP Server が既に同一 DB にアクセスしているため、新ツール追加のインフラコストがゼロ
- rusqlite の WAL モード + version カラムにより、Cloud Sync との統合が自然

**却下した代替案**:
- ファイルベース（.claude/memory/）: Claude Code CLI との相性は良いが、構造化クエリに不向き
- 分離型 DB（claude_memory.db）: JOIN 不可、sync 対象が増える複雑さ

**テーブル設計（概念）**:

```
claude_memories         — Semantic Memory（抽出されたパターン・ルール）
claude_episodes         — Episodic Memory（具体的な成功/失敗の記録）
claude_safeguards       — MERF ループで抽出された「やってはいけないこと」
claude_preferences      — ユーザーの好み・行動パターン
claude_reflections      — 日次/週次の振り返り結果
```

**Working Memory は SQLite に入れない**。
現在のセッションコンテキスト（進行中タスク、直近のやりとり）はインメモリで十分。
SQLite に保存するのは「セッションを跨いで価値がある情報」のみ。

### 判断 2: 新 MCP Server の分離 → mcp-server-cognitive/

**選択**: 既存の `mcp-server/`（データ CRUD）とは別に `mcp-server-cognitive/`（分析・内省・記憶管理）を新設

**理由**:
- 既存 MCP Server は「データの読み書き」に専念。28 ツールが安定稼働中
- 認知系ツールは性質が根本的に異なる（分析、パターン抽出、提案生成）
- 独立デプロイ可能。認知系の改修が CRUD 側に影響しない
- 調査書の「サンドボックスモード」原則に合致（破壊的変更の影響を隔離）

**mcp-server-cognitive が提供するツール群（概念）**:

```
# 記憶管理
save_memory           — 新しい記憶（パターン/セーフガード/好み）を保存
recall_memories       — 関連する記憶を検索・取得
retire_memory         — 古くなった記憶を退役させる

# 内省・分析（MERF ループの Reflector 相当）
reflect_on_day        — 日次の振り返り（タスク完了率、時間配分、メモ分析）
analyze_patterns      — 週次/月次のパターン抽出（集中時間帯、中断要因）
generate_safeguard    — 失敗パターンからセーフガードを抽出

# 提案
suggest_schedule      — パターンに基づくスケジュール提案
suggest_task_priority — コンテキストに基づくタスク優先順位提案
```

**同一 SQLite DB を参照**。mcp-server と mcp-server-cognitive は同じ DB ファイルを読み書きする。
WAL モードにより同時アクセスは安全。

### 判断 3: マルチデバイス対応 → チャット UI 付き、Cloud Sync 対象

**選択**: Claude 記憶テーブルも Cloud Sync (Cloudflare D1) の対象に含め、将来的にチャット UI を構築する

**APIコスト分析（月額推定）**:

| 利用パターン | モデル | メッセージ数/日 | 月額コスト |
|---|---|---|---|
| 日常会話・簡単な指示 | Haiku 4.5 ($1/$5/MTok) | 50 | ~$4.50 |
| 分析・計画・振り返り | Sonnet 4.6 ($3/$15/MTok) | 10 | ~$6.00 |
| 合計（Prompt Cache 適用後） | — | — | **$5-12** |

Prompt Caching（システムプロンプト + 記憶コンテキストのキャッシュ、入力コスト 90% 削減）と
モデル自動ルーティング（Haiku/Sonnet の切り替え）により、個人利用は十分現実的。

**チャット UI のアーキテクチャ**:

```
[Mobile/Desktop Chat UI]
  ↓ Claude API (Messages API)
  ↓ System Prompt に記憶コンテキストを動的注入
  ↓ Tool Use で MCP Server のツールを呼び出し
  ↓ 結果を life-editor の SQLite に書き込み
```

注意: Claude API の Tool Use 機能を使えば、チャット UI から直接 MCP ツールを呼び出せる。
ただし、MCP プロトコル自体は stdio/SSE ベースのため、
**API 側では Tool Use の定義として MCP ツールのスキーマを変換して渡す**必要がある。

---

## 3. 記憶の階層モデル（life-editor 固有の定義）

調査書の 4 層メモリモデルを life-editor のコンテキストに翻訳する。

### 3.1 Working Memory（作業記憶）— インメモリ、非永続

- 現在のチャットセッションのコンテキスト
- 進行中のタスクとタイマー状態
- 直近の 3-5 ターンの会話履歴
- **格納先**: API リクエストの messages 配列 + システムプロンプト内

### 3.2 Episodic Memory（エピソード記憶）— SQLite `claude_episodes`

- 「2026-04-15 に 3 時間集中セッションを完走し、タスク A, B, C を完了した」
- 「火曜の午後にスケジュール通りに進まなかった。原因は予定外の会議」
- **life-editor の既存データが自動的にエピソード記憶として機能する**
  - `schedule_items` + `completed` フラグ → 実行記録
  - `memos` → その日の気づき・振り返り
  - ポモドーロ完了記録 → 集中セッションの軌跡
- **新規保存**: Claude が分析した「要約されたエピソード」のみ claude_episodes に書き込む

### 3.3 Semantic Memory（意味記憶）— SQLite `claude_memories`

- 「こうだいは午前中にコード作業を入れると効率が良い」
- 「週末は長い集中セッションより短いバーストが合っている」
- **Episodic Memory からの抽出・抽象化**。MERF ループの Reflector が生成
- 検証・退役の仕組み: 新しいエピソードと矛盾する場合は retire フラグを立てる

### 3.4 Safeguard Memory（セーフガード記憶）— SQLite `claude_safeguards`

- 「夕方以降に新機能の実装タスクを入れると、翌日に品質問題が発生しやすい」
- 「3 日連続で計画未達の場合、タスク量の見直しが必要」
- **失敗パターンから抽出された予防知識**
- Meta フェーズ（計画立案時）に自動ロードされ、同じ失敗を繰り返さない

### 3.5 Vector Memory — 将来課題（Phase 3 以降）

SQLite だけでは類似検索が困難。将来的に以下の選択肢を検討:
- sqlite-vss（SQLite Vector Search 拡張）
- Cloudflare Vectorize（D1 と組み合わせ）
- ローカル Embedding モデル（Tauri + ONNX Runtime）

---

## 4. 学習サイクルの設計（簡易 MERF ループ）

調査書の MERF ループを life-editor のコンテキストに簡素化する。

### 4.1 日次ループ（Daily Reflection）

```
[Trigger] 1 日の終わり or ユーザーの明示的な指示

[Meta]    今日のスケジュール・タスク・メモを取得（既存 MCP ツール）
          関連する Semantic Memory / Safeguard を検索
          
[Execute] （ユーザーの 1 日は既に「実行済み」）

[Evaluate] タスク完了率、スケジュール遵守率、集中セッション数を計算
           計画 vs 実績のギャップを特定
           
[Reflect] パターンの抽出:
          - 成功パターン → Semantic Memory に保存
          - 失敗パターン → Safeguard に保存
          - 翌日の計画への提案を生成
```

### 4.2 週次ループ（Weekly Analysis）

```
[Trigger] 週末 or ユーザーの明示的な指示

[Meta]    1 週間分の Episode + Daily Reflection 結果を取得

[Evaluate] 週全体の傾向分析
           曜日別パフォーマンスパターン
           繰り返し発生している障害の特定

[Reflect] Semantic Memory の検証:
          - 既存パターンと一致 → 信頼度を上げる
          - 矛盾するデータ → パターンを更新 or 退役
          - 新パターンの発見 → 新規保存
```

### 4.3 実装上の注意

- ループは**ユーザーの指示で起動**。自動実行は Phase 3 以降
- Reflector の出力は必ずユーザーに表示し、承認を得てから保存
- 「セーフガードの自動適用」は段階的に導入（最初は提案のみ）

---

## 5. 動的システムプロンプトの設計

チャット UI から Claude API を呼ぶ際、システムプロンプトを毎回動的に構築する。

### 5.1 構成要素

```
[Static Core]
  - Claude のアイデンティティ（life-editor のパートナー AI）
  - 安全制約（個人情報の扱い、破壊的操作の禁止）
  - 利用可能なツール一覧

[Dynamic - User Context]  ← claude_preferences から取得
  - ユーザーの好み（言語、フォーマット、コミュニケーションスタイル）
  - 現在の目標・プロジェクト

[Dynamic - Active Memory] ← claude_memories + claude_safeguards から取得
  - 直近のパターン（「午前中はコード作業に集中」）
  - アクティブなセーフガード（「夕方以降の新機能実装は避ける」）

[Dynamic - Today's Context] ← 既存 MCP ツールから取得
  - 今日のスケジュール
  - 進行中のタスク
  - 今日のメモ
```

### 5.2 コンテキスト予算の管理

調査書が強調する「アテンション予算」の原則に従い:

- Static Core: ~2,000 tokens（固定）
- Dynamic User Context: ~500 tokens（最大）
- Active Memory: ~1,500 tokens（関連度順に上位 N 件）
- Today's Context: ~1,000 tokens（要約形式）
- **合計: ~5,000 tokens**（全体の 5% 以下に抑える）

Prompt Caching: Static Core + Dynamic User Context はキャッシュ対象。
Active Memory + Today's Context は毎リクエスト更新。

---

## 6. フェーズ計画

### Phase 1: 記憶基盤の構築

- SQLite に claude_* テーブルを追加（migrations.rs）
- mcp-server-cognitive/ の骨格を作成
- save_memory / recall_memories / retire_memory ツールの実装
- 既存 MCP Server から記憶系ツールを呼べることの確認

### Phase 2: 内省ループの実装

- reflect_on_day / analyze_patterns ツールの実装
- Safeguard の保存・検索・適用ロジック
- Claude Code ターミナルからの内省ループ起動

### Phase 3: チャット UI + Cloud Sync

- life-editor にチャットパネルを追加（React コンポーネント）
- Claude API (Messages API) との直接通信
- 動的システムプロンプトの構築ロジック
- claude_* テーブルの Cloud Sync 対応
- モデルルーティング（Haiku / Sonnet 自動切り替え）
- Prompt Caching の実装

### Phase 4: 自己最適化（Eval 駆動）

- 提案の受け入れ率トラッキング
- パターンの信頼度スコアリング
- Claude によるスキル定義の自己改善ループ

---

## 7. 技術的制約と前提

- **Claude API と MCP は別レイヤー**: チャット UI → Claude API (Tool Use) → life-editor DB。
  MCP プロトコルは Claude Code CLI 経由でのみ使用。チャット UI からは Tool Use 定義として変換
- **コスト管理**: API キーに月額上限を設定。暴走防止のハードリミット必須
- **プライバシー**: Claude API にデータを送信する以上、Anthropic のデータポリシーを理解した上で設計
- **オフライン対応**: チャット UI はオンライン必須だが、記憶の参照・蓄積はローカル SQLite で完結

---

## 8. 調査書からの引用と適用判断

| 調査書の概念 | life-editor での適用 | 適用度 |
|---|---|---|
| 4 層メモリモデル | Working/Episodic/Semantic/Safeguard の 4 層（Vector は後回し） | ◎ |
| MERF ループ | 日次/週次の簡易版として実装。医療特化部分は除外 | ○ |
| 動的システムプロンプト | チャット UI 構築時に実装。コンテキスト予算 ~5,000 tokens | ◎ |
| ランタイムガードレール | claude-code-harness の Go エンジンは不採用。MCP ツール側でバリデーション | △ |
| Eval 駆動型自己改善 | Phase 4。まず手動での振り返りから開始 | △（将来） |
| MCP によるツール仮想化 | 既に実装済み。認知系ツールを追加拡張 | ◎ |
| コンテキストエンジニアリング | Prompt Caching + Model Routing でコスト最適化 | ◎ |
| NexAgent (Elixir/OTP) | 技術スタック不一致。概念のみ参考（永続プロセス） | ✕ |
| Ruflo (Swarm Intelligence) | 個人利用には過剰。マルチエージェントは不採用 | ✕ |

---

## 9. 関連ドキュメント

- [ADR-0002: Context/Provider Pattern](./ADR-0002-context-provider-pattern.md)
- [ADR-0003: Schedule Provider 分割](./ADR-0003-schedule-provider-split.md)
- [調査書: Claude成長型ハーネス設計調査](https://docs.google.com/document/d/1R6DFhTOJAqqmBU3vsOnbHf8ZRqMTI3LAHUJAY9Etq6E)
- [CLAUDE.md: プロジェクト概要](../../CLAUDE.md)

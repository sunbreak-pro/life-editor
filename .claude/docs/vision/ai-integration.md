# AI Integration — Vision

> CLAUDE.md §5 AI Integration の詳細版。Cognitive Architecture (ADR-0005) 要旨 / 利用シナリオ / AI 不使用時の機能割合。
> **素案（Phase A-2）— ユーザーレビュー待ち**

---

## 1. Cognitive Architecture（ADR-0005, PROPOSED）

> 詳細は `.claude/docs/adr/ADR-0005-claude-cognitive-architecture.md` 参照

### 要旨

life-editor 既存の MCP Server / SQLite / アプリ内ターミナルを基盤に、**Claude の永続記憶 + 学習サイクル + マルチデバイス対応**を段階的に構築する。

### 設計判断（3 点）

1. **記憶ストレージ = 同一 SQLite に `claude_*` テーブル群を追加**（claude_memories / claude_episodes / claude_safeguards / claude_preferences / claude_reflections）。生活データと JOIN して横断分析可能、Cloud Sync の対象に統合
2. **新 MCP Server `mcp-server-cognitive/` を分離**（既存 30 ツールの CRUD と分け、内省・分析・記憶管理に専念）
3. **Claude Code プロセス ラッピング方式**で Max サブスク内 $0 実現（Claude Agent SDK は third-party サブスク利用不可のため）

### 記憶階層モデル（life-editor 適用版）

- **Working Memory**: インメモリ、非永続（現在セッションのコンテキストのみ）
- **Episodic Memory** → `claude_episodes`: 既存 schedule_items / memos / pomodoro 記録が自動的にエピソードとして機能
- **Semantic Memory** → `claude_memories`: Episode から抽象化されたパターン（「午前中に集中作業が得意」等）
- **Safeguard Memory** → `claude_safeguards`: 失敗パターンから抽出された予防知識
- **Vector Memory**: Phase 3 以降の課題（sqlite-vss / Vectorize / ローカル Embedding 検討）

### 学習サイクル（簡易 MERF ループ）

- **日次**: 1 日終わりに `reflect_on_day` → タスク完了率・スケジュール遵守率・集中セッション分析 → 翌日提案
- **週次**: `analyze_patterns` で曜日別パターン抽出 → Semantic Memory 検証・更新

### フェーズ計画

| Phase | 内容                                                                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1     | 記憶基盤: claude\_\* テーブル + mcp-server-cognitive 骨格 + save/recall/retire_memory ツール                                 |
| 2     | 内省ループ: reflect_on_day / analyze_patterns / Safeguard 適用ロジック                                                       |
| 3     | チャット UI + Cloud Sync: Claude Code PTY 出力パース → チャットバブル UI、claude\_\* テーブル D1 同期、CloudCLI セルフホスト |
| 4     | 自己最適化: Eval 駆動型改善、提案受け入れ率トラッキング                                                                      |

---

## 2. 利用シナリオ

### シナリオ 1: 朝の計画

ユーザーが「今日のタスクの優先順位を整理して」とターミナルで Claude に指示。Claude が MCP `list_tasks` でタスクを取得し、`update_task` で並び替え・スケジュール再配置。カレンダー UI が即座に反映される。

### シナリオ 2: 1 日の振り返り

夜に `reflect_on_day` を起動。Claude が schedule_items の完了率、memos の内容、pomodoro_sessions のパターンを分析し、Semantic Memory に「火曜午後は予定外会議が入りやすい」等のパターンを保存。翌日のスケジュール提案を生成。

### シナリオ 3: データベース集計

「今月の食費合計して」とユーザーが指示。Claude が Database MCP ツール（Phase 1 で追加予定の `query_database`）で家計簿 DB を集計し、カテゴリ別合計を提示。formula プロパティが追加されれば月次予算残高も自動算出される。

---

## 3. AI 不使用でも成立する機能の割合

**コア機能の約 80% は AI なしで動作する**：

- Tasks / Schedule / Notes / Memo の CRUD は完全に UI で完結
- Pomodoro Timer / Audio Mixer / Playlist は AI 不要
- Database（汎用 DB）の作成・編集・集計（sum/avg）は UI のみで可能
- WikiTags / File Explorer / Settings は AI 不要

**AI が真価を発揮する場面**:

- 自然言語での横断検索・一括操作（「先月の TODO で未完了のものを今月に移動」など）
- パターン分析と提案（reflect_on_day / analyze_patterns）
- 外部知識の取り込み（YouTube URL → 要約 → ノート保存）
- 設計支援（Database スキーマ提案、ルーティン構成提案）

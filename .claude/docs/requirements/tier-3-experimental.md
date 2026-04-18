# Tier 3 — Experimental / Frozen Candidates

> 実験 / 凍結候補。半年以上未利用ならドロップ判断対象。
> Phase B-3 で凍結継続 / 削除候補 / 未着手 のラベル付与。Phase C で最終判定。
> 簡略版テンプレ: Status / Boundary / 凍結 or 削除判断の根拠 のみ記入。

**Tier 3 機能数**: 6（暫定、Phase B-3 で確定）

---

## Feature: Paper Boards

**Tier**: 3
**Status**: ○基本完成（フレーム / レイヤー / Undo/Redo / ソフトデリートまで実装済み）
**Verdict**: **凍結継続**（実装維持、新機能追加は凍結）
**Owner Provider/Module**: `frontend/src/components/Ideas/Connect/Paper/` / `src-tauri/src/commands/paper_board_commands.rs` / `src-tauri/src/db/paper_board_repository.rs`
**Supports Value Prop**: なし（Tier 3 候補）

### Boundary

- やる: ビジュアルキャンバス（React Flow 系）/ ノード（Card / Text）/ エッジ / フレーム nesting / レイヤー DnD / fit-content 自動リサイズ / Note 連携 / Undo/Redo
- やらない: 新機能追加の積極推進（既存不具合修正とリファクタ追従のみ）/ MCP 対応

### 凍結 or 削除判断の根拠

- 最終コミット日: **2026-04-18**（TypeScript 修正）/ 機能追加は **2026-04-12**（Phase 3 Board Undo/Redo）が最後
- 機能追加コミット件数: **13 件**（2026-03-20 〜 2026-04-12 に活発、以降はリファクタ追従のみ）
- 実利用状況（作者）: 未確認（Phase C でヒアリング）
- 位置づけ: Notes / WikiTag Connections と用途が重複。V3（Notion 的汎用 DB）に寄せると Paper Boards の必要性は限定的
- Verdict 根拠: 実装は完成しているが Tier 1 の Notes / WikiTag Connections で代替可能。削除はせず「凍結継続」とし、新機能は追加しない

### Dependencies

- DB Tables: `paper_boards` / `paper_nodes` / `paper_edges`
- 他機能: Notes（連携）

---

## Feature: Analytics

**Tier**: 3
**Status**: △基盤のみ（基本統計 + 作業時間グラフ + Recharts 複数タブ、ダッシュボード未成熟）
**Verdict**: **凍結継続（ADR-0005 Phase 4 と統合検討）**
**Owner Provider/Module**: `AnalyticsFilterProvider` / `frontend/src/components/Analytics/` / `src-tauri/src/commands/diagnostics_commands.rs`
**Supports Value Prop**: なし（Tier 3 候補）

### Boundary

- やる: 基本統計（総タスク数 / 完了率 / フォルダ数）/ 作業時間グラフ（Recharts）/ 複数タブ / 右サイドバーフィルタパネル
- やらない: 詳細ダッシュボード / カスタムレポート / Claude 駆動の分析（ADR-0005 Phase 4 で別途）

### 凍結 or 削除判断の根拠

- 最終コミット日: **2026-04-18**（TypeScript 修正）/ 最終機能追加は **2026-02-25**（6-tab 拡張）
- 機能追加コミット件数: **17 件**（2026-02-09 初期 〜 2026-02-25 活発、以降はリファクタ追従のみ）
- 実利用状況（作者）: 未確認（Phase C でヒアリング）
- 関連: **ADR-0005 Phase 4（自己最適化）**で `reflect_on_day` / `analyze_patterns` が生成する分析データの可視化パネルとして再利用想定
- Verdict 根拠: 基盤は完成しており、Claude 駆動分析（ADR-0005 Phase 2）の出力を表示する UI として活用する方針。単独ではなく Cognitive Architecture と統合する形で残す

### Dependencies

- 他機能: Tasks / Timer / Schedule（データ源）/ Cognitive Architecture（将来の分析データ源）

---

## Feature: NotebookLM 連携

**Tier**: 3
**Status**: ×未着手（構想のみ）
**Verdict**: **未着手（Claude 経由代替で暫定対応）**
**Owner Provider/Module**: 未実装

### Boundary

- やる（構想）: YouTube / Web 動画の要約取り込み → ノート保存
- やらない（現状）: NotebookLM API 直接連携（API 公開待ち）

### 凍結 or 削除判断の根拠

- 実装着手なし（NotebookLM 公式 API 未公開）
- 暫定対応（短期）: クリップボード + リッチペースト強化（Notes Future Enhancement）
- 暫定対応（中期）: Claude に YouTube URL を渡して要約 → MCP `create_note` でノート保存（ADR-0005 Phase 2 の一環）
- Verdict 根拠: 公式 API 公開まで実装着手しない。Claude 経由で等価の機能が実現でき、生活 OS 化のボトルネックではないため優先度低

### Dependencies

- 外部: NotebookLM API（公開待ち）
- 他機能: Notes / WikiTags / MCP Server（Claude 経由代替パス）

---

## Feature: Google Calendar 連携

**Tier**: 3
**Status**: ×未着手（構想のみ）
**Verdict**: **未着手（ICS 購読を短期 Phase 1 として予定）**
**Owner Provider/Module**: 未実装

### Boundary

- やる（構想）: Google Calendar の予定を life-editor のスケジュールに参照表示
- やらない（現状）: 予定編集（外部サービス代替を Non-Goal とする — CLAUDE.md §4 NG-6）

### 凍結 or 削除判断の根拠

- 実装着手なし
- 推奨アプローチ:
  - Phase 1: ICS URL 購読（実装コスト最小、片方向 import）
  - Phase 2: OAuth 連携（双方向同期まで）
  - Claude からの参照は google-calendar MCP を併用
- Schedule 機能の Future Enhancement（§Schedule 短期 / 中期）と統合
- Verdict 根拠: Tier 1 Schedule の補完として価値が高く、ICS 購読は小さく始められる。Tier 2 昇格 or Schedule 内部実装として吸収する可能性あり（Phase C 以降で再評価）

### Dependencies

- 他機能: Schedule
- 外部: Google Calendar API / ICS URL / google-calendar MCP

---

## Feature: Google Drive 連携

**Tier**: 3
**Status**: ×未着手（構想のみ）
**Verdict**: **未着手（優先度低、MCP 経由代替で十分）**
**Owner Provider/Module**: 未実装

### Boundary

- やる（構想）: Drive 上のドキュメントをノートや WikiTags と紐付け
- やらない（現状）: ファイルピッカー UI 統合

### 凍結 or 削除判断の根拠

- 実装着手なし
- 推奨アプローチ: **google-drive MCP を先行導入**（Claude 経由の参照で即時対応）
- File Explorer（Tier 2）がローカル FS 中心で機能するため、Drive 固有実装の必要性は低い
- Verdict 根拠: 本体実装は着手せず、Claude + google-drive MCP の組合せで代替する。将来必要性が明確になった時点で File Explorer 機能の拡張として取り込む

### Dependencies

- 他機能: Notes / WikiTags / File Explorer / MCP Server
- 外部: Google Drive API / google-drive MCP

---

## Feature: Cognitive Architecture (ADR-0005 PROPOSED)

**Tier**: 3 (Reference)
**Status**: ×未着手（PROPOSED ADR）
**Verdict**: PROPOSED のまま継続（CLAUDE.md §8.3 で要約参照）
**Owner Provider/Module**: 未実装（将来 `mcp-server-cognitive/` + SQLite `claude_*` テーブル）

### Boundary

- やる（構想）: 永続記憶化 / 学習サイクル（MERF ループ）/ チャット UI / Cloud Sync
- やらない（現状）: 全 4 フェーズすべて未着手

### 凍結 or 削除判断の根拠（Phase C で記入）

- ADR-0005 が `.claude/docs/adr/` に PROPOSED として残置
- Phase 1（記憶基盤）から段階的着手予定
- Tier 3 だが ADR-0005 経由で長期ロードマップに組み込み済み
- Verdict 根拠: PROPOSED 維持（Phase A-3 で確定）

### Dependencies

- DB Tables（新規）: `claude_memories` / `claude_episodes` / `claude_safeguards` / `claude_preferences` / `claude_reflections`
- 他機能: MCP Server（既存）/ Cloud Sync（既存）/ Terminal + Claude Code（既存）

### Related Plans

- 関連 ADR: `.claude/docs/adr/ADR-0005-claude-cognitive-architecture.md`

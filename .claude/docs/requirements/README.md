# Life Editor — 機能要件定義（Tier 1-3）

CLAUDE.md §11 Feature Tier Map の詳細版。各機能の Purpose / Boundary / Acceptance Criteria / Dependencies を定義する SSOT。

## ファイル構成

| ファイル                 | 対象                                                           | 規模目安 |
| ------------------------ | -------------------------------------------------------------- | -------- |
| `tier-1-core.md`         | Value Proposition を直接支えるコア機能（推定 8-10 機能）       | ~2000 行 |
| `tier-2-supporting.md`   | 補助機能 / Tier 1 の補完（推定 10-12 機能）                    | ~1500 行 |
| `tier-3-experimental.md` | 実験 / 凍結候補 / 半年以上未利用ならドロップ判断対象（5-8 件） | ~800 行  |
| `ios-additions.md`       | iOS 限定の上乗せ要件（元 note「iOS追加機能要件」の SSOT 化）   | 可変     |

## Tier 分類の判定基準

| Tier | 定義                                                                                | 判定者                 |
| ---- | ----------------------------------------------------------------------------------- | ---------------------- |
| 1    | Value Proposition (CLAUDE.md §3) を直接支える / 無いと Life Editor として成立しない | ユーザー（作者）       |
| 2    | 補助機能 / あると価値が大幅増 / Tier 1 機能の補完                                   | ユーザー + Claude 提案 |
| 3    | 実験 / 凍結候補 / 半年以上未利用ならドロップ判断対象                                | Phase C で再評価       |

## 1 機能あたりの要件テンプレート

```markdown
## Feature: <機能名>

**Tier**: 1 | 2 | 3
**Status**: ◎完成 / ○基本完成 / △基盤のみ / ×未着手
**Owner Provider/Module**: 例 `TaskTreeProvider` / `src-tauri/src/commands/task.rs`
**MCP Coverage**: 対応ツール名一覧 / —
**Supports Value Prop**: V1 / V2 / V3（CLAUDE.md §3 参照）

### Purpose

1-2 行で目的。

### Boundary

- やる: <bullet>
- やらない: <bullet>

### Acceptance Criteria

Tier 1: 5 件以上 / Tier 2: 3-5 件 / Tier 3: 1-3 件（簡略版）

- [ ] AC1
- [ ] AC2
- ...

### Dependencies

- 他機能: <Feature 名>
- 外部サービス: <Google Calendar / Claude API 等>
- DB Tables: <table 名一覧>
- IPC Commands: <command 一覧 or 「DataService 経由」>

### Known Issues / Tech Debt

- <bullet>

### Future Enhancements

- 短期: <bullet>
- 中期: <bullet>

### Related Plans

- `.claude/feature_plans/YYYY-MM-DD-<slug>.md`（IN_PROGRESS）
- `.claude/archive/<file>`（COMPLETED）
```

## 記入順序（推奨）

1. Tier 1（コア）から記入。Owner Provider / DB Tables / IPC Commands は実コードで grep して実在確認
2. Acceptance Criteria は「ユーザーが UI で観察できる挙動」レベルに具体化
3. Tier 2 は AC を 3-5 件に簡略化可
4. Tier 3 は Status / Boundary / 凍結 or 削除判断の根拠 のみ簡略版

## CLAUDE.md §11 との同期

- 機能を追加 / 削除 / Tier 変更したら、CLAUDE.md §11 Feature Tier Map も同時更新
- 機能数の差分ゼロを Verification で確認

## Stack 並立期間中の追加ルール (cleanup-and-consolidation Phase 3-5, 2026-05-24)

移行 SSOT (`2026-05-04-cross-platform-migration.md`) に基づく Stack 並立期間中、各 Tier ファイルは以下を追加する:

- **Feature 単位（AC 単位ではない）に `Stack:` 行を持つ**。書式: `Stack: <現行> → <移行先> (<移行 Phase>)`
- 例: `Stack: Tauri SQLite (frontend/ + src-tauri/) → Supabase Postgres (shared/ + web/, 移行 SSOT Phase 2 進行中)`
- 移行が完了していない Feature でも記入する（並立期間中の参照透明性）
- 移行 Phase 5 完了時に Stack 行は廃止し、移行後スタックの単一記述に統合する

# Plan: Tasks Fetch by Scheduled Range（I-1、計測前提）

**Status:** DROPPED (2026-04-18 — 計測しきい値未達)
**Created:** 2026-04-18
**Project:** /Users/newlife/dev/apps/life-editor
**Verdict source:** `.claude/archive/2026-04-18-deferred-items-reevaluation.md` Item 1 (I-1)
**Related requirements:** [`tier-1-core.md`](../docs/requirements/tier-1-core.md) §Tasks Known Issues

---

## Context

Sync 完了時に `fetchTaskTree()` が全件取得を走らせる。数百件超のタスクで iOS の遅延が懸念される（§Tasks Known Issues の保留 I-1）。ただし現状は実測未取得のため、**計測 → しきい値判断 → 実装** の順で進める。

## Verdict

**Keep (計測次第で実装)** — 計測結果がしきい値を超えた場合のみ実装、しきい値以下なら Drop に降格

### 判定根拠

- Tier 1 Tasks の Known Issues に正式登録済み（ユーザー体感が劣化する懸念を SSOT に記録）
- Target User（§2 Key characteristics）は「生活データを一つの SQLite に集約したい」= パワーユーザー寄り。タスク数は数百〜数千件まで想定される
- Mobile（§5 Platform Strategy）は "Consumption + Quick capture" 用途のため、起動 / sync 時の遅延はユーザー離脱に直結

## しきい値（計測ベース）

| タスク数 | 全件 fetch 時間目安 | 判定             |
| -------- | ------------------- | ---------------- |
| ≤ 200    | < 200ms             | Drop（実装不要） |
| 200-500  | 200-500ms           | Modify 検討      |
| ≥ 500    | ≥ 500ms             | Keep（実装必須） |

## Steps

- [ ] S1. iOS シミュレータで 500 件 / 1000 件 / 3000 件のダミータスクを投入して `db_tasks_fetch_tree` を実測
- [ ] S2. 計測結果を本ファイル「計測結果」セクションに記録
- [ ] S3. しきい値に応じて Verdict 確定（Keep or Drop）
- [ ] S4. Keep の場合:
  - `src-tauri/src/commands/task_commands.rs` に `db_tasks_fetch_by_scheduled_range(start, end)` 追加（3 点同期）
  - 全ツリー参照する UI（TaskTree / DnD / 検索）は既存の fetch_tree を使い、sync 完了後の Calendar / Schedule 用途のみ range fetch に切替
  - キャッシュ戦略: `useTaskTreeContext` が全件を保持、range fetch は差分マージ
- [ ] S5. Drop の場合: 本ファイルに Status: Dropped (計測しきい値未達) マーク → archive/dropped/ へ移動

## 計測結果

**環境**: macOS (Apple Silicon), `cargo test --release`、in-memory SQLite、`fetch_tree` の SQL scan + `row_to_node` のみ計測（IPC serialization / JS parse は含まない）、10 runs/size の avg と max。

| n    | avg (ms) | max (ms) |
| ---- | -------- | -------- |
| 500  | 3.17     | 3.65     |
| 1000 | 6.11     | 6.35     |
| 3000 | 19.42    | 25.03    |

**iOS 補正**: ARM mobile + I/O overhead を最大 5x と仮定しても、n=3000 で max ~125ms。さらに IPC/JS parse 込みでも 500ms しきい値には達しない見込み。

**判定**: Drop (n=3000 でも < 50ms、しきい値 500ms を大幅に下回る)

### 再計測トリガー

以下の条件で再計測推奨:

- ユーザーの実タスクが 5000 件を超えた場合
- `row_to_node` に重い処理（JSON デコード、外部参照解決等）が追加された場合
- Sync 完了後の fetch_tree が UI フリーズを引き起こすバグレポートが出た場合

## Verification

- [ ] 計測結果が記録されている
- [ ] Verdict が Keep / Drop のいずれかで確定している
- [ ] Keep の場合、新コマンドが 3 点同期され、Calendar / Schedule での使用箇所が切替わっている
- [ ] 全ツリー参照機能（検索 / DnD）のデグレがないことをテストで確認

## Files

| File                                        | Operation | Notes                                                   |
| ------------------------------------------- | --------- | ------------------------------------------------------- |
| `src-tauri/src/commands/task_commands.rs`   | Update    | `db_tasks_fetch_by_scheduled_range` 追加                |
| `src-tauri/src/lib.rs`                      | Update    | `generate_handler![]` 登録                              |
| `frontend/src/services/TauriDataService.ts` | Update    | メソッド追加                                            |
| `frontend/src/services/DataService.ts`      | Update    | インターフェース追加                                    |
| `.claude/docs/requirements/tier-1-core.md`  | Update    | §Tasks Known Issues の保留 I-1 を解消 or 維持に書き換え |

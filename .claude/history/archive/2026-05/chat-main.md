# HISTORY ARCHIVE (chat-main, 2026-05)

ローリングアーカイブ: `history/chat-main.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-05-23 - DU-B-4 taskMapper + sortByDepthDesc vitest

#### 概要

DU-B-3 で実装した `taskMapper` の 2 行分割 API と `sortByDepthDesc` ユーティリティに対する vitest を追加。子計画書 §DU-B-4 の 5 必須ケース（roundtrip 5 shape / DB-Q2 bump 3 sub-case / parent_item_role 型ガード / soft-delete patch shape / order ↔ sort_order 3 path）+ sortByDepthDesc 6 ケース（3-level tree leaf-first / sibling 安定性 / orphan / cycle 終端 / empty / single root）を追加。テスト数 71 → 91。

#### 変更点

- **Shared tests**: `shared/tests/taskMapper.test.ts`（14 case）/ `shared/tests/sortByDepthDesc.test.ts`（6 case）新規追加
- **検証**: `npx tsc -b` 緑 / `npm test` 91/91 緑

### 2026-05-23 - DU-B-3 SupabaseTasksService 9 methods 本実装

#### 概要

`SupabaseTasksService` の 9 stub メソッドを `items_meta + tasks_payload` 2 行操作の本実装に書き換え。`shared/src/utils/sortByDepthDesc.ts` を新規追加（permanentDeleteTask の descendants-first DELETE 順序保証 + cycle guard）。並列起動した security-reviewer / role-qa 監査で role-qa が Blocker B-1（syncTaskTree の upsert が既存行 UPDATE 時に updated_at を bump しない DB-Q2 違反）を検出 → 修正後 APPROVE。

#### 変更点

- **Shared services**: `SupabaseDataService.ts` の `SupabaseTasksService` 9 メソッドを本実装（createTask の R2 try/catch hard-delete、updateTask の dual UPDATE + read-back、syncTaskTree の DB-Q2 enforcement で `{ ...meta, updated_at: now }` spread、softDelete / restore の updated_at 明示 bump、permanentDelete の descendants-first DELETE、migrateTasksToBackend は no-op 維持）
- **Shared utils**: `sortByDepthDesc.ts` 新規追加（深さ降順ソート + visited guard）
- **検証**: `tsc -b` 緑 / `npm test` 71/71 緑 / `taskMapper.roundtrip.js` 20/20 緑

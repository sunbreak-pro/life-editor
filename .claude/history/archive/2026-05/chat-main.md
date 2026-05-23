# HISTORY ARCHIVE (chat-main, 2026-05)

ローリングアーカイブ: `history/chat-main.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-05-23 - DU-B-3 SupabaseTasksService 9 methods 本実装

#### 概要

`SupabaseTasksService` の 9 stub メソッドを `items_meta + tasks_payload` 2 行操作の本実装に書き換え。`shared/src/utils/sortByDepthDesc.ts` を新規追加（permanentDeleteTask の descendants-first DELETE 順序保証 + cycle guard）。並列起動した security-reviewer / role-qa 監査で role-qa が Blocker B-1（syncTaskTree の upsert が既存行 UPDATE 時に updated_at を bump しない DB-Q2 違反）を検出 → 修正後 APPROVE。

#### 変更点

- **Shared services**: `SupabaseDataService.ts` の `SupabaseTasksService` 9 メソッドを本実装（createTask の R2 try/catch hard-delete、updateTask の dual UPDATE + read-back、syncTaskTree の DB-Q2 enforcement で `{ ...meta, updated_at: now }` spread、softDelete / restore の updated_at 明示 bump、permanentDelete の descendants-first DELETE、migrateTasksToBackend は no-op 維持）
- **Shared utils**: `sortByDepthDesc.ts` 新規追加（深さ降順ソート + visited guard）
- **検証**: `tsc -b` 緑 / `npm test` 71/71 緑 / `taskMapper.roundtrip.js` 20/20 緑

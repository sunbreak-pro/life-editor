---
Status: DRAFT — DU-B 子計画書 v3-rev2（2026-05-23 改訂）。v1 → v2 で 3 監査 (Blocker 1 / Major 5 / High 2 / Medium 1 / Low 1) 反映 → v3 で apply 試行 → PG 制約 (generated 列 + composite FK + SET NULL 不可、SQLSTATE 42601) で v3 失敗 → v3-rev2 で ON DELETE NO ACTION に変更（アプリ層 permanentDeleteTask が descendants 再帰削除責務、Tauri 同型）。本 v3-rev2 はユーザー承認待ち。
Created: 2026-05-23
Task: Data Unification DU-B — Tasks role 移植（items_meta + tasks_payload 経由）
Project path: /Users/newlife/dev/apps/life-editor
Branch: data-unification/items-meta-redesign
Parent: .claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md（親計画書 v3, `dcc8484`）
Previous: .claude/archive/2026-05-23-data-unification-a-db-schema.md（DU-A 完了, `5801341`）
継承する親章: 「採用アーキテクチャ」「DB 設計詳細」「列化判定マトリクス」「Pattern A Provider 再設計案」「parent_item_id 設計判断」「Sync への影響」
---

# Plan: DU-B — Tasks role 移植

## このフェーズのゴール

親計画書の DU-B 出口条件を満たす:

- TasksProvider が `items_meta`（role=task）+ `tasks_payload` 経由で動作
- web/ Tasks タブで CRUD + 階層 DnD + 期限 + 3 ステータスの golden path が緑
- `shared/tests/taskMapper.test.ts` 含む vitest 緑（roundtrip + parent role guard + updated_at bump）
- RLS gate offender 0 / Supabase advisor lint 0
- CLAUDE.md §4.3（id 戦略）+ `docs/vision/db-conventions.md`（payload mapper 規約）に DU-B 確定事項追記

## ユーザー確定事項（2026-05-23 / DU-B 起票時）

実装に入る前のブレ防止のため、以下を本子計画書の不変前提として固定する。

| #     | 項目                                  | 確定                                                                                                            |
| ----- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| DB-Q1 | items_meta + tasks_payload Atomicity  | **クライアント直列 2 回 invoke**（items_meta 先 → tasks_payload）。FK 制約で順序強制                            |
| DB-Q2 | payload 単独 mutation 時の updated_at | **mapper 側で明示 bump**（updateTask 内で payload UPDATE + items_meta.updated_at=now() を 2 回 invoke）         |
| DB-Q3 | parent_item_id の cross-role 防止     | **DB スキーマで物理的に不可能化**（items_meta に `(id, role)` UNIQUE + tasks_payload に composite FK 経由参照） |

### DB-Q1 補足（Atomicity の現実解）— **v2 改訂 (role-qa Blocker-1)**

- items_meta INSERT 成功 → tasks_payload INSERT 失敗 → **孤児 items_meta 残存**のリスクを R2 で扱う
- DU-B-3 で `createTask()` 内に try/catch を入れ、tasks_payload INSERT 失敗時に items_meta を **hard delete**（`.delete().eq("id", id)`）する
- **hard delete を採用する理由（v1 の softDelete から改訂）**: v1 案の softDelete は他デバイス Sync で TrashView を汚染する（version 1 で生成→即 softDelete = 他デバイスに「正常生成→即削除」として伝播し、Trash に意味不明な行が積み上がる）。一方 hard delete は同セッション内・version=1 のため、まだ他デバイスに伝播していない前提で安全に消せる（Phase 2 LWW は updated_at + version カーソル方式で、SELECT で見えなくなった行は「未取得」扱い）
- **hard delete 自体が失敗するケース（NW 断線等）の備え**: R2 Recovery Playbook の検出 SQL を日次/週次運用に組み込む。これは v2 でも変えない
- 完全な atomicity が必要になった時点で 0010+ で RPC 化に切り替える設計余地を残す（後続申し送り）

### DB-Q2 補足（mapper bump の理由）

- DB トリガ案を退けた理由: 5 payload 分のトリガ関数 + SECURITY INVOKER + `search_path` 固定が必要で、DU-A の `sync_event_deleted_cache` と同等の運用コストが 5 倍
- mapper 側案の利点: LWW カーソルが見える位置にあり、5 payload で同一パターンを反復できる
- リスク（bump 忘れ）は DU-B-4 で `taskMapper.test.ts` の必須ケースとして固定（R3）

### DB-Q3 補足（composite FK の仕組み）

例えるなら「Task 用伝票には Task 用箱の番号しか書けないように、伝票そのものの書式を物理的に作る」方式。

```sql
-- ① items_meta に composite UNIQUE 追加（PK は id 単独だが、composite FK の参照先として別途必要）
alter table public.items_meta
  drop constraint if exists items_meta_id_role_uk;
alter table public.items_meta
  add constraint items_meta_id_role_uk unique (id, role);

-- ② tasks_payload に parent_item_role を hidden generated 列として追加（常に 'task' で固定）
--    冪等性のため drop column → add column の順で実行（再 apply でスキーマ差分が出ないように）
alter table public.tasks_payload
  drop column if exists parent_item_role;
alter table public.tasks_payload
  add column parent_item_role text generated always as ('task') stored;

-- ③ 0008 の単独 FK を drop し、composite FK に張り替え
--    ON DELETE NO ACTION (v3-rev2 確定): PG は generated 列を含む composite
--    FK に SET NULL を許容せず (SQLSTATE 42601) / CASCADE は items_meta 同士
--    の親子 FK 不在のため子 items_meta が孤児化する。NO ACTION なら子がいる
--    親の hard-delete は PG が拒否し、アプリ層 (permanentDeleteTask) が
--    descendants 再帰削除を担う Tauri 同型に整合 (DB-Q3 の本懐 = cross-role
--    防止は FK 参照先 role 一致で達成済、ON DELETE 動作は本質ではない)。
alter table public.tasks_payload
  drop constraint if exists tasks_payload_parent_item_id_fkey;
alter table public.tasks_payload
  drop constraint if exists tasks_payload_parent_fk;
alter table public.tasks_payload
  add constraint tasks_payload_parent_fk
    foreign key (parent_item_id, parent_item_role)
    references public.items_meta (id, role)
    match simple
    on delete no action;

-- ④ 補助 index 2 本（R6 緩和）+ 旧単独 index 整理（security-reviewer Low-A）
create index if not exists items_meta_role_isdel_idx
  on public.items_meta (role, is_deleted) where is_deleted = false;
create index if not exists idx_tasks_payload_parent_role
  on public.tasks_payload (parent_item_id, parent_item_role);
drop index if exists public.idx_tasks_payload_parent;  -- 複合 index の prefix で代替可能（redundant）

-- ⑤ tasks_payload insert/update policy に parent_item_id 側 EXISTS 追加
--    （security-reviewer Medium-1 — 0008 時点の脆弱性を DU-B で同時解消、DU-D Notes 型として確立）
drop policy if exists tasks_payload_insert_own on public.tasks_payload;
create policy tasks_payload_insert_own on public.tasks_payload for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.items_meta
                where items_meta.id = tasks_payload.item_id
                  and items_meta.user_id = auth.uid())
    and (tasks_payload.parent_item_id is null
         or exists (select 1 from public.items_meta
                    where items_meta.id = tasks_payload.parent_item_id
                      and items_meta.user_id = auth.uid()))
  );
-- update_own も同型の with check 拡張（using は 0008 と同じ user_id = auth.uid()）
```

これにより、parent_item_id が指す items_meta の role が `task` 以外なら INSERT/UPDATE が **DB 側で失敗** する（composite FK 経由）+ parent_item_id が他ユーザー所有なら policy で **PostgREST 層で reject** される（owner EXISTS 経由 = side-channel も同時に閉じる）。アプリ層のバグや SQL 直叩きでも cross-role 親子も他人の id 経由の整合性違反も両方ブロックされる。

**他 role への波及**: 同パターンを DU-C で `events_payload`（routine_item_id は parent ではなく「生成元」を指すため対象外）、DU-D で `notes_payload.parent_item_role='note'` 固定 generated 列 + composite FK + parent_item_id 側 EXISTS として再利用する（DU-D 子計画書起票時の必須申し送り事項）。DU-B で確立した方式を後続子計画書が踏襲する。

## 現状調査結果（2026-05-23 Explore 確定）

### shared/ 側の Tasks 関連実装（Phase 2 S2 で既存）

| ファイル                                                            | 状態                                | DU-B での扱い                                                     |
| ------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| `shared/src/types/taskTree.ts`                                      | TaskNode 型完備（22 フィールド）    | **変更不要**（TS 側型は不変、DB 側のみ 2 行分割）                 |
| `shared/src/services/taskMapper.ts`                                 | 0003 tasks 単一テーブル向け実装済み | **書き換え**: 2 行分割（rowsToTaskNode / taskNodeToRows）         |
| `shared/src/services/taskMapper.roundtrip.ts`                       | node 自己実行型テスト               | **書き換え**: 新 mapper に追随                                    |
| `shared/src/services/DataService.ts`                                | Tasks 9 メソッド interface          | **変更不要**（interface 不変、実装のみ書き換え）                  |
| `shared/src/services/SupabaseDataService.ts` (SupabaseTasksService) | 0003 tasks 直接アクセス             | **書き換え**: items_meta JOIN tasks_payload 経由                  |
| `shared/src/context/TaskTreeContext.tsx` + Provider                 | Pattern A 完備、DataService DI 対応 | **変更不要**（DI で透過、role 名 TasksProvider 改名は DU-F 一括） |
| `shared/src/hooks/useTaskTreeAPI.ts` + 5 つの hook                  | shared 完備                         | **変更不要**                                                      |

### web/ 側

| ファイル                         | 状態                                  | DU-B での扱い                          |
| -------------------------------- | ------------------------------------- | -------------------------------------- |
| `web/src/TasksScreen.tsx`        | S1 で TasksProvider マウント済        | **変更不要**                           |
| `web/src/tasks/TaskTreeView.tsx` | S1 機能 UI（DnD + ステータス + CRUD） | **変更不要**（mapper 透過 = 動作維持） |

### vitest

| ファイル                          | 状態                            | DU-B での扱い                            |
| --------------------------------- | ------------------------------- | ---------------------------------------- |
| `shared/vitest.config.ts`         | 完備                            | **変更不要**                             |
| `shared/tests/taskMapper.test.ts` | **未作成**（roundtrip.ts のみ） | **新規追加**（DU-A 申し送り Top 5 後継） |

### MCP Server（凍結対象 / 影響なし）

- `mcp-server/src/handlers/taskHandlers.ts` の 6 ツールは Tauri SQLite 直叩き
- 凍結中のため DU-B では触らない
- 後続「MCP catch-up plan」で `items_meta` 経由に書き換え

## DU-A 申し送りの DU-B での処遇

| #   | 申し送り                                              | DU-B での扱い                                                  |
| --- | ----------------------------------------------------- | -------------------------------------------------------------- |
| ①   | MCP 16 ツール書き換え凍結                             | 維持（DU-B 範囲外、後続「MCP catch-up plan」）                 |
| ②   | is_deleted_cache の INSERT 経路同期                   | **Tasks 範囲外**（events_payload 専用、DU-C で確定）           |
| ③   | payload 単独 mutation 時の items_meta.updated_at bump | **DB-Q2 で確定**（mapper 側）                                  |
| ④   | check-rls-selftest に payload EXISTS ケース 1 件追加  | **DU-B-1 に組込**（0009 apply 直前に gate self-test 1 件追加） |
| ⑤   | WikiLink グラフ可視化 UI                              | 維持（DU-F 後の別計画）                                        |
| ⑥   | S8 Realtime/delta sync 申し送り継承                   | 維持（移行 SSOT 後期）                                         |

## 作業段階（DU-B-1 〜 DU-B-6）

| Step   | 内容                                                                                                                                                                                                                                                                                                                  | 検証                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 規模 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| DU-B-1 | `0009_tasks_payload_parent_fk.sql` 作成 + check-rls.sql に EXISTS ケース 1 件追加 + Supabase apply                                                                                                                                                                                                                    | **migration-validator H2 反映**: `\d tasks_payload` で composite FK 確認 / RLS gate selftest 緑 / advisor lint 0 / **0009 末尾 POST-APPLY VERIFICATION A-I 全件を SQL Editor で手動実行（特に E=cross-role parent INSERT 拒否、F=ON DELETE NO ACTION 動作 (v3-rev2)、G=parent owner EXISTS）し、結果を outbox に貼り付け**                                                                                                                                                                                   | S    |
| DU-B-2 | `shared/src/services/taskMapper.ts` 2 行分割書き換え + `taskMapper.roundtrip.ts` 更新                                                                                                                                                                                                                                 | `npm run -w shared build` 緑 / roundtrip 自己実行 OK                                                                                                                                                                                                                                                                                                                                                                                                                                                         | M    |
| DU-B-3 | `shared/src/services/SupabaseDataService.ts` の SupabaseTasksService 9 メソッド書き換え（createTask の R2 try/catch hard delete + updateTask の updated_at bump + **permanentDeleteTask の descendants 再帰削除 = v3-rev2 NO ACTION 前提**: 子孫を `getDescendantIds` 等で集めて子から順に DELETE、Tauri 同型を踏襲） | **role-qa Major-1/3 反映**: shared build 緑 / **R2 検出 SQL (孤児 items_meta) = 0 行** を SQL Editor で確認（createTask 強制失敗テスト後）/ **updated_at bump 検証: updateTask 呼出前後で items_meta.updated_at が動くことを SQL Editor で確認** / **9 メソッド各 1 回実行後の items_meta ↔ tasks_payload 同期確認（updated_at 同時更新 + is_deleted 同時反転 + 孤児なし）** / **permanentDeleteTask で子のいる親を hard-delete しても FK violation で落ちず descendants 順削除で成功** / smoke test（手動） | L    |
| DU-B-4 | `shared/tests/taskMapper.test.ts` 新規追加（必須ケース: roundtrip 5 ステータス / updated_at bump / parent role guard / soft-delete）                                                                                                                                                                                  | `npm run -w shared test` 緑                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | M    |
| DU-B-5 | web/ Tasks タブで golden path 動作確認（CRUD + 階層 DnD + 期限 + 3 状態）                                                                                                                                                                                                                                             | ユーザー手動確認 + console error 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | S    |
| DU-B-6 | CLAUDE.md §4.3（id 戦略補足: composite FK パターン）+ `docs/vision/db-conventions.md`（payload mapper 規約 / updated_at bump 責務）更新                                                                                                                                                                               | docs diff レビュー                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | S    |

### Step 間の順序

```
DU-B-1 ──→ DU-B-2 ──→ DU-B-3 ──→ DU-B-4 ──→ DU-B-5 ──→ DU-B-6
  (SQL)    (mapper)  (DataService) (vitest)   (UI 確認)   (docs)
```

DU-B-2 と DU-B-4 は並列可だが、N=1 想定で順序実行を推奨。

## 監査計画

各 Step 完了時に独立コンテキストでサブエージェントを起動（メインチャットが Agent ツールで起動。再帰禁止）。

| Step   | 監査対象 / エージェント                                                               |
| ------ | ------------------------------------------------------------------------------------- |
| DU-B-1 | `life-editor-migration-validator`（0009 整合性）                                      |
| DU-B-2 | `role-qa`（mapper 純粋関数 + 副作用 0 確認）                                          |
| DU-B-3 | `security-reviewer`（trans rollback / SQL 注入境界）+ `role-qa`（9 メソッド契約遵守） |
| DU-B-4 | `role-qa`（テストの必須ケース網羅）                                                   |
| DU-B-5 | （ユーザー手動 golden path のみ）                                                     |
| DU-B-6 | `role-qa`（docs 整合性）                                                              |

## Non-goals（DU-B で扱わないこと）

- 他 role の payload 移植（DU-C / DU-D / DU-E / DU-F）
- MCP Server 6 ツール書き換え（凍結）
- events_payload の is_deleted_cache 関連（DU-C）
- routine_groups / wiki_tags 系の操作（DU-C / DU-F）
- Provider 改名（TaskTreeProvider → TasksProvider）= DU-F で全 role 一括改名
- Tasks の UI デザイン刷新（S1 機能 UI のまま）
- web 側 vitest 配備（mapper/DataService 内の純粋ロジックは shared で覆える）

## Risks & Mitigations

| ID  | リスク                                                                                                                                  | レベル | 緩和策                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | composite FK の 0009 apply が既存 0008 単独 FK と衝突                                                                                   | 高     | 0009 内で先に 0008 FK を drop してから composite FK を追加（DDL を 1 transaction にまとめる）                                                                                                                                             |
| R2  | クライアント直列 2 回 invoke で items_meta 成功 → payload 失敗 → 孤児 items_meta                                                        | 高     | **v2 改訂**: createTask の try/catch で items_meta を **hard delete**（`.delete().eq("id", id)`）。同セッション内・version=1 のため Sync 上 tombstone 不要（v1 softDelete は他デバイス TrashView 汚染するため不採用）                     |
| R3  | mapper 側 updated_at bump 忘れで Sync が壊れる                                                                                          | 中     | DU-B-4 の taskMapper.test.ts で「updateTask 後 items_meta.updated_at が必ず動く」を必須ケース化                                                                                                                                           |
| R4  | generated 列 `parent_item_role='task'` が将来 role 拡張時に冗長に見える                                                                 | 低     | 親計画書 Q14 で 5 role 厳守、role 拡張は Non-goal。コメントに「DU-B 確定」を明記して保護                                                                                                                                                  |
| R5  | parent_item_id が NULL の場合に composite FK が効くか                                                                                   | 低     | PostgreSQL の MATCH SIMPLE（デフォルト）= NULL 含む複合 FK は許容。0009 apply 後に NULL parent ケースで動作確認                                                                                                                           |
| R6  | items_meta JOIN tasks_payload のクエリ性能（fetchTaskTree で全件 SELECT）                                                               | 中     | items_meta.role + items_meta.is_deleted 複合 index を 0009 で同時追加。`SYNC_PAGE_SIZE` 適用は S8                                                                                                                                         |
| R7  | `order` → `sort_order` 改名の TS 側忘れ                                                                                                 | 中     | DU-A 確定（mapper で `order` ↔ `sort_order` 変換）を踏襲。taskMapper.test.ts で必須ケース化                                                                                                                                               |
| R8  | **v2 追加 (role-qa Major-2)**: taskMapper.test.ts は緑だが SupabaseTasksService の業務列マッピング誤り（DB 列名・型変換）で本番動作不能 | 中     | DU-B-3 完了時に Supabase SQL Editor で 9 メソッド各 1 件ずつ実 INSERT/SELECT を手動実行し、TS 型と DB 列名・型が一致することを目視確認。整合性確認は DU-B-3 検証欄に必須化。`shared/tests/integration/` での自動化は DU-F 完了後の別 plan |

## Recovery Playbook（発生時の対応手順）

リスク R1〜R8 が「発生してしまった後」の検出 + 復旧手順を、事前にすべて手順化しておく（事後対応不能なミスを 0 にするため）。

### R1 復旧 — composite FK の 0009 apply 失敗

**検出**: SQL Editor で 0009 apply 時に `ERROR: constraint "tasks_payload_parent_fk" violates foreign key constraint` または `ERROR: column "parent_item_role" already exists`

**復旧手順**:

1. 0009 が **transaction で囲まれているか**確認（囲まれていれば自動 rollback、囲まれていなければ部分 apply 状態の手動回収が必要）
2. 部分 apply の場合は以下を順に手動実行:
   ```sql
   alter table public.tasks_payload drop constraint if exists tasks_payload_parent_fk;
   alter table public.tasks_payload drop column if exists parent_item_role;
   alter table public.items_meta drop constraint if exists items_meta_id_role_uk;
   -- 0008 単独 FK が drop 済みなら復元
   alter table public.tasks_payload
     add constraint tasks_payload_parent_item_id_fkey
     foreign key (parent_item_id) references public.items_meta(id);
   ```
3. apply エラーメッセージから根本原因を特定（既存 cross-role parent row が存在する場合は、`SELECT t.item_id, t.parent_item_id, m.role FROM tasks_payload t JOIN items_meta m ON m.id=t.parent_item_id WHERE m.role <> 'task';` で違反行を特定 → 違反行を NULL parent に修正してから 0009 を再 apply）

### R2 復旧 — 孤児 items_meta の検出と回収

**検出**: 日次（または週次）で以下を実行（DU-B 完了直後にユーザー実機で 1 回実行することを DU-B-5 検証に含める）:

```sql
-- role=task で items_meta にあるが tasks_payload にない孤児
select m.id, m.title, m.created_at
from items_meta m
left join tasks_payload p on p.item_id = m.id
where m.role = 'task' and p.item_id is null and m.is_deleted = false;
```

**復旧手順** — v2 改訂 (role-qa Blocker-1 対応):

- 検出された行を **hard delete** する（v1 の softDelete は他デバイス TrashView 汚染するため不採用）:
  ```sql
  delete from items_meta
  where id in (<検出された id 群>) and is_deleted = false;
  -- ※ 既に他デバイスに同期済の可能性がある行は別途 tombstone 化検討
  -- N=1 想定では「自分が作って失敗した直後」しか発生しないため hard delete で安全
  ```
- 復旧後、`SupabaseTasksService.createTask` の try/catch ロジックが「失敗時 hard delete」を正しく実行しているかコードレビューで再確認
- ネットワーク断などで hard delete 自体も失敗した場合は、次の R2 検出 SQL 実行サイクルで再回収される（冪等性が成立）

### R3 復旧 — updated_at bump 忘れの検出と一括修正 — v2 改訂 (role-qa Major-5)

**検出の難しさ**: tasks_payload には updated_at 列が存在しない（items_meta が単一所有者）。そのため「payload mutation の事実」が DB 側に残らず、bump 漏れの常駐検出は困難。v1 で書いた「`updated_at = created_at` を見る」検出 SQL は **一度も updateTask されていない作成直後の Task が全件ヒット** する false-positive 過多のため削除。代替策 2 つ:

**代替策 1**: 監査ログ機構の導入（中期）

- 別 migration（DU-B スコープ外）で `audit_log (id, table_name, action, item_id, performed_at)` を追加し、SupabaseTasksService が updateTask 呼出時に 1 行 INSERT
- 定期突合: `audit_log.performed_at` の最大値 vs `items_meta.updated_at` の最大値（同 item_id）が乖離していたら bump 漏れ候補
- DU-A 申し送りの「audit_log 機構」と整合（本子計画書スコープ外、後続別 plan）

**代替策 2**: 手動 spot check（N=1 即時運用）

- 自分が編集した Task の id を覚えておき、SQL Editor で `select id, updated_at from items_meta where id = '<手動 id>';` を実行
- updated_at が「編集 1 分以内」のタイムスタンプかを目視確認
- N=1 想定なら現実的、複数ユーザー想定では機能しない

**復旧手順**（bump 漏れが検出された場合）:

- 該当行の items_meta.updated_at を強制 bump:
  ```sql
  update items_meta set updated_at = now() where id in (<対象 id 群>);
  ```
- 根本対応: `taskMapper.test.ts` の bump 必須ケースが緑か再確認 → 緑なのに本番で起きた = SupabaseTasksService 側の bump 呼び出し漏れ → コードレビュー
- 設計補強: SupabaseTasksService 内の bump ロジックを 1 ヘルパー関数に集約し、9 メソッドすべてから必ず通る経路にする（DU-B-3 実装方針）

### R4 復旧 — generated 列の冗長性は実害なし

**検出**: 不要

**対応**: R4 はリスクとして低レベル（実害なし、コードレビュー時の混乱だけ）。発生時の復旧手順は不要。コメントで「DU-B 確定 / 5 role 厳守の親計画書 Q14 に紐付く」を保護目的で残す。

### R5 復旧 — NULL parent FK 動作不良

**検出**: DU-B-1 apply 直後の手動テスト:

```sql
-- ルート Task（parent_item_id = NULL）を 1 件作成して INSERT 成功するか
insert into items_meta (id, role, title) values ('task-test-r5', 'task', 'R5 test');
insert into tasks_payload (item_id, task_type, status, parent_item_id) values ('task-test-r5', 'task', 'NOT_STARTED', null);
-- 成功すれば R5 は発生しない。失敗した場合は composite FK の MATCH モードを確認
delete from items_meta where id = 'task-test-r5';
```

**復旧手順**（失敗した場合のみ）:

- composite FK を `MATCH SIMPLE` 明示で再作成 (v3-rev2: NO ACTION):
  ```sql
  alter table public.tasks_payload drop constraint tasks_payload_parent_fk;
  alter table public.tasks_payload
    add constraint tasks_payload_parent_fk
    foreign key (parent_item_id, parent_item_role)
    references public.items_meta (id, role)
    match simple
    on delete no action;
  ```
- 上記でも失敗する場合は、parent_item_role を generated でなく nullable 通常列に変更し、`parent_item_id IS NULL OR parent_item_role = 'task'` CHECK 制約で代替

### R6 復旧 — クエリ性能劣化の検出と index 追加

**検出**: Supabase ダッシュボード `Database > Performance > Query Performance` または `pg_stat_statements`:

```sql
select query, calls, mean_exec_time, total_exec_time
from pg_stat_statements
where query ilike '%items_meta%tasks_payload%'
order by mean_exec_time desc
limit 10;
```

mean_exec_time が 100ms を超える SELECT があれば対象。

**復旧手順**:

- 即時対応: 補助 index を追加（0010 migration 不要、本番 SQL Editor で直接 CREATE INDEX 可、ただし大規模テーブルでは `CREATE INDEX CONCURRENTLY` を使う）:
  ```sql
  create index concurrently if not exists items_meta_role_isdel_idx
    on public.items_meta (role, is_deleted) where is_deleted = false;
  create index concurrently if not exists tasks_payload_parent_idx
    on public.tasks_payload (parent_item_id);
  ```
- 中期対応: `SYNC_PAGE_SIZE` の items_meta 用 cursor pagination を S8 で前倒し検討（DU-A 申し送りに継承済）

### R7 復旧 — `order` 直書き残存の検出

**検出**: shared/ / web/ で `"order"` または `\.order` 直書きを ripgrep 検出:

```bash
rg -n '"order"\b|\border:\s' shared/src/ web/src/ --type ts
```

mapper 経由でなく直接 DB クエリに "order" を書いている箇所が出たら違反。

**復旧手順**:

- 検出箇所を `sort_order` に書き換え、または mapper 経由に集約
- taskMapper.test.ts に「DB 側列名は `sort_order` / TS 側プロパティ名は `order`」の roundtrip を必須ケースとして固定

### R8 復旧 — v2 追加 (role-qa Major-2): vitest 緑なのに本番 SupabaseTasksService が動かない

**検出**: DU-B-3 完了直後の必須手順として、Supabase SQL Editor で 9 メソッドそれぞれを 1 件ずつ実行し、結果行を目視確認:

```sql
-- 例: createTask 実行 → items_meta + tasks_payload の同期確認
select m.id, m.role, m.title, m.updated_at, p.task_type, p.status, p.sort_order
from items_meta m
join tasks_payload p on p.item_id = m.id
where m.id = '<手動で作った task id>';

-- 期待: 1 行、items_meta.updated_at と tasks_payload に同期反映、列名・型が TS 側と一致

-- updateTask 実行 → bump 確認
select id, updated_at, (now() - updated_at) as drift
from items_meta
where id = '<更新した task id>';
-- 期待: drift が「数秒以内」（編集 1 回完了時点で確認）

-- softDeleteTask 実行 → is_deleted / deleted_at 確認
select id, is_deleted, deleted_at from items_meta where id = '<削除した task id>';
-- 期待: is_deleted=true, deleted_at=now()
```

**復旧手順**（不一致発覚時）:

- 不一致列を taskMapper.ts で修正（rowToTaskNode / taskNodeToRow / taskUpdatesToPatch の 3 箇所すべてを確認）
- taskMapper.roundtrip.ts に「不一致パターンを再現する fixture」を追加し、roundtrip 緑を再確認
- shared/tests/taskMapper.test.ts の必須ケースに同型エッジを追加
- SupabaseTasksService の該当メソッドをコードレビュー
- 9 メソッド spot check を再実行し、整合性確認

**根本対応**（中期）:

- shared/tests/integration/ で「実 Supabase に接続して 9 メソッドを順に実行する E2E テスト」を構築（DU-F 完了後の別 plan、本子計画書スコープ外）

### 復旧優先度マトリクス

| 状況                                                       | 最優先対応                                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| DU-B-1 apply 中に失敗                                      | R1 復旧 → 原因特定 → 0009 修正                                                                          |
| DU-B-3 デプロイ後にユーザー操作で詰む                      | R2 検出 SQL を即実行 → 孤児 **hard delete**（v2 改訂）                                                  |
| Sync が他デバイスから来ない                                | R3 spot check → updated_at 強制 bump → コードレビュー（v2 改訂）                                        |
| 新規 Task 作成が ERROR で落ちる                            | R5 復旧（FK MATCH モード）                                                                              |
| ページ表示が遅い                                           | R6 復旧（CONCURRENTLY index 追加）                                                                      |
| code review で `order` 直書き発見                          | R7 復旧（書き換え + mapper 経由化）                                                                     |
| DU-B-3 完了後の手動検証で TS↔DB マッピング不一致発覚（v2） | R8 復旧（不一致列を taskMapper.ts で修正 → roundtrip + taskMapper.test 再緑 → 9 メソッド再 spot check） |

## Definition of Done

- [ ] 0009 migration（composite FK + 補助 index）が本番 Supabase に apply 済み
- [ ] check-rls.sh 緑（payload EXISTS ケース selftest 含む）
- [ ] advisor lint 0（既知 WARN `auth_leaked_password_protection` のみ）
- [ ] taskMapper.ts が items_meta + tasks_payload 2 行分割で実装済み
- [ ] taskMapper.roundtrip.ts 緑
- [ ] SupabaseTasksService 9 メソッド (fetchTaskTree / fetchDeletedTasks / createTask / updateTask / syncTaskTree / softDeleteTask / restoreTask / permanentDeleteTask / migrateTasksToBackend) が items_meta + tasks_payload 経由で動作し、**各メソッドを 1 回ずつ実行した直後の Supabase SQL Editor 確認で items_meta と tasks_payload が同期している**（updated_at 同時更新 + is_deleted 同時反転 + 孤児なし）— v2 改訂 (role-qa Major-3)
- [ ] shared/tests/taskMapper.test.ts 緑（roundtrip 5 ステータス / updated_at bump / parent role guard / soft-delete）
- [ ] web/ Tasks タブで CRUD + ツリー DnD + 期限 + 3 状態 OK（ユーザー手動）
- [ ] CLAUDE.md §4.3 + `docs/vision/db-conventions.md` に DU-B 確定事項追記
- [ ] migration-validator / security-reviewer / role-qa の各層 PASS
- [ ] HISTORY.md に DU-B 完了エントリ + MEMORY.md 「直近の完了」更新

## ロールバック方針

### 0009 apply 後の巻き戻し（DU-B-1 着手と同時に SQL を commit）

`supabase/migrations/0009_rollback.sql` を DU-B-1 で 0009 本体と同時に commit し、手動 SQL Editor で逐次実行可能な状態にしておく:

```sql
-- 0009_rollback.sql（DU-B-1 で 0009 本体と同時 commit）
begin;

alter table public.tasks_payload drop constraint if exists tasks_payload_parent_fk;
alter table public.tasks_payload drop column if exists parent_item_role;
alter table public.items_meta drop constraint if exists items_meta_id_role_uk;

-- 0008 時点の単独 FK を復元
alter table public.tasks_payload
  drop constraint if exists tasks_payload_parent_item_id_fkey;
alter table public.tasks_payload
  add constraint tasks_payload_parent_item_id_fkey
  foreign key (parent_item_id) references public.items_meta(id);

-- 補助 index も巻き戻し（R6 で 0009 に追加分）
drop index if exists items_meta_role_isdel_idx;
drop index if exists tasks_payload_parent_idx;

commit;
```

### Step 別の巻き戻し手順

| Step   | 巻き戻し方法                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| DU-B-1 | 上記 `0009_rollback.sql` を SQL Editor で実行 → git で 0009 関連 commit を revert                                 |
| DU-B-2 | `git revert <taskMapper 書き換え commit>` → DB スキーマは維持 OK（mapper だけ 0008 互換に戻す）                   |
| DU-B-3 | `git revert <SupabaseTasksService 書き換え commit>` → 0009 スキーマと taskMapper はそのまま、DataService だけ戻す |
| DU-B-4 | テスト追加だけなので `git revert` で十分（破壊性 0）                                                              |
| DU-B-5 | UI 動作確認だけなのでコード変更なし                                                                               |
| DU-B-6 | docs 更新を `git revert`                                                                                          |

### 判断タイミング

- 各 Step の出口検証で golden path が通らない場合、その時点でユーザーに報告し、続行 / 巻き戻しを決定
- 巻き戻し基準: 「Recovery Playbook の R1〜R8 のいずれを試しても 30 分以内に解消できない」場合
- 巻き戻し後の next step: 原因究明 → 子計画書 v2 改訂 → 監査再依頼 → 再着手

## マイルストーン（累計見込み + バッファ ±50%）

DU-A 実工数（v2 確定 + 4 ラウンド監査 + apply）≒ 約 2 日。DU-B は SQL が小規模 + mapper 書き換え中心で DU-A よりやや軽め見込み。

| マイルストーン                      | 想定工数   | バッファ込み (±50%) |
| ----------------------------------- | ---------- | ------------------- |
| 子計画書承認 + DU-B-1 着手          | 0.3 日     | 0.2〜0.5 日         |
| DU-B-1 完了（0009 apply + gate 緑） | +0.5 日    | +0.3〜0.8 日        |
| DU-B-2 完了（mapper 書き換え）      | +0.7 日    | +0.4〜1.0 日        |
| DU-B-3 完了（DataService 書き換え） | +1.0 日    | +0.5〜1.5 日        |
| DU-B-4 完了（vitest 追加）          | +0.5 日    | +0.3〜0.8 日        |
| DU-B-5 完了（web 動作確認）         | +0.3 日    | +0.2〜0.5 日        |
| DU-B-6 完了（docs 更新）            | +0.3 日    | +0.2〜0.5 日        |
| **総計**                            | **3.6 日** | **2.1〜5.6 日**     |

## 親計画書承認後の最初のアクション

1. [ユーザー] 本子計画書 DRAFT v1 のレビュー + 確定事項（DB-Q1/Q2/Q3）の最終承認
2. [メイン] 親計画書 v3 の「parent_item_id 設計判断」「Sync への影響」「Migration 戦略」に DB-Q1/Q2/Q3 を追記（DU-B 確定として）
3. [メイン] `task-tracker` で MEMORY.md 進行中エントリを「DU-B 着手」に更新
4. [メイン] DU-B-1 着手: 0009 migration の SQL ドラフト → `migration-validator` 監査 → 本番 SQL Editor apply（DU-A と同パターン）
5. [メイン] DU-B-2 以降は本子計画書の Step 順に進行

## 計画書間連携

- **本子計画書は DU-B 着手中の SSOT**。DU-B-1〜6 の確定事項を保持
- **親計画書（v3）**: DB-Q1/Q2/Q3 確定後に「parent_item_id 設計判断」章を更新
- **DU-A 子計画書（archive 済）**: 申し送り②③④の処遇を本子計画書「DU-A 申し送りの処遇」表で明示済
- DU-B 完了時に本子計画書 Status を COMPLETED に更新 → `.claude/archive/` 移動（`task-tracker` 経由）

## Verification（子計画書自体の検証）

- [ ] Status / Created / Branch / Parent / Previous / 継承する親章 が冒頭に揃っている
- [ ] DB-Q1〜Q3 のユーザー確定事項が明示され、補足説明で初学者でも判断根拠が追える
- [ ] 0009 migration の SQL ドラフトが具体化されている（composite FK パターンの 3 つの ALTER）
- [ ] 作業段階が DU-B-1〜6 で独立検証可能
- [ ] 監査計画が migration / security / role-qa の 3 層を含む
- [ ] DU-A 申し送り 6 項の処遇が表形式で明示
- [ ] Non-goals が明示されている
- [ ] Risk が R1〜R8 で網羅されている
- [ ] DoD が観測可能なチェック項目で揃っている
- [ ] ロールバック方針が DB apply 後の現実に即している
- [ ] migration-validator / security-reviewer / role-qa による独立監査
- [ ] ユーザー承認

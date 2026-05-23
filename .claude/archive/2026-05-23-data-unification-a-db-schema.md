---
Status: COMPLETED — DU-A 子計画書 v2（2026-05-23 完了）。0007/0008 SQL 作成 + 4 ラウンド監査 PASS + Supabase 本番 SQL Editor で破壊的 apply 成功 + 全 5 検証クリア。後続=DU-B (Tasks role 移植)。
Created: 2026-05-23
Task: Data Unification DU-A — DB スキーマ設計 + apply（0007 drop + 0008 schema + RLS）
Project path: /Users/newlife/dev/apps/life-editor
Branch: data-unification/items-meta-redesign
Parent: .claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md（親計画書 v3）
継承する親章: 「採用アーキテクチャ」「DB 設計詳細」「列化判定マトリクス」「RLS 設計」「Migration 戦略」「ロールバック方針」
---

# Plan: DU-A — DB スキーマ設計 + apply

## このフェーズのゴール

親計画書の DU-A 出口条件を満たす:

- `0007_drop_legacy_item_tables.sql` + `0008_data_unification_schema.sql` が本番 Supabase に apply 済み
- items_meta + 5 payload + 7 専用/relation = 計 13 テーブルが作成済み
- 全 RLS gate offender 0（`check-rls.sh` 緑）/ advisor lint 0
- vitest は本フェーズでは対象なし（SQL のみ。mapper/Provider は DU-B 以降）

## 現行スキーマ調査結果（2026-05-23 Explore 確定）

### 既存 migration（0001-0006）が作る全 10 テーブル

| テーブル                    | 作成元 | DU-A での扱い                             |
| --------------------------- | ------ | ----------------------------------------- |
| `tasks`                     | 0003   | **DROP**                                  |
| `dailies`                   | 0004   | **DROP**                                  |
| `notes`                     | 0005   | **DROP**                                  |
| `note_links`                | 0005   | **DROP**（notes への FK 依存。DD-3 参照） |
| `note_connections`          | 0005   | **DROP**（notes への FK 依存。DD-3 参照） |
| `routines`                  | 0006   | **DROP**                                  |
| `routine_groups`            | 0006   | **DROP**                                  |
| `routine_group_assignments` | 0006   | **DROP**                                  |
| `schedule_items`            | 0006   | **DROP**                                  |
| `calendars`                 | 0006   | **維持（構造）/ データは DD-2 で判断**    |
| `calendar_tag_definitions`  | 0006   | **維持**                                  |
| `calendar_tag_assignments`  | 0006   | **維持（task 参照行は DD-2 で判断）**     |

→ **DROP 対象は親計画書の「7 テーブル」ではなく実際は 9 テーブル**（notes に従属する note_links / note_connections を見落としていた）。親計画書 Migration 戦略の「DROP 対象 (7 テーブル)」は本子計画書で 9 に訂正。

### 検出された FK 依存（DROP 順序に直結）

1. **`calendars.folder_id text NOT NULL references tasks(id) ON DELETE CASCADE`**（0006:155）
   - tasks を DROP すると **維持予定の calendars 行までカスケード削除**される
   - さらに NOT NULL のため、新スキーマで folder_id の参照先（items_meta?）を決めないと calendars が成立しない → **DD-1 / DD-2**
2. **`calendar_tag_assignments.entity_id`（polymorphic, FK なし）**
   - `entity_type='task'` の行は tasks.id を指す（FK なし）→ tasks DROP で orphan 化 → DD-2
   - `entity_type='schedule_item'` の行は schedule_items.id を指すが schedule_items も DROP 対象（schedule_items は events_payload へ移行）→ こちらも orphan
3. **`note_links` / `note_connections` → notes.id（FK, cascade）**（0005）
   - notes DROP で自動 cascade。だが親計画書は note_links を「touched=NO で維持」としていた → **DD-3**
4. `routine_group_assignments` / `schedule_items` → routines（cascade/set null）→ いずれも同時 DROP につき問題なし

### 既存テーブルの規約（新スキーマで踏襲）

- **id**: text の `<prefix>-<uuid>`（client 生成）。例外 = `calendar_tag_definitions.id` は `integer generated always as identity`（CalendarTag.id=number 契約、維持対象なので不変）
- **version**: versioned テーブルは `version integer not null default 1`、データ層が mutation 毎に increment（LWW on id）。**親計画書 L201 の `bigint` は現行 9 テーブルの `integer` 規約に統一する（M4 確定）。LWW 用単調カウンタに bigint は過剰、既存整合を優先**
- **soft-delete**: `is_deleted boolean not null default false` + `deleted_at timestamptz`
- **timestamps**: `created_at` / `updated_at`（共に `timestamptz not null default now()`）。updated_at が delta sync cursor
- **RLS**: 全テーブル `auth.uid() = user_id` の owner-only 4 policy（全 policy に `to authenticated` 付与＝0002 defense-in-depth 踏襲）。`user_id uuid not null default auth.uid()`
- **RLS gate**: `supabase/scripts/check-rls.sql`（offender 7 パターン検出 + sentinel `___RLS_GATE_OK___`）/ `check-rls.sh`（ラッパ）/ `check-rls-selftest.sh`（自己検証）。allowlist は現状空。新規 13 テーブルも同 pattern なので gate スクリプト本体の修正は原則不要だが、**B1 対策: payload の EXISTS サブクエリ付き policy が gate の `has_qual_no_authuid` ヒューリスティック（`%auth.uid()%=%user_id%` / `%user_id%=%auth.uid()%` パターンマッチ）で緑判定されることを apply 前に `check-rls-selftest.sh` に 1 ケース追加して実証する。緑にならなければ compound key `(payload_table, 'policy_qual_no_authuid')` で allowlist 追記を準備**

## 監査反映（2026-05-23 role-qa + migration-validator）

両監査「条件付き承認可」。以下を本子計画書 + SQL 作成時に織り込む（全て設計精緻化、方向転換なし）:

- **B1（RLS gate 自動カバー）**: 上記「RLS gate」項に selftest 実証 + allowlist 準備を追記済み
- **B2 / H-3（is_deleted_cache トリガの SECURITY 設定）**: migration-validator が確定回答 — **`SECURITY INVOKER`（DEFINER 不要）+ `set search_path = public, pg_temp`**。所有者本人コンテキストで発火し payload update policy（auth.uid=user_id）を通過するため INVOKER で十分。DEFINER は越境リスクかつ advisor `function_search_path_mutable` WARN を誘発するので採らない
- **C-1 / M2（calendar_tag_definitions）**: **truncate しない（維持）**。`cta` を truncate すれば `cta.tag_id → ctd.id` の orphan は発生しない。integer identity PK + version は不変。「任意」表現を撤回
- **C-2（truncate 冪等性）**: 0007 の truncate 対象は **維持テーブル（calendars / calendar_tag_assignments）のみ**に限定。DROP 対象は truncate しない。冪等性記述を「DROP=if exists で冪等 / truncate=維持テーブルゆえ再実行でも存在し常に成功」に正確化
- **H-1（DROP cascade）**: 全 DROP に `cascade` 維持。順序は可読性目的（cascade が従属 FK / self-FK を自動処理）
- **H-2（payload RLS 二重防衛）**: EXISTS 内も `and items_meta.user_id = auth.uid()` で縛る。全 payload に `user_id uuid not null default auth.uid()` 必須（M3）
- **M1（partial unique 命名）**: `uq_events_payload_routine_date`、述語は schedule_items 版踏襲
- **M3（payload updated_at 責務）**: payload 単独 mutation 時に items_meta.updated_at を bump する責務（mapper or トリガ）を DU-B 着手前に確定（DU-A は列定義のみ）
- **m1（order 命名）**: 新スキーマは予約語回避のため **`sort_order integer`** に統一（現行 `"order"` のクォート地獄を避ける）。mapper が TS `order` ↔ DB `sort_order` を変換。DU-A で確定（DU-B 先送りを撤回）
- **m2（dailies_payload.date UNIQUE）**: Non-goal にマルチテナント無しと明記済みのため単純 `UNIQUE(date)` で可。ただし将来整合のためコメントで user_id 複合候補を残す

## 設計判断（DD: 2026-05-23 全て案 A で確定）

親計画書の想定と現行スキーマ実態の食い違いから生じた 3 点。**全てユーザーが推奨案 A を選択し確定**:

- **DD-1 確定**: folder = `role=task` の sub-type（tasks_payload に `task_type` + `folder_type`）
- **DD-2 確定**: calendars / calendar_tag_assignments データも truncate + `folder_id` FK を `items_meta(id)` に再ターゲット
- **DD-3 確定**: note_links / note_connections も DROP、WikiLink は `wiki_tag_connections` に一元化（DU-F）

→ 親計画書の「DROP 7 テーブル」を **9 テーブル** に、「note_links touched=NO」を **DROP + DU-F 統合** に、「calendars データ保持」を **truncate + FK 再張り** に訂正（本子計画書が正本。親計画書承認後の修正のため outbox / 親計画書追記で整合させる）。

### 各 DD の選択肢（記録用）

### DD-1: folder-type task の表現

現 `tasks.type ∈ {folder, task}` + `folder_type ∈ {normal, complete}`。新 role enum（task/event/routine/note/daily）に "folder" がない。

- **推奨案 A**: folder も `role=task` とし、`tasks_payload` に `task_type text check (task_type in ('folder','task'))` + `folder_type` 列を持たせる。5-role 契約を壊さず、folder は task の sub-type として表現
- 案 B: role を 6 値に拡張（task/folder/event/...）。Q14（5 種厳守）と矛盾
- 案 C: folder 概念を廃止し、階層は parent_item_id のみで表現。既存 folder UX が壊れる

### DD-2: calendars データと folder_id FK 再ターゲット

`calendars.folder_id NOT NULL → tasks(id)`。tasks が DROP + データ破壊的リセット（Q3）されると、calendars データは参照先を失う。親計画書「calendars データは保持」は FK 実態と矛盾。

- **推奨案 A**: calendars / calendar_tag_assignments のデータも **truncate**（破壊的リセットの一部）。folder_id FK を `items_meta(id)` へ再ターゲット（DD-1 で folder=role=task のため）。calendar_tag_assignments の orphan 行（entity_type='task'|'schedule_item'）は truncate で一掃。構造は維持・データは初期化。最も整合的
- 案 B: calendars 構造維持・folder_id を nullable に緩め FK を一旦 drop（loose ref）。データ部分保持を試みるが orphan リスク残る
- 案 C: calendars 系も items_meta に統合（別計画予定だったが前倒し）。スコープ拡大

### DD-3: note_links / note_connections の処遇

両者は notes.id への FK を持ち、notes DROP で cascade 削除される。親計画書は note_links を「touched=NO で維持」としたが、FK 実態により**維持は不可能**。

- **推奨案 A**: note_links / note_connections も DROP。WikiLink 機能は items_meta 上の `wiki_tag_connections` に一元化（DU-F で実装）。daily↔notes Connect は wiki_tag_connections で再現。親計画書の「note_links touched=NO」を撤回し「DROP + DU-F で wiki_tag_connections に統合」へ訂正
- 案 B: note_links のスキーマだけ残し FK を items_meta に張り替え。WikiLink と二重管理になり Obsidian 一元思想に反する

## 0007 drop migration 設計

```sql
-- 0007_drop_legacy_item_tables.sql
-- DU-A: 旧 item 系 9 テーブルを DROP（破壊的リセット）。calendars 系 3 は構造維持（DD-2 案 A ならデータ truncate）。

-- Step 1: calendars.folder_id FK を外す（tasks DROP で calendars が cascade 削除されるのを防ぐ）
alter table public.calendars drop constraint if exists calendars_folder_id_fkey;

-- Step 2: 参照先を失う calendars 系データを truncate（維持テーブルのみ＝再実行でも常に存在し冪等）
truncate table public.calendar_tag_assignments;
truncate table public.calendars;
-- calendar_tag_definitions は truncate しない（維持）。cta truncate で tag_id orphan は発生せず、integer identity PK + version は不変（C-1 確定）

-- Step 3: 9 テーブルを FK 逆順で DROP（CASCADE で従属 index/policy も除去）
drop table if exists public.schedule_items cascade;
drop table if exists public.routine_group_assignments cascade;
drop table if exists public.routine_groups cascade;
drop table if exists public.routines cascade;
drop table if exists public.note_connections cascade;
drop table if exists public.note_links cascade;
drop table if exists public.notes cascade;
drop table if exists public.dailies cascade;
drop table if exists public.tasks cascade;

-- 冪等性: DROP は if exists で冪等。truncate 対象は維持テーブル（calendars/cta）ゆえ再実行でも存在し常に成功（C-2 確定）
```

## 0008 schema migration 設計（13 テーブル）

親計画書「DB 設計詳細」の列定義を正本とする。本子計画書では **親計画書から追加・修正する列** と **作成順序** を確定する。

### 作成順序（FK 依存順）

```
1. items_meta                      (親テーブル、FK 先)
2. tasks_payload                   (item_id FK items_meta, parent_item_id FK items_meta)
3. events_payload                  (item_id FK, routine_item_id FK items_meta)
4. routines_payload                (item_id FK)
5. notes_payload                   (item_id FK, parent_item_id FK items_meta)
6. dailies_payload                 (item_id FK)
7. routine_groups                  (専用)
8. routine_group_assignments       (routine_item_id FK items_meta, group_id FK routine_groups)
9. wiki_tags                       (専用)
10. wiki_tag_groups                (専用)
11. wiki_tag_group_assignments     (tag_id FK wiki_tags, group_id FK wiki_tag_groups)
12. wiki_tag_assignments           (item_id FK items_meta, tag_id FK wiki_tags)
13. wiki_tag_connections           (from/to_item_id FK items_meta)
-- 最後: calendars.folder_id FK を items_meta(id) へ再張り（DD-1/DD-2 案 A）
-- 冪等化のため 0008 でも事前 drop（0007 で外しているが 0008 単独再実行に備える）
alter table public.calendars drop constraint if exists calendars_folder_id_fkey;
alter table public.calendars
  add constraint calendars_folder_id_fkey
  foreign key (folder_id) references public.items_meta(id) on delete cascade;
```

> **M1 注記（型安全の限界）**: この FK は items_meta(id) を指すだけなので、`role=note`/`event` 等の id を folder_id に入れても FK 上は通る。「folder_id が role=task かつ task_type='folder' を指す」保証は **DU-A スコープ外**（DU-B/DU-E の app 層 or CHECK で担保）。DU-A では FK 再張りのみ。同様に tasks_payload.parent_item_id / notes_payload.parent_item_id の「同 role 内参照」も app 層担保（親計画書 L398）。

### 親計画書の列定義から DU-A で補強する点

現行 `tasks` テーブルは親計画書 tasks_payload（item_id/parent_item_id/start_at/due_at/status/sort_order）より列が多い。**現行 frontend 型が正本**（CLAUDE.md 原則）なので、tasks_payload に以下を追加移植する:

- `user_id uuid not null default auth.uid()`（**全 payload に必須**。RLS owner policy 成立条件。M3 確定）
- `task_type text check (task_type in ('folder','task'))`（DD-1）
- `folder_type text check (folder_type is null or folder_type in ('normal','complete'))`
- `is_expanded boolean`（ツリー開閉）
- `content text` / `work_duration_minutes integer` / `color text` / `icon text` / `time_memo text`
- `priority integer check (priority between 1 and 4)` / `reminder_enabled boolean` / `reminder_offset integer`
- `scheduled_at` / `scheduled_end_at` / `is_all_day` / `completed_at` / `original_parent_id`
- `sort_order integer`（同階層ソート。**新スキーマは予約語回避で `sort_order` に統一。mapper が TS `order` ↔ DB `sort_order` を変換。m1 確定**）

> 注: items_meta が title/timestamps/is_deleted/version を持つので、payload 側はそれらを **重複させない**。current tasks の title/created_at/updated_at/is_deleted/deleted_at/version は items_meta へ移譲。

同様に notes_payload / dailies_payload / events_payload / routines_payload も現行テーブルの全業務列を移植する（DU-A SQL 作成時に 0003-0006 の列を 1:1 照合。本計画書では設計方針のみ固定、逐語列リストは SQL ファイルで確定）。

### RLS（4 policy × 13 テーブル = 52 policy）

親計画書「RLS 設計」のテンプレート通り。payload テーブルは `user_id uuid not null default auth.uid()` 冗長付与 + item_id 経由の EXISTS チェックの二重防衛。**EXISTS 内も `and items_meta.user_id = auth.uid()` で縛る（H-2）**。全 policy に `to authenticated` を付与。各 policy は `drop policy if exists` → `create policy` で 0008 を冪等化。

### items_meta の version/sync 集約

- versioned 権威列 = items_meta.version + items_meta.updated_at
- payload テーブルは version を持たない（items_meta に従属）
- relation テーブル（routine*group_assignments / wiki_tag*\* assignments / connections）は version なし + updated_at + soft-delete-aware delta（Issue 008 同型）

### Issue 011 後継（Routine 重複生成防止）

親計画書 M-new-2 で events_payload に `routine_item_id` / `source_date` / `is_deleted_cache` を追加済み。DU-A では:

- **案 A 採用**: `is_deleted_cache boolean not null default false` 列 + items_meta.is_deleted 更新トリガで同期 + partial UNIQUE index `uq_events_payload_routine_date (routine_item_id, source_date) WHERE routine_item_id IS NOT NULL AND is_deleted_cache = false`（M1 命名確定、述語は schedule_items 版踏襲）
- **トリガは `SECURITY INVOKER`（DEFINER 不要）+ `set search_path = public, pg_temp`（B2/H-3 確定）**。所有者本人コンテキストで発火し payload update policy（auth.uid=user_id）を通過するため INVOKER で十分。DEFINER は越境リスク + advisor `function_search_path_mutable` WARN を誘発するため不採用
- payload 単独 mutation 時に items_meta.updated_at を bump する責務（mapper or トリガ）は DU-B 着手前に確定（M3。DU-A は列定義のみ）

## apply 手順（破壊的 = 二段承認）

1. **[一段目・済]** 親計画書承認時にユーザーが Data Unification 方針を承認
2. **[二段目・未]** DU-A 子計画書承認 + DD-1/DD-2/DD-3 確定 + **「Supabase 破壊的 apply 実行可」の最終承認**をユーザーから取得
3. **apply 前に SQL Editor から既存データを CSV エクスポート（migration-validator が強く推奨）**。0007/0008 は冪等でも消えたデータは 0003-0006 再適用では戻らない。N=1 テストデータでも実行推奨
4. apply 実行: 現運用は **手動 SQL Editor**（MCP write 凍結中 = 親申し送り）。0007 → 0008 の順で貼り付け実行
5. apply 後検証:
   - `select count(*) from items_meta`（= 0、空状態）
   - `supabase/scripts/check-rls.sh`（offender 0・sentinel 確認）
   - `get_advisors`（RLS lint WARN 0、`auth_leaked_password_protection` は既知 WARN で完成後判断）
   - `\d items_meta` 等で 13 テーブル + 52 policy の存在確認

## Verification（DU-A 完了条件）

- [ ] DD-1 / DD-2 / DD-3 がユーザー確定済み
- [ ] `0007_drop_legacy_item_tables.sql` 作成（9 DROP + calendars FK 外し + DD-2 truncate、冪等）
- [ ] `0008_data_unification_schema.sql` 作成（13 テーブル + 52 policy + items_meta 集約 + Issue 011 partial UNIQUE + calendars FK 再張り）
- [ ] migration-validator 監査 PASS（3 系統整合は Supabase 単独運用のため D1/SQLite 系は対象外、PostgreSQL 単系統で idempotency + RLS + FK 順序を検証）
- [ ] role-qa 監査 PASS
- [ ] ユーザー最終承認（破壊的 apply）
- [ ] apply 成功 + check-rls 緑 + advisor 0 + items_meta count=0

## ロールバック方針

親計画書「ロールバック方針」を継承。DU-A apply 後に戻す場合は 0003-0006 を再適用（既存データは復元不能、CSV 前提）。0007/0008 は冪等なので再 apply 安全。

## Non-goals（DU-A スコープ外）

- mapper / DataService 実装（DU-B 以降）
- Provider 配線（DU-B 以降）
- MCP Server ツール書き換え（凍結）
- calendars 系の items_meta 統合（DD-2 案 C を採らない限り別計画）
- WikiLink グラフ可視化 UI（DU-F でも backlink list のみ）

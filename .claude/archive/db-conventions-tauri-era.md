# DB Conventions — Life Editor (Post-Data-Unification era)

> Supabase Postgres + RLS + Realtime 上で動く `items_meta + <role>_payload` 2 行分割モデル用の規約集。
> 設計原則（なぜ）と遵守ルール（どう書くか）の両方を保持する。実装コードの規約部分は CLAUDE.md §4 / §6 の SSOT 章からもリンクされる。

> 📦 **旧 Tauri SQLite + Cloud D1 時代の §1-§9 規約は [`.claude/archive/db-conventions-tauri-era.md`](../../archive/db-conventions-tauri-era.md) に移管済（main `1cfdc62`）**。Tauri ランタイムは Phase 2 で停止済で、現行 `shared/` + `supabase/` コードに対しては適用されない。歴史的経緯の参照のみに留める。
>
> 本ファイル (v2) は Data Unification (DU-A 〜 DU-F) 進行中に発見された規約を蓄積する位置づけ。DU-C/D/E/F 着手時に §11 以降を追記していく。章番号 §10 は DU-B-6 で確立済の知見を維持するため温存（plan / known-issues から `§10.X` でリンクされている）。

---

## 10. Payload Mapper 規約（Data Unification 後 / Postgres + RLS 系）

> 適用対象: `shared/src/services/*Mapper.ts` + `supabase/migrations/0008+` で導入された `items_meta + <role>_payload` 2 行分割モデル。DU-B (Tasks) で確立した規約を、DU-C/D/E/F に向けて先に固定する。

### 10.1 2 行分割マッピング（5 role 共通）

`tasks` / `notes` / `dailies` / `routines` / `events` の 5 role すべてで、TS の 1 ドメイン型は **`items_meta` 1 行 + `<role>_payload` 1 行**にマップされる。mapper は次の 3 関数だけで構成し、I/O は一切持たない（`@supabase/supabase-js` 依存ゼロ）:

- `rowsToType(meta, payload): Type` — SELECT した 2 行 → TS 型
- `typeToRows(node, userId): { meta, payload }` — TS 型 → 2 行（INSERT 用）
- `typeUpdatesToPatches(updates, userId, now): { metaPatch, payloadPatch }` — Partial 更新

実装例: `shared/src/services/taskMapper.ts`（DU-B-2 で確立）。

### 10.2 DB-Q2: `updated_at` bump は mapper の責務

`items_meta.updated_at` は Cloud Sync の LWW cursor（`<role>_payload` には `updated_at` 列を持たせない＝単一所有）。**payload 単独更新でも必ず `items_meta.updated_at` を bump する**。`typeUpdatesToPatches` は `metaPatch.updated_at = now` を**無条件**注入する設計にする（`now` は呼び出し側から注入 → mapper の純粋性 + テスト可能性）。

**UPSERT 経路の落とし穴**: `typeToRows` の `metaInsertRow` は `updated_at` を含めない（DB DEFAULT `now()` 任せ）。これは fresh INSERT 専用の前提で、PostgREST `.upsert()` が既存行に当たって UPDATE に転じる経路では UPDATE-side trigger が無いため `updated_at` が古いまま残る。`syncTaskTree` 系の bulk upsert では caller 側で `{ ...meta, updated_at: now }` を spread して bump を強制する（`SupabaseDataService.syncTaskTree` 参照）。

### 10.3 Generated 列の書き込み禁止

`<role>_payload.parent_item_role` は `generated always as ('<role>') stored` で固定値を持つ生成列。PG は INSERT/UPDATE に値を指定すると SQLSTATE 42601 で reject する。Write 用型（例: `TasksPayloadWriteRow = Omit<TasksPayloadRow, "parent_item_role">`）で**型レベルから除外**し、ランタイムでも mapper の `taskNodeToRows().payload` が `hasOwnProperty("parent_item_role") === false` になることをテストで確認する（`shared/tests/taskMapper.test.ts` 参照）。

### 10.4 同 role 内親子の DB-level 強制（composite FK）

`items_meta.(id, role)` を UNIQUE にし、`<role>_payload` 側で `(parent_item_id, parent_item_role)` の composite FK を `items_meta(id, role)` に張ることで「親は同 role のみ」を物理的に保証する（cross-role parent を不可能化）。FK の `ON DELETE` 動作:

- `ON DELETE CASCADE` (`tasks_payload.item_id -> items_meta.id`): meta hard-delete で payload も自動消去
- `ON DELETE NO ACTION` (`tasks_payload.(parent_item_id, parent_item_role) -> items_meta(id, role)`): 子がいる親の DELETE は PG が拒否 → caller 側で**子から先に DELETE** する descendants-first ordering が必須。SET NULL は generated 列の制約と衝突するため使えない（known-issue 021 参照）

### 10.5 R2 orphan recovery（hard delete on payload INSERT failure）

`createX` メソッドは `items_meta` INSERT 成功後に `<role>_payload` INSERT を別ステートメントで投げる（PostgREST にトランザクションが無いため）。payload INSERT 失敗時は try/catch で `items_meta` を **hard delete**（soft-delete ではない — 他デバイスの TrashView を汚染しないため）。catch 内 delete もまた失敗するケース（NW 断線等）は、別途運用の R2 検出 SQL でスイープする:

```sql
-- R2: 孤児 items_meta (meta あり payload なし)
select m.id, m.role, m.created_at
from items_meta m
left join tasks_payload p on p.item_id = m.id and m.role = 'task'
where m.role = 'task' and p.item_id is null;
-- expected: 0 rows
```

`fetchX` 系の SELECT は payload が無い meta 行を silent skip して UI に出さない（防御的）。

### 10.6 DU-B 確定 3 件サマリ

| ID    | 確定事項                                                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| DB-Q1 | createX で payload INSERT 失敗時は items_meta を **hard delete**（孤児防止 / sync 汚染防止）                                                   |
| DB-Q2 | `updated_at` bump は mapper の `typeUpdatesToPatches` で無条件注入。UPSERT 経路は caller 側 spread 補完が必須                                  |
| DB-Q3 | composite FK は `ON DELETE NO ACTION`。`permanentDeleteX` は live + trashed 全 pool で descendants を集め、深さ降順 (子→親) で 1 件ずつ DELETE |

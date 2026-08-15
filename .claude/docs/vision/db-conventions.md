# DB Conventions — Life Editor (Post-Data-Unification era)

> Supabase Postgres + RLS + Realtime 上で動く `items_meta + <role>_payload` 2 行分割モデル用の規約集。
> 設計原則（なぜ）と遵守ルール（どう書くか）の両方を保持する。実装コードの規約部分は CLAUDE.md §4 / §6 の SSOT 章からもリンクされる。

> 📦 **旧 Tauri SQLite + Cloud D1 時代の §1-§9 規約は [`.claude/archive/db-conventions-tauri-era.md`](../../archive/db-conventions-tauri-era.md) に移管済（main `1cfdc62`）**。Tauri ランタイムは Phase 2 で停止済で、現行 `shared/` + `supabase/` コードに対しては適用されない。歴史的経緯の参照のみに留める。
>
> 本ファイル (v2) は Data Unification (DU-A 〜 DU-F) で発見された規約を蓄積する位置づけ（DU 系レーンは完了済み。新規約は §11 以降に追記する）。章番号 §10 は DU-B-6 で確立済の知見を維持するため温存（plan / known-issues から `§10.X` でリンクされている）。

---

## 10. Payload Mapper 規約（Data Unification 後 / Postgres + RLS 系）

> 注: 旧 Tauri 時代の「全テーブルに version カラム」は遺物で未使用。LWW cursor は `items_meta.updated_at` が正（CLAUDE.md §3.3）。
>
> 適用対象: `shared/src/services/*Mapper.ts` + `supabase/migrations/0008+` で導入された `items_meta + <role>_payload` 2 行分割モデル。DU-B (Todos) で確立した規約を、DU-C/D/E/F に向けて先に固定する。

### 10.1 2 行分割マッピング（5 role 共通）

`tasks` / `notes` / `dailies` / `routines` / `events` の 5 role すべてで、TS の 1 ドメイン型は **`items_meta` 1 行 + `<role>_payload` 1 行**にマップされる。mapper は次の 3 関数だけで構成し、I/O は一切持たない（`@supabase/supabase-js` 依存ゼロ）:

- `rowsToType(meta, payload): Type` — SELECT した 2 行 → TS 型
- `typeToRows(node, userId): { meta, payload }` — TS 型 → 2 行（INSERT 用）
- `typeUpdatesToPatches(updates, userId, now): { metaPatch, payloadPatch }` — Partial 更新

実装例: `shared/src/services/todoMapper.ts`（DU-B-2 で確立）。

### 10.2 DB-Q2: `updated_at` bump は mapper の責務

`items_meta.updated_at` は Cloud Sync の LWW cursor（`<role>_payload` には `updated_at` 列を持たせない＝単一所有）。**payload 単独更新でも必ず `items_meta.updated_at` を bump する**。`typeUpdatesToPatches` は `metaPatch.updated_at = now` を**無条件**注入する設計にする（`now` は呼び出し側から注入 → mapper の純粋性 + テスト可能性）。

**UPSERT 経路の落とし穴**: `typeToRows` の `metaInsertRow` は `updated_at` を含めない（DB DEFAULT `now()` 任せ）。これは fresh INSERT 専用の前提で、PostgREST `.upsert()` が既存行に当たって UPDATE に転じる経路では UPDATE-side trigger が無いため `updated_at` が古いまま残る。`syncTodoTree` 系の bulk upsert では caller 側で `{ ...meta, updated_at: now }` を spread して bump を強制する（`SupabaseDataService.syncTodoTree` 参照）。

### 10.3 Generated 列の書き込み禁止

`<role>_payload.parent_item_role` は `generated always as ('<role>') stored` で固定値を持つ生成列。PG は INSERT/UPDATE に値を指定すると SQLSTATE 42601 で reject する。Write 用型（例: `TasksPayloadWriteRow = Omit<TasksPayloadRow, "parent_item_role">`）で**型レベルから除外**し、ランタイムでも mapper の `todoNodeToRows().payload` が `hasOwnProperty("parent_item_role") === false` になることをテストで確認する（`shared/tests/todoMapper.test.ts` 参照）。

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

**逆向きの残骸（#625 Event↔Todo 変換）**: role 付け替えは「新 payload UPSERT → `items_meta.role` UPDATE → 旧 payload DELETE」の順で走る（`SupabaseItemConversionService`）。孤児 meta を絶対に作らない代わりに、最後の DELETE が落ちると **role と一致しない payload 行**が残る。読み取りは role で絞ってから join するので UI からは完全に不可視・無害（meta の hard delete で CASCADE 消滅する）が、放置量は把握しておきたいので検出クエリを持つ:

```sql
-- #625: role と一致しない payload 行（変換の中断残骸）
select p.item_id, m.role from tasks_payload  p join items_meta m on m.id = p.item_id where m.role <> 'task';
select p.item_id, m.role from events_payload p join items_meta m on m.id = p.item_id where m.role <> 'event';
-- expected: 0 rows
```

### 10.6 DU-B 確定 3 件サマリ

| ID    | 確定事項                                                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| DB-Q1 | createX で payload INSERT 失敗時は items_meta を **hard delete**（孤児防止 / sync 汚染防止）                                                   |
| DB-Q2 | `updated_at` bump は mapper の `typeUpdatesToPatches` で無条件注入。UPSERT 経路は caller 側 spread 補完が必須                                  |
| DB-Q3 | composite FK は `ON DELETE NO ACTION`。`permanentDeleteX` は live + trashed 全 pool で descendants を集め、深さ降順 (子→親) で 1 件ずつ DELETE |

### 10.7 events_payload 案 A 完成（DU-C-1 / 0011）

`events_payload` に対する 2-row 化 + 同期 trigger 構成（案 A）が DU-C-1 (`supabase/migrations/0011_du_c_events_payload_fk.sql`) で完成。

- **composite FK**: `(routine_item_id, routine_item_role)` → `items_meta(id, role)` を `routine_item_role text GENERATED ALWAYS AS ('routine') STORED` 列で実現。`routine_item_id` が指せるのは `role='routine'` の items_meta のみ。`ON DELETE NO ACTION`（KI-021 generated 列に SET NULL/CASCADE 不可）。
- **同期トリガ 2 種**:
  - `trg_sync_event_deleted_cache` (AFTER UPDATE OF is_deleted, 0008 既存): items_meta の `is_deleted` 変化を `events_payload.is_deleted_cache` に伝播。Issue 011 partial UNIQUE フィルタ用ミラーを維持。
  - `trg_events_payload_init_cache` (BEFORE INSERT, 0011 新規): items_meta から現在の is_deleted を読んで cache 初期化。「soft-delete 済 items_meta → 後から events_payload INSERT」の保険。
- **Routine→Event cascade はアプリ層責務**: trigger は events_payload.item_id 単位でしかミラーしない。Routine soft-delete → 由来 events 全体の soft-delete は `SupabaseRoutinesService.softDeleteRoutine` が events_payload WHERE routine_item_id=X の items_meta を `.in()` で一括 UPDATE。戻り値 `{ deletedScheduleItemIds }` で UI が in-memory 同期。

### 10.8 bulkCreate ON CONFLICT 戦略（partial UNIQUE 系）

partial UNIQUE 制約 (`uq_events_payload_routine_date` 等) を持つ relation/event テーブルへの bulk INSERT は、Supabase JS の `upsert(rows, { onConflict, ignoreDuplicates: true })` で冪等化する。

- 対象: `events_payload` の `(routine_item_id, source_date) WHERE routine_item_id IS NOT NULL AND is_deleted_cache = false`
- 動作: 既に live な (routine, date) ペアがあれば silent skip → 生成器が month-flip 連打しても duplicate を作らない (Issue 011 contract)
- ⚠️ `source_date` は generator 経路でのみ populate (routine_item_id 非 null の時 `start_at` から patch)。手動 event は source_date=null で partial UNIQUE は発火しない
- R2 cleanup: payload upsert が例外 (NW / RLS / unexpected) で throw した場合のみ、INSERT 済 items_meta 群を `.in("id", ids)` で hard delete (孤児防止)。ignoreDuplicates の silent skip は throw しないので cleanup 対象外

## 11. PostgREST list read のページ分割規約（#172）

PostgREST は全 SELECT をサーバ側 `max-rows`（Supabase 既定 1000）で**無音切り捨て**する（known-issue 012 と同型の failure shape）。全件系の list read は `shared/src/services/postgrestFetchAll.ts` の helper 経由で書く。

- **fetchAllPages**: 全件 read は `.order(一意カラム末尾)` + `.range()` の追い pull。末尾 order が一意でないとページ跨ぎで重複/取りこぼしが出る
- **fetchByIdChunks / forEachIdChunk**: `.in(col, ids)` の id リストは 200 件ずつに分割（URL 長 + max-rows の両対策）。write の部分適用は Realtime では自己修復しない（caller の retry / 冪等パッチ前提）
- **有界 read は適用不要**: 単一 item の join・1 routine のグループ所属など、入力で件数が構造的に抑えられる read はそのままでよい。ただし `.in().in()` の直積フィルタは「バッチで有界」に見えて既存行数でスケールするため対象（bulkCreate pre-check の実例）
- ⚠️ **運用注意**: Supabase 側で `db.max_rows` を `POSTGREST_PAGE_SIZE`（=1000）未満に下げると short-page 停止条件が壊れ、全 paginated read が再び無音切り捨てに戻る（012 再来）。max-rows を変更する場合は先に POSTGREST_PAGE_SIZE を追随させること

---

## 12. PostgREST 埋め込み join の FK 名指し規約（#365 / #431）

「関連テーブルの列を条件に使いたいだけ」の read は、埋め込み join でサーバ側に押し込むと 1 往復で済む。実例が `listAllTagAssignments`（`shared/src/services/SupabaseWikiTagsUnifiedService.ts:154-169`）で、`items_meta!inner(is_deleted)` + `.eq("items_meta.is_deleted", false)` によって「ゴミ箱に入った item に紐づく assignment」を DB 側で落としている（クライアント側で id を集めて 2 回目の sweep を撃つと、syncVersion が上がるたび = 打鍵が止まるたびに再実行されてしまう）。

⚠️ **同じ書き方をコピーできない相手がある**。埋め込み先テーブルへの FK が **2 本以上ある**場合、素の `items_meta!inner(...)` は「どちらの FK を辿るか」が決まらず、PostgREST が **PGRST201（400）**を返す。

- **踏む相手の実例**: `wiki_tag_connections` は `from_item_id` / `to_item_id` の 2 本が `items_meta` を参照する（DDL = `supabase/migrations/0008_data_unification_schema.sql:922-931`）。したがって `listAllTagConnections`（同ファイル `:235-247`）に `items_meta!inner(is_deleted)` をそのまま足すと 400 になる
- **回避**: FK 制約名（または列名）で辿る側を名指しする — `items_meta!wiki_tag_connections_from_item_id_fkey(is_deleted)` のように書く。0008 の FK はインライン `references` で張られており制約名を明示していないため、Postgres 既定の `<table>_<column>_fkey` が名前になる（**書く前に実物を確認すること**）。**両端の liveness を見たいなら埋め込みも 2 つ必要**（別名で 2 回埋め込む）
- **判断の目安**: 埋め込みを足す前に、対象テーブルから埋め込み先への FK が何本あるかを確認する。1 本なら素の `!inner` でよい。2 本以上なら必ず名指しする
- 埋め込んだ列は join 専用で、行 → ドメイン型の mapper は余分なキーを無視してよい（`rowToWikiTagAssignment` がその形）

---

## 13. migration 0013 は欠番（埋めない・振り直さない）

`supabase/migrations/` は `0012_drop_calendar_tags.sql` の次が `0014_notes_payload_parent_fk.sql` で、**0013 が無い**。これは失くしたのでも、適用に失敗して巻き戻したのでもなく、**一度も存在しなかった番号**。ホテルに 13 階が無いのと同じで、抜けているのは番号だけで中身は欠けていない。

実測（2026-08-11 / #669）:

- `git log --all --full-history -- '*0013*'` が 0 件。どのブランチにも 0013 という名前のファイルがあった履歴が無い
- 0012（DU-C+）と 0014（DU-D）は**同じ commit で入っている**（`fe2c7d86` / PR #17）。並行して書かれた 2 本の子計画書がそれぞれ先に番号を確保し、間の 1 つを誰も使わないまま両方が着地した
- リモートの適用台帳（`supabase_migrations.schema_migrations`）も 0012 → 0014 で飛んでおり、ローカルのファイル列と完全に一致している

したがって **DB に足りない DDL は無い**。運用上の帰結が 2 つある:

- **空いた 0013 を後から埋めない**。0014 以降は適用済みなので、いま 0013 を足すと「番号は 0014 より前、実際に流れるのは後」という食い違いが生まれる。新しい DDL は常に末尾の次の番号を取る
- **既存 migration のファイル名を振り直さない**。適用済みの version 文字列は台帳に記録済みで、リネームは Supabase CLI から「未適用の新規 migration」に見える。既に当たっている DDL を再実行しにいく

番号の連番性を見る監査（`life-editor-migration-validator` 等）が 0013 を欠番として挙げた場合、それは想定どおりで対処不要。

---

## 14. 検証データの規約（#700 / [`D-20260812-shared-fix-3`](../../decisions/D-20260812-shared-fix-3.md)）

MCP の検証ツール（`seed_verification_state` / `read_verification_state` / `cleanup_verification_state`）が撒くデータの置き場所と後始末。実装 = `mcp-server/src/utils/verification.ts` + `mcp-server/src/handlers/verificationHandlers.ts`。

- **撒き先は検証専用アカウント 1 つ。分離は RLS が担う** — 全テーブルのポリシーが `auth.uid() = user_id` で `user_id` はサーバ側既定（`supabase/migrations/0002_rls_tasks.sql`）。MCP Server は anon key + `signInWithPassword` の一般ユーザーとして繋ぐ（service_role を使わない）ので、撒き先の切替は env の差し替えだけで済む。**id の接頭辞やタイトルの `[verify]` は目印であって分離ではない**（接頭辞方式は #700 の案 B として却下済み）
- **3 ツールは `LIFE_EDITOR_VERIFICATION_MODE=1` のときしか動かない**。推奨形は `.mcp.json` に検証用エントリをもう 1 本立て、その `env` ブロックでだけ検証アカウントの認証情報とフラグを渡すこと（下記）。日常の接続からはツールに到達できなくなる。認証情報は `${VAR}` 参照のまま・平文展開禁止（CLAUDE.md §9）

```jsonc
"life-editor-verify": {
  "command": "node",
  "args": ["<repo>/mcp-server/dist/index.js"],
  "env": {
    "LIFE_EDITOR_SUPABASE_URL": "${LIFE_EDITOR_SUPABASE_URL}",
    "LIFE_EDITOR_SUPABASE_ANON_KEY": "${LIFE_EDITOR_SUPABASE_ANON_KEY}",
    "LIFE_EDITOR_SUPABASE_EMAIL": "${LIFE_EDITOR_VERIFY_SUPABASE_EMAIL}",
    "LIFE_EDITOR_SUPABASE_PASSWORD": "${LIFE_EDITOR_VERIFY_SUPABASE_PASSWORD}",
    "LIFE_EDITOR_VERIFICATION_MODE": "1"
  }
}
```

- **撒いた行はツール側の台帳が覚える** — `mcp-server/.verification-ledger.json`（git 非追跡）。cleanup はこの台帳の id しか消さず、削除に失敗した行は台帳に残るので再実行が復旧手順になる。撒く途中で落ちた場合も、既に書けた行は台帳に載る
- **daily は撒けない** — DailyNode の id は日付由来（`daily-<YYYY-MM-DD>`）で実データと区別できず、id で消す cleanup が本物の日記を巻き込む。task / event / note はランダム id なので衝突しない
- **cleanup は hard delete で、payload → `items_meta` の順**。soft delete では TrashView に残って「片付いていない」ため。順序は composite FK が NO ACTION（§10.4）だから
- **後片付けはアカウントより先に行**。`user_id` から `auth.users` への FK が無いため、アカウントを先に消すと行が誰にも見えないまま残る。cleanup の応答は台帳が空になったときだけ「アカウントを消してよい」と言う

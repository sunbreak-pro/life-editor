-- items_meta.origin_app / origin_key / origin_request_hash — who made an item,
-- and the retry key that keeps a resent create from making a second one
-- (Issue #2147, plan 2026-10-07-extension-app-gateway.md Step 5 = R5 + R6,
-- D-20261007-main-5 = A, D-20261007-main-6 = A)
--
-- WHY: 拡張アプリ（最初は SubscRecorder）が窓口を通して作る項目に、二つのことが
--   要る。
--   (1) 作成元（R6）。別のアプリが作った項目を、アプリの鍵で更新・削除させない
--       ために、項目が「どのアプリが作ったか」を行に持つ。
--   (2) 重複防止のキー（R5）。窓口は「少なくとも 1 回送る」呼び出しを受ける。
--       同じキーでもう一度作成が来たら、2 件目を作らずに 1 件目の id を返したい。
--
--   どちらも items_meta の列にした。理由は、項目の作成が「items_meta INSERT →
--   payload INSERT」の 2 手で、作成元とキーが meta の INSERT と同じ 1 回の書き込み
--   で付くから。別の表に置くと「項目はできたがキーの行が無い」「キーの行はあるが
--   項目が無い」という半端な状態が 2 通り増える。作成元をタグで済ませる案
--   （D-20261007-main-5 の B）は、作成とタグ付けの 2 回のあいだで落ちたとき印の
--   無い項目が残るので採らなかった。前例は 0023（wiki_tag_connections.origin）。
--
--   採らなかった案:
--     - キーから id を決める形（id = f(key)）→ CLAUDE.md §4 の ID 不変式
--       （generateId(prefix) / `<type>-<timestamp+counter>`）から外れる。
--     - 専用の表（idempotency_keys）→ 上のとおり半端な状態が増える。
--     - KV / Durable Objects → 窓口の Worker は使わない（mcp-server/wrangler.jsonc）。
--
-- SCOPE:
--   1. items_meta に 3 列を足す。すべて NULL 可で、NULL = 「life-editor 本体、
--      または持ち主の鍵（スマホの Claude アプリ / Claude Code）が作った項目」。
--        origin_app           作ったアプリの名前（小文字・数字・ハイフン、40 字まで）
--        origin_key           そのアプリが付けた重複防止のキー（200 字まで）
--        origin_request_hash  作成の中身の SHA-256（16 進 64 字）。同じキーで中身が
--                             違うのを見分けるために持つ（D-20261007-main-6 = A）
--   2. 3 列の組み合わせの CHECK を 1 本。キーとハッシュは両方あるか両方無く、
--      キーがあるときは origin_app も要る。
--   3. (user_id, origin_app, origin_key) の一意インデックス（origin_key がある
--      行だけ）。同じアプリの同じキーは 1 人につき 1 行。
--   backfill は無い。既存の行は何も変わらない（新しい列はすべて NULL）。
--
-- ソフトデリート済みの行もインデックスに残す（is_deleted で絞らない）。
--   D-20261007-main-6 = A は「ソフトデリート済みのキーは作り直さず『削除済み』を
--   返す」と決めている。絞ると、持ち主が消した項目を同じキーの再送が無言で作り
--   直す。ゴミ箱を空にして行ごと消えたときは、キーも一緒に空く。
--
-- RLS は列単位ではないので、items_meta の既存の owner-only ポリシー
-- （0008 で作り、0010 で initplan 形式に張り直したもの）がそのまま新しい列も
-- 覆う。Realtime も items_meta は加入済み（0017_realtime_publication.sql）なので
-- 変更なし。どちらもここでは重ねて書かない。
--
-- 同期（CLAUDE.md §3.3）: items_meta.updated_at を cursor とする方式は変わらない。
--   新しい列は作成時に 1 度書かれて以後動かないので、LWW の競合も増えない。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
--
-- 先に push しても古いコードは壊れない。この migration は列を足すだけで、
-- 古いコードはその列を読まず、書きもしない。コード（#2148）がこの列を読み書き
-- するのは push の後。
--
-- 番号: 着手時の origin/main の最新は 0035。0036 は #2094（materials）、0037 は
-- #2118（settings・PR #2177）が予約しているため 0038 にした。`supabase/scripts/
-- db-push.sh` は --include-all で push するので、番号が空いても前後しても通る。
--
-- ロールバックは supabase/migrations_archive_rollback/0038_rollback.sql
-- （migrations/ の外。db push では流れない。手で流す）。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。再実行安全: 列は add column if not
-- exists（2 回目は列ごとの CHECK ごと何もしない）、組み合わせの CHECK は
-- drop constraint if exists → add、インデックスは create unique index if not exists。

begin;

alter table public.items_meta
  add column if not exists origin_app text
    constraint items_meta_origin_app_check
      check (origin_app is null or origin_app ~ '^[a-z][a-z0-9-]{0,39}$'),
  add column if not exists origin_key text
    constraint items_meta_origin_key_check
      check (origin_key is null or char_length(origin_key) between 1 and 200),
  add column if not exists origin_request_hash text
    constraint items_meta_origin_request_hash_check
      check (origin_request_hash is null or origin_request_hash ~ '^[0-9a-f]{64}$');

alter table public.items_meta
  drop constraint if exists items_meta_origin_shape_check;
alter table public.items_meta
  add constraint items_meta_origin_shape_check
    check (
      (origin_key is null and origin_request_hash is null)
      or (origin_key is not null
          and origin_request_hash is not null
          and origin_app is not null)
    );

create unique index if not exists uq_items_meta_origin_key
  on public.items_meta (user_id, origin_app, origin_key)
  where origin_key is not null;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (push の後に流す。期待値つき):
-- ===========================================================================
-- A. 3 列がある
--    select column_name, data_type from information_schema.columns
--    where table_schema = 'public' and table_name = 'items_meta'
--      and column_name in ('origin_app', 'origin_key', 'origin_request_hash')
--    order by column_name;
--    -- expect: 3 rows（すべて text）
--
-- B. 既存の行は変わっていない
--    select count(*) from public.items_meta
--    where origin_app is not null or origin_key is not null
--       or origin_request_hash is not null;
--    -- expect: 0（窓口の作成が次に走るまで）
--
-- C. RLS ゲート
--    cd supabase && npm run db:check-rls
--    -- expect: offenders = 0
--
-- D. CHECK が 4 本、インデックスが 1 本で、再実行で重なっていない
--    select conname from pg_constraint
--    where conrelid = 'public.items_meta'::regclass and contype = 'c'
--      and conname like 'items_meta_origin%' order by conname;
--    -- expect: items_meta_origin_app_check / items_meta_origin_key_check /
--    --         items_meta_origin_request_hash_check / items_meta_origin_shape_check
--    select indexname from pg_indexes
--    where schemaname = 'public' and tablename = 'items_meta'
--      and indexname = 'uq_items_meta_origin_key';
--    -- expect: 1 row
--
-- E. items_meta が Realtime に加入している
--    select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' and schemaname = 'public'
--      and tablename = 'items_meta';
--    -- expect: 1 row
--
-- F. （push 後、Claude が list_tables で確認する）
--    mcp__supabase__list_tables で items_meta に 3 列が見えること

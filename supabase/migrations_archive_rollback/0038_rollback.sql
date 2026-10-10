-- 0038 ROLLBACK: 0038_items_meta_origin.sql を完全に巻き戻す（Issue #2147）。
--
-- 適用順:
--   1. 一意インデックスを drop
--   2. 組み合わせの CHECK を drop
--   3. 3 列を drop（列ごとの CHECK は列と一緒に消える）
--
-- ⚠️ 巻き戻すと、窓口が付けた作成元と重複防止のキーが失われる。拡張アプリが
--   作った項目そのものは残るが、どのアプリが作ったかは分からなくなり、同じ
--   キーの再送は重複して作成される。窓口のコード（#2148 以降）が列を読み書き
--   している間は流さない。先にコードを戻すか、窓口を止めること。
--
-- APPLY MANUALLY VIA THE SUPABASE SQL EDITOR. NOT YET APPLIED.
-- 手で流しても supabase_migrations.schema_migrations には 0038 が残るので、後の
-- db push は 0038 を流し直さない。戻し直すときは 0038_items_meta_origin.sql を SQL
-- エディタに貼る（何度流しても安全）。
-- このファイルは migrations/ の外にあり、`supabase db push` では流れない。

begin;

drop index if exists public.uq_items_meta_origin_key;

alter table public.items_meta
  drop constraint if exists items_meta_origin_shape_check;

alter table public.items_meta
  drop column if exists origin_request_hash,
  drop column if exists origin_key,
  drop column if exists origin_app;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (流した後。期待値つき):
-- ===========================================================================
--    select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'items_meta'
--      and column_name in ('origin_app', 'origin_key', 'origin_request_hash');
--    -- expect: 0 rows
--    select indexname from pg_indexes
--    where schemaname = 'public' and tablename = 'items_meta'
--      and indexname = 'uq_items_meta_origin_key';
--    -- expect: 0 rows

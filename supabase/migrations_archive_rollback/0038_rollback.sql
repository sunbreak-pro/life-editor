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

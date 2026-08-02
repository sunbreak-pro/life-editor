-- wiki_tag_connections.origin 列追加 (Issue #372)
--
-- WHY (#372): 本文の "[[ ]]" リンク挿入で作られた辺（inline 由来）と、LinkPanel /
--   Connect で手動追加された辺を区別できず、本文からリンクを消しても辺を削除
--   同期できなかった（無差別に消すと手動リンクを壊すため #285 で意図的に見送り）。
--   origin ('manual' | 'inline') を持たせ、削除同期の対象を inline 由来だけに
--   限定できるようにする。
--
-- SCOPE: DDL のみ（列追加 1 本）。backfill 不要 — 既存行は default 'manual' に
--   落ちる。既存の inline 由来辺は判別不能のため安全側（= 自動削除対象外）に倒す。
--   RLS は列単位ではないため既存ポリシーがそのまま効く（変更不要）。
--   uq_wtc_from_to (from_item_id, to_item_id) where is_deleted = false は変更
--   しない: origin は「誰が作ったか」であり別辺にはしない。手動辺が既にある
--   ペアへの inline 挿入はフロントの重複ガードが insert 自体を抑止するので、
--   手動辺が inline に化けることはない。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。add column if not exists で再実行安全。

begin;

alter table public.wiki_tag_connections
  add column if not exists origin text not null default 'manual'
  constraint wiki_tag_connections_origin_check
    check (origin in ('manual', 'inline'));

commit;

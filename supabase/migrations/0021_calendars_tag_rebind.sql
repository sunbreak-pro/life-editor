-- life-tags 統一 S2: calendars.folder_id → tag_id rebind (Issue #231)
--
-- WHY (plan 2026-07-11-life-tags-unification.md §F S2, epic Issue #225):
--   folder ノードは廃止され wiki_tags に一本化された（S1 = 0020）。calendars は
--   従来「folder サブツリーのビュー」だったが、その意味的後継として「その life-tag
--   (wiki_tag) が付いたアイテム群のビュー」へ再バインドする（合意方針 案 a）。tag は
--   wiki_tag_assignments を介さず calendars.tag_id で直接参照する。
--
-- SCOPE: calendars は本番 0 行（0007 で truncate 済。INSERT 経路自体は
--   CalendarView 経由で存在するが本番未使用）なのでデータ移行は不要。DDL のみ
--   （旧 folder_id FK/index の付け替え）。行が残っていた場合、旧 folder_id 値は
--   wiki_tags に存在せず新 FK の add constraint が失敗する（begin/commit で
--   ロールバックされデータ破壊はなし）— push 直前に
--   `select count(*) from public.calendars`（0 期待）で再確認すること。
--
-- 現状（0008 適用後）:
--   * constraint calendars_folder_id_fkey : folder_id -> items_meta(id) ON DELETE
--     CASCADE（0006 で tasks(id) として作成 → 0007 で detach → 0008 §15 で
--     items_meta(id) に re-attach）。
--   * index idx_calendars_folder on (folder_id)（0006）。
--   本 migration でこの 2 つを drop し、列を tag_id に rename、wiki_tags(id) 参照の
--   FK と idx_calendars_tag を張り直す。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit で全体をアトミック化。冪等スタイルは 0008/0020 に合わせ
--   drop-if-exists / if not exists / DO ブロックで再実行安全にする。

begin;

-- ===========================================================================
-- 1. 旧 folder_id FK と index を drop
-- ===========================================================================
-- FK は 0008 §15 で items_meta(id) を指すよう re-attach 済。drop-if-exists で
-- 0006(tasks)/0007(detach)/0008(items_meta) のどの中間状態から来ても安全。
alter table public.calendars drop constraint if exists calendars_folder_id_fkey;
drop index if exists public.idx_calendars_folder;

-- ===========================================================================
-- 2. 列 folder_id → tag_id へ rename
-- ===========================================================================
-- rename column 自体は冪等でないため、folder_id が残っている時だけ実行する DO
-- ガードで再実行安全にする（0008 の if-exists 流儀に合わせた列存在チェック）。
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendars'
      and column_name = 'folder_id'
  ) then
    alter table public.calendars rename column folder_id to tag_id;
  end if;
end $$;

-- ===========================================================================
-- 3. tag_id 用の index と wiki_tags(id) 参照 FK を張り直す
-- ===========================================================================
-- 旧 idx_calendars_folder の後継。
create index if not exists idx_calendars_tag on public.calendars (tag_id);

-- 旧 semantics（参照先が物理削除されたらカレンダーも消える）を wiki_tags に対して
-- 維持。wiki_tags は通常ソフトデリートなので ON DELETE CASCADE は実運用でほぼ
-- 発火しない。その帰結として「tag_id が is_deleted=true のタグを指したまま残る」
-- ことは DB では禁止されず、"live なタグを指す" は app-layer 不変式（0008 §15 の
-- folder_id M1 注記と同構造 — UI は未知/soft-deleted タグを id fallback 表示 +
-- 作成時ガードで扱う）。add は冪等でないため drop-if-exists 先行。
alter table public.calendars drop constraint if exists calendars_tag_id_fkey;
alter table public.calendars
  add constraint calendars_tag_id_fkey
  foreign key (tag_id) references public.wiki_tags(id) on delete cascade;

commit;

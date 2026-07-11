-- life-tags 統一 S1: folder rows → wiki_tags + wiki_tag_assignments 変換
--
-- WHY (plan 2026-07-11-life-tags-unification.md §Step 2 B/C, epic Issue #225):
--   folder ノード（tasks_payload task_type='folder' / notes_payload
--   note_type='folder'）を廃止し、整理概念を WikiTag 基盤に一本化する。各
--   folder を同名の wiki_tags に変換し、直下アイテムへ assignment を付与、
--   folder 本体はソフトデリートしてツリーから外す。多階層 folder の平坦化は
--   「直近 folder 名のみ付与」で確定（実測: active folder は全てルート直下・
--   入れ子なし — §Step 2-A/B）。
--
-- SET-BASED / 全 user 適用（user_id 決め打ち禁止 — §Step 2-A で本人 + playwright
--   使い捨ての 2 名義を確認）。変換対象・タグ・assignment・re-root すべて
--   items_meta.user_id を源泉に持ち回り、auth.uid() には依存しない。
--
-- 期待値（§B-7・2026-07-11 Supabase 本番 read-only 実測）:
--   * 新規タグ = 5（task folder 3 + note folder 2・再利用 0・タグ名衝突 0）
--   * assignment = 1（task `test2` → `testfolder` タグ）
--   * re-root = task 1・note 0（note folder 直下ノートは 0 件）
--   * 変換後 active folder = 0
--   検証手順 = `supabase/scripts/life_tags_verify.sql`（実行前後で対）
--   ロールバック = `supabase/migrations_archive_rollback/0020_rollback.sql`
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit で全体をアトミック化。途中失敗は自動ロールバック
--   され部分状態は残らない（したがって「完了済み run のみ」を跨いだ冪等化は
--   ログ + folder ソフトデリートの二重ガードで担保）。
--
-- IDEMPOTENCY (§B-7 要件 #7): 変換対象は (1) `is_deleted = false` かつ
--   (2) folder_tag ログ未記録、の 2 条件で絞る。変換済み folder は
--   is_deleted=true になり (1) で自然に除外される上、ログにも残るので (2) でも
--   除外される。再実行しても _lt_targets が空になり全ステップが no-op。
--
-- DDL は最小（移行ログテーブルのみ・既存テーブルの ALTER なし）。

begin;

-- ===========================================================================
-- 1. 移行ログテーブル life_tags_migration_log（唯一の DDL）
-- ===========================================================================
-- 1 行 = 1 変換事象。entry_type で 2 種を判別:
--   'folder_tag' — folder→tag 対応 1 件（was_new_tag = そのタグを本 migration
--                  が新規作成したか / 既存 active タグを再利用したか）
--   'item_move'  — 直下アイテム 1 件の re-root + assignment 退避
--                  (old_parent_id = 外した folder / assignment_id = 作成した
--                   assignment。既存 live assignment に当たり skip された場合は
--                   null / prev_original_parent_id = task の re-root 前
--                   original_parent_id をロールバック用に退避)
-- ロールバック対称性の要（folder→tag / 新規タグ / 作成 assignment / notes の
-- re-root 退避先はここにしか無い）。
create table if not exists public.life_tags_migration_log (
  id                      text        primary key
                                      default ('ltmlog-' || gen_random_uuid()::text),
  user_id                 uuid        not null,
  entry_type              text        not null
                                      check (entry_type in ('folder_tag','item_move')),
  folder_id               text,       -- folder_tag: 変換した folder の items_meta.id
  folder_role             text        check (folder_role is null or folder_role in ('task','note')),
  folder_title            text,       -- folder_tag: 監査用の folder タイトル控え
  tag_id                  text,       -- both: 対応する wiki_tags.id
  was_new_tag             boolean,    -- folder_tag: true=新規作成 / false=既存再利用
  item_id                 text,       -- item_move: re-root した直下アイテム
  item_role               text        check (item_role is null or item_role in ('task','note')),
  old_parent_id           text,       -- item_move: 外した folder の id（notes の re-root 復元源）
  assignment_id           text,       -- item_move: 作成した assignment id（skip 時 null）
  prev_original_parent_id text,       -- item_move(task): re-root 前の original_parent_id 退避
  migrated_at             timestamptz not null default now()
);

create index if not exists idx_ltml_user       on public.life_tags_migration_log (user_id);
create index if not exists idx_ltml_entry_type on public.life_tags_migration_log (entry_type);
create index if not exists idx_ltml_folder     on public.life_tags_migration_log (folder_id);
create index if not exists idx_ltml_item       on public.life_tags_migration_log (item_id);
create index if not exists idx_ltml_tag        on public.life_tags_migration_log (tag_id);

-- RLS: 既存テーブルの流儀（0008）に合わせて owner-only 4 policy を有効化。
-- アプリからは参照しない内部監査台帳だが、public スキーマの RLS-disabled
-- advisor WARN を避けるため他テーブル同様に有効化する。
alter table public.life_tags_migration_log enable row level security;

drop policy if exists life_tags_migration_log_select_own on public.life_tags_migration_log;
create policy life_tags_migration_log_select_own
  on public.life_tags_migration_log
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists life_tags_migration_log_insert_own on public.life_tags_migration_log;
create policy life_tags_migration_log_insert_own
  on public.life_tags_migration_log
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists life_tags_migration_log_update_own on public.life_tags_migration_log;
create policy life_tags_migration_log_update_own
  on public.life_tags_migration_log
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists life_tags_migration_log_delete_own on public.life_tags_migration_log;
create policy life_tags_migration_log_delete_own
  on public.life_tags_migration_log
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- REALTIME: 本テーブルは supabase_realtime publication に *追加しない*（0017 の
-- 14 テーブル集合を変更しない）。cross-tab full-refetch は同期対象ドメインの
-- 変更検知のためで、監査ログは UI が購読する必要がないため sync 対象外。

-- ===========================================================================
-- 2. 変換対象 folder のスナップショット（tasks + notes union）
-- ===========================================================================
-- 対象 = is_deleted=false かつ folder_tag ログ未記録の folder。
--   * tasks: task_type='folder' かつ folder_type IS DISTINCT FROM 'complete'
--     （'complete' はシステム生成の完了バケツ・status 軸が後継のため変換しない）
--   * notes: note_type='folder'（notes_payload に folder_type 列は無く、
--     note folder は全てユーザー folder のため 'complete' 除外は不要）
create temporary table _lt_targets on commit drop as
  select
    m.id      as folder_id,
    m.user_id as user_id,
    'task'::text as folder_role,
    m.title   as folder_title,
    m.title   as tag_name,
    tp.color  as color
  from public.items_meta m
  join public.tasks_payload tp on tp.item_id = m.id
  where m.role = 'task'
    and m.is_deleted = false
    and tp.task_type = 'folder'
    and tp.folder_type is distinct from 'complete'
    and not exists (
      select 1 from public.life_tags_migration_log l
      where l.entry_type = 'folder_tag' and l.folder_id = m.id
    )
  union all
  select
    m.id, m.user_id, 'note'::text, m.title, m.title, np.color
  from public.items_meta m
  join public.notes_payload np on np.item_id = m.id
  where m.role = 'note'
    and m.is_deleted = false
    and np.note_type = 'folder'
    and not exists (
      select 1 from public.life_tags_migration_log l
      where l.entry_type = 'folder_tag' and l.folder_id = m.id
    );

-- ===========================================================================
-- 3. (user_id, tag_name) で dedupe → 継承 color を決定
-- ===========================================================================
-- 同名 folder が複数（task/note 跨ぎ含む）あれば 1 タグに合流（タグは role 横断
-- が仕様 §B-3）。color は「非 null 優先 → folder_id 昇順」の決定的規則で 1 つ選ぶ。
create temporary table _lt_names on commit drop as
  select
    user_id,
    tag_name,
    (array_agg(color order by (color is null), folder_id))[1] as color
  from _lt_targets
  group by user_id, tag_name;

-- ===========================================================================
-- 4. タグ id を解決（既存 active タグ再利用 or 新規作成）
-- ===========================================================================
create temporary table _lt_name_tag on commit drop as
  select
    n.user_id,
    n.tag_name,
    n.color,
    null::text  as final_tag_id,
    false       as was_new
  from _lt_names n;

-- 4a. 同 user・同名の active タグがあれば再利用（uq_wiki_tags_name の partial
--     unique により最大 1 件）。
update _lt_name_tag t
set final_tag_id = w.id,
    was_new      = false
from public.wiki_tags w
where w.user_id = t.user_id
  and w.name = t.tag_name
  and w.is_deleted = false
  and t.final_tag_id is null;

-- 4b. 残り（active タグ無し）を新規 INSERT し、返り値で final_tag_id を確定。
--     id = `tag-<uuid>`（アプリの generateId('tag') = `<prefix>-<crypto.randomUUID()>`
--     と同形）。ON CONFLICT 句は uq_wiki_tags_name（partial unique）に整合させる
--     — Issue 011 の ignoreDuplicates 契約と同型。
with ins as (
  insert into public.wiki_tags (id, user_id, name, color, is_deleted, deleted_at, version)
  select
    'tag-' || gen_random_uuid()::text,
    t.user_id,
    t.tag_name,
    t.color,
    false,
    null,
    1
  from _lt_name_tag t
  where t.final_tag_id is null
  on conflict (name, user_id) where is_deleted = false do nothing
  returning id, user_id, name
)
update _lt_name_tag t
set final_tag_id = ins.id,
    was_new      = true
from ins
where ins.user_id = t.user_id
  and ins.name = t.tag_name;

-- 4c. 防御的再解決: 4b の ON CONFLICT で skip され final_tag_id が null のまま
--     残った行（想定外の active 重複時のみ）を、いま存在するタグに解決。
update _lt_name_tag t
set final_tag_id = w.id,
    was_new      = false
from public.wiki_tags w
where w.user_id = t.user_id
  and w.name = t.tag_name
  and w.is_deleted = false
  and t.final_tag_id is null;

-- ===========================================================================
-- 5. folder → tag マップ + folder_tag ログ記録
-- ===========================================================================
create temporary table _lt_folder_tags on commit drop as
  select
    tg.folder_id,
    tg.user_id,
    tg.folder_role,
    nt.final_tag_id as tag_id
  from _lt_targets tg
  join _lt_name_tag nt
    on nt.user_id = tg.user_id
   and nt.tag_name = tg.tag_name;

insert into public.life_tags_migration_log
  (user_id, entry_type, folder_id, folder_role, folder_title, tag_id, was_new_tag)
select
  tg.user_id,
  'folder_tag',
  tg.folder_id,
  tg.folder_role,
  tg.folder_title,
  nt.final_tag_id,
  nt.was_new          -- タグ単位の新旧（同名 dedupe した全 folder 行が同値）
from _lt_targets tg
join _lt_name_tag nt
  on nt.user_id = tg.user_id
 and nt.tag_name = tg.tag_name;

-- ===========================================================================
-- 6. active 直下アイテム（folder 以外）のスナップショット
-- ===========================================================================
-- 直近祖先タグのみ付与（一階層原則・祖先連鎖は付与しない §B-4）。子が folder の
-- 場合は付与・re-root 対象外（その folder 自身が _lt_targets として別途変換・
-- ソフトデリートされる。実測では active 入れ子なしのため実影響なし）。
-- composite FK により task folder の子は task・note folder の子は note に限られる。
create temporary table _lt_children on commit drop as
  select
    cm.id       as item_id,
    cm.user_id  as user_id,
    'task'::text as item_role,
    ft.folder_id as old_parent_id,
    ft.tag_id   as tag_id,
    cp.original_parent_id as prev_original_parent_id
  from _lt_folder_tags ft
  join public.tasks_payload cp on cp.parent_item_id = ft.folder_id
  join public.items_meta cm on cm.id = cp.item_id
  where ft.folder_role = 'task'
    and cm.is_deleted = false
    and cp.task_type is distinct from 'folder'
  union all
  select
    cm.id,
    cm.user_id,
    'note'::text,
    ft.folder_id,
    ft.tag_id,
    null::text            -- notes に original_parent_id 相当は無い
  from _lt_folder_tags ft
  join public.notes_payload cp on cp.parent_item_id = ft.folder_id
  join public.items_meta cm on cm.id = cp.item_id
  where ft.folder_role = 'note'
    and cm.is_deleted = false
    and cp.note_type is distinct from 'folder';

-- ===========================================================================
-- 7. assignment 付与 + item_move ログ記録
-- ===========================================================================
-- 各直下アイテムへ folder タグの assignment を冪等 INSERT。id = `tag_assign-<uuid>`
-- （アプリ形式と同形）。ON CONFLICT は uq_wta_item_tag（partial unique・
-- is_deleted=false）に整合（既に live な同 (item, tag) は silent skip — Issue 011
-- ignoreDuplicates 契約）。作成できた assignment id を item_move ログに退避して、
-- ロールバックが「新規作成分のみ」削除できるようにする。
with created_assign as (
  insert into public.wiki_tag_assignments
    (id, user_id, item_id, tag_id, is_deleted, deleted_at)
  select
    'tag_assign-' || gen_random_uuid()::text,
    c.user_id,
    c.item_id,
    c.tag_id,
    false,
    null
  from _lt_children c
  on conflict (item_id, tag_id) where is_deleted = false do nothing
  returning id, item_id, tag_id
)
insert into public.life_tags_migration_log
  (user_id, entry_type, tag_id, item_id, item_role, old_parent_id,
   assignment_id, prev_original_parent_id)
select
  c.user_id,
  'item_move',
  c.tag_id,
  c.item_id,
  c.item_role,
  c.old_parent_id,
  ca.id,                       -- 既存 live に当たり skip された場合は null
  c.prev_original_parent_id
from _lt_children c
left join created_assign ca
  on ca.item_id = c.item_id
 and ca.tag_id = c.tag_id;

-- ===========================================================================
-- 8. re-root（直下アイテムを親から切り離す）+ items_meta.updated_at bump
-- ===========================================================================
-- tasks: 旧 folder id を original_parent_id に退避し parent_item_id → NULL。
update public.tasks_payload tp
set parent_item_id     = null,
    original_parent_id = c.old_parent_id
from _lt_children c
where c.item_role = 'task'
  and tp.item_id = c.item_id;

-- notes: parent_item_id → NULL（旧 folder は item_move ログの old_parent_id に退避済）。
update public.notes_payload np
set parent_item_id = null
from _lt_children c
where c.item_role = 'note'
  and np.item_id = c.item_id;

-- DB-Q2（LWW cursor 契約）: payload 単独更新でも items_meta.updated_at を bump。
-- items_meta には updated_at 自動 bump トリガが無いため無条件に明示 bump する。
update public.items_meta m
set updated_at = now()
from _lt_children c
where m.id = c.item_id;

-- ===========================================================================
-- 9. folder 本体をソフトデリート + items_meta.updated_at bump
-- ===========================================================================
-- hard delete しない（TrashView 復元 + ロールバックの保険）。folder のソフト
-- デリートでは calendars_folder_id_fkey（ON DELETE CASCADE）は発火しないため
-- schedule の参照整合は保たれる（§Step 2-A 実測）。DB-Q2 に従い updated_at も bump。
update public.items_meta m
set is_deleted = true,
    deleted_at = now(),
    updated_at = now()
from _lt_folder_tags ft
where m.id = ft.folder_id;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION（commit 後に実行 — 詳細は scripts/life_tags_verify.sql）:
-- ===========================================================================
-- A. 新規タグ数 = 5（本番実測）
--    select count(*) from life_tags_migration_log
--    where entry_type = 'folder_tag' and was_new_tag = true;   -- expect: 5
--
-- B. assignment 数 = 1（本番実測）
--    select count(*) from life_tags_migration_log
--    where entry_type = 'item_move' and assignment_id is not null;  -- expect: 1
--
-- C. re-root 数 = 1（task 1 / note 0）
--    select item_role, count(*) from life_tags_migration_log
--    where entry_type = 'item_move' group by item_role;   -- expect: task=1
--
-- D. 変換後 active folder = 0
--    select count(*) from items_meta m
--    join tasks_payload tp on tp.item_id = m.id
--    where m.role='task' and m.is_deleted=false
--      and tp.task_type='folder' and tp.folder_type is distinct from 'complete';
--    -- expect: 0（notes 側も同様に 0）

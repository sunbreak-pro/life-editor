-- life-tags 統一 S1: 変換 migration（0020_life_tags_folder_migration.sql）の検証クエリ
--
-- 使い方: BEFORE 群は `supabase db push` の *前* に、AFTER 群は push の *後* に
--   SQL Editor で実行し、各対の値が一致することを確認する。実行 = 🛑 ユーザー。
--   期待値は §Step 2-B/C（2026-07-11 Supabase 本番 read-only 実測）。全 user
--   集計（user_id 決め打ちしない）。
--
-- 対応関係（§C-(a)(b)(c)）:
--   (a) 変換前 active folder 数 = folder_tag ログ行数 = 生成 + 再利用タグ数
--   (b) 変換前 folder 直下 active アイテム数 = 生成 assignment 数 = re-root 数
--   (c) 変換後 active folder 数 = 0

-- ###########################################################################
-- BEFORE（push 前に実行）
-- ###########################################################################

-- (a-before) 変換対象 active folder 数（task + note）。期待: 5（task 3 + note 2）
select 'a-before: active target folders' as check, count(*) as value
from (
  select m.id
  from public.items_meta m
  join public.tasks_payload tp on tp.item_id = m.id
  where m.role = 'task' and m.is_deleted = false
    and tp.task_type = 'folder'
    and tp.folder_type is distinct from 'complete'
  union all
  select m.id
  from public.items_meta m
  join public.notes_payload np on np.item_id = m.id
  where m.role = 'note' and m.is_deleted = false
    and np.note_type = 'folder'
) folders;

-- (b-before) folder 直下の active 非フォルダアイテム数（task + note）。期待: 1（task test2）
select 'b-before: active direct children' as check, count(*) as value
from (
  -- task folder の task 子
  select cm.id
  from public.items_meta fm
  join public.tasks_payload fp on fp.item_id = fm.id
  join public.tasks_payload cp on cp.parent_item_id = fm.id
  join public.items_meta cm on cm.id = cp.item_id
  where fm.role = 'task' and fm.is_deleted = false
    and fp.task_type = 'folder' and fp.folder_type is distinct from 'complete'
    and cm.is_deleted = false and cp.task_type is distinct from 'folder'
  union all
  -- note folder の note 子
  select cm.id
  from public.items_meta fm
  join public.notes_payload fp on fp.item_id = fm.id
  join public.notes_payload cp on cp.parent_item_id = fm.id
  join public.items_meta cm on cm.id = cp.item_id
  where fm.role = 'note' and fm.is_deleted = false
    and fp.note_type = 'folder'
    and cm.is_deleted = false and cp.note_type is distinct from 'folder'
) children;

-- ###########################################################################
-- AFTER（push 後に実行）
-- ###########################################################################

-- (a-after-1) folder_tag ログ行数。期待: 5（= a-before）
select 'a-after: folder_tag log rows' as check, count(*) as value
from public.life_tags_migration_log
where entry_type = 'folder_tag';

-- (a-after-2) 生成 + 再利用タグ数 = folder_tag ログの distinct tag_id。期待: 5
--   （タグ名衝突 0 のため folder_tag 行数 = distinct tag。cross-role 同名 folder が
--     あると dedupe で distinct < 行数になる — その場合 a-after-1 と乖離するのが正）
select 'a-after: distinct tags (new+reused)' as check,
       count(distinct tag_id) as value,
       count(*) filter (where was_new_tag = true)  as new_tags,     -- expect: 5
       count(*) filter (where was_new_tag = false) as reused_tags   -- expect: 0
from public.life_tags_migration_log
where entry_type = 'folder_tag';

-- (a-after-3) 実際に active な wiki_tags のうち、本 migration が新規作成したもの。期待: 5
select 'a-after: live new tags present' as check, count(*) as value
from public.wiki_tags w
where w.is_deleted = false
  and w.id in (
    select tag_id from public.life_tags_migration_log
    where entry_type = 'folder_tag' and was_new_tag = true
  );

-- (b-after-1) item_move ログ行数 = re-root 数。期待: 1
select 'b-after: item_move rows (re-root count)' as check,
       count(*) as value,
       count(*) filter (where item_role = 'task') as task_reroot,   -- expect: 1
       count(*) filter (where item_role = 'note') as note_reroot    -- expect: 0
from public.life_tags_migration_log
where entry_type = 'item_move';

-- (b-after-2) 作成した assignment 数（skip 除く）。期待: 1
--   （item_move 行数と一致するのは「既存 live assignment が無かった」前提。既存が
--     あって skip されると assignment 数 < re-root 数になる — その差分は正常）
select 'b-after: created assignments' as check, count(*) as value
from public.life_tags_migration_log
where entry_type = 'item_move' and assignment_id is not null;

-- (b-after-3) 実際に live な assignment（作成分）。期待: 1
select 'b-after: live created assignments present' as check, count(*) as value
from public.wiki_tag_assignments a
where a.is_deleted = false
  and a.id in (
    select assignment_id from public.life_tags_migration_log
    where entry_type = 'item_move' and assignment_id is not null
  );

-- (c-after) 変換後 active folder 数。期待: 0（task / note とも）
select 'c-after: active folders remaining' as check, count(*) as value
from (
  select m.id
  from public.items_meta m
  join public.tasks_payload tp on tp.item_id = m.id
  where m.role = 'task' and m.is_deleted = false
    and tp.task_type = 'folder'
    and tp.folder_type is distinct from 'complete'
  union all
  select m.id
  from public.items_meta m
  join public.notes_payload np on np.item_id = m.id
  where m.role = 'note' and m.is_deleted = false
    and np.note_type = 'folder'
) folders;

-- 追加の健全性チェック: re-root した子が親から外れている（parent_item_id NULL）。期待: 0 rows
select 'sanity: children still parented' as check, count(*) as value
from public.life_tags_migration_log l
join public.tasks_payload tp on tp.item_id = l.item_id
where l.entry_type = 'item_move' and l.item_role = 'task'
  and tp.parent_item_id is not null;

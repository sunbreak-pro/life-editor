-- life-tags 統一 S1 rollback: revert 0020_life_tags_folder_migration.sql.
--
-- life_tags_migration_log を逆適用して folder / re-root / 新規タグ / 作成
-- assignment を変換前へ戻す。ログを源泉にするため 0020 と対称。
--
-- Apply MANUALLY VIA SQL Editor only（`supabase db push` では走らない）。実行 =
-- 🛑 ユーザー。
--
-- SYMMETRY（0020 の逆順）:
--   0020: [tag作成] → [assignment作成] → [re-root] → [folder ソフトデリート]
--   本ファイル: [re-root復元] → [folder復元] → [assignment削除] → [新規タグ削除]
--              → [ログ消去]
--
-- 再利用タグは *削除しない*（was_new_tag = false で区別）。新規タグ削除は
-- wiki_tag_assignments への ON DELETE CASCADE で当該タグ宛 assignment も消える。
-- 作成 assignment は assignment_id 退避分のみ明示削除（既存 live に skip された
-- 分は触らない）。
--
-- ⚠️ hard-delete は現行 sync（Realtime イベント → 全件 full-refetch）前提で安全。
--   アプリ本体の削除規約は soft-delete のため、将来 incremental delta-pull を
--   復活させる場合は本ファイルの tag / assignment 削除も soft-delete へ切替える
--   こと（hard-delete は updated_at cursor の delta に載らず幽霊行が残る）。
--
-- ⚠️ ログ消去は最後に行う（各ステップがログを読むため）。ログを残すと 0020 再適用
--   時に folder_tag ログの NOT EXISTS ガードで folder がスキップされ再変換できない。

begin;

-- ===========================================================================
-- 1. re-root 復元（親を戻す）+ items_meta.updated_at bump
-- ===========================================================================
-- tasks: 旧 folder を parent_item_id に戻し、original_parent_id を re-root 前の
--        値（ログ退避）へ復元。0020 が original_parent_id を上書きしたのを巻き戻す。
update public.tasks_payload tp
set parent_item_id     = l.old_parent_id,
    original_parent_id = l.prev_original_parent_id
from public.life_tags_migration_log l
where l.entry_type = 'item_move'
  and l.item_role = 'task'
  and tp.item_id = l.item_id;

-- notes: 旧 folder を parent_item_id に戻す（退避先はログの old_parent_id のみ）。
update public.notes_payload np
set parent_item_id = l.old_parent_id
from public.life_tags_migration_log l
where l.entry_type = 'item_move'
  and l.item_role = 'note'
  and np.item_id = l.item_id;

-- LWW: re-root 復元した子アイテムの meta も updated_at を bump。
update public.items_meta m
set updated_at = now()
from public.life_tags_migration_log l
where l.entry_type = 'item_move'
  and m.id = l.item_id;

-- ===========================================================================
-- 2. folder 本体の復元（ソフトデリート解除）+ updated_at bump
-- ===========================================================================
update public.items_meta m
set is_deleted = false,
    deleted_at = null,
    updated_at = now()
from public.life_tags_migration_log l
where l.entry_type = 'folder_tag'
  and m.id = l.folder_id;

-- ===========================================================================
-- 3. 本 migration が作成した assignment のみ削除
-- ===========================================================================
-- assignment_id を退避した分のみ（既存 live に当たり skip された分は対象外）。
delete from public.wiki_tag_assignments a
where a.id in (
  select l.assignment_id
  from public.life_tags_migration_log l
  where l.entry_type = 'item_move'
    and l.assignment_id is not null
);

-- ===========================================================================
-- 4. 新規作成したタグのみ削除（再利用タグは残す）
-- ===========================================================================
-- was_new_tag = true のタグのみ。ON DELETE CASCADE で残存 assignment も自動消去
-- （新規タグに既存 assignment は存在し得ないので実質 3 の補完）。
delete from public.wiki_tags w
where w.id in (
  select distinct l.tag_id
  from public.life_tags_migration_log l
  where l.entry_type = 'folder_tag'
    and l.was_new_tag = true
);

-- ===========================================================================
-- 5. ログ消去（最後）— 0020 を再適用可能にする
-- ===========================================================================
-- 全 folder_tag / item_move 行を削除。ログを残すと 0020 の冪等ガードが folder を
-- スキップして再変換不能になるため、完全ロールバックではログを空にする。
delete from public.life_tags_migration_log;

commit;

-- ===========================================================================
-- POST-ROLLBACK VERIFICATION（commit 後・期待値は本番実測ベース）:
-- ===========================================================================
-- A. active folder が復活（task 3 + note 2 = 5）
--    select count(*) from items_meta m
--    join tasks_payload tp on tp.item_id = m.id
--    where m.role='task' and m.is_deleted=false
--      and tp.task_type='folder' and tp.folder_type is distinct from 'complete';
--    -- expect: 3（notes 側 2）
--
-- B. 新規タグが消えている（再利用タグ 0 件だったので active wiki_tags は移行前の 4 に戻る）
--    select count(*) from wiki_tags where is_deleted = false;   -- expect: 移行前値
--
-- C. re-root した子が folder 配下に戻っている（parent_item_id 非 NULL）
--    select tp.item_id, tp.parent_item_id from tasks_payload tp
--    where tp.item_id = 'test2 の id';   -- expect: parent = testfolder id
--
-- D. ログが空（再適用可能）
--    select count(*) from life_tags_migration_log;   -- expect: 0
--
-- 注: life_tags_migration_log テーブル自体（DDL）は drop しない。0020 は
--     `create table if not exists` なので再適用時もそのまま使える。テーブルごと
--     消したい場合は別途 `drop table public.life_tags_migration_log;` を実行する。

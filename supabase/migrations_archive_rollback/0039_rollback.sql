-- 0039 ROLLBACK: 0039_app_records.sql を完全に巻き戻す（Issue #2161）。
--
-- 適用順:
--   1. delete_my_account() を 0037 の定義に戻す（2 表の行を消さない版）
--   2. 2 表を Realtime から外す
--   3. 2 表を drop（索引・制約・ポリシーは表と一緒に消える）
--
-- ⚠️ 1 は 0037 の本体をそのまま貼ってある。0039 の後に別の migration
--   （#2094 など）が delete_my_account() を作り直していたら、この本体は使わず、
--   流す時点の最新の本体から app_records / extension_apps の 2 行だけを抜いた
--   ものに差し替えること。そのまま流すと、後の migration が足した表の削除まで
--   消える。
--
-- 1 を先にする理由: 関数の中の DELETE 文は実行時に表を探すので、表だけ先に
--   消すと、関数を戻すまでのあいだ退会が「表が無い」で必ず失敗する。
--
-- ⚠️ 巻き戻すと、拡張アプリが上げた記録と拡張アプリの台帳がすべて失われる。
--   shared / mcp-server のコード（#2162 以降）が 2 表を読み書きしている間は
--   流さない。先にコードを戻すこと（USER_DATA_EXPORT_TABLES から 2 表を外す
--   変更も含む）。
--
-- APPLY MANUALLY VIA THE SUPABASE SQL EDITOR. NOT YET APPLIED.
-- 手で流しても supabase_migrations.schema_migrations には 0039 が残るので、後の
-- db push は 0039 を流し直さない。戻し直すときは 0039_app_records.sql を SQL
-- エディタに貼る（何度流しても安全）。
-- このファイルは migrations/ の外にあり、`supabase db push` では流れない。

begin;

-- 1. delete_my_account() を 0037 の定義に戻す
create or replace function public.delete_my_account()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller    uuid := auth.uid();
  rec       record;
  remaining bigint;
  leftovers text[] := '{}';
begin
  if caller is null then
    raise exception 'delete_my_account: no authenticated caller';
  end if;

  delete from public.wiki_tag_connections       where user_id = caller;
  delete from public.wiki_tag_assignments       where user_id = caller;
  delete from public.wiki_tag_group_assignments where user_id = caller;
  delete from public.routine_group_assignments  where user_id = caller;
  delete from public.goal_todo_links            where user_id = caller;
  delete from public.playlist_items             where user_id = caller;

  delete from public.tasks_payload    where user_id = caller;
  delete from public.events_payload   where user_id = caller;
  delete from public.notes_payload    where user_id = caller;
  delete from public.dailies_payload  where user_id = caller;
  delete from public.routines_payload where user_id = caller;
  delete from public.goals_payload    where user_id = caller;

  delete from public.items_meta      where user_id = caller;
  delete from public.wiki_tags       where user_id = caller;
  delete from public.wiki_tag_groups where user_id = caller;
  delete from public.routine_groups  where user_id = caller;
  delete from public.playlists       where user_id = caller;

  delete from public.timer_settings          where user_id = caller;
  delete from public.timer_sessions          where user_id = caller;
  delete from public.pomodoro_presets        where user_id = caller;
  delete from public.sound_settings          where user_id = caller;
  delete from public.life_tags_migration_log where user_id = caller;
  delete from public.ai_rules                where user_id = caller;
  delete from public.ai_memories             where user_id = caller;
  delete from public.ai_skills               where user_id = caller;

  for rec in
    select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a
        on a.attrelid = c.oid
       and a.attname = 'user_id'
       and a.attnum > 0
       and not a.attisdropped
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
     order by c.relname
  loop
    execute format(
      'select count(*) from public.%I where user_id = $1',
      rec.table_name
    ) into remaining using caller;
    if remaining > 0 then
      leftovers := leftovers || rec.table_name;
    end if;
  end loop;

  if array_length(leftovers, 1) is not null then
    raise exception
      'delete_my_account: rows remain in % — add it to the delete list',
      array_to_string(leftovers, ', ');
  end if;
end;
$$;

comment on function public.delete_my_account() is
  'Deletes every public.* row owned by the calling user (Issue #1200; goals tables added and the dropped calendars line removed in #2101; ai_rules / ai_memories / ai_skills added in #2118). Runs as the CALLER so RLS scopes it, and raises if any user_id table still holds a row afterwards. The auth.users row is removed separately by the delete-account Edge Function.';

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

-- 2. Realtime から外す（ALTER PUBLICATION ... DROP TABLE に IF EXISTS は無い）
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_records'
  ) then
    alter publication supabase_realtime drop table public.app_records;
  end if;
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'extension_apps'
  ) then
    alter publication supabase_realtime drop table public.extension_apps;
  end if;
end;
$$;

-- 3. 2 表を drop
drop table if exists public.app_records;
drop table if exists public.extension_apps;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (流した後。期待値つき):
-- ===========================================================================
--    select table_name from information_schema.tables
--    where table_schema = 'public'
--      and table_name in ('app_records', 'extension_apps');
--    -- expect: 0 rows
--    select pg_get_functiondef('public.delete_my_account()'::regprocedure)
--           ~ 'app_records' as still_mentions;
--    -- expect: still_mentions = false

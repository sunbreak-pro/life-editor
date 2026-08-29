-- public.delete_my_account() — 退会時の自分のデータ全消去 (Issue #1200)
--
-- WHY: 第三者配布に向けたセルフサービス退会。「アカウント削除 = データ完全消去」
--   を成立させるには 2 つ消す必要がある: (1) public 配下の自分の行すべて、
--   (2) auth.users の行。本 migration は (1) だけを持ち、(2) は Edge Function
--   `delete-account` が service_role で行う（supabase/functions/delete-account）。
--
--   分けた理由: (1) を service_role で書くと RLS が効かない場所に「全ユーザーの
--   行を消せる DELETE」が 21 本並ぶことになり、条件を 1 つ書き間違えた瞬間に
--   他人のデータが飛ぶ。ここを SECURITY INVOKER の関数にして呼び出し元の JWT で
--   走らせれば、RLS の `auth.uid() = user_id` が二重の歯止めになる（全 21
--   テーブルに DELETE ポリシーがあることは 2026-08-29 に pg_policies で実測）。
--   Edge Function が service_role を使うのは auth.users の 1 行だけ。
--
--   auth.users に向いた FK は 1 本も無い（実測）。つまり ON DELETE CASCADE は
--   一切効かず、public 側は明示的に消すしかない。この関数がその明示。
--
-- SCOPE: 関数 1 本の作成のみ。テーブル / 列 / ポリシーは触らない（新規テーブル
--   が無いので RLS ゲートの検査対象は増えない）。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `cd supabase && npm run db:push`。`apply_migration` MCP 単独使用は禁止
-- （本ファイルはローカルに置くだけ・エージェントは DB へ適用しない）。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。`create or replace function` なので
--   再実行安全。関数本体も 1 トランザクションで走るため、途中の 1 テーブルが
--   失敗したら全部巻き戻る（中途半端に消えたアカウントを作らない）。

begin;

create or replace function public.delete_my_account()
returns void
language plpgsql
-- SECURITY INVOKER (既定) を明示。RLS を効かせたまま走らせるのが設計の要。
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

  /*
   * 削除順は FK の向き（子 → 親）。DB-Q3 の descendants-first と同じ理屈で、
   * NO ACTION の FK は親を先に消せない。
   *
   * 1) items_meta / wiki_tags / wiki_tag_groups / routine_groups / playlists
   *    を参照している行
   */
  delete from public.wiki_tag_connections       where user_id = caller;
  delete from public.wiki_tag_assignments       where user_id = caller;
  delete from public.wiki_tag_group_assignments where user_id = caller;
  delete from public.routine_group_assignments  where user_id = caller;
  delete from public.calendars                  where user_id = caller;
  delete from public.playlist_items             where user_id = caller;

  -- 2) payload 行（items_meta への composite FK を持つ）
  delete from public.tasks_payload    where user_id = caller;
  delete from public.events_payload   where user_id = caller;
  delete from public.notes_payload    where user_id = caller;
  delete from public.dailies_payload  where user_id = caller;
  delete from public.routines_payload where user_id = caller;

  -- 3) 参照される側
  delete from public.items_meta      where user_id = caller;
  delete from public.wiki_tags       where user_id = caller;
  delete from public.wiki_tag_groups where user_id = caller;
  delete from public.routine_groups  where user_id = caller;
  delete from public.playlists       where user_id = caller;

  -- 4) 独立テーブル（FK なし）
  delete from public.timer_settings          where user_id = caller;
  delete from public.timer_sessions          where user_id = caller;
  delete from public.pomodoro_presets        where user_id = caller;
  delete from public.sound_settings          where user_id = caller;
  delete from public.life_tags_migration_log where user_id = caller;

  /*
   * 取りこぼし検査。上のリストは手で並べたものなので、後から user_id を持つ
   * テーブルが増えたときに「静かに残る」のが一番まずい — 退会したのにデータが
   * 残っている状態は、外からは絶対に見えない。
   *
   * そこで public 配下の user_id を持つ全テーブルをカタログから引き直し、
   * 自分の行が 1 行でも残っていたら例外を投げる。トランザクションごと巻き戻る
   * ので、退会は「全部消えたか、何も消えていないか」のどちらかにしかならない。
   * 新テーブルを足した人はここで落ちて、上のリストへの追加を強制される。
   */
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
  'Deletes every public.* row owned by the calling user (Issue #1200). Runs as the CALLER so RLS scopes it, and raises if any user_id table still holds a row afterwards. The auth.users row is removed separately by the delete-account Edge Function.';

-- 匿名クライアントからは呼べない。ログイン済み（= JWT を持つ）だけが対象。
revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

commit;

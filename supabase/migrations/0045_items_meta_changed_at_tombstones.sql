-- items_meta.changed_at と items_meta_tombstones — 前回から変わった分だけを読む (Issue #2333)
--
-- WHY: 読み直しのたびに全件を取っていた。差分の基準に updated_at は使えない。
--   端末の時計で書かれるので（itemsMeta.ts の toItemsMetaPatch）、時計が遅れた
--   端末の書き込みが基準より過去になり、取りこぼす。そこでサーバーの時計だけで
--   動く列と、物理削除の記録を足す（計画書 2026-10-21-offline-cache.md）。
--
-- WHAT:
--   - items_meta.changed_at。BEFORE INSERT OR UPDATE のトリガーが
--     clock_timestamp() を書くので、クライアントの値は上書きされる。
--     updated_at には触れない（LWW と版の比較 #607 / #2057 を変えないため）。
--     既存の行は列の既定値 now() で埋まり、push の時刻で揃う。既定値を
--     clock_timestamp() にしないのは、volatile な既定値だと add column が表を
--     書き直すため。now() は stable なので書き直さない。以後の書き込みでは
--     トリガーが clock_timestamp() を書く。
--   - items_meta_tombstones。物理削除された行の id / role / 時刻だけを持つ。
--     同じ id の 2 回目の削除は行を上書きする。user_id と role も書き直すのは、
--     同じ id が別の role で作り直されたあとの削除でも、持ち主の RLS で正しく
--     読めるようにするため。
--   - delete_my_account() の作り直し（下の「退会」）。
--
-- 権限: 記録のトリガー関数は SECURITY DEFINER + search_path=''。INSERT の
--   ポリシーを持たない表に書くため。MCP サーバーやスクリプトがどのロールで
--   消しても記録が残る。書く値はすべて old の行から取り、引数も動的 SQL も
--   持たない。changed_at のトリガーは表の外に触らないので SECURITY INVOKER。
--
-- RLS: 持ち主の select と delete。select は差分の読み出しのため。delete は
--   INVOKER で走る delete_my_account() が消すためで、計画書の「select だけ」
--   から足した。消せるのは自分の記録だけで、消しても次の全件読み出しで揃う。
--
-- 退会: auth.users へ向かう FK は public に 1 本も無く（0025 の実測）、
--   カスケードで消えることは無い。tombstones にも FK を付けない。将来
--   items_meta にカスケードが付いても、消えていく行を参照する FK が
--   トリガーの INSERT を落とさないようにするため。
--   退会の実体は delete_my_account() で、items_meta を消した時点で記録の
--   トリガーが自分の行を tombstones に書く。最後の取りこぼし検査は user_id を
--   持つ全表を見るので、ここで消さないと退会が必ず失敗する。よって items_meta
--   の直後に tombstones を消し、退会後に記録は残らない。
--
-- 採らなかった案:
--   (a) トリガーで updated_at をサーバーの時計にする。楽観更新と版の比較の
--       前提が全部変わる。
--   (b) payload 表にも changed_at を進めるトリガーを足す。payload だけの書き
--       込みを取りこぼさなくなるが、items_meta の Realtime が 1 書き込みごとに
--       増える。計画に無いので今回は足さず、全件読み出しの安全網で回収する。
--
-- SCOPE: 列 1 本・表 1 枚・トリガー 2 本・関数 3 本。publication は変えない
--   （tombstones は購読しない。items_meta の変更通知は今のまま）。古い記録の
--   掃除は、行が小さいので当面しない。書き出しファイルにも載せない（同期の
--   帳簿であり、持ち出すデータではない）。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `cd supabase && npm run db:push`。`apply_migration` MCP 単独使用は禁止
-- （本ファイルはローカルに置くだけ・エージェントは DB へ適用しない）。
-- PR の merge は db push のあと。先に merge しても全件読み出しが changed_at を
-- 選ばないので一覧は壊れず、クライアントは全件の取得で動き続ける。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。if not exists / drop … if exists /
--   create or replace なので再実行安全。

begin;

alter table public.items_meta
  add column if not exists changed_at timestamptz not null default now();

create index if not exists idx_items_meta_user_changed_at
  on public.items_meta (user_id, changed_at);

create or replace function public.items_meta_stamp_changed_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.changed_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists trg_items_meta_changed_at on public.items_meta;
create trigger trg_items_meta_changed_at
  before insert or update on public.items_meta
  for each row execute function public.items_meta_stamp_changed_at();

create table if not exists public.items_meta_tombstones (
  id         text        primary key,
  user_id    uuid        not null,
  role       text        not null,
  deleted_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_items_meta_tombstones_user_deleted_at
  on public.items_meta_tombstones (user_id, deleted_at);

alter table public.items_meta_tombstones enable row level security;

drop policy if exists items_meta_tombstones_select_own on public.items_meta_tombstones;
create policy items_meta_tombstones_select_own
  on public.items_meta_tombstones
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists items_meta_tombstones_delete_own on public.items_meta_tombstones;
create policy items_meta_tombstones_delete_own
  on public.items_meta_tombstones
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.items_meta_record_tombstone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.items_meta_tombstones (id, user_id, role)
  values (old.id, old.user_id, old.role)
  on conflict (id) do update
    set user_id = excluded.user_id,
        role = excluded.role,
        deleted_at = excluded.deleted_at;
  return old;
end;
$$;

revoke all on function public.items_meta_stamp_changed_at() from public, anon, authenticated;
revoke all on function public.items_meta_record_tombstone() from public, anon, authenticated;

drop trigger if exists trg_items_meta_record_tombstone on public.items_meta;
create trigger trg_items_meta_record_tombstone
  after delete on public.items_meta
  for each row execute function public.items_meta_record_tombstone();

-- 本体は 0041 と同じ。変わるのは items_meta の直後に tombstones を消すことだけ。
-- （userDataExport.test.ts は最新の定義の本文から消す対象を正規表現で拾う。）
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
  delete from public.goal_todo_links            where user_id = caller;
  delete from public.playlist_items             where user_id = caller;

  -- 2) payload 行（items_meta への FK を持つ）
  delete from public.tasks_payload    where user_id = caller;
  delete from public.events_payload   where user_id = caller;
  delete from public.notes_payload    where user_id = caller;
  delete from public.dailies_payload  where user_id = caller;
  delete from public.routines_payload where user_id = caller;
  delete from public.goals_payload    where user_id = caller;
  delete from public.tables_payload   where user_id = caller;

  -- 3) 参照される側
  delete from public.items_meta      where user_id = caller;
  -- 上の行で記録のトリガーが書いた分。items_meta より先には消せない。
  delete from public.items_meta_tombstones where user_id = caller;
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
  delete from public.ai_rules                where user_id = caller;
  delete from public.ai_memories             where user_id = caller;
  delete from public.ai_skills               where user_id = caller;
  delete from public.app_records             where user_id = caller;
  delete from public.extension_apps          where user_id = caller;
  delete from public.record_views            where user_id = caller;

  /*
   * 取りこぼし検査（0025 と同じ）。public 配下の user_id を持つ全テーブルを
   * カタログから引き直し、自分の行が 1 行でも残っていたら例外を投げる。
   * トランザクションごと巻き戻るので、退会は「全部消えたか、何も消えて
   * いないか」のどちらかにしかならない。
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
  'Deletes every public.* row owned by the calling user (Issue #1200; goals tables added and the dropped calendars line removed in #2101; ai_rules / ai_memories / ai_skills added in #2118; app_records / extension_apps added in #2161; tables_payload added in #2094; record_views added in #2260; items_meta_tombstones added in #2333). Runs as the CALLER so RLS scopes it, and raises if any user_id table still holds a row afterwards. The auth.users row is removed separately by the delete-account Edge Function.';

-- create or replace は権限を引き継ぐが、0025 と同じ状態を明示しておく。
revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (push の後に流す。期待値つき):
-- ===========================================================================
-- A. 列の既定値が stable で、トリガーが 2 本ある
--    select column_default from information_schema.columns
--     where table_schema = 'public' and table_name = 'items_meta'
--       and column_name = 'changed_at';
--    -- expect: now()
--    select tgname from pg_trigger
--     where tgrelid = 'public.items_meta'::regclass
--       and tgname in ('trg_items_meta_changed_at', 'trg_items_meta_record_tombstone')
--     order by tgname;
--    -- expect: 2 rows
--
-- B. 削除記録の表のポリシー（持ち主の select と delete の 2 本。insert / update
--    は無い。書くのは SECURITY DEFINER のトリガーだけ）
--    select policyname, cmd, qual like '%( SELECT auth.uid()%' as initplan
--      from pg_policies
--     where schemaname = 'public' and tablename = 'items_meta_tombstones'
--     order by policyname;
--    -- expect: 2 rows
--    --   items_meta_tombstones_delete_own | DELETE | true
--    --   items_meta_tombstones_select_own | SELECT | true
--
-- C. updated_at を書かない更新で changed_at だけが進み、authenticated が消すと
--    記録が残り、他人には見えない。SQL Editor は postgres ロールで動くので、
--    0041 の E と同じく authenticated に切り替えた 1 つの DO ブロックにまとめ、
--    結果を詰めた例外で全体を巻き戻す（rollback は不要。A / B は実在しない
--    uuid でよい — items_meta に auth.users への FK は無い）。トランザクションの
--    中でも clock_timestamp() は進むので、同じブロックで比べられる。
--    do $$
--    declare
--      c0 timestamptz; c1 timestamptz; u0 timestamptz; u1 timestamptz;
--      own bigint; other bigint;
--    begin
--      set local role authenticated;
--      perform set_config('request.jwt.claims',
--        '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
--      insert into public.items_meta (id, role, title)
--        values ('task-tombstone-check', 'task', 'check');
--      select changed_at, updated_at into c0, u0
--        from public.items_meta where id = 'task-tombstone-check';
--      update public.items_meta set title = 'check 2'
--        where id = 'task-tombstone-check';
--      select changed_at, updated_at into c1, u1
--        from public.items_meta where id = 'task-tombstone-check';
--      delete from public.items_meta where id = 'task-tombstone-check';
--      select count(*) into own from public.items_meta_tombstones
--        where id = 'task-tombstone-check';
--      perform set_config('request.jwt.claims',
--        '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
--      select count(*) into other from public.items_meta_tombstones
--        where id = 'task-tombstone-check';
--      raise exception 'tombstone check (rolled back): moved=% kept=% own=% other=%',
--        c1 > c0, u1 = u0, own, other;
--    end $$;
--    -- expect: ERROR P0001: tombstone check (rolled back): moved=t kept=t own=1 other=0
--
-- D. 退会の関数が新しい本体になっている
--    select prosrc like '%items_meta_tombstones%' from pg_proc
--     where proname = 'delete_my_account';
--    -- expect: true

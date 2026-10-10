-- app_records / extension_apps — 拡張アプリが上げる数値の記録と、拡張アプリの台帳
-- (Issue #2161, plan 2026-10-08-extension-app-records-and-apps-section.md Step 2,
-- D-20261008-main-1)
--
-- WHY: 拡張アプリ（家計簿・体重・睡眠など）が「いつ・何を・いくつ」を送ってくる
--   先と、どの拡張アプリがあるかの一覧を持つ。読む側（Analytics の「記録」タブ、
--   Apps セクション、MCP の record 系の道具）は後続の Issue（#2162〜）で作る。
--
--   2 表とも 0018 の timer / audio、0037 の ai_* と同じ「独立した表 + 各表が自分の
--   updated_at を持つ」形にした（D-20261008-main-1 Q2）。理由:
--     - Todo / ノートのような項目ではない。階層も、タグ / リンクも、ゴミ箱も
--       持たないので、items_meta + payload の 2 行分割と複合 FK は何も守らない。
--     - 記録は追記が中心で件数が多い。items_meta に混ぜると、項目の一覧と同期の
--       cursor（CLAUDE.md §3.3）に記録の行が入り込む。
--
-- ソフトデリートは持たない（物理削除）。ソフトデリートは TrashView から戻すため
--   の仕組みで（CLAUDE.md §4）、どちらもゴミ箱に出さない。
--
-- app_records.source_app は extension_apps への FK にしない。値は
--   extension_apps.slug か予約語 'claude'（こうだいさんの MCP からの記録）で、
--   'claude' は台帳に行が無い。台帳に登録する前に記録だけ届くこともある
--   （Apps の「記録だけ届いているアプリ」= #2165）。台帳の行を消しても記録は残す。
--
-- 重複防止（D-20261007-main-6 と同じ決まり）: 拡張アプリは「少なくとも 1 回送る」
--   ので、同じ external_id の再送を部分 UNIQUE で 1 行に保つ。external_id が無い
--   記録（MCP から手で入れたもの）は何件でも入る。中身が違う再送を断るのは
--   ハンドラの仕事（#2163）。
--
-- dims は jsonb object であることだけを DB で検査する。値の型とキーの数（20 個
--   まで）は MCP のハンドラが検査する（計画書 §設計 データ）。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
--
-- ⚠️ MERGE ORDER: shared の USER_DATA_EXPORT_TABLES が同じ PR で 2 表を読む
-- ようになる。本番に表が無い状態でコードだけ入ると「データを書き出す」が
-- 存在しない表を引いて失敗する。**push が merge より先**であること（0034 /
-- 0037 と同じ）。
--
-- ⚠️ delete_my_account() の本体の最新はこのファイル。#2094（materials・
-- 計画書 2026-10-10-note-table-items.md）も同じ関数を create or replace する。
-- そちらは 0039 より後の番号を使い、この本体（app_records / extension_apps の
-- 2 行を含む）を元にすること。0039 より前の番号で後から push すると、
-- db-push.sh は --include-all で流すので、DB に残る関数から 2 表が抜け、
-- 記録を持つ人の退会が最後の取りこぼし検査で必ず失敗する。
--
-- ロールバックは supabase/migrations_archive_rollback/0039_rollback.sql
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。再実行安全:
--   表と索引は if not exists / ポリシーは drop if exists → create /
--   publication は pg_publication_tables で確認してから足す / 関数は
--   create or replace。

begin;

-- ===========================================================================
-- 1. app_records  (text id = `record-<timestamp+counter>` — 1 件の記録 = 1 行)
-- ===========================================================================
-- id は generateId("record") の形（CLAUDE.md §4 の「他 generateId(prefix)」）。
create table if not exists public.app_records (
  id          text        primary key,
  user_id     uuid        not null default auth.uid(),
  source_app  text        not null,
  external_id text,
  kind        text        not null,
  occurred_at timestamptz not null,
  value       numeric     not null,
  unit        text,
  dims        jsonb       not null default '{}'::jsonb,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- 記録の種類（expense / weight / sleep …）。語彙はアプリが決め、life-editor は
  -- 形だけを見る。
  constraint app_records_kind_shape
    check (kind ~ '^[a-z][a-z0-9_]{0,31}$'),
  constraint app_records_dims_is_object
    check (jsonb_typeof(dims) = 'object')
);

-- 期間で並べて読む（Analytics の一覧と期間別の集計）。
create index if not exists idx_app_records_user_occurred
  on public.app_records (user_id, occurred_at desc);

-- アプリで絞る（Apps の「最後の記録」「30 日の件数」と記録タブの絞り込み）。
-- 下の部分 UNIQUE は external_id がある行しか持たないので、こちらは別に要る。
create index if not exists idx_app_records_user_source
  on public.app_records (user_id, source_app);

-- 種類で絞る（記録タブの絞り込み）。
create index if not exists idx_app_records_user_kind
  on public.app_records (user_id, kind);

-- 同じアプリの同じ external_id は 1 人につき 1 行（重複防止のキー）。
create unique index if not exists uq_app_records_external_id
  on public.app_records (user_id, source_app, external_id)
  where external_id is not null;

alter table public.app_records enable row level security;

drop policy if exists app_records_select_own on public.app_records;
create policy app_records_select_own
  on public.app_records
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists app_records_insert_own on public.app_records;
create policy app_records_insert_own
  on public.app_records
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists app_records_update_own on public.app_records;
create policy app_records_update_own
  on public.app_records
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists app_records_delete_own on public.app_records;
create policy app_records_delete_own
  on public.app_records
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 2. extension_apps  (主キー = (user_id, slug) — 拡張アプリ 1 つ = 1 行)
-- ===========================================================================
-- slug は app_records.source_app と、窓口の鍵が指すアプリの id（#2146）になる。
-- 「最後の記録」と「30 日の件数」は保存せず、app_records から数える。
-- user_id 単独の索引は作らない（主キーの索引の先頭列と重なる）。
create table if not exists public.extension_apps (
  slug        text        not null,
  user_id     uuid        not null default auth.uid(),
  name        text        not null,
  url         text,
  icon        text,
  description text,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, slug),
  constraint extension_apps_slug_shape
    check (slug ~ '^[a-z][a-z0-9-]{1,31}$')
);

alter table public.extension_apps enable row level security;

drop policy if exists extension_apps_select_own on public.extension_apps;
create policy extension_apps_select_own
  on public.extension_apps
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists extension_apps_insert_own on public.extension_apps;
create policy extension_apps_insert_own
  on public.extension_apps
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists extension_apps_update_own on public.extension_apps;
create policy extension_apps_update_own
  on public.extension_apps
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists extension_apps_delete_own on public.extension_apps;
create policy extension_apps_delete_own
  on public.extension_apps
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 3. Realtime publication
-- ===========================================================================
-- shared の REALTIME_TABLES に 2 表を足すのは #2162（同期ドメイン appRecords /
-- extensionApps と一緒に）。そのとき syncRealtimeTables.test.ts の
-- PUBLICATION_MIGRATIONS に本ファイルを足すと、この下の配列が読まれる
-- （ファイルの中で最初の配列リテラルであること）。
do $$
declare
  t text;
  tables text[] := array[
    'app_records',
    'extension_apps'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I', t
      );
    end if;
  end loop;
end;
$$;

-- ===========================================================================
-- 4. delete_my_account() を作り直す
-- ===========================================================================
-- 0025 / 0034 / 0037 の関数は「user_id を持つ表に自分の行が残っていたら例外」を
-- 最後に検査するので、新しい 2 表を消す対象に足さないと退会が必ず失敗する。
-- shared/tests/userDataExport.test.ts も最新の定義の消す対象と書き出しの
-- 表の一覧を突き合わせる。
-- （userDataExport.test.ts は最新の定義の本文から消す対象を正規表現で拾う
-- ので、このコメントには DELETE 文の形を書かない。）
--
-- 本体は 0037 と同じ（SECURITY INVOKER・子 → 親の順・取りこぼし検査）。
-- 変わるのは「4) 独立テーブル」に 2 表を足したことだけ。2 表のあいだに FK は
-- 無いので順番は問わない。
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
  delete from public.ai_rules                where user_id = caller;
  delete from public.ai_memories             where user_id = caller;
  delete from public.ai_skills               where user_id = caller;
  delete from public.app_records             where user_id = caller;
  delete from public.extension_apps          where user_id = caller;

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
  'Deletes every public.* row owned by the calling user (Issue #1200; goals tables added and the dropped calendars line removed in #2101; ai_rules / ai_memories / ai_skills added in #2118; app_records / extension_apps added in #2161). Runs as the CALLER so RLS scopes it, and raises if any user_id table still holds a row afterwards. The auth.users row is removed separately by the delete-account Edge Function.';

-- create or replace は権限を引き継ぐが、0025 と同じ状態を明示しておく。
revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (push の後に流す。期待値つき):
-- ===========================================================================
-- A. 2 表がある
--    select table_name from information_schema.tables
--    where table_schema = 'public'
--      and table_name in ('app_records', 'extension_apps');
--    -- expect: 2 rows
--
-- B. Realtime に入っている
--    select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime'
--      and tablename in ('app_records', 'extension_apps');
--    -- expect: 2 rows
--
-- C. RLS ゲート
--    cd supabase && npm run db:check-rls
--    -- expect: offenders = 0
--
-- D. ポリシーが 4 本ずつ、initplan 形式のまま（check-rls は形の漏れしか見ない
--    ので別に確認）
--    select tablename, count(*) as policies,
--           bool_and(coalesce(qual, with_check) like '%( SELECT auth.uid()%') as initplan
--      from pg_policies
--     where schemaname = 'public'
--       and tablename in ('app_records', 'extension_apps')
--     group by tablename;
--    -- expect: 2 rows, policies = 4, initplan = true
--
-- E. 退会の関数が 2 表を消す
--    select pg_get_functiondef('public.delete_my_account()'::regprocedure)
--           ~ 'app_records' and
--           pg_get_functiondef('public.delete_my_account()'::regprocedure)
--           ~ 'extension_apps' as covers_both;
--    -- expect: covers_both = true
--
-- F. 制約と索引がそろっている（読み取りだけ）
--    select conrelid::regclass, conname
--      from pg_constraint
--     where conrelid in ('public.app_records'::regclass,
--                        'public.extension_apps'::regclass)
--       and contype in ('c', 'p')
--     order by 1, 2;
--    -- expect: 5 rows（app_records = CHECK 2 + PK 1 / extension_apps = CHECK 1 + PK 1）
--    select indexname from pg_indexes
--     where schemaname = 'public' and tablename = 'app_records'
--     order by 1;
--    -- expect: 5 rows（app_records_pkey + idx_* 3 本 + uq_app_records_external_id）
--
-- G. 本人以外を弾き、重複防止のキーが効く。SQL Editor は最後の文の結果しか
--    出さないので、1 つの DO ブロックにまとめ、結果を詰めた例外で全体を巻き戻す
--    （rollback は不要。A / B は実在しない uuid でよい — FK は無い）。
--    do $$
--    declare r bigint; a bigint; u bigint; d bigint; dup text := 'none';
--    begin
--      set local role authenticated;
--      perform set_config('request.jwt.claims',
--        '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
--      insert into public.extension_apps (slug, name) values ('rls-check', 'A のアプリ');
--      insert into public.app_records (id, source_app, external_id, kind, occurred_at, value)
--        values ('record-rls-a', 'rls-check', 'ext-1', 'expense', now(), 450);
--      begin
--        insert into public.app_records (id, source_app, external_id, kind, occurred_at, value)
--          values ('record-rls-a2', 'rls-check', 'ext-1', 'expense', now(), 450);
--      exception when unique_violation then dup := 'blocked';  -- 23505 なら期待どおり
--      end;
--      perform set_config('request.jwt.claims',
--        '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
--      select count(*) into r from public.app_records;
--      select count(*) into a from public.extension_apps;
--      update public.app_records set value = 0 where id = 'record-rls-a';
--      get diagnostics u = row_count;
--      delete from extension_apps where slug = 'rls-check';  -- public. を付けない（下の注）
--      get diagnostics d = row_count;
--      begin
--        insert into public.app_records (id, user_id, source_app, kind, occurred_at, value)
--          values ('record-rls-b', '00000000-0000-0000-0000-00000000000a',
--                  'rls-check', 'expense', now(), 1);
--        raise exception 'RLS NG: impersonating insert was accepted';
--      exception when insufficient_privilege then null;  -- 42501 なら期待どおり
--      end;
--      raise exception 'RLS check (rolled back): r=% a=% u=% d=% dup=%', r, a, u, d, dup;
--    end $$;
--    -- expect: ERROR P0001: RLS check (rolled back): r=0 a=0 u=0 d=0 dup=blocked
--    （注: userDataExport.test.ts は削除一覧を正規表現で拾うので、このファイルの
--    コメントには「public. 付きの DELETE 文」を書かない。）
--
-- H. local と remote の差分が無い
--    supabase db diff
--    -- expect: 差分 0

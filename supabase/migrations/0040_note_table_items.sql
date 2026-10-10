-- Note tables as tag-able items — role `table` + tables_payload (Issue #2094)
--
-- WHY: ノート本文の中の表にタグを付けられるようにする（D-20260927-materials-1
--   = A / 計画書 .claude/docs/vision/plans/2026-10-10-note-table-items.md）。
--   タグの割り当て（wiki_tag_assignments）は items_meta.id を参照するので、
--   表を新しい role `table` の items_meta 行にする。wiki_tag_assignments は
--   role を区別しないので、その表の DDL は変えない。
--
--   表のセルの正本はノート本文（TipTap の JSON）のまま。本文の表ノードが
--   `tableId` 属性でこの行を指す。payload が持つのは親のノートだけ。採らなかった案:
--     - セルの中身も payload に写す → 正本が 2 つになり、片方の書き込みが
--       落ちたときにずれる。
--     - 本文の全部の表を保存のたびにアイテムにする → タグを付けない表まで
--       行が増え、既存の表の backfill（全ノートの書き換え）も要る。
--       アイテムになるのはタグを初めて付けたときだけ（計画書 Q2）。
--     - Daily の本文の表も対象にする → 親の role が 2 通りになり、生成列で
--       固定できない。親はノートだけ（計画書 Q1）。
--
--   番号: 計画書と 2026-10-08-extension-app-records-and-apps-section.md は
--   0036 を #2094 に予約していたが、origin/main には 0037 (#2118) と 0038
--   (#2147) が先に入った。0036 を足すと「番号は 0038 より前、実際に流れる
--   のは後」という食い違いになる（素の CLI は止まり、`npm run db:push` は
--   --include-all で順番を無視して流す。どちらでも食い違う）。
--   db-conventions §13 の「新しい DDL は常に末尾の次の番号を取る」に従う。
--   0036 は欠番のまま埋めない。さらに 0039 は #2161（app_records /
--   extension_apps、PR #2190）が先に取ったので、0040 にした。
--
-- ⚠️ 0039 (#2161) が先: 下の delete_my_account() は 0039 の本体
--   （app_records / extension_apps の 2 行を含む）に tables_payload を足した
--   もの。0039 を適用する前に 0040 を流すと、存在しない表を消しにいく関数が
--   残る。push は 0039 → 0040 の順、merge も #2190 → この PR の順。
--
-- SCOPE:
--   1. items_meta.role の CHECK に 'table' を足す（0034 と同じ張り直し）。
--   2. tables_payload（新規）。名前は items_meta.title が持つ（payload に重ね
--      ない）。updated_at もソフトデリートも items_meta 側だけが持つ。
--   3. owner-only RLS（initplan 形式）と supabase_realtime への追加。
--   4. delete_my_account() を作り直す（tables_payload を消す対象に足す）。
--   backfill は無い。既存の表はタグを付けるまでアイテムにならない。
--
-- DB で守らないこと（アプリ側 = 計画書 Step 3〜4 の DataService が守る）:
--   - 本文から消えた表のアイテムのソフトデリートと、本文に戻ったときの復元。
--   - 親のノートが削除済みの表を一覧から外すこと（読むときに親を見る）。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
--
-- ⚠️ MERGE ORDER: shared の REALTIME_TABLES と USER_DATA_EXPORT_TABLES が
-- 同じ PR で tables_payload を読むようになる。本番に表が無い状態でコード
-- だけ入ると、Realtime の購読と「データを書き出す」が存在しない表を引いて
-- 失敗する。**push が merge より先**であること。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。再実行安全:
--   CHECK は「role 列だけを見る CHECK を全部落として張り直す」/ 表と索引は
--   if not exists / ポリシーは drop if exists → create / publication は
--   pg_publication_tables で確認してから足す / 関数は create or replace。

begin;

-- ===========================================================================
-- 0. 前提: items_meta(id, role) の UNIQUE（0009 が作る）。複合 FK の参照先。
-- ===========================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.items_meta'::regclass
      and conname = 'items_meta_id_role_uk'
  ) then
    raise exception
      '0040 prereq missing: items_meta_id_role_uk (created by 0009).';
  end if;
end$$;

-- ===========================================================================
-- 1. items_meta.role の CHECK に 'table' を足す
-- ===========================================================================
-- 0034 が名前付きの items_meta_role_check で張り直している。念のため 0034 と
-- 同じく role 列 1 本だけを見る CHECK を pg_constraint から全部引いて落とす。
do $$
declare
  r record;
begin
  for r in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.items_meta'::regclass
       and c.contype = 'c'
       and cardinality(c.conkey) = 1
       and c.conkey[1] = (
         select a.attnum
           from pg_attribute a
          where a.attrelid = 'public.items_meta'::regclass
            and a.attname = 'role'
       )
  loop
    execute format(
      'alter table public.items_meta drop constraint %I', r.conname
    );
  end loop;
end$$;

alter table public.items_meta
  add constraint items_meta_role_check
    check (role in ('task','event','routine','note','daily','goal','table'));

-- ===========================================================================
-- 2. tables_payload  (role=table)
-- ===========================================================================
-- 列の意味（計画書 §設計 > データの持ち方）:
--   parent_note_id    表が入っているノート。parent_note_role は 'note' 固定の
--                     生成列で、複合 FK が「親はノートだけ」を DB で保証する
--                     （0009 / 0034 と同じ形）。ON DELETE NO ACTION = 物理削除は
--                     子から先に（DB-Q3 descendants-first。生成列があるので
--                     SET NULL は使えない）。ノートのソフトデリートは行を
--                     消さないので、この FK には触れない。
create table if not exists public.tables_payload (
  item_id          text        primary key
                               references public.items_meta(id) on delete cascade,
  user_id          uuid        not null default auth.uid(),
  parent_note_id   text        not null,
  parent_note_role text        generated always as ('note') stored,
  constraint tables_payload_parent_fk
    foreign key (parent_note_id, parent_note_role)
    references public.items_meta (id, role)
    match simple
    on delete no action
);

create index if not exists idx_tables_payload_user
  on public.tables_payload (user_id);
create index if not exists idx_tables_payload_parent_role
  on public.tables_payload (parent_note_id, parent_note_role);

alter table public.tables_payload enable row level security;

drop policy if exists tables_payload_select_own on public.tables_payload;
create policy tables_payload_select_own
  on public.tables_payload
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- insert / update: 自分の行で、item_id と親のノートの items_meta も自分のもの
-- （0014 / 0034 と同じ二重防衛。他人のノートを親に置けないようにする）。
drop policy if exists tables_payload_insert_own on public.tables_payload;
create policy tables_payload_insert_own
  on public.tables_payload
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = tables_payload.item_id
        and items_meta.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.items_meta
      where items_meta.id = tables_payload.parent_note_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists tables_payload_update_own on public.tables_payload;
create policy tables_payload_update_own
  on public.tables_payload
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = tables_payload.item_id
        and items_meta.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.items_meta
      where items_meta.id = tables_payload.parent_note_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists tables_payload_delete_own on public.tables_payload;
create policy tables_payload_delete_own
  on public.tables_payload
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 3. Realtime publication
-- ===========================================================================
-- shared の REALTIME_TABLES と同じ集合に保つ（syncRealtimeTables.test.ts が
-- この下の配列を読む。ファイルの中で最初の配列リテラルであること）。
do $$
declare
  t text;
  tables text[] := array[
    'tables_payload'
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
-- 0039 の関数は「user_id を持つ表に自分の行が残っていたら例外」を最後に
-- 検査するので、tables_payload を消す対象に足さないと退会が必ず失敗する。
-- shared/tests/userDataExport.test.ts も最新の定義の消す対象と書き出しの
-- 表の一覧を突き合わせる。
-- （userDataExport.test.ts は最新の定義の本文から消す対象を正規表現で拾う
-- ので、このコメントには DELETE 文の形を書かない。）
--
-- 本体は 0039 と同じ（SECURITY INVOKER・子 → 親の順・取りこぼし検査）。
-- 変わるのは「2) payload 行」に tables_payload を足したことだけ。表の
-- アイテムの payload は親のノートの items_meta を複合 FK（NO ACTION）で
-- 指すので、items_meta より先に消す。
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
  'Deletes every public.* row owned by the calling user (Issue #1200; goals tables added and the dropped calendars line removed in #2101; ai_rules / ai_memories / ai_skills added in #2118; app_records / extension_apps added in #2161; tables_payload added in #2094). Runs as the CALLER so RLS scopes it, and raises if any user_id table still holds a row afterwards. The auth.users row is removed separately by the delete-account Edge Function.';

-- create or replace は権限を引き継ぐが、0025 と同じ状態を明示しておく。
revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (push の後に流す。期待値つき):
-- ===========================================================================
-- A. role の CHECK に table が入っている
--    select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.items_meta'::regclass and contype = 'c';
--    -- expect: items_meta_role_check ... 'table' を含む。role を見る CHECK は 1 本だけ
--
-- B. 表がある
--    select table_name from information_schema.tables
--    where table_schema = 'public' and table_name = 'tables_payload';
--    -- expect: 1 row
--
-- C. Realtime に入っている
--    select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' and tablename = 'tables_payload';
--    -- expect: 1 row
--
-- D. RLS ゲート
--    cd supabase && npm run db:check-rls
--    -- expect: offenders = 0
--
-- E. ポリシーが initplan 形式のまま（check-rls は形の漏れしか見ないので別に確認）
--    select tablename, count(*) as policies,
--           bool_and(coalesce(qual, with_check) like '%( SELECT auth.uid()%') as initplan
--      from pg_policies
--     where schemaname = 'public' and tablename = 'tables_payload'
--     group by tablename;
--    -- expect: 1 row, policies = 4, initplan = true
--
-- F. 親にノート以外を置くと断られる（複合 FK が守ること）
--    insert into items_meta (id, role, title) values ('task-F-parent', 'task', 'F');
--    insert into items_meta (id, role, title) values ('table-F-child', 'table', '');
--    insert into tables_payload (item_id, parent_note_id)
--      values ('table-F-child', 'task-F-parent');
--    -- expect: ERROR (FK violation: parent_note_role='note' but
--    --         items_meta.role='task' for task-F-parent)
--    -- 後始末は items_meta の 2 行を id で消す（親から先でよい。payload 行は
--    -- 作られていない）。
--
-- G. 孤児が無い（db-conventions §10.5）
--    select count(*) from items_meta m
--     where m.role = 'table'
--       and not exists (select 1 from tables_payload p where p.item_id = m.id);
--    -- expect: 0

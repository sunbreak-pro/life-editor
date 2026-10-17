-- How each kind of record is shown — record_views (Issue #2260)
--
-- WHY: 体重のように「その時点の値」を残す記録では、合計が意味を持たない
--   （#2212 の実ブラウザ確認で、Mobile の記録ブロックが体重 2 件を足した
--   124.5 kg を出していた）。そこで記録の種類ごとに、値の出し方（合計 /
--   平均 / 最新 / 件数）とグラフの形（棒 / 折れ線）を選べるようにする
--   （計画書 .claude/docs/vision/plans/2026-10-12-records-aggregation-views.md・
--   承認 = D-20261017-main-1）。選んだ内容は端末ではなく DB に置く。公開 Web
--   URL が主導線なので（CLAUDE.md §2）、Desktop と Mobile で揃わないと
--   「選んだのに戻っている」と見えるため。採らなかった案:
--     - この端末の localStorage → 端末ごとに選択がずれる（計画書 案 A の A）。
--     - extension_apps に JSON 列 → 台帳に行がない `claude`（MCP から入れた
--       記録）と「記録だけ届いているアプリ」の種類は置き場がない（同 C）。
--
--   形: 独立した表で、自分の updated_at を持つ（0018 の timer_settings、
--   0037 の ai_* と同じ。D-20261008-main-1 Q2）。items_meta には混ぜない。
--   ソフトデリートは持たない（ゴミ箱に入るものではない）。
--
--   キー = 1 人の中で (kind, unit)。unit なしは空文字にする。主キー・UNIQUE に
--   null を入れると「null 同士は別物」になり、同じ種類の行が何本でも入るため。
--   記録タブの recentKindTotals も、単位が変わった種類を 2 行に分けている。
--
--   主キーは乱数の id にし、(user_id, kind, unit) は UNIQUE にする。Issue の
--   本文は primary key (user_id, kind, unit) だが、次の 2 つのためにこの形を
--   採った（引き当てのキーとしての意味は変わらない。upsert の onConflict は
--   この UNIQUE を指す）:
--     1. Realtime は DELETE の通知だけは RLS で絞らず、主キーの列を付けて
--        購読者全員に送る。主キーに user_id と kind を入れると、退会で行が
--        消えたとき、その人の uuid と記録の種類（weight など）が他人の画面に
--        届く。0037 の ai_rules が乱数の id を持つのと同じ理由。
--     2. 「データを書き出す」（userDataExport.ts）はページ送りを 1 列の
--        並び順で安定させる。kind だけでは単位違いの行が並び順で同点になる。
--
--   kind の形は app_records と同じ CHECK（0039）。値は 2 つとも CHECK で
--   語彙を閉じる。初期値は sum / bar（計画書 案 C = 今の動きと同じ）。行が
--   無い種類も同じ初期値で出す — 読み出しで行を作らない（#499）。
--
-- SCOPE:
--   1. record_views（新規）と owner-only RLS 4 本（initplan 形式）。
--   2. supabase_realtime への追加（Desktop と Mobile で選択を揃えるため）。
--   3. delete_my_account() を作り直す（record_views を消す対象に足す）。
--   backfill は無い。既存の種類は行が無いまま初期値で出る。
--
-- ⚠️ 本体の出どころ: 下の delete_my_account() は、着手時の origin/main で
--   最新の定義である 0040 の本体に record_views を足したもの。0040 より古い
--   本体から作ると app_records / extension_apps / tables_payload が退会の
--   対象から抜け、取りこぼし検査で退会が必ず失敗する。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
--
-- ⚠️ MERGE ORDER: shared の REALTIME_TABLES と USER_DATA_EXPORT_TABLES が
-- 同じ PR で record_views を読むようになる。本番に表が無い状態でコード
-- だけ入ると、Realtime の購読と「データを書き出す」が存在しない表を引いて
-- 失敗する（0039 と同じ）。**push が merge より先**であること。
--
-- ROLLBACK: このファイルは編集しない。戻すときは別ファイルの逆向き
-- migration（publication から外す → 表を drop → delete_my_account() を 0040
-- の本体で作り直す）を足す。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。再実行安全:
--   表は if not exists / ポリシーは drop if exists → create / publication は
--   pg_publication_tables で確認してから足す / 関数は create or replace。

begin;

-- ===========================================================================
-- 1. record_views  (1 人の中で kind + unit ごとに 1 行)
-- ===========================================================================
create table if not exists public.record_views (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid(),
  kind       text        not null,
  -- 単位なしの記録は空文字（UNIQUE に null を入れないため。上の WHY）。
  unit       text        not null default '',
  metric     text        not null default 'sum',
  chart      text        not null default 'bar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint record_views_kind_shape
    check (kind ~ '^[a-z][a-z0-9_]{0,31}$'),
  constraint record_views_metric_check
    check (metric in ('sum', 'avg', 'latest', 'count')),
  constraint record_views_chart_check
    check (chart in ('bar', 'line')),
  constraint record_views_user_kind_unit_uk unique (user_id, kind, unit)
);

-- user_id 単独の索引は作らない（UNIQUE (user_id, kind, unit) の索引の先頭列と
-- 重なる）。

alter table public.record_views enable row level security;

drop policy if exists record_views_select_own on public.record_views;
create policy record_views_select_own
  on public.record_views
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists record_views_insert_own on public.record_views;
create policy record_views_insert_own
  on public.record_views
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists record_views_update_own on public.record_views;
create policy record_views_update_own
  on public.record_views
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists record_views_delete_own on public.record_views;
create policy record_views_delete_own
  on public.record_views
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 2. Realtime publication
-- ===========================================================================
-- shared の REALTIME_TABLES と同じ集合に保つ（syncRealtimeTables.test.ts が
-- この下の配列を読む。ファイルの中で最初の配列リテラルであること）。
do $$
declare
  t text;
  tables text[] := array[
    'record_views'
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
-- 3. delete_my_account() を作り直す
-- ===========================================================================
-- 0040 の関数は「user_id を持つ表に自分の行が残っていたら例外」を最後に
-- 検査するので、record_views を消す対象に足さないと退会が必ず失敗する。
-- shared/tests/userDataExport.test.ts も最新の定義の消す対象と書き出しの
-- 表の一覧を突き合わせる。
-- （userDataExport.test.ts は最新の定義の本文から消す対象を正規表現で拾う
-- ので、このコメントには DELETE 文の形を書かない。）
--
-- 本体は 0040 と同じ（SECURITY INVOKER・子 → 親の順・取りこぼし検査）。
-- 変わるのは「4) 独立テーブル」に record_views を足したことだけ。FK を
-- 持たないので、どこで消しても順番の制約は無い。
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
  'Deletes every public.* row owned by the calling user (Issue #1200; goals tables added and the dropped calendars line removed in #2101; ai_rules / ai_memories / ai_skills added in #2118; app_records / extension_apps added in #2161; tables_payload added in #2094; record_views added in #2260). Runs as the CALLER so RLS scopes it, and raises if any user_id table still holds a row afterwards. The auth.users row is removed separately by the delete-account Edge Function.';

-- create or replace は権限を引き継ぐが、0025 と同じ状態を明示しておく。
revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (push の後に流す。期待値つき):
-- ===========================================================================
-- A. 表がある
--    select table_name from information_schema.tables
--    where table_schema = 'public' and table_name = 'record_views';
--    -- expect: 1 row
--
-- B. Realtime に入っている
--    select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' and tablename = 'record_views';
--    -- expect: 1 row
--
-- C. RLS ゲート
--    cd supabase && npm run db:check-rls
--    -- expect: offenders = 0
--
-- D. ポリシーが initplan 形式のまま（check-rls は形の漏れしか見ないので別に確認）
--    select tablename, count(*) as policies,
--           bool_and(coalesce(qual, with_check) like '%( SELECT auth.uid()%') as initplan
--      from pg_policies
--     where schemaname = 'public' and tablename = 'record_views'
--     group by tablename;
--    -- expect: 1 row, policies = 4, initplan = true
--
-- E. 本人以外を弾き、UNIQUE と語彙の CHECK が効く。SQL Editor は postgres
--    ロールで動き auth.uid() が null になる（user_id の既定値も null になり、
--    23505 / 23514 より先に 23502 で落ちる）ので、0039 の G と同じく
--    authenticated に切り替えた 1 つの DO ブロックにまとめ、結果を詰めた例外で
--    全体を巻き戻す（rollback は不要。A / B は実在しない uuid でよい）。
--    do $$
--    declare r bigint; u bigint; dup text := 'none'; bad text := 'none';
--    begin
--      set local role authenticated;
--      perform set_config('request.jwt.claims',
--        '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
--      insert into public.record_views (kind, unit) values ('weight', 'kg');
--      begin
--        insert into public.record_views (kind, unit) values ('weight', 'kg');
--      exception when unique_violation then dup := 'blocked';  -- 23505 なら期待どおり
--      end;
--      begin
--        insert into public.record_views (kind, metric) values ('sleep', 'median');
--      exception when check_violation then bad := 'blocked';   -- 23514 なら期待どおり
--      end;
--      perform set_config('request.jwt.claims',
--        '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
--      select count(*) into r from public.record_views;
--      update public.record_views set metric = 'avg' where kind = 'weight';
--      get diagnostics u = row_count;
--      raise exception 'RLS check (rolled back): r=% u=% dup=% bad=%', r, u, dup, bad;
--    end $$;
--    -- expect: ERROR P0001: RLS check (rolled back): r=0 u=0 dup=blocked bad=blocked
--
-- F. 退会の関数が新しい本体になっている
--    select prosrc like '%record_views%' from pg_proc
--     where proname = 'delete_my_account';
--    -- expect: true

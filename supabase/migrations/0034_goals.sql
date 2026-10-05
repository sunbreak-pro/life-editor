-- Goals linked to Todos — the data floor of the Briefing rebuild (Issue #2101)
--
-- WHY: 朝刊の目標を「書くだけ」から「Todo とつないで達成を自動で判定する」へ
--   変える（D-20260928-briefing-4 / 計画書
--   .claude/docs/vision/plans/2026-10-03-briefing-goals-redesign.md §設計 > データ）。
--   順番は「データが先・画面は後」（D-20261002-briefing-3）なので、この
--   migration は DDL だけを持ち、画面・DataService・MCP の道具は後続の Issue。
--
--   目標は新しい role `goal` の items_meta 行 + goals_payload 行（2 行分割の
--   決まりどおり）。目標 ↔ Todo は専用の goal_todo_links に持つ。採らなかった案:
--     - 予約ノート `note-goals` の本文に置いたまま → 1 行に id が無く、Todo と
--       多対多でつなげない。並び・親・期間末の判断も持てない。
--     - 既存の wiki_tag_connections に入れる → 種類を問わずつながる表なので、
--       目標のつながりがノートのリンクと同じチップとして Connect に混ざり、
--       種類の取り違えも DB で防げない。
--     - 達成を DB 側で計算して列に保存 → Todo の完了・削除・つなぎ替えのたびに
--       計算し直すトリガーが要り、LWW cursor の扱いが複雑になる。達成は
--       shared / mcp-server の純粋関数で毎回出す（#2102）。
--
--   番号: 計画書は 0032 と書いているが、origin/main で 0032
--   (update_note_content) と 0033 (routines_payload_frequency_end_date) が
--   先に使われたため 0034 にした。
--
-- SCOPE:
--   1. items_meta.role の CHECK に 'goal' を足す。0008 の CHECK は名前の無い
--      インライン制約なので、名前を推測せず pg_constraint から role 列だけを
--      見る CHECK を引いて落とし、名前付き items_meta_role_check で張り直す。
--   2. goals_payload（新規）。題は items_meta.title が持つ（payload に題を
--      重ねない）。updated_at も持たない（LWW cursor は items_meta 側だけ）。
--      ソフトデリートも items_meta.is_deleted が持つ。
--   3. goal_todo_links（新規・関係の表）。(goal_id,'goal') と (todo_id,'task')
--      を items_meta(id, role) への複合 FK にして、種類の取り違えを DB で防ぐ。
--      ソフトデリートで、生きている行だけに部分 UNIQUE。
--   4. dailies_payload に evening_published_at / evening_notes の 2 列。
--   5. 新しい 2 表に owner-only RLS（initplan 形式）と supabase_realtime への追加。
--   6. delete_my_account() を作り直す（下の §6 参照）。
--   backfill は無い。既存の行は何も変わらない（新しい列はすべて NULL）。
--
-- DB で守らないこと（アプリ側 = 後続の DataService / MCP が守る）:
--   - 親の目標は年 → 月 → 週の順だけ（行をまたぐ規則なので CHECK で書けない）。
--   - 週の period_key が日曜であること（D-20260816-briefing-1）。text → date の
--     変換は IMMUTABLE ではないので CHECK に入れない。形だけを CHECK で見る。
--   - 1 期間 3 つまでの上限。
--
-- ⚠️ 既知の連動: Todo → Event の変換（#625 SupabaseItemConversionService）は
--   items_meta.role を 'task' から 'event' に UPDATE する。goal_todo_links の
--   複合 FK は (todo_id, 'task') を指すので、その Todo を指す行が 1 行でも
--   あれば（削除済みの行も含む）role の UPDATE が FK で止まる。変換の前に
--   つながりを物理削除するか変換を断るかは、Goals の DataService を作る
--   Issue（計画書 Step 3）で決める。この migration では FK を緩めない
--   （緩めると種類の取り違えを DB で防ぐ目的が消える）。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
--
-- ⚠️ MERGE ORDER: shared の REALTIME_TABLES と USER_DATA_EXPORT_TABLES が
-- 同じ PR で goals_payload / goal_todo_links を読むようになる。本番に表が無い
-- 状態でコードだけ入ると、Realtime の購読と「データを書き出す」が存在しない
-- 表を引いて失敗する。**push が merge より先**であること。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。再実行安全:
--   CHECK は「role 列だけを見る CHECK を全部落として張り直す」なので 2 回目も
--   同じ形に戻る / 表と索引は if not exists / 列は add column if not exists /
--   ポリシーは drop if exists → create / publication は pg_publication_tables
--   で確認してから足す / 関数は create or replace。

begin;

-- ===========================================================================
-- 0. 前提: items_meta(id, role) の UNIQUE（0009 が作る）。複合 FK の参照先。
-- ===========================================================================
-- 0014 と同じく、落として作り直さずに存在だけを確かめる（他の複合 FK が
-- 依存しているので drop は 2BP01 で失敗する）。
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.items_meta'::regclass
      and conname = 'items_meta_id_role_uk'
  ) then
    raise exception
      '0034 prereq missing: items_meta_id_role_uk (created by 0009).';
  end if;
end$$;

-- ===========================================================================
-- 1. items_meta.role の CHECK に 'goal' を足す
-- ===========================================================================
-- 0008:80 の `check (role in (...))` は列のインライン制約で、名前は Postgres
-- が付けたもの（推測しない）。role 列 1 本だけを見る CHECK を pg_constraint
-- から全部引いて落とし、名前付きで張り直す。2 回目の実行では自分が張った
-- items_meta_role_check を落として同じものを張るので、結果は変わらない。
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
    check (role in ('task','event','routine','note','daily','goal'));

-- ===========================================================================
-- 2. goals_payload  (role=goal)
-- ===========================================================================
-- 列の意味（計画書 §設計 > データ）:
--   period_kind / period_key  期間の種類と鍵。year = YYYY / month = YYYY-MM /
--                             week = 週の初日（日曜）の YYYY-MM-DD。
--   sort_order                同じ期間の中の並び。
--   parent_goal_id            上の階層の目標（親は 1 つ）。parent_goal_role は
--                             'goal' 固定の生成列で、複合 FK が「親は目標だけ」を
--                             DB で保証する（0009 / 0014 と同じ形）。
--                             ON DELETE NO ACTION = 物理削除は子から先に
--                             （DB-Q3 descendants-first。生成列があるので
--                             SET NULL は使えない）。
--   manual_achieved_at        手で達成にした時刻（未接続のときだけ付く）。
--   period_end_decision       期間末のふり返りの答え。decided_at と必ず対。
--   carried_from_goal_id      持ち越した元の目標。元が物理削除されたら NULL に
--                             戻す（持ち越しの履歴が消えても今の目標は生きる）。
--                             生成列を足して複合 FK にすると SET NULL が使えず、
--                             元の目標を消せなくなるので単一列の FK にした。
--   legacy_key                note-goals から移したときの節の鍵。二重に移さない
--                             ための印で、同じ人の中で 1 つだけ（部分 UNIQUE）。
create table if not exists public.goals_payload (
  item_id              text        primary key
                                   references public.items_meta(id) on delete cascade,
  user_id              uuid        not null default auth.uid(),
  period_kind          text        not null
                                   check (period_kind in ('year','month','week')),
  period_key           text        not null,
  sort_order           integer     not null default 0,
  parent_goal_id       text,
  parent_goal_role     text        generated always as ('goal') stored,
  manual_achieved_at   timestamptz,
  period_end_decision  text        check (
                                     period_end_decision is null
                                     or period_end_decision in ('carried','dropped','achieved')
                                   ),
  decided_at           timestamptz,
  carried_from_goal_id text        references public.items_meta(id) on delete set null,
  legacy_key           text,
  constraint goals_payload_period_key_shape check (
    (period_kind = 'year'  and period_key ~ '^[0-9]{4}$')
    or (period_kind = 'month' and period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
    or (period_kind = 'week'  and period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$')
  ),
  constraint goals_payload_decision_pair check (
    (period_end_decision is null) = (decided_at is null)
  ),
  constraint goals_payload_not_own_parent check (
    parent_goal_id is null or parent_goal_id <> item_id
  ),
  constraint goals_payload_parent_fk
    foreign key (parent_goal_id, parent_goal_role)
    references public.items_meta (id, role)
    match simple
    on delete no action
);

create index if not exists idx_goals_payload_user
  on public.goals_payload (user_id);
create index if not exists idx_goals_payload_period
  on public.goals_payload (period_kind, period_key);
create index if not exists idx_goals_payload_parent_role
  on public.goals_payload (parent_goal_id, parent_goal_role);
create index if not exists idx_goals_payload_carried_from
  on public.goals_payload (carried_from_goal_id);

create unique index if not exists uq_goals_payload_legacy_key
  on public.goals_payload (user_id, legacy_key)
  where legacy_key is not null;

alter table public.goals_payload enable row level security;

drop policy if exists goals_payload_select_own on public.goals_payload;
create policy goals_payload_select_own
  on public.goals_payload
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- insert / update: 自分の行で、item_id・親・持ち越し元の items_meta もすべて
-- 自分のもの（0014 と同じ二重防衛。他人の id を参照に置けないようにする）。
drop policy if exists goals_payload_insert_own on public.goals_payload;
create policy goals_payload_insert_own
  on public.goals_payload
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = goals_payload.item_id
        and items_meta.user_id = (select auth.uid())
    )
    and (
      goals_payload.parent_goal_id is null
      or exists (
        select 1 from public.items_meta
        where items_meta.id = goals_payload.parent_goal_id
          and items_meta.user_id = (select auth.uid())
      )
    )
    and (
      goals_payload.carried_from_goal_id is null
      or exists (
        select 1 from public.items_meta
        where items_meta.id = goals_payload.carried_from_goal_id
          and items_meta.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists goals_payload_update_own on public.goals_payload;
create policy goals_payload_update_own
  on public.goals_payload
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = goals_payload.item_id
        and items_meta.user_id = (select auth.uid())
    )
    and (
      goals_payload.parent_goal_id is null
      or exists (
        select 1 from public.items_meta
        where items_meta.id = goals_payload.parent_goal_id
          and items_meta.user_id = (select auth.uid())
      )
    )
    and (
      goals_payload.carried_from_goal_id is null
      or exists (
        select 1 from public.items_meta
        where items_meta.id = goals_payload.carried_from_goal_id
          and items_meta.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists goals_payload_delete_own on public.goals_payload;
create policy goals_payload_delete_own
  on public.goals_payload
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 3. goal_todo_links  (RELATION + soft-delete — goal <-> todo, many-to-many)
-- ===========================================================================
-- id = `goallink-<uuid>`（クライアントが作る）。goal_role / todo_role は固定の
-- 生成列で、複合 FK が「goal_id は目標・todo_id は Todo」を DB で保証する。
-- どちらかの item が物理削除されたら行ごと消える（CASCADE は行を消すだけなので
-- 生成列と衝突しない）。ソフトデリートは is_deleted / deleted_at、生きている
-- 行は (goal_id, todo_id) で 1 つだけ（削除済みの行があっても作り直せる）。
-- updated_at は関係の表なので自分で持つ（routine_group_assignments /
-- wiki_tag_connections と同じ）。
create table if not exists public.goal_todo_links (
  id          text        primary key,
  user_id     uuid        not null default auth.uid(),
  goal_id     text        not null,
  goal_role   text        generated always as ('goal') stored,
  todo_id     text        not null,
  todo_role   text        generated always as ('task') stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  is_deleted  boolean     not null default false,
  deleted_at  timestamptz,
  constraint goal_todo_links_goal_fk
    foreign key (goal_id, goal_role)
    references public.items_meta (id, role)
    on delete cascade,
  constraint goal_todo_links_todo_fk
    foreign key (todo_id, todo_role)
    references public.items_meta (id, role)
    on delete cascade
);

create index if not exists idx_gtl_user       on public.goal_todo_links (user_id);
create index if not exists idx_gtl_goal_role  on public.goal_todo_links (goal_id, goal_role);
create index if not exists idx_gtl_todo_role  on public.goal_todo_links (todo_id, todo_role);
create index if not exists idx_gtl_deleted    on public.goal_todo_links (is_deleted);
create index if not exists idx_gtl_updated_at on public.goal_todo_links (updated_at);

create unique index if not exists uq_gtl_goal_todo
  on public.goal_todo_links (goal_id, todo_id)
  where is_deleted = false;

alter table public.goal_todo_links enable row level security;

drop policy if exists goal_todo_links_select_own on public.goal_todo_links;
create policy goal_todo_links_select_own
  on public.goal_todo_links
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- insert / update: 両端の items_meta がどちらも自分のもの。
drop policy if exists goal_todo_links_insert_own on public.goal_todo_links;
create policy goal_todo_links_insert_own
  on public.goal_todo_links
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = goal_todo_links.goal_id
        and items_meta.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.items_meta
      where items_meta.id = goal_todo_links.todo_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists goal_todo_links_update_own on public.goal_todo_links;
create policy goal_todo_links_update_own
  on public.goal_todo_links
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = goal_todo_links.goal_id
        and items_meta.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.items_meta
      where items_meta.id = goal_todo_links.todo_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists goal_todo_links_delete_own on public.goal_todo_links;
create policy goal_todo_links_delete_own
  on public.goal_todo_links
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 4. dailies_payload: 夕刊の 2 列
-- ===========================================================================
-- evening_published_at  夕刊を発行した時刻（★）。NULL = 未発行。
-- evening_notes         出来事の行に足した一言。行の鍵（`todo:<id>` /
--                       `session:<id>` / `event:<id>`）→ 文 の object。
-- RLS は列単位ではないので、dailies_payload の既存の owner-only ポリシーが
-- そのまま新しい列も覆う。Realtime も加入済みの表なので変更なし。
alter table public.dailies_payload
  add column if not exists evening_published_at timestamptz;

alter table public.dailies_payload
  add column if not exists evening_notes jsonb
    check (evening_notes is null or jsonb_typeof(evening_notes) = 'object');

-- ===========================================================================
-- 5. Realtime publication
-- ===========================================================================
-- shared の REALTIME_TABLES と同じ集合に保つ（syncRealtimeTables.test.ts が
-- この下の配列を読む。ファイルの中で最初の配列リテラルであること）。
do $$
declare
  t text;
  tables text[] := array[
    'goals_payload',
    'goal_todo_links'
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
-- 6. delete_my_account() を作り直す
-- ===========================================================================
-- 0025 の関数は「user_id を持つ表に自分の行が残っていたら例外」を最後に
-- 検査するので、新しい 2 表を消す対象に足さないと退会が必ず失敗する。
-- shared/tests/userDataExport.test.ts も最新の定義の消す対象と書き出しの
-- 表の一覧を突き合わせる。
--
-- ついでに直すもの: 0025 の定義は calendars 表の行も消そうとするが、その表は
-- 0026 で消えている。plpgsql は実行時に表を解決するので、0026 の適用後は
-- 退会がこの行で落ちていた。作り直す定義からはこの行を外す。
-- （userDataExport.test.ts は最新の定義の本文から消す対象を正規表現で拾う
-- ので、このコメントには DELETE 文の形を書かない。）
--
-- 本体は 0025 と同じ（SECURITY INVOKER・子 → 親の順・取りこぼし検査）。
-- 変わるのは消す対象の並びだけ。
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
  'Deletes every public.* row owned by the calling user (Issue #1200; goals tables added and the dropped calendars line removed in #2101). Runs as the CALLER so RLS scopes it, and raises if any user_id table still holds a row afterwards. The auth.users row is removed separately by the delete-account Edge Function.';

-- create or replace は権限を引き継ぐが、0025 と同じ状態を明示しておく。
revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (push の後に流す。期待値つき):
-- ===========================================================================
-- A. role の CHECK に goal が入っている
--    select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.items_meta'::regclass and contype = 'c';
--    -- expect: items_meta_role_check ... 'goal' を含む。role を見る CHECK は 1 本だけ
--
-- B. 2 表と 2 列がある
--    select table_name from information_schema.tables
--    where table_schema = 'public'
--      and table_name in ('goals_payload', 'goal_todo_links');
--    -- expect: 2 rows
--    select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'dailies_payload'
--      and column_name in ('evening_published_at', 'evening_notes');
--    -- expect: 2 rows
--
-- C. Realtime に入っている
--    select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime'
--      and tablename in ('goals_payload', 'goal_todo_links');
--    -- expect: 2 rows
--
-- D. RLS ゲート
--    cd supabase && npm run db:check-rls
--    -- expect: offenders = 0

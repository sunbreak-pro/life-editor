-- Claude customization — rules / memories / skills (Issue #2118, Epic #2117 R1)
--
-- WHY: Life Editor の中で Claude Code に渡す「ルール（CLAUDE.md 相当）」
--   「メモリ（覚えておいてほしいこと）」「Claude スキル（SKILL.md 相当の
--   作業手順）」を編集・保存し、Desktop と Mobile のあいだで同期する土台。
--   正本は DB（D-20261006-main-1）。Desktop の起動時にファイルへ書き出す
--   処理（#2120）、Claude からの書き戻し（#2121）、編集画面（#2119）は後続。
--
--   3 つとも 0018 の timer / audio と同じ「独立した表 + 各表が自分の
--   updated_at を持つ」形にした。理由:
--     - Todo / ノートのような項目ではない。階層も、タグ / リンクも、
--       ゴミ箱も持たないので、items_meta + payload の 2 行分割と複合 FK は
--       何も守らない（0018 と同じ判断）。
--     - 表を 3 つに分けた（1 表 + 種別列にしなかった）。形が違うからで、
--       ルールは 1 人 1 行・メモリは並び順つきの短文・スキルは名前と説明と
--       本文を持つ。1 表にすると「種別ごとに使う列が違う」CHECK が積み上がる。
--
-- 名前: Materials の「テンプレート」（Note テンプレート #1179〜#1181）と
--   取り違えないよう、表・型の名前は ai_* / AiSkill にした（Epic の命名注意）。
--
-- ソフトデリートは持たない（物理削除）。ソフトデリートは TrashView から
--   戻すための仕組みで（CLAUDE.md §4）、この 3 種はゴミ箱に出さない。
--   playlists / pomodoro_presets と同じ扱い。
--
-- 1 件あたりのサイズ上限（DB の CHECK と shared/src/services/
-- aiCustomizationLimits.ts の定数で同じ値を持つ。数え方は char_length =
-- 文字数で、JS 側は Array.from(s).length で同じ数え方にそろえる）:
--   ai_rules.body          40000 文字 — Claude Code が CLAUDE.md を
--                          「大きすぎる」と警告し始める 40k 文字に合わせた
--   ai_memories.body       1000 文字・空白だけは不可
--   ai_skills.slug         64 文字・kebab-case（小文字英数字とハイフン）。
--                          SKILL.md の name とフォルダ名になる
--   ai_skills.description  1024 文字・1 行・空白だけは不可（SKILL.md の
--                          description の上限と同じ）
--   ai_skills.body         40000 文字（ルールと同じ）
--
-- 件数の上限は持たない（Issue が求めるのは 1 件ごとの上限だけ）。要るなら
--   #2119 / #2120 で決める。行をまたぐ規則なので、決めた場合も CHECK では
--   書けずアプリ側が守る。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
--
-- ⚠️ MERGE ORDER: shared の REALTIME_TABLES と USER_DATA_EXPORT_TABLES が
-- 同じ PR で 3 表を読むようになる。本番に表が無い状態でコードだけ入ると、
-- Realtime の購読と「データを書き出す」が存在しない表を引いて失敗する。
-- **push が merge より先**であること（0034 と同じ）。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。再実行安全:
--   表と索引は if not exists / ポリシーは drop if exists → create /
--   publication は pg_publication_tables で確認してから足す / 関数は
--   create or replace。

begin;

-- ===========================================================================
-- 1. ai_rules  (1 人 1 行 — ルール = アプリ専用フォルダの .claude/CLAUDE.md)
-- ===========================================================================
-- user_id の UNIQUE で 1 人 1 行が DB で保証される。保存は
-- upsert(onConflict: user_id)。主キーを user_id にせず乱数の id を別に持つのは、
-- Realtime が DELETE の通知だけは RLS で絞らず主キー付きで購読者全員に送るため
-- （主キーが user_id だと、誰かの退会でその人の uuid が他人の画面に届く）。
-- 行が無い = まだ何も書いていない（読み出しで
-- 行を作らない — timer_settings の「読むと行ができる」形は #499 で
-- 余計な書き込みの原因になったので採らない）。
create table if not exists public.ai_rules (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid(),
  body       text        not null default ''
                         check (char_length(body) <= 40000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_rules_user_uk unique (user_id)
);

alter table public.ai_rules enable row level security;

drop policy if exists ai_rules_select_own on public.ai_rules;
create policy ai_rules_select_own
  on public.ai_rules
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists ai_rules_insert_own on public.ai_rules;
create policy ai_rules_insert_own
  on public.ai_rules
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists ai_rules_update_own on public.ai_rules;
create policy ai_rules_update_own
  on public.ai_rules
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists ai_rules_delete_own on public.ai_rules;
create policy ai_rules_delete_own
  on public.ai_rules
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 2. ai_memories  (text id = `aimemory-<uuid>` — 1 件 1 行の項目リスト)
-- ===========================================================================
-- D-20261006-main-1 Q4 = 1 件ずつの項目リスト。Claude の追記（#2121）と
-- 1 件ずつの削除がしやすい形。sort_order = 一覧の並び（追加は末尾）。
create table if not exists public.ai_memories (
  id         text        primary key,
  user_id    uuid        not null default auth.uid(),
  body       text        not null,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_memories_body_not_blank check (body ~ '[^[:space:]]'),
  constraint ai_memories_body_length check (char_length(body) <= 1000)
);

-- 一覧の並び（sort_order → id）に合わせた 1 本。user_id 単独の索引は
-- この先頭列と重なるので作らない。
create index if not exists idx_ai_memories_user_order
  on public.ai_memories (user_id, sort_order, id);

alter table public.ai_memories enable row level security;

drop policy if exists ai_memories_select_own on public.ai_memories;
create policy ai_memories_select_own
  on public.ai_memories
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists ai_memories_insert_own on public.ai_memories;
create policy ai_memories_insert_own
  on public.ai_memories
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists ai_memories_update_own on public.ai_memories;
create policy ai_memories_update_own
  on public.ai_memories
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists ai_memories_delete_own on public.ai_memories;
create policy ai_memories_delete_own
  on public.ai_memories
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 3. ai_skills  (text id = `aiskill-<uuid>` — SKILL.md 1 つ = 1 行)
-- ===========================================================================
-- slug は SKILL.md の name と、書き出し先 .claude/skills/<slug>/ のフォルダ名
-- になる（#2120）。同じ人の中で 1 つだけ（物理削除なので部分 UNIQUE は
-- 要らない — 消した名前はすぐに使い直せる）。id を別に持つのは、名前を
-- 変えても同じスキルとして追えるようにするため。
create table if not exists public.ai_skills (
  id          text        primary key,
  user_id     uuid        not null default auth.uid(),
  slug        text        not null,
  description text        not null,
  body        text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint ai_skills_slug_shape
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 64),
  -- Windows がフォルダ名に使えない名前。書き出し（#2120）が Windows の
  -- Desktop でだけ失敗するので、保存の時点で断る。
  constraint ai_skills_slug_not_reserved
    check (slug !~ '^(con|prn|aux|nul|com[1-9]|lpt[1-9])$'),
  constraint ai_skills_description_not_blank
    check (description ~ '[^[:space:]]'),
  constraint ai_skills_description_one_line
    check (description !~ '[\r\n]'),
  constraint ai_skills_description_length
    check (char_length(description) <= 1024),
  constraint ai_skills_body_length
    check (char_length(body) <= 40000),
  constraint ai_skills_user_slug_uk unique (user_id, slug)
);

-- user_id 単独の索引は作らない（UNIQUE (user_id, slug) の索引の先頭列と重なる）。

alter table public.ai_skills enable row level security;

drop policy if exists ai_skills_select_own on public.ai_skills;
create policy ai_skills_select_own
  on public.ai_skills
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists ai_skills_insert_own on public.ai_skills;
create policy ai_skills_insert_own
  on public.ai_skills
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists ai_skills_update_own on public.ai_skills;
create policy ai_skills_update_own
  on public.ai_skills
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists ai_skills_delete_own on public.ai_skills;
create policy ai_skills_delete_own
  on public.ai_skills
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 4. Realtime publication
-- ===========================================================================
-- shared の REALTIME_TABLES と同じ集合に保つ（syncRealtimeTables.test.ts が
-- この下の配列を読む。ファイルの中で最初の配列リテラルであること）。
do $$
declare
  t text;
  tables text[] := array[
    'ai_rules',
    'ai_memories',
    'ai_skills'
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
-- 5. delete_my_account() を作り直す
-- ===========================================================================
-- 0025 / 0034 の関数は「user_id を持つ表に自分の行が残っていたら例外」を
-- 最後に検査するので、新しい 3 表を消す対象に足さないと退会が必ず失敗する。
-- shared/tests/userDataExport.test.ts も最新の定義の消す対象と書き出しの
-- 表の一覧を突き合わせる。
-- （userDataExport.test.ts は最新の定義の本文から消す対象を正規表現で拾う
-- ので、このコメントには DELETE 文の形を書かない。）
--
-- 本体は 0034 と同じ（SECURITY INVOKER・子 → 親の順・取りこぼし検査）。
-- 変わるのは「4) 独立テーブル」に 3 表を足したことだけ。
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
  'Deletes every public.* row owned by the calling user (Issue #1200; goals tables added and the dropped calendars line removed in #2101; ai_rules / ai_memories / ai_skills added in #2118). Runs as the CALLER so RLS scopes it, and raises if any user_id table still holds a row afterwards. The auth.users row is removed separately by the delete-account Edge Function.';

-- create or replace は権限を引き継ぐが、0025 と同じ状態を明示しておく。
revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (push の後に流す。期待値つき):
-- ===========================================================================
-- A. 3 表がある
--    select table_name from information_schema.tables
--    where table_schema = 'public'
--      and table_name in ('ai_rules', 'ai_memories', 'ai_skills');
--    -- expect: 3 rows
--
-- B. Realtime に入っている
--    select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime'
--      and tablename in ('ai_rules', 'ai_memories', 'ai_skills');
--    -- expect: 3 rows
--
-- C. RLS ゲート
--    cd supabase && npm run db:check-rls
--    -- expect: offenders = 0
--
-- D. 本人以外を弾く。SQL Editor は最後の文の結果しか出さないので、1 つの
--    DO ブロックにまとめ、結果を詰めた例外で全体を巻き戻す（rollback は不要。
--    A / B は実在しない uuid でよい — FK は無い）。
--    do $$
--    declare m bigint; s bigint; r bigint; u bigint; d bigint;
--    begin
--      set local role authenticated;
--      perform set_config('request.jwt.claims',
--        '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
--      insert into public.ai_memories (id, body) values ('aimemory-rls-a', 'A のメモ');
--      insert into public.ai_skills (id, slug, description)
--        values ('aiskill-rls-a', 'rls-check', 'A のスキル');
--      insert into public.ai_rules (body) values ('A のルール');
--      perform set_config('request.jwt.claims',
--        '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
--      select count(*) into m from public.ai_memories;
--      select count(*) into s from public.ai_skills;
--      select count(*) into r from public.ai_rules;
--      update public.ai_memories set body = 'x' where id = 'aimemory-rls-a';
--      get diagnostics u = row_count;
--      delete from ai_skills where id = 'aiskill-rls-a';  -- public. を付けない（下の注）
--      get diagnostics d = row_count;
--      begin
--        insert into public.ai_memories (id, user_id, body)
--          values ('aimemory-rls-b', '00000000-0000-0000-0000-00000000000a', 'なりすまし');
--        raise exception 'RLS NG: impersonating insert was accepted';
--      exception when insufficient_privilege then null;  -- 42501 なら期待どおり
--      end;
--      raise exception 'RLS check (rolled back): m=% s=% r=% u=% d=%', m, s, r, u, d;
--    end $$;
--    -- expect: ERROR P0001: RLS check (rolled back): m=0 s=0 r=0 u=0 d=0
--    （注: userDataExport.test.ts は削除一覧を正規表現で拾うので、このファイルの
--    コメントには「public. 付きの DELETE 文」を書かない。）
--
-- E. 制約がそろっている（読み取りだけ。挿入で試すと user_id の NOT NULL が
--    CHECK より先に落ちて、CHECK の有無を確かめられない）
--    select conrelid::regclass, conname
--      from pg_constraint
--     where conrelid in ('public.ai_rules'::regclass,
--                        'public.ai_memories'::regclass,
--                        'public.ai_skills'::regclass)
--       and contype in ('c', 'u')
--     order by 1, 2;
--    -- expect: 11 rows（ai_rules = CHECK 1 + UNIQUE 1 / ai_memories = CHECK 2 /
--    --         ai_skills = CHECK 6 + UNIQUE 1）
--
-- F. ポリシーが initplan 形式のまま（check-rls は形の漏れしか見ないので別に確認）
--    select tablename, count(*) as policies,
--           bool_and(coalesce(qual, with_check) like '%( SELECT auth.uid()%') as initplan
--      from pg_policies
--     where schemaname = 'public'
--       and tablename in ('ai_rules', 'ai_memories', 'ai_skills')
--     group by tablename;
--    -- expect: 3 rows, policies = 4, initplan = true

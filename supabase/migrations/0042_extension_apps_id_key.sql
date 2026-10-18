-- extension_apps gets a random id primary key — extension_apps (Issue #2271)
--
-- WHY: 0039 の extension_apps（拡張アプリの台帳）は主キーが (user_id, slug)
--   のまま supabase_realtime の配信に入っている。Realtime は DELETE の通知
--   だけは RLS で絞らず、主キーの列を付けて購読者全員に送る（REPLICA IDENTITY
--   は 0017 の既定のまま = 主キーだけ）。そのため台帳の行を消すたびに、消した
--   人の uuid と拡張アプリの slug が、ほかの利用者の画面にも届きうる。配布先を
--   10〜20 人に開く方針（D-20260829-main-1）の前に塞ぐ。#2260 の record_views
--   を監査したときに見つかった（record_views 側の判断 = D-20261017-main-2）。
--
--   直し方は 0037 の ai_rules と 0041 の record_views と同じ形にする: 主キーを
--   乱数の id にし、(user_id, slug) は UNIQUE に下げる。DELETE の通知に載るのは
--   乱数の id だけになり、誰の行か・何のアプリかは読めない。引き当てのキーとし
--   ての意味は変わらない（1 人の中で slug は 1 行。重複は UNIQUE が 23505 で
--   断るので、SupabaseAppRecordsService の `taken` の判定はそのまま働く）。
--   採らなかった案:
--     - extension_apps を Realtime から外す → Desktop と Mobile で台帳がずれる。
--       Apps 画面と Analytics の記録タブは extensionApps の通知で読み直す
--       （#2162）。
--     - REPLICA IDENTITY を変える → RLS が有効な表では、FULL にしても
--       Realtime は DELETE の old_record を主キーの列だけに削る。主キーに
--       何を置くかでしか、通知に載る列は変わらない。
--     - slug を乱数の値に作り直す → slug は app_records.source_app と窓口の鍵が
--       指すアプリの名前（#2146）で、人が読む値。変えると記録と鍵が切れる。
--
--   app_records は主キーが id（記録ごとの text id）なので、この漏れは無い。
--   この migration では触らない。
--
-- SCOPE:
--   1. extension_apps に id 列を足し、既存の行を gen_random_uuid() で埋める。
--      既定値と NOT NULL を付ける。
--   2. UNIQUE (user_id, slug) を足してから、主キーを (user_id, slug) から id に
--      付け替える。UNIQUE を先に足すので、重複を断る制約が欠ける瞬間は無い。
--   RLS のポリシー・Realtime の publication・delete_my_account() は変えない。
--   ポリシーは user_id だけを見て、退会の関数は user_id で消すため。
--   user_id 単独の索引は作らない（UNIQUE (user_id, slug) の索引の先頭列と重なる）。
--
-- コード側（同じ PR）: 画面と MCP は id を読まない。台帳のキーは今までどおり
--   slug で、更新と削除は slug で絞る（RLS が本人の行に限るので 1 行に決まる）。
--   EXTENSION_APP_COLUMNS にも id を足さない。「データを書き出す」は select *
--   なので id 列も書き出され、並び順は slug のまま（1 人の中で一意）。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
--
-- ⚠️ MERGE ORDER: **push が merge より先**。コードは id を読まないので、
-- どちらの形の表でも動く。ただし漏れを塞ぐのはこのファイルなので、コードだけ
-- 先に入って「直したつもり」の状態を作らない。
--
-- ROLLBACK: このファイルは編集しない。戻すときは別ファイルの逆向き
-- migration（主キーを (user_id, slug) に戻す → UNIQUE を drop → id 列を drop）を
-- 足す。戻すと上の漏れも戻る。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。再実行安全:
--   列は add column if not exists / 埋め込みは id is null の行だけ / 既定値と
--   NOT NULL は何度付けても同じ / UNIQUE は pg_constraint を名前で見てから足す /
--   主キーは「今の主キーが id 1 列か」を pg_constraint で見て、違うときだけ
--   付け替える。

begin;

-- ===========================================================================
-- 1. id 列（既存の行を埋めてから既定値と NOT NULL を付ける）
-- ===========================================================================
alter table public.extension_apps
  add column if not exists id uuid;

update public.extension_apps
   set id = gen_random_uuid()
 where id is null;

alter table public.extension_apps
  alter column id set default gen_random_uuid();

alter table public.extension_apps
  alter column id set not null;

-- ===========================================================================
-- 2. (user_id, slug) を UNIQUE に下げ、主キーを id に付け替える
-- ===========================================================================
-- UNIQUE を先に足す。主キーを外したあとも、同じ slug の 2 行目を断る制約が
-- 途切れないため。
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.extension_apps'::regclass
       and conname = 'extension_apps_user_slug_uk'
  ) then
    alter table public.extension_apps
      add constraint extension_apps_user_slug_uk unique (user_id, slug);
  end if;
end;
$$;

-- 0039 の主キーは名前を付けていないので extension_apps_pkey になっている。
-- 名前ではなく列で見る（id 1 列なら付け替え済み）。
do $$
declare
  pk_name  text;
  pk_is_id boolean;
begin
  select c.conname,
         c.conkey = array[(
           select a.attnum from pg_attribute a
            where a.attrelid = c.conrelid and a.attname = 'id'
         )]::smallint[]
    into pk_name, pk_is_id
    from pg_constraint c
   where c.conrelid = 'public.extension_apps'::regclass
     and c.contype = 'p';

  if pk_is_id then
    return;
  end if;

  if pk_name is not null then
    execute format(
      'alter table public.extension_apps drop constraint %I', pk_name
    );
  end if;

  alter table public.extension_apps
    add constraint extension_apps_pkey primary key (id);
end;
$$;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (push の後に流す。期待値つき):
-- ===========================================================================
-- A. 主キーが id、(user_id, slug) が UNIQUE
--    select conname, contype, pg_get_constraintdef(oid)
--      from pg_constraint
--     where conrelid = 'public.extension_apps'::regclass
--       and contype in ('p', 'u')
--     order by conname;
--    -- expect: 2 rows
--    --   extension_apps_pkey         p  PRIMARY KEY (id)
--    --   extension_apps_user_slug_uk u  UNIQUE (user_id, slug)
--
-- B. id が埋まっていて、既定値が乱数
--    select count(*) filter (where id is null) as missing,
--           count(*) as total
--      from public.extension_apps;
--    -- expect: missing = 0（SQL Editor は postgres ロールなので全員の行を数える）
--    select column_default, is_nullable
--      from information_schema.columns
--     where table_schema = 'public' and table_name = 'extension_apps'
--       and column_name = 'id';
--    -- expect: gen_random_uuid(), NO
--
-- C. RLS ゲート（ポリシーは変えていないが、表の形が変わったので回す）
--    cd supabase && npm run db:check-rls
--    -- expect: offenders = 0
--
-- D. 重複した slug を断り、本人以外を弾く。SQL Editor は postgres ロールで
--    動き auth.uid() が null になるので、0039 の G と同じく authenticated に
--    切り替えた 1 つの DO ブロックにまとめ、結果を詰めた例外で全体を巻き戻す
--    （rollback は不要。A / B は実在しない uuid でよい — FK は無い）。
--    do $$
--    declare r bigint; u bigint; d bigint; dup text := 'none'; idset text;
--    begin
--      set local role authenticated;
--      perform set_config('request.jwt.claims',
--        '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
--      insert into public.extension_apps (slug, name) values ('pk-check', 'A のアプリ');
--      select case when id is not null then 'set' else 'null' end into idset
--        from public.extension_apps where slug = 'pk-check';
--      begin
--        insert into public.extension_apps (slug, name) values ('pk-check', 'again');
--      exception when unique_violation then dup := 'blocked';  -- 23505 なら期待どおり
--      end;
--      perform set_config('request.jwt.claims',
--        '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
--      select count(*) into r from public.extension_apps;
--      update public.extension_apps set name = 'x' where slug = 'pk-check';
--      get diagnostics u = row_count;
--      delete from extension_apps where slug = 'pk-check';  -- public. を付けない（下の注）
--      get diagnostics d = row_count;
--      raise exception 'PK check (rolled back): id=% dup=% r=% u=% d=%', idset, dup, r, u, d;
--    end $$;
--    -- expect: ERROR P0001: PK check (rolled back): id=set dup=blocked r=0 u=0 d=0
--    （注: userDataExport.test.ts は退会の関数の削除一覧を正規表現で拾うので、
--    このファイルには「public. 付きの DELETE 文」を書かない。）
--
-- E. Realtime の DELETE の通知に載る列が id だけになった（REPLICA IDENTITY は
--    既定 = 主キー）
--    select relreplident from pg_class where oid = 'public.extension_apps'::regclass;
--    -- expect: d
--    select pg_get_replica_identity_index('public.extension_apps');
--    -- expect: extension_apps_pkey
--    -- 実機では Apps 画面で台帳の行を消し、別アカウントで開いた画面の
--    -- WebSocket に届く old_record が {"id": "<uuid>"} だけであることを見る。
--
-- F. local と remote の差分が無い
--    supabase db diff
--    -- expect: 差分 0

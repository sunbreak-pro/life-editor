-- public.upsert_daily_content(...) — Daily 本文の「版を比べてから書く」保存 (Issue #2336)
--
-- WHY: 圏外で書いた Daily は、何時間も後に届くことがある。save_daily_content（0043）
--   は版を比べないので、そのあいだに別の端末で書いた内容を黙って上書きする。
--   0043 は版の比較を持たないまま push 済みなので書き換えず、送信待ちの箱から
--   送るときだけ使う関数を別に足す。回線があるときの保存は 0043 のまま変えない。
--
-- WHAT: 日付と本文と「元にした版」（`items_meta.updated_at`）を受け取る。
--
--   - 行があり、版が一致したら書く。`saved = true` と新しい updated_at を返す。
--   - 行があり、版がずれていたら何も書かない。`saved = false` と、その時点の
--     updated_at と本文を返す。呼び出し元は 3-way merge して送り直す。
--     `p_expected_updated_at` が null（元の版を持たない）で行があるときも同じ。
--     `m.updated_at = null` は真にならないので、同じ分岐に落ちる。
--   - 行が無ければ `daily-<date>` で items_meta と dailies_payload を作り、
--     `saved = true` を返す。同じ日を 2 本が同時に作りに来たときは、後の 1 本は
--     `on conflict do nothing` で何も書かず、先の 1 本が書いた本文を
--     `saved = false` で受け取る。409 にも、黙った上書きにもならない。
--     元の版を持っていて行が無い（別の端末で完全に削除された）ときも作り直す。
--     本文を失わないため。
--
--   新しい updated_at は 0032 と同じ `greatest(now(), 旧値 + 1ms)`。端末の時計で
--   書かれた旧値がサーバーより進んでいても、版は必ず前へ動く。
--
-- 削除済み（ゴミ箱の中）の行には書かない。`saved = false` と `is_deleted = true`
--   を返し、呼び出し元はその本文を「送れなかった変更」の箱に移して、コピーできる
--   ようにする（2026-11-02 #2336 の実装での判断）。
--     - 書くだけだと、本文はゴミ箱の中に入り、画面からは消えたように見える。
--     - 復元して書くと、別の端末での削除を黙って取り消す。
--     - どちらの側の内容も消えない: ゴミ箱の行はそのままで、圏外の本文は箱に残る。
--
-- 同時実行: items_meta の行の UPDATE が行ロックを取るので、同じ版を元にした 2 本は
--   直列になり、後の 1 本は進んだ updated_at と比べて断られる（0032 と同じ）。
--
-- role: `daily-` で始まる id が別の role の行だったら例外を投げ、トランザクション
--   ごと戻す（0043 と同じ。db-conventions §10.5）。
--
-- 0045 との関係: `items_meta.changed_at` は BEFORE INSERT OR UPDATE のトリガーが
--   書くので、この関数の meta の INSERT / UPDATE でそのまま進む。payload だけを
--   書く経路は無い。この関数は行を消さないので削除記録も増えない。完全に削除
--   された id を作り直した場合は、新しい changed_at が削除記録より後になり、
--   差分の読み出しは行を残す（`itemChanges.ts` の tombstonedIds）。
--
-- 採らなかった案:
--
--   (a) save_daily_content に版の引数を足す。push 済みの関数を置き換えることに
--       なり、回線があるときの保存まで版を比べ始める。Daily の画面には衝突を解く
--       UI が無く、#2336 の範囲を超える。
--   (b) 呼び出し元の時計で updated_at を渡す（0043 の形）。送信は何時間も後に
--       走るので、端末の時刻を版にしない。
--
-- SECURITY: SECURITY INVOKER を明示し、呼び出し元の JWT で走らせる。items_meta /
--   dailies_payload の owner-only RLS がそのまま効く。user_id は列の既定値
--   auth.uid() に任せる（0043 と同じ）。anon からは呼べない（0032 と同じ grant の
--   形）。search_path は空にして、参照はすべて public. で修飾する。
--   返す列は明示する。dailies_payload の password_hash を返さないため。
--   パスワード付きの日の扱いは呼び出し元の責任（0032 と同じ）。アプリは
--   パスワード付きの日を箱に入れず、`has_password` を見て端末に残さない。
--
-- SCOPE: 関数 1 本の作成のみ。テーブル / 列 / ポリシー / publication は触らない。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `cd supabase && npm run db:push`。`apply_migration` MCP 単独使用は禁止
-- （本ファイルはローカルに置くだけ・エージェントは DB へ適用しない）。
-- PR の merge は db push のあと。先に merge しても送信待ちは消えない（関数が無い
-- 答えのあいだは箱に残り、push のあとで送る）。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。`create or replace function` なので
--   再実行安全。

begin;

create or replace function public.upsert_daily_content(
  p_date text,
  p_content jsonb,
  p_expected_updated_at timestamptz
)
returns table (
  saved boolean,
  updated_at timestamptz,
  content_json jsonb,
  is_deleted boolean,
  has_password boolean
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id text;
  v_role text;
  v_deleted boolean;
  v_created boolean;
  v_updated_at timestamptz;
  v_has_password boolean;
begin
  if p_date is null or p_date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'upsert_daily_content: invalid date %', p_date
      using errcode = '22023';
  end if;

  select p.item_id into v_id
    from public.dailies_payload p
   where p.date = p_date;

  if v_id is null then
    v_id := 'daily-' || p_date;

    insert into public.items_meta as m (id, role, title, updated_at)
    values (v_id, 'daily', p_date, now())
    on conflict (id) do nothing
    returning m.updated_at into v_updated_at;
    v_created := found;

    if not v_created then
      select m.role, m.is_deleted, m.updated_at
        into v_role, v_deleted, v_updated_at
        from public.items_meta m
       where m.id = v_id;
      if v_role is distinct from 'daily' then
        raise exception 'upsert_daily_content: % is not a daily', v_id
          using errcode = 'P0002';
      end if;
      if v_deleted then
        return query select false, v_updated_at, null::jsonb, true, false;
        return;
      end if;
    end if;

    insert into public.dailies_payload as p (item_id, date, content_json)
    values (v_id, p_date, p_content)
    on conflict (date) do nothing
    returning p.has_password into v_has_password;

    if found then
      -- meta だけが先にあった行（片方だけ作られた行）は、ここで版を進める。
      if not v_created then
        update public.items_meta m
           set updated_at = greatest(now(), m.updated_at + interval '1 millisecond')
         where m.id = v_id
        returning m.updated_at into v_updated_at;
      end if;
      return query select true, v_updated_at, null::jsonb, false, v_has_password;
      return;
    end if;
  else
    update public.items_meta m
       set updated_at = greatest(now(), m.updated_at + interval '1 millisecond')
     where m.id = v_id
       and m.role = 'daily'
       and m.is_deleted = false
       and m.updated_at = p_expected_updated_at
    returning m.updated_at into v_updated_at;

    if found then
      update public.dailies_payload p
         set content_json = p_content
       where p.item_id = v_id
      returning p.has_password into v_has_password;
      return query select true, v_updated_at, null::jsonb, false, v_has_password;
      return;
    end if;
  end if;

  -- Refused: hand back the version that is there now, body included, read in
  -- ONE statement so the stamp and the body belong to the same write.
  return query
    select false, m.updated_at, p.content_json, m.is_deleted, p.has_password
      from public.items_meta m
      join public.dailies_payload p on p.item_id = m.id
     where p.date = p_date
       and m.role = 'daily';
  if not found then
    raise exception 'upsert_daily_content: % is not a daily', v_id
      using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.upsert_daily_content(text, jsonb, timestamptz) is
  'Write a Daily body only if items_meta.updated_at still equals the version the caller read, or create daily-<date> when the day has no row (Issue #2336). Returns saved=true with the new updated_at, or saved=false with the current updated_at and body; a null version counts as stale when a row exists. Never writes a soft-deleted row (saved=false, is_deleted=true). Never returns password_hash. Runs as the CALLER so RLS scopes it.';

revoke all on function public.upsert_daily_content(text, jsonb, timestamptz) from public;
revoke all on function public.upsert_daily_content(text, jsonb, timestamptz) from anon;
grant execute on function public.upsert_daily_content(text, jsonb, timestamptz) to authenticated;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (push の後に流す。期待値つき):
-- ===========================================================================
-- A. 権限（authenticated だけが呼べる）
--    select has_function_privilege('anon', 'public.upsert_daily_content(text, jsonb, timestamptz)', 'execute') as anon,
--           has_function_privilege('authenticated', 'public.upsert_daily_content(text, jsonb, timestamptz)', 'execute') as authed;
--    -- expect: anon = false, authed = true
--
-- B. 版の比較・元の版なし・削除済み・別の role。1 つの DO ブロックにまとめ、結果を
--    詰めた例外で全体を巻き戻す（0045 の C と同じ形。uuid は実在しなくてよい）。
--    do $$
--    declare
--      u constant timestamptz := '2000-01-01T00:00:00Z';
--      d constant text := '1999-01-02';
--      body constant jsonb := '{"type":"doc","content":[]}';
--      r1 record; r2 record; r3 record; r4 record; r5 record;
--      other_role text := 'ok';
--    begin
--      set local role authenticated;
--      perform set_config('request.jwt.claims',
--        '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
--      select * into r1 from public.upsert_daily_content(d, body, null);
--      select * into r2 from public.upsert_daily_content(d, body, null);
--      select * into r3 from public.upsert_daily_content(d, body, u);
--      select * into r4 from public.upsert_daily_content(d, body, r2.updated_at);
--      update public.items_meta set is_deleted = true where id = 'daily-' || d;
--      select * into r5 from public.upsert_daily_content(d, body, r4.updated_at);
--      insert into public.items_meta (id, role, title)
--        values ('daily-1999-01-03', 'task', 'check');
--      begin
--        perform public.upsert_daily_content('1999-01-03', body, null);
--        other_role := 'wrote';
--      exception when sqlstate 'P0002' then other_role := 'raised';
--      end;
--      raise exception 'daily check (rolled back): new=% nobase=% stale=% match=% moved=% deleted=%/% role=%',
--        r1.saved, r2.saved, r3.saved, r4.saved, r4.updated_at > r2.updated_at,
--        r5.saved, r5.is_deleted, other_role;
--    end $$;
--    -- expect: ERROR P0001: daily check (rolled back): new=t nobase=f stale=f match=t moved=t deleted=f/t role=raised

-- public.save_daily_content(...) — Daily 本文の保存を 1 往復にまとめる (Issue #2325)
--
-- WHY: Daily に 1 回保存するたびに 6 本のリクエストが出ていた（#2290 の
--   計測・2026-10-19）。日付で payload を読む → id で meta を読む → meta を
--   UPDATE → payload を UPDATE → meta を読み直す → payload を読み直す、の 6 本。
--   入力中は 800ms ごとに保存が走るので、1 分の入力で 17 回 × 6 本になる。
--
-- WHAT: 日付と本文を受け取り、1 つのトランザクションで次を行って、保存後の
--   行（meta と payload）を返す。
--
--   - その日付の行があれば、items_meta.updated_at を進め、
--     dailies_payload.content_json を書き換える。削除済みの行でも書く
--     （今のアプリの保存と同じ。復元はしない）。
--   - 無ければ `daily-<date>` で items_meta と dailies_payload を作る。
--     同じ日を 2 本の保存が同時に作りに来ても、`on conflict` で後の 1 本は
--     更新に回り、重複キーの 409 にならない（#2309 の race と同じ場面）。
--
--   updated_at は呼び出し元が渡す（`p_updated_at`）。今のアプリの更新も
--   クライアントの時計で updated_at を書いており、Sync の LWW の基準を
--   変えないため。呼び出し元が値を先に知っているので、Realtime で戻って
--   きた行が自分の書き込みかを見分ける材料にもなる（#2290 の PR #2338 が
--   入れる仕組みと組み合わせる）。null ならサーバーの now() を使う。
--   作るときの created_at だけはサーバーの now()（今のアプリの作成と同じ）。
--
--   書いた行が Daily でなかったとき（id が `daily-` で始まる別の役割の行）は
--   例外を投げ、トランザクションごと戻す。片方の表だけ書けた状態を残さない
--   ため（db-conventions §10.5: role を見ずに書く経路を足さない）。
--
--   返す列は明示する。dailies_payload には password_hash があり、
--   `to_jsonb(p)` で丸ごと返すとクライアントに渡ってしまうため。
--
-- 採らなかった案:
--
--   (a) 版を比べてから書く（update_note_content の形）。Daily の画面には
--       まだ衝突を解く UI が無く、この Issue の範囲は通信量の削減に限るため。
--       比べずに書くのは今の保存と同じ挙動。
--   (b) PostgREST の upsert 2 本（meta → payload）。往復は 2 本に減るが、
--       片方だけ書けた状態が残りうる。クライアントは、この関数がまだ無い
--       環境（db push 前）でだけ、今までの 6 本の経路に落とす。
--
-- SECURITY: SECURITY INVOKER を明示し、呼び出し元の JWT で走らせる。
--   items_meta / dailies_payload の owner-only RLS がそのまま効く。
--   user_id は列の既定値 auth.uid() に任せる（アプリの INSERT も同じ）。
--   anon からは呼べない（0032 と同じ grant の形）。search_path は空にして、
--   参照はすべて public. で修飾する。
--
-- SCOPE: 関数 1 本の作成のみ。テーブル / 列 / ポリシー / publication は
--   触らない。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `cd supabase && npm run db:push`。`apply_migration` MCP 単独使用は禁止
-- （本ファイルはローカルに置くだけ・エージェントは DB へ適用しない）。
-- PR の merge は db push のあと（先に merge すると web が無い関数を呼び、
-- クライアントは 6 本の経路に落ちて動き続けるが、削減は効かない）。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。`create or replace function` なので
--   再実行安全。

begin;

create or replace function public.save_daily_content(
  p_date text,
  p_content jsonb,
  p_updated_at timestamptz default null
)
returns table (
  id text,
  user_id uuid,
  role text,
  title text,
  is_deleted boolean,
  deleted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  item_id text,
  date text,
  content_json jsonb,
  is_pinned boolean,
  is_edit_locked boolean,
  has_password boolean,
  evening_published_at timestamptz,
  evening_notes jsonb,
  morning_comment jsonb
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id text;
  v_now timestamptz := coalesce(p_updated_at, now());
begin
  if p_date is null or p_date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'save_daily_content: invalid date %', p_date
      using errcode = '22023';
  end if;

  select p.item_id into v_id
    from public.dailies_payload p
   where p.date = p_date;

  if v_id is null then
    v_id := 'daily-' || p_date;
    insert into public.items_meta as m (id, role, title, updated_at)
    values (v_id, 'daily', p_date, v_now)
    on conflict (id) do update set updated_at = excluded.updated_at
      where m.role = 'daily';
    if not found then
      raise exception 'save_daily_content: % is not a daily', v_id
        using errcode = 'P0002';
    end if;
    insert into public.dailies_payload as p (item_id, date, content_json)
    values (v_id, p_date, p_content)
    on conflict (date) do update set content_json = excluded.content_json;
  else
    update public.items_meta m
       set updated_at = v_now
     where m.id = v_id
       and m.role = 'daily';
    if not found then
      raise exception 'save_daily_content: % is not a daily', v_id
        using errcode = 'P0002';
    end if;
    update public.dailies_payload p
       set content_json = p_content
     where p.item_id = v_id;
  end if;

  return query
    select m.id, m.user_id, m.role, m.title, m.is_deleted, m.deleted_at, m.created_at,
           m.updated_at, p.item_id, p.date, p.content_json, p.is_pinned,
           p.is_edit_locked, p.has_password, p.evening_published_at,
           p.evening_notes, p.morning_comment
      from public.items_meta m
      join public.dailies_payload p on p.item_id = m.id
     where p.date = p_date
       and m.role = 'daily';
end;
$$;

comment on function public.save_daily_content(text, jsonb, timestamptz) is
  'Write a Daily body by date in one round trip (Issue #2325): updates items_meta.updated_at and dailies_payload.content_json, or creates daily-<date> when the day has no row. Returns the saved row without password_hash. Runs as the CALLER so RLS scopes it.';

revoke all on function public.save_daily_content(text, jsonb, timestamptz) from public;
revoke all on function public.save_daily_content(text, jsonb, timestamptz) from anon;
grant execute on function public.save_daily_content(text, jsonb, timestamptz) to authenticated;

commit;

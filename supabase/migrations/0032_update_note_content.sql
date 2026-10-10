-- public.update_note_content(...) — ノート本文の「版を比べてから書く」保存 (Issue #2057)
--
-- WHY: ノートを開いたまま MCP（`update_note`）で本文を書き換えると、開いている
--   画面の次の自動保存が、エディタの持つ古い本文で MCP の変更を上書きしていた
--   （2026-10-01 ユーザー報告・エラーも出ないサイレントなデータ損失）。
--   アプリの保存（`updateNoteUnified`）は items_meta と notes_payload への
--   無条件の UPDATE 2 回で、どの版を元に書いたかを確かめていなかった。
--
-- WHAT: 本文の保存を 1 つの関数にまとめ、呼び出し元が「読んだ時点の
--   `items_meta.updated_at`」を渡す。
--
--   - 一致したら、items_meta（updated_at を進める + 任意で title）と
--     notes_payload.content_json を同じトランザクションで書き、
--     `saved = true` と新しい updated_at を返す。
--   - 一致しなければ何も書かず、`saved = false` と、その時点の updated_at と
--     本文を返す。呼び出し元はそれを「別の場所の版」として衝突の解決に使う。
--     本文が自分の元の版と同じなら（タイトルやピンだけが変わった）、返った
--     updated_at で書き直せばよい。
--   - ノートが無い / 削除済みなら 0 行を返す。
--
--   items_meta の行の UPDATE が行ロックを取るので、同時に来た 2 本の保存は
--   直列になり、後の 1 本は進んだ updated_at と比べて断られる（READ COMMITTED
--   の再評価）。2 回の UPDATE が 1 トランザクションになるので、片方だけ
--   書けた状態も残らない。
--
--   新しい updated_at は `greatest(now(), 旧値 + 1ms)`。クライアントの時計で
--   書かれた旧値がサーバーより進んでいても、版は必ず前へ動く（動かないと、
--   同じ版を元にした次の保存が通ってしまう）。
--
-- 採らなかった案:
--
--   (a) `items_meta.version` をサーバー側で採番する案。version は旧 Tauri
--       時代の列で、アプリも MCP も読み書きしていない（CLAUDE.md §3.3 /
--       #1385）。ノート本文のためだけに生き返らせると、「version は使わない」
--       という前提と食い違う。updated_at は既に全経路が書いているので、
--       比較のキーに使えばほかの書き込み経路を変えずに済む。
--   (b) PostgREST の条件つき UPDATE（`updated_at=eq.…`）を 2 回投げる案。
--       DDL は要らないが、1 回目と 2 回目のあいだに別の保存が割り込める。
--       クライアントは、この関数がまだ無い環境（db push 前）でだけ、この形に
--       落とす。
--
-- SECURITY: SECURITY INVOKER を明示し、呼び出し元の JWT で走らせる。
--   items_meta / notes_payload の owner-only RLS がそのまま効くので、他人の
--   行は書けず、読めもしない。anon からは呼べない（0025 / 0031 と同じ grant の
--   形）。search_path は空にして、参照はすべて public. で修飾する。
--   パスワード付きノートの扱いは呼び出し元の責任のまま（アプリは解錠後にだけ
--   エディタを出し、MCP は事前に断る）。
--
-- SCOPE: 関数 1 本の作成のみ。テーブル / 列 / ポリシー / publication は
--   触らない。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `cd supabase && npm run db:push`。`apply_migration` MCP 単独使用は禁止
-- （本ファイルはローカルに置くだけ・エージェントは DB へ適用しない）。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。`create or replace function` なので
--   再実行安全。

begin;

create or replace function public.update_note_content(
  p_id text,
  p_content jsonb,
  p_expected_updated_at timestamptz,
  p_title text default null
)
returns table (saved boolean, updated_at timestamptz, content_json jsonb)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_updated_at timestamptz;
begin
  update public.items_meta m
     set updated_at = greatest(now(), m.updated_at + interval '1 millisecond'),
         title = coalesce(p_title, m.title)
   where m.id = p_id
     and m.role = 'note'
     and m.is_deleted = false
     and m.updated_at = p_expected_updated_at
  returning m.updated_at into v_updated_at;

  if found then
    update public.notes_payload p
       set content_json = p_content
     where p.item_id = p_id;
    return query select true, v_updated_at, null::jsonb;
    return;
  end if;

  -- Refused: hand back the version that is there now, body included, read in
  -- ONE statement so the stamp and the body belong to the same write.
  return query
    select false, m.updated_at, p.content_json
      from public.items_meta m
      join public.notes_payload p on p.item_id = m.id
     where m.id = p_id
       and m.role = 'note'
       and m.is_deleted = false;
end;
$$;

comment on function public.update_note_content(text, jsonb, timestamptz, text) is
  'Write a note body only if items_meta.updated_at still equals the version the caller read (Issue #2057). Returns saved=true with the new updated_at, saved=false with the current updated_at and body, or no row when the note is gone. Runs as the CALLER so RLS scopes it.';

revoke all on function public.update_note_content(text, jsonb, timestamptz, text) from public;
revoke all on function public.update_note_content(text, jsonb, timestamptz, text) from anon;
grant execute on function public.update_note_content(text, jsonb, timestamptz, text) to authenticated;

commit;

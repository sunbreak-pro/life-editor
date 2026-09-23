-- public.search_notes_content(q) — ノート本文の部分一致検索 (Issue #1972)
--
-- WHY: #1837 で配線した本文検索は、PostgREST のフィルタ
--   `notes_payload?content_json::text=ilike.*…*` を投げていた。PostgREST は
--   `select` の列にはキャストを書けるが、**フィルタの列名にはキャストを
--   書けない**。`content_json::text` という名前の列を探して見つからず、
--   リクエストは 404 で返る。サービス側はそれを投げ、フックが握って「本文の
--   一致なし」として扱うので、画面にはタイトルの一致だけが出ていた。
--
--   そこで比較を SQL 側に移し、クライアントは `client.rpc()` で呼ぶ。
--
-- 採らなかった案:
--
--   (a) notes_payload に `content_text text generated always as
--       (content_json::text) stored` を足してフィルタする案。notes_payload は
--       Realtime publication の加入テーブルなので、本文と同じ大きさの列が
--       変更通知のたびにもう 1 本乗る。行の全列を読む経路（`select("*")` や
--       mapper の列一覧）への波及も確認が要る。関数ならテーブルの形は変わらない。
--
--   (b) jsonb の全文検索（to_tsvector / GIN 索引）。既定の text search 構成は
--       日本語を語に区切れず（空白の無い文は 1 語になる）、部分一致が取れない。
--       pg_bigm 等の拡張は Supabase の無料枠で使える保証が無い。1 人あたりの
--       ノートは数百件規模で、ILIKE の全件走査で足りる。件数が桁で増えたら
--       pg_trgm の GIN 索引をこの関数の式に張る。
--
-- WHAT: 返すのは item_id だけ。本文は返さない。呼び出し側（
--   SupabaseNotesUnifiedSearch）は従来どおり id を items_meta と突き合わせて
--   is_deleted / role を絞り、本文はパスワードの有無を見てから別に読む。
--
--   `has_password = false` は関数の中に置く (#1763)。ロック中のノートの本文は
--   検索者が読んでよいものではなく、ヒットしたという事実も本文についての情報に
--   なる。クライアントのフィルタに任せると、呼び出し側を書き換えた人が外せて
--   しまう。
--
--   一致の意味は #1837 の意図と同じ `content_json::text ILIKE '%q%'`。jsonb の
--   テキスト表現は日本語をそのまま出す（\u エスケープしない）ので、本文の語で
--   当たる。キー名（"type" / "paragraph" 等）にも当たるのは既知の副作用で、
--   #1837 の設計と同じ。% と _ はワイルドカードのまま扱う（タイトル検索の
--   `.ilike("title", …)` と揃える）。
--
-- SECURITY: SECURITY INVOKER（既定）を明示し、呼び出し元の JWT で走らせる。
--   notes_payload の owner-only RLS がそのまま効くので、他人の行は読めない。
--   anon からは呼べない（0025 と同じ grant の形）。search_path は空にして、
--   参照はすべて public. で修飾する。
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

create or replace function public.search_notes_content(q text)
returns table (item_id text)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.item_id
    from public.notes_payload p
   where p.has_password = false
     and p.content_json::text ilike '%' || q || '%'
$$;

comment on function public.search_notes_content(text) is
  'Ids of the calling user''s unlocked notes whose content_json text contains q, case-insensitively (Issue #1972). Runs as the CALLER so RLS scopes it; returns ids only, never the body.';

revoke all on function public.search_notes_content(text) from public;
revoke all on function public.search_notes_content(text) from anon;
grant execute on function public.search_notes_content(text) to authenticated;

commit;

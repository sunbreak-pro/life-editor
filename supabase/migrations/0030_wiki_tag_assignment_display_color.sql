-- wiki_tag_assignments に created_at と is_display_color を追加 (Issue #1580)
--
-- WHY: Schedule のアイテムをタグの色で塗り分けるのに、2 つの事実が足りない。
--
--   (1) 「最初に付けたタグ」が分からない。既定の表示色はそれで決めると
--       #1580 が定めているのに、0008 以来この表の時刻列は `updated_at` 1 本
--       だけで、これは「最後に触った時刻」であって「付けた時刻」ではない。
--       ソフトデリートから復活させる（同じ行を再利用する）と値が今に飛ぶので、
--       代用にすると付け直した順に並び替わってしまう。
--
--   (2) 「どのタグの色を使うか」の選択を置く場所が無い。
--
-- WHERE: どちらも items_meta ではなく **wiki_tag_assignments** に置く。
--
--   色はタグの持ち物であり、アイテムが持つのは「どのタグを表示色に使うか」だけ
--   という現行方針（web/src/wikitag/TagColorControls.tsx ヘッダー）を崩さない。
--   そして「アイテムとタグの結びつき」を表しているのがまさにこの表なので、
--   「この結びつきが表示色である」という印はここが正しい置き場になる。
--
--   items_meta に display_tag_id を足す案は却下した。5 role 共有の表なので
--   task / event / routine の 3 mapper と 3 サービスの SELECT 一覧・書き込み
--   経路が全部動くことになり、Schedule が既に丸ごと読んでいる
--   wiki_tag_assignments（listAllTagAssignments）で完結する話に対して代償が
--   大きすぎる。読み手（useScheduleGridFilters）は allTags と allAssignments を
--   既に受け取っており、この 2 列でその場で解決できる。
--
-- SCOPE: DDL のみ（列 2 本 + 索引 2 本）。
--
--   created_at は backfill する。既存行を `default now()` で埋めると全行が
--   同時刻になり「最初に付けたタグ」が決まらなくなるため、手元にある唯一の
--   履歴 = updated_at を写す。完全ではない（触った時刻が入る）が、全行同値
--   よりは真実に近い。
--
--   is_display_color は既定 false = 「明示的な選択なし」。読み手はその場合
--   created_at 昇順の先頭にフォールバックするので、backfill は要らない。
--
--   partial UNIQUE (item_id) WHERE is_display_color AND NOT is_deleted で
--   「1 アイテムにつき表示色タグは高々 1 つ」を DB が保証する。書き込みは
--   「そのアイテムの印を全部落としてから 1 つ立てる」の順で、逆にすると
--   一瞬この索引に違反する。
--
--   RLS は列単位ではないので wiki_tag_assignments の owner-only ポリシー
--   (0008 §12 / 0010 initplan-cached) がそのまま新列も覆う。Realtime
--   publication は既加入のテーブル (0017) なので変更なし。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
--
-- ⚠️ MERGE ORDER: この 2 列は WIKI_TAG_ASSIGNMENTS_COLUMNS の SELECT 一覧に
-- 入る。本番に列が無い状態でコードだけ入ると、タグの一括読み込み
-- (listAllTagAssignments) が PostgREST 42703 で落ち、**タグを使う画面が全部**
-- 巻き添えになる（Schedule のレンズ・Connect・Notes のタグ絞り込み）。
-- **push が merge より先**であること。#1374 (0028) と同じ順序制約。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。`add column if not exists` /
--   `create index if not exists` で再実行安全。backfill は
--   `where created_at is null` なので 2 回目は 0 行。

begin;

-- (1) 付けた時刻 --------------------------------------------------------

alter table public.wiki_tag_assignments
  add column if not exists created_at timestamptz;

-- 既存行: 手元にある唯一の履歴を写す。新規行は下の default が効く。
update public.wiki_tag_assignments
   set created_at = updated_at
 where created_at is null;

alter table public.wiki_tag_assignments
  alter column created_at set default now();

alter table public.wiki_tag_assignments
  alter column created_at set not null;

comment on column public.wiki_tag_assignments.created_at is
  'このタグを付けた時刻 (#1580)。updated_at は「最後に触った時刻」で、'
  'ソフトデリートからの復活で今に飛ぶため「最初に付けたタグ」の根拠にできない。';

create index if not exists idx_wta_created_at
  on public.wiki_tag_assignments (created_at);

-- (2) 表示色に使うタグ --------------------------------------------------

alter table public.wiki_tag_assignments
  add column if not exists is_display_color boolean not null default false;

comment on column public.wiki_tag_assignments.is_display_color is
  'この結びつきのタグの色を、アイテムの表示色に使う (#1580)。'
  'false 一色 = 明示的な選択なし → 読み手は created_at 昇順の先頭に落ちる。';

-- 1 アイテムにつき高々 1 つ。書き込みは「全部落としてから 1 つ立てる」順で、
-- 逆順だと一瞬ここに違反する。
create unique index if not exists uq_wta_display_color
  on public.wiki_tag_assignments (item_id)
  where is_display_color and is_deleted = false;

commit;

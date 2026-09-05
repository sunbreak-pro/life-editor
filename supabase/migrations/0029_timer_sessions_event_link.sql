-- timer_sessions に event_id を追加 — 稼働時間の紐付け先を Todo から Event へ広げる (Issue #1375)
--
-- WHY: Work タイマーで測った時間は 0018 以来 `task_id`（Todo）にしか紐づかず、
--   「この予定に何時間かけたか」を残す場所が無かった。#1373 で Event から
--   完了ステータスを廃止したため、「その予定がどうなったか」を実績時間で
--   置き換える必要がある。
--
--   保存形の選択（Issue #1375 の「先に決めること」）:
--     採用 = sessions 側に参照列（event_id）を足す。
--     却下 = events_payload 側に集計値（合計分数）を持つ。集計値の二重持ちに
--       なり、セッションの削除・部分停止のたびに再計算が要る。参照列なら
--       実績時間は常に sessions からの導出値で、ズレようが無い。
--
--   `task_id` と同じく FK は張らない（0018 の設計理由をそのまま踏襲）:
--   セッションは対象アイテムより長生きしてよく、items_meta 側は自分の RLS を
--   持つので、ここで結合すると独立した削除がブロックされる。
--
--   role 判別列（item_role）は足さない。id は role を跨いで一意（CLAUDE.md §4）
--   なので、どちらの列に入っているかがそのまま role を表す。
--
-- SCOPE: DDL のみ = 列追加 1 本 + 索引 1 本 + CHECK 制約 1 本。backfill 不要
--   （既存行はすべて event_id NULL = 従来どおり Todo 紐付けか未紐付け）。
--   RLS は列単位ではないので timer_sessions の owner-only ポリシー 4 本（0018）
--   がそのまま新列も覆う。Realtime publication も 0018 で加入済みのため変更なし。
--
--   CHECK は「1 セッションの紐付け先は高々 1 つ」を DB 側で担保する。
--   両方入った行があると aggregateWorkTimeByTag が同じ分数を 2 つのアイテムへ
--   数えてしまい、リングの合計が実際の稼働時間を超える。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
--
-- ⚠️ MERGE ORDER: `event_id` は TIMER_SESSION_COLUMNS の SELECT 一覧に入るため、
-- 本番に列が無い状態でコードだけ入ると timer_sessions の SELECT が全部
-- PostgREST 42703 で落ちる（Work タブと Analytics が丸ごと死ぬ）。
-- **push が merge より先**であること。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。`add column if not exists` /
--   `create index if not exists` / 制約は `drop ... if exists` → `add` で
--   再実行安全（Postgres は `add constraint if not exists` を持たない）。

begin;

alter table public.timer_sessions
  add column if not exists event_id text;

comment on column public.timer_sessions.event_id is
  'このセッションを紐づけた Event の items_meta.id (#1375)。NULL = Event 紐付け無し。'
  'task_id と同じく FK は張らない（セッションは対象より長生きしてよい）。';

-- task_id と同じ形の索引。予定の詳細から「この予定の実績時間」を引くときに
-- event_id で絞るため、seq scan を避ける。
create index if not exists idx_timer_sessions_event
  on public.timer_sessions (event_id);

-- 紐付け先は高々 1 つ。両方 NULL（どこにも紐づかない自由計測）は従来どおり許可。
alter table public.timer_sessions
  drop constraint if exists timer_sessions_single_attribution;
alter table public.timer_sessions
  add constraint timer_sessions_single_attribution
  check (task_id is null or event_id is null);

commit;

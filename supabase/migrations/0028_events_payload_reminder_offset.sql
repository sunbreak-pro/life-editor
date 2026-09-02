-- events_payload に reminder_offset_min を追加 (Issue #1374)
--
-- WHY: 予定のリマインダー（開始の何分前に知らせるか）。0008 以来 events_payload
--   が持っているのは絶対時刻の `reminder_at timestamptz` だけで、全書き込みが
--   literal null（mcp-server / SupabaseScheduleItemsService / mapper のいずれも
--   null 固定）。実データが 1 行も無いので、互換性の負債ゼロでオフセット表現へ
--   乗り換える。
--
--   絶対時刻ではなくオフセットにする理由:
--     (1) 予定を動かすたびに再計算が要り、その計算にはタイムゾーンの知識が要る。
--         scheduleItemMapper は「TZ を知らない純粋関数」であることを自分の
--         ヘッダで明言しており、そこに TZ 演算を持ち込むのは設計違反になる。
--         オフセットなら移動に対して不変。
--     (2) tasks_payload / routines_payload はどちらも `reminder_offset` /
--         `template_reminder_offset_min` を持っており、3 role で形が揃う。
--
--   NULL = リマインダー無し。既定値（Settings の「既定の通知タイミング」）は
--   作成時に行へ書き込むため、読み取り時に既定へフォールバックしない —
--   「通知しない」と「まだ決めていない」が区別できなくなるのを避ける。
--
--   `reminder_at` は本マイグレーションでは DROP しない（DDL は不可逆・退役は
--   別 Issue）。当面は書かれず読まれない列として残る。
--
-- SCOPE: DDL のみ（列追加 1 本）。backfill 不要 = 既存行はすべて NULL で
--   「リマインダー無し」になる。RLS は列単位ではないので events_payload の
--   owner-only ポリシー 4 本（0008 / 0011 initplan-cached）がそのまま新列も
--   覆う。索引は不要（この列で絞り込まず、スイープは 2 日分の行をまるごと読む）。
--   Realtime publication は既加入のテーブルなので変更なし。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
--
-- ⚠️ MERGE ORDER: この列は EVENTS_PAYLOAD_COLUMNS の SELECT 一覧に入るため、
-- 本番に列が無い状態でコードだけ入ると schedule の SELECT が全部 PostgREST
-- 42703 で落ちる。**push が merge より先**であること。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。`add column if not exists` で
--   再実行安全。

begin;

alter table public.events_payload
  add column if not exists reminder_offset_min integer;

comment on column public.events_payload.reminder_offset_min is
  '開始の何分前に通知するか (#1374)。NULL = リマインダー無し。絶対時刻ではなく'
  'オフセットで持つので、予定を動かしても再計算が要らない。';

commit;

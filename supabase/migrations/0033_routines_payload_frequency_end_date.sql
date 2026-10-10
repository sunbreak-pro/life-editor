-- routines_payload に frequency_end_date を追加 (Issue #2082)
--
-- WHY: 繰り返し（Routine）に「いつまで続けるか」を持たせる。これまでシリーズの
--   始まりは `frequency_start_date`（interval の起点）で持てたが、終わりを持つ
--   列が無く、終わらせるには繰り返しごと消すしかなかった。
--
--   値は `frequency_start_date` と同じ形の "YYYY-MM-DD" テキスト（ローカル暦日。
--   date / timestamptz にすると JST の日付境界がずれる = S4-0 D-1 と同じ理由）。
--   **終了日を含む**（その日の回までは作る）。NULL = 終了日なし（無期限）で、
--   既存の繰り返しはすべてこの状態になる。
--
--   0008 の parent-plan 側の列 `end_at text` は使わない。mapper / MCP が常に
--   NULL を書く「将来の契約統合用の予約列」で、意味が決まっていないため。
--   現行 shape（frequency_*）の命名に揃えた専用列にする。
--
-- SCOPE: DDL のみ（列追加 1 本）。backfill 不要 = 既存行はすべて NULL で
--   「終了日なし」= 今までと同じ挙動。RLS は列単位ではないので routines_payload
--   の owner-only ポリシーがそのまま新列も覆う。索引は不要（この列で絞り込まず、
--   生成器はクライアント側で 1 行ずつ読む）。Realtime publication は既加入の
--   テーブルなので変更なし。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
--
-- ⚠️ MERGE ORDER: この列は ROUTINES_PAYLOAD_COLUMNS（shared）と MCP の
-- routineHandlers の SELECT 一覧に入るため、本番に列が無い状態でコードだけ
-- 入ると routine の SELECT が全部 PostgREST 42703 で落ちる。
-- **push が merge より先**であること。Cloudflare の Remote MCP Worker
-- （mcp-server/src/worker.ts）も同じ SELECT を使うので、Worker のデプロイも
-- push の後にする。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。`add column if not exists` で
--   再実行安全。

begin;

alter table public.routines_payload
  add column if not exists frequency_end_date text;

comment on column public.routines_payload.frequency_end_date is
  '繰り返しの終了日 (#2082)。"YYYY-MM-DD" のローカル暦日で、その日を含む。'
  'NULL = 終了日なし。これより後の日には回を作らない。';

commit;

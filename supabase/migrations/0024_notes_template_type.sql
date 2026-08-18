-- notes_payload.note_type に 'template' を追加 (Issue #1047)
--
-- WHY: ノートのテンプレート機能。テンプレートは「本文と名前を持つノートと同じ形
--   のもの」なので、専用テーブルを足さず notes_payload の note_type に 3 つ目の
--   値 'template' を足して表現する（items_meta.role は 'note' のまま = 2 行分割
--   モデルと ID 不変式に手を入れない）。テンプレート行は一覧 / 検索 / 件数 /
--   ゴミ箱から除外され、テンプレートパネルだけが読む（除外は
--   SupabaseNotesUnifiedReads / -Search の keep フィルタ側）。
--
--   note_type は 0008 でインライン check として作られており、Postgres が
--   notes_payload_note_type_check という名前を付けている。列の制約なので
--   drop → add で入れ替える。
--
-- SCOPE: DDL のみ（check 制約の入れ替え 1 本）。既存行の backfill 不要 —
--   'folder' / 'note' / NULL はすべて従来どおり通る。RLS は列単位ではないので
--   notes_payload の既存ポリシーがそのまま効く（変更不要）。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。drop constraint if exists → add で
--   再実行安全。

begin;

alter table public.notes_payload
  drop constraint if exists notes_payload_note_type_check;

alter table public.notes_payload
  add constraint notes_payload_note_type_check
  check (note_type in ('folder', 'note', 'template'));

commit;

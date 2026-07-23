-- wiki_tags.icon 列追加 (Issue #310 part 2)
--
-- WHY (#310 part 2 追加パート): life-tag (wiki_tag) を「アイコン + 名称 + 色 + 使用数」
--   で管理する Tag 編集モーダルと、後続 #311（見出しでのアイコン表示）のため、
--   wiki_tags に任意アイコン名を保持する列を足す。値は lucide-react のアイコン名
--   （例 "Tag" / "Star"）を文字列で持ち、フロントで name→コンポーネント解決する。
--   color と同じ nullable・default 無しの任意メタデータ扱い。
--
-- SCOPE: DDL のみ（列追加 1 本）。既存行への backfill は不要（null = 未設定 =
--   フロントがデフォルトアイコンにフォールバック）。RLS は列単位ではないため
--   wiki_tags の既存ポリシーがそのまま新列にも効く（変更不要）。
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
-- ─────────────────────────────────────────────────────────────────────────
--
-- ATOMICITY: begin/commit でアトミック化。add column if not exists で再実行安全。

begin;

alter table public.wiki_tags add column if not exists icon text;

commit;

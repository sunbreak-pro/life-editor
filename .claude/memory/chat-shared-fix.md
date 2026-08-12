# MEMORY (chat-shared-fix)

## 進行中

### 🔧 #782 MCP 棚卸しの残り 3 塊（着手日: 2026-08-13）

**対象**: `mcp-server/**`

- 前回: —
- 現在: 塊①（restore_item / delete_note / untag_entity / update_note is_pinned）の実装
- 次: 塊②（get_daily の exists/isTrashed/hasBriefing・search_all の id/hasMore/total/offset）→ 塊③（get_week_context / get_note_context — 実装前に返す内容を Issue にコメント）

## 直近の完了

- #672 use\*API load effect 共通化の完走（schedule 導出化 + baseline 全削除 = PR #801 open・merge 後 playwright は chat-main 宛て）✅（2026-08-13）
- #669 core-refactor C2（mcp-server の書き込みを `utils/items` へ・`tools.ts` を宣言的レジストリ + 引数 validator・db-conventions §13）✅（2026-08-11・PR #694 open）
- #587 Notes 神ファイル 2 本の分割（PR #642 = useNotesUnifiedAPI 1075→429 行・PR #647 = SupabaseNotesUnifiedService 842→303 行・どちらも merged）✅（2026-08-10）

## 予定

- #700（MCP 検証用ツール）— one writer per artifact のため #782 完了後に同一レーンで処理
- PR #801 merge 後の playwright 検証は chat-main（PR 本文に申し送り済み・完了で #672 close）

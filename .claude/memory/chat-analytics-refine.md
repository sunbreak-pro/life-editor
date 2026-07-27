# MEMORY (chat-analytics-refine)

## 進行中

（なし）

## 直近の完了

- #375 Notes folder 退役の後段 + Connect の project ノード撤去（PR #405・merge 待ち）✅（2026-07-27）— S3（#225）が「意図的な過渡期非対称」として温存していた Notes 側を撤去。`NoteNodeType = "note"` 単一化 / `createFolder` 撤去（undo ラベル i18n も en/ja lockstep）/ **legacy `note_type='folder'` 行の fetch 時除外を新設**（`isLegacyNoteFolderRow` — list・Trash・search・MCP `fetchLiveNotes` の 4 経路。Tasks 側 `isLegacyFolderRow` と同型）/ Connect は `project` ノード種別ごと退役し tag ノード（`wiki_tags` + `wiki_tag_assignments` 由来）を後継に（方針はユーザー確定）。DDL 変更なし。shared 1168 tests + shared/web/mcp-server build green
- #362 の再着地 ✅（2026-07-27）— PR #401 merge 済み・Issue #362 close 済み。着地は内容で実測（`git ls-tree origin/main -- mcp-server/src/handlers/fileHandlers.ts` が空・`origin/main:mcp-server/src/tools.ts` の `"list_files"` grep が 0）。stacked PR #397 が MERGED 表示のまま main へ届いていなかった件のリカバリ完了
- #360 mcp-server の DROP 済み legacy テーブル参照を解消（PR #396 merge 済み・Issue close 済み）✅（2026-07-26）— 0007 で消えた tasks/notes/dailies/schedule_items を見ていた 18 ツールを `items_meta` + `<role>_payload` へ移行。共通 utils 3 本新規（`items` / `pagination` / `content`）。better-sqlite3 + db.ts 削除、`.mcp.json` を Supabase 資格情報参照に差し替え

## 予定

- chat-main が実 Supabase で MCP ツール疎通確認（`list_tasks` / `get_task_tree` / `search_all` = tier-1-core AC2 / AC9）。この worktree に資格情報が無く未検証。実行には `LIFE_EDITOR_SUPABASE_URL` / `_ANON_KEY` / `_EMAIL` / `_PASSWORD` のシェル環境 export が必要（`.mcp.json` は `${VAR}` 参照のみ持つ。#256 時点から未配線だった）
- **stacked PR を今後出すときの教訓**: base 側 merge → GitHub の base 張り替えを待つ → 後続 merge の順。同時 merge で後続が迷子になる（本件 #397）。着地確認は PR state ではなく内容の実測で行う（memory `stacked-pr-base-retarget-race`）
- PR #405 merge 後: Issue #375 は `Closes #375` で自動 close。merge 後の実ブラウザ確認（Connect 凡例が note/daily/tag の 3 つ・Notes の Trash に幽霊 folder が出ないこと）は chat-main 側で
- chat-main へ起票依頼済みの別件フォロー: 完了 Todo の「今日」が UTC 日基準（`completedAt.substring(0,10)` vs ローカル暦日キーの非対称。JST では朝 8 時までの完了が前日カウント）— 起票されたら analytics レーンで対応
- analytics rightSidebar パネル中身の定義（プレースホルダー継続可・タグ別/期間別集計フィルタが候補。#334 でタグ集計の土台ができた）
- 後続: life-tags（兄弟計画・着手は合図待ち）

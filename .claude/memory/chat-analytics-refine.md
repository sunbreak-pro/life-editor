# MEMORY (chat-analytics-refine)

## 進行中

（なし）

## 直近の完了

- #418 タスク入れ子（ネスト）dead code チェーンの退役（**PR #424 merge 済み**。独立監査の指摘反映 = 追随 **PR #432** が merge 待ち）✅（2026-07-27）— folder 退役（#225）で `NodeType` が単一値になった結果、`moveNodeInto` のガード（`target.type === "task"`）が常に真になり必ず失敗していた件。ただし唯一の呼び出し元 `web/src/tasks/useTaskTreeDnd.ts` が repo 内ゼロ参照で、機能自体が画面に未配線だった → ユーザー判断で**ガード修正ではなくチェーンごと退役**。撤去 = 両 movement hook の `moveNodeInto` と `moveNode` の親変更分岐 / `useTaskTreeDnd.ts`（281 行）/ `MoveRejectionReason` の `target_is_task`・`parent_is_task` / 誤コメント群。残置 = `moveNode` の並び替え本体（兄弟リスト内専用に縮小・非兄弟へのドロップは既存の `findIndex === -1` に落として `node_not_found`。新しい reason は増やしていない）/ `moveToRoot` / `isDescendantOf`（実測で `moveNode` が継続使用）。i18n は対応キーが元から存在せず変更なし。新規テスト `treeMovementReorderOnly.test.ts`（8 件）。shared 1184 tests + shared/web build green
- #375 Notes folder 退役の後段 + Connect の project ノード撤去（**PR #405 / 追随 PR #417 とも merge 済み・Issue #375 close 済み**）✅（2026-07-27）— S3（#225）が「意図的な過渡期非対称」として温存していた Notes 側を撤去。`NoteNodeType = "note"` 単一化 / `createFolder` 撤去（undo ラベル i18n も en/ja lockstep）/ **legacy `note_type='folder'` 行の fetch 時除外を新設**（`isLegacyNoteFolderRow` — list・Trash・search・MCP `fetchLiveNotes` の 4 経路。Tasks 側 `isLegacyFolderRow` と同型）/ Connect は `project` ノード種別ごと退役し tag ノード（`wiki_tags` + `wiki_tag_assignments` 由来）を後継に（方針はユーザー確定）。DDL 変更なし。shared 1168 tests + shared/web/mcp-server build green
- #362 の再着地 ✅（2026-07-27）— PR #401 merge 済み・Issue #362 close 済み。着地は内容で実測（`git ls-tree origin/main -- mcp-server/src/handlers/fileHandlers.ts` が空・`origin/main:mcp-server/src/tools.ts` の `"list_files"` grep が 0）。stacked PR #397 が MERGED 表示のまま main へ届いていなかった件のリカバリ完了

## 予定

- chat-main が実 Supabase で MCP ツール疎通確認（`list_tasks` / `get_task_tree` / `search_all` = tier-1-core AC2 / AC9）。この worktree に資格情報が無く未検証。実行には `LIFE_EDITOR_SUPABASE_URL` / `_ANON_KEY` / `_EMAIL` / `_PASSWORD` のシェル環境 export が必要（`.mcp.json` は `${VAR}` 参照のみ持つ。#256 時点から未配線だった）
- **stacked PR を今後出すときの教訓**: base 側 merge → GitHub の base 張り替えを待つ → 後続 merge の順。同時 merge で後続が迷子になる（本件 #397）。着地確認は PR state ではなく内容の実測で行う（memory `stacked-pr-base-retarget-race`）
- PR #417（#375 の QA 追随）は merge 済み。残るは実ブラウザ確認（Connect 凡例が note/daily/tag の 3 つ・Notes の Trash に幽霊 folder が出ないこと）で、これは chat-main 側の担当
- **#418 の判断保留 1 件**: `shared/src/utils/noteDropIntent.ts`（`computeNoteDropIntent`）は `useTaskTreeDnd` 削除で src 内の消費者ゼロになったが、barrel の公開 API + 専用テストを持つ純関数で above/below 判定は並び替え側の primitive のため残置した。ファイルごと消すかはユーザー判断待ち（PR #424 本文と Issue #418 コメントに明記済み）
- **base の鮮度を毎回実測する**（2026-07-27 の失敗）: 「lint error は main 時点で既存」と報告したが、判定に使った `git stash` は**自分の古い base との比較**でしかなく、実際は同日 merge の PR #402 が解決済みだった。main 由来かどうかは `git show origin/main:<path>` で見る。着手前の `git merge origin/main` を飛ばさない（CLAUDE.md §7.4）
- chat-main へ起票依頼済みの別件フォロー: 完了 Todo の「今日」が UTC 日基準（`completedAt.substring(0,10)` vs ローカル暦日キーの非対称。JST では朝 8 時までの完了が前日カウント）— 起票されたら analytics レーンで対応
- analytics rightSidebar パネル中身の定義（プレースホルダー継続可・タグ別/期間別集計フィルタが候補。#334 でタグ集計の土台ができた）
- 後続: life-tags（兄弟計画・着手は合図待ち）

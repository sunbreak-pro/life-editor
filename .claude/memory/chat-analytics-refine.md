# MEMORY (chat-analytics-refine)

## 進行中

- #369 リスト系の低優先 follow-up まとめ（実装完了・**PR 提出済み / merge 待ち**。ブランチ `claude/analytics-369-list-followups`。同 PR に本セッションの task-tracker 記録も同梱）

## 直近の完了

- **#420 / #428 / #429 / #430 の 4 件**（PR **#437 / #440 / #442 / #445** + 監査追随 **#449** すべて merge 済み・Issue 4 件とも close）✅（2026-07-28）— open-issue fan-out の analytics レーン分。**#420** = `completedAt` の UTC 文字列を消費側 5 箇所が `substring(0, 10)` で切っていて、ローカル暦日キー（#356）のバケットと食い違い JST 09:00 前の完了が前日に落ちていた件 → `dateKeyOfInstant()` へ統一（過去データの見え方が変わる旨を PR 本文に明記）。**#428** = タグ別作業時間が trash 済みタスクを含む件 → **案 1（trash 除外）を採用**し `aggregateWorkTimeByTag` に `liveTasks` を必須引数で追加（#365 の副作用ではなく #365 のやり残し半分。`fetchTaskTree` / Connect と挙動を揃えた）。**#429** = `aggregateTagByEntityType` を退役（統合後の型に `entityType` が無く、呼ぶと黙って全ゼロを返す状態。呼び出し元ゼロを grep 全数実測）。**#430** = `[[` 候補フェッチの遅延化（`useItemLinkTargets` を ref 専用に書き換え、`@tiptap/suggestion` の `items()` が await する性質を使ってメニューを開くまでフェッチしない。3 role + `balanceByRole` の配分は維持）。監査追随 #449 で **CI（UTC）では #420 のテストが絶対に落ちない**問題を `vitest.config.ts` の `test.env.TZ = "Asia/Tokyo"` 固定で解消し、`createdAt` 側の取りこぼし 2 箇所も回収。shared 1225 tests + shared/web build green
- #418 タスク入れ子（ネスト）dead code チェーンの退役（**PR #424 merge 済み**。独立監査の指摘反映 = 追随 **PR #432** が merge 待ち）✅（2026-07-27）— folder 退役（#225）で `NodeType` が単一値になった結果、`moveNodeInto` のガード（`target.type === "task"`）が常に真になり必ず失敗していた件。ただし唯一の呼び出し元 `web/src/tasks/useTaskTreeDnd.ts` が repo 内ゼロ参照で、機能自体が画面に未配線だった → ユーザー判断で**ガード修正ではなくチェーンごと退役**。撤去 = 両 movement hook の `moveNodeInto` と `moveNode` の親変更分岐 / `useTaskTreeDnd.ts`（281 行）/ `MoveRejectionReason` の `target_is_task`・`parent_is_task` / 誤コメント群。残置 = `moveNode` の並び替え本体（兄弟リスト内専用に縮小・非兄弟へのドロップは既存の `findIndex === -1` に落として `node_not_found`。新しい reason は増やしていない）/ `moveToRoot` / `isDescendantOf`（実測で `moveNode` が継続使用）。i18n は対応キーが元から存在せず変更なし。新規テスト `treeMovementReorderOnly.test.ts`（8 件）。shared 1184 tests + shared/web build green
- #375 Notes folder 退役の後段 + Connect の project ノード撤去（**PR #405 / 追随 PR #417 とも merge 済み・Issue #375 close 済み**）✅（2026-07-27）— S3（#225）が「意図的な過渡期非対称」として温存していた Notes 側を撤去。`NoteNodeType = "note"` 単一化 / `createFolder` 撤去（undo ラベル i18n も en/ja lockstep）/ **legacy `note_type='folder'` 行の fetch 時除外を新設**（`isLegacyNoteFolderRow` — list・Trash・search・MCP `fetchLiveNotes` の 4 経路。Tasks 側 `isLegacyFolderRow` と同型）/ Connect は `project` ノード種別ごと退役し tag ノード（`wiki_tags` + `wiki_tag_assignments` 由来）を後継に（方針はユーザー確定）。DDL 変更なし。shared 1168 tests + shared/web/mcp-server build green
- #362 の再着地 ✅（2026-07-27）— PR #401 merge 済み・Issue #362 close 済み。着地は内容で実測（`git ls-tree origin/main -- mcp-server/src/handlers/fileHandlers.ts` が空・`origin/main:mcp-server/src/tools.ts` の `"list_files"` grep が 0）。stacked PR #397 が MERGED 表示のまま main へ届いていなかった件のリカバリ完了

## 予定

- chat-main が実 Supabase で MCP ツール疎通確認（`list_tasks` / `get_task_tree` / `search_all` = tier-1-core AC2 / AC9）。この worktree に資格情報が無く未検証。実行には `LIFE_EDITOR_SUPABASE_URL` / `_ANON_KEY` / `_EMAIL` / `_PASSWORD` のシェル環境 export が必要（`.mcp.json` は `${VAR}` 参照のみ持つ。#256 時点から未配線だった）
- **stacked PR を今後出すときの教訓**: base 側 merge → GitHub の base 張り替えを待つ → 後続 merge の順。同時 merge で後続が迷子になる（本件 #397）。着地確認は PR state ではなく内容の実測で行う（memory `stacked-pr-base-retarget-race`）
- PR #417（#375 の QA 追随）は merge 済み。残るは実ブラウザ確認（Connect 凡例が note/daily/tag の 3 つ・Notes の Trash に幽霊 folder が出ないこと）で、これは chat-main 側の担当
- **#418 の判断保留 1 件**: `shared/src/utils/noteDropIntent.ts`（`computeNoteDropIntent`）は `useTaskTreeDnd` 削除で src 内の消費者ゼロになったが、barrel の公開 API + 専用テストを持つ純関数で above/below 判定は並び替え側の primitive のため残置した。ファイルごと消すかはユーザー判断待ち（PR #424 本文と Issue #418 コメントに明記済み）
- **base の鮮度を毎回実測する**（2026-07-27 の失敗）: 「lint error は main 時点で既存」と報告したが、判定に使った `git stash` は**自分の古い base との比較**でしかなく、実際は同日 merge の PR #402 が解決済みだった。main 由来かどうかは `git show origin/main:<path>` で見る。着手前の `git merge origin/main` を飛ばさない（CLAUDE.md §7.4）
- 完了 Todo の「今日」が UTC 日基準だった件は **#420 として起票 → PR #437 / #449 で対応完了**（2026-07-28）
- **テストの前提タイムゾーンは config で固定する**（2026-07-28 の失敗）: #420 のローカル暦日テストは開発機（JST）では意味を持つが、CI は ubuntu = UTC でローカル日 == UTC 日になり、**守るべきバグをそのまま通してしまう**状態だった。時刻・暦日に依存するテストを書いたら `vitest.config.ts` の `test.env.TZ` を確認する
- #420 / #428 / #429 / #430 の実ブラウザ確認は chat-main 側の担当（Analytics の完了数・タグ別作業時間・Notes/Daily の `[[` メニュー初回表示）
- outbox に起票依頼 1 件を残した: legacy `WikiTagAssignment` / `WikiTagEntityType` が #429 で宣言のみになった → DU-F の legacy タグ API 退役とまとめて掃除
- analytics rightSidebar パネル中身の定義（プレースホルダー継続可・タグ別/期間別集計フィルタが候補。#334 でタグ集計の土台ができた）
- 後続: life-tags（兄弟計画・着手は合図待ち）

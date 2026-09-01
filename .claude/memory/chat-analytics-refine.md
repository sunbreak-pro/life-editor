# MEMORY (chat-analytics-refine)

## 進行中

（なし）

## 直近の完了

- #1379 タグ使用状況カード ✅（2026-09-01 実装完了・PR #1419 open）— Overview に「選択期間に作られたアイテムのタグ別付与数」と「現在の総数」を 2 列で並べるカードを追加。窓が違う 2 つの数字を 1 つの見出しに並べない（#780 / #860 の戒め）ため、`TagUsageBucket` で `rangeCount` / `totalCount` を型レベル分離 + 列ごとに `scope="col"` 見出し + カード meta にプリセット名。期間はタグ付与時刻ではなく**アイテムの `createdAt`** で切る（`wiki_tag_assignments` に `created_at` が無い = 0008 migration:850。厳密版は親 #1375）。`aggregateWorkTimeByTag` は無変更。**web ホストに `fetchEvents()` を追加**（Issue の配線メモは「ホストのフェッチ不要」だったが、props の `scheduleItems` はプリセットごと再取得 + 予定の開催日キーのため、「総数は変わらない」と「期間内に作成」のどちらも答えられない）。CI verify 全ステップをローカル実行して緑（shared 2822 / web 1019 / desktop 29 / mcp 322 tests + docs-lint OK）
- #369 リスト系の低優先 follow-up まとめ（**PR #456 merge 済み**）✅（2026-07-28）
- **#420 / #428 / #429 / #430 の 4 件**（PR **#437 / #440 / #442 / #445** + 監査追随 **#449** すべて merge 済み・Issue 4 件とも close）✅（2026-07-28）— open-issue fan-out の analytics レーン分。**#420** = `completedAt` の UTC 文字列を消費側 5 箇所が `substring(0, 10)` で切っていて、ローカル暦日キー（#356）のバケットと食い違い JST 09:00 前の完了が前日に落ちていた件 → `dateKeyOfInstant()` へ統一（過去データの見え方が変わる旨を PR 本文に明記）。**#428** = タグ別作業時間が trash 済みタスクを含む件 → **案 1（trash 除外）を採用**し `aggregateWorkTimeByTag` に `liveTasks` を必須引数で追加（#365 の副作用ではなく #365 のやり残し半分。`fetchTaskTree` / Connect と挙動を揃えた）。**#429** = `aggregateTagByEntityType` を退役（統合後の型に `entityType` が無く、呼ぶと黙って全ゼロを返す状態。呼び出し元ゼロを grep 全数実測）。**#430** = `[[` 候補フェッチの遅延化（`useItemLinkTargets` を ref 専用に書き換え、`@tiptap/suggestion` の `items()` が await する性質を使ってメニューを開くまでフェッチしない。3 role + `balanceByRole` の配分は維持）。監査追随 #449 で **CI（UTC）では #420 のテストが絶対に落ちない**問題を `vitest.config.ts` の `test.env.TZ = "Asia/Tokyo"` 固定で解消し、`createdAt` 側の取りこぼし 2 箇所も回収。shared 1225 tests + shared/web build green

## 予定

- **#1379 のスコープ逸脱 1 件をユーザーに確認**（PR #1419 本文に明記）: Issue の配線メモは「web ホストのフェッチを触らずに済む」だったが、DoD の「3 role を数える」と「総数は期間で変わらない」を両立させるには `fetchEvents()` の追加が要った。AC を優先した判断でよいかの追認待ち
- #1379 の実ブラウザ確認は chat-main 側の担当（Overview のタグ使用状況カード — プリセットを動かして左の数字だけが動くこと）
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

# MEMORY (chat-analytics-refine)

## 進行中

（なし）

## 直近の完了

- **#1476〜#1480 Analytics の実ブラウザ点検 5 件**（#1408 由来）✅（2026-09-05 実装完了・**PR #1494 merged / #1500 / #1504 / #1508 / #1511 open・4 本とも CI SUCCESS**）— 1 Issue = 1 ブランチ（origin/main 起点）= 1 PR。#1476 期間プリセットが Todo 完了トレンドに効かない（`days={30}` 直書き → `dateRangeDays()` に正本化。**作業タブは #860 の判断を尊重して据え置き・コメントで理由を明記**）／ #1477 タグ別作業時間の円グラフのラベルがカードをはみ出す（recharts の外側ラベルはクリップされない → 割合を凡例へ・名前で照合）／ #1478 ja に残る英語ラベル（区分名と No Todo を集計関数から i18n へ・Y 軸幅 80→96px）／ #1479 Todo 別作業時間の Y 軸に生 id（名前を引けない = ゴミ箱送り → #428 と同じ規則で行ごと除外）／ #1480 タイルの省略（列数がウィンドウ基準 → データカラムに `@container`・見出しは折り返しへ。ストリークの件は #1467 で解決済み）
- **#1375 Work の実績時間を Event に紐づけ + タグ別稼働時間の Event 対応** ✅（2026-09-02 実装完了・**PR #1456 open**）— `timer_sessions` に `event_id`（migration 0029・**`supabase db push` はユーザーの手番で、merge より先に必要**）／ `startTimerSession` の第 2 引数を `WorkTarget { kind, id }` に／ `aggregateWorkTimeByTag` の 4 番目を構造型 `WorkTimeItem[]` へ（Todo だけ渡す既存呼び出しは数値不変）／ Work のピッカーが Todo + 今後 7 日の予定を 1 リストで提示／ 予定の編集パネルに読み取り専用の実績時間行。`ActiveTodo` → `ActiveWorkItem` の改名込み。CI verify 全ステップ + docs-lint をローカル実測して緑（shared 2876 / web 1051 / desktop 30 / mcp 322）
- #1379 タグ使用状況カード ✅（2026-09-01 実装完了・PR #1419 open）— Overview に「選択期間に作られたアイテムのタグ別付与数」と「現在の総数」を 2 列で並べるカードを追加。窓が違う 2 つの数字を 1 つの見出しに並べない（#780 / #860 の戒め）ため、`TagUsageBucket` で `rangeCount` / `totalCount` を型レベル分離 + 列ごとに `scope="col"` 見出し + カード meta にプリセット名。期間はタグ付与時刻ではなく**アイテムの `createdAt`** で切る（`wiki_tag_assignments` に `created_at` が無い = 0008 migration:850。厳密版は親 #1375）。`aggregateWorkTimeByTag` は無変更。**web ホストに `fetchEvents()` を追加**（Issue の配線メモは「ホストのフェッチ不要」だったが、props の `scheduleItems` はプリセットごと再取得 + 予定の開催日キーのため、「総数は変わらない」と「期間内に作成」のどちらも答えられない）。CI verify 全ステップをローカル実行して緑（shared 2822 / web 1019 / desktop 29 / mcp 322 tests + docs-lint OK）

## 予定

- **#1476 の残り判断 1 件**: 期間プリセットを**作業タブの上段グラフにも効かせるか**。今回は据え置き（同タブは日/週/月の窓を自前で持ち、ローリング 14 日は #860 の判断として `workTimeChartWeekStart.test.tsx` に固定済み）。効かせるなら別 Issue が要る。PR #1494 本文にも記載
- **#1476〜#1480 の実ブラウザ確認は chat-main 側の担当**: 660px（詳細パネル開）と 1280px でタイルの数値・見出しが省略されないこと／ タグ別作業時間の凡例に「名前 NN%」が出てカード内に収まること／ ja で経過日数分布の区分名と「Todo なし」が日本語であること／ Todo 別作業時間に生 id の行が出ないこと／ 期間プリセットで Todo 完了トレンドの X 軸が動くこと
- **報告前に各ゲートのログを個別に確認する**（2026-09-05 の失敗）: #1478 で「ローカル全緑」と報告したが `shared-build` / `shared-typecheck-tests` のログを開いておらず、TS2741 と不正な `TodoStatus` リテラルを CI で初めて検出した。テスト件数だけを見て緑と言わない
- **`scripts/docs-lint.sh` は stdin を閉じて回す**（2026-09-05 実測）: background 実行のラッパー経由で stdin がパイプのままだと終わらない。`< /dev/null` を付けると数秒で `docs-lint: OK`
- **`git push` が無応答なら gh の credential helper を使う**（2026-09-05 実測）: `git-credential-manager.exe` が対話プロンプト待ちで固まる。`git -c credential.helper='!gh auth git-credential' push` で通る
- **#1456 は merge 前に `supabase db push` が要る**（🛑 人手ゲート）: `event_id` が `TIMER_SESSION_COLUMNS` の SELECT 一覧に入るため、本番に列が無い状態でコードだけ入ると `timer_sessions` の SELECT が全部 PostgREST 42703 で落ちる（Work タブと Analytics が丸ごと死ぬ）。PR 本文にも明記済み
- #1375 の実ブラウザ確認は chat-main 側の担当（Work でイベントを選んで開始 → その予定の編集パネルに実績時間が出ること／ Todos タブのタグ別稼働時間に Event 分が乗ること）
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

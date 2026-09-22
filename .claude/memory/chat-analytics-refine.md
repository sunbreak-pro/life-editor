# MEMORY (chat-analytics-refine)

## 進行中

（なし）

## 直近の完了

- **#1860〜#1867 Analytics の画面別探索検証 8 件** ✅（2026-09-21 実装完了・**PR #1883 / #1890 / #1893 / #1896 / #1897 / #1898 / #1899 / #1900 open**）— 1 Issue = 1 ブランチ（origin/main 起点）= 1 PR を番号順に。#1860 タグ別作業時間が期間を無視（`sessionsWithinRange()` を足し Todos タブで絞る。ホストのセッションは全期間のまま = Work タブの合計の前提）／ #1861 All time が 2020 固定（プリセットの `dateRange` は予定の取得範囲を兼ねるので据え置き、トレンドの描画期間だけ `trendRangeDays()` でデータ最古日から。92 日超は週・1 年超は月にまとめ、年またぎでラベルに年）／ #1862 ルーチン名のはみ出しと全 0%（文字数でなく推定幅で省略する `fitAxisLabel()`・棒に 2px の目印と数値ラベル）／ #1863 長いタグ名と Streaks の数値（`table-fixed`・数字は `flex-shrink-0` で単位だけ省略。`analytics.streak.days` は #1823 の担当なので不触）／ #1864 Work タブの単位と日付書式（`ChartAxisFormat` をホストが 1 回作り `labels.axis` で全グラフへ。`web/src/analytics/axisFormat.ts`・i18n 3 キー）／ #1865 期間プリセットが往復で戻る（タブと同じく `useShellNavigation` が保持し `initialPreset` で戻す。保つのはプリセットだけで期間は mount ごとに作り直す）／ #1866 週の開始・上位 10 件・目盛（セルは `getDay()` の番号のまま行順を `WEEK_STARTS_ON` から・カードが自分で切って「N 件中の上位 10 件」・`evenDateTicks()` は末尾から等間隔）／ #1867 ヒートマップの a11y（各セル `role=img` + 曜日・時刻・値の名前、タブ停止位置は 1 つで矢印 / Home / End 移動）
- **#1520 / #1524 Analytics の Mobile 点検 2 件**（#1409 由来）✅（2026-09-06 実装完了・**PR #1531 / #1533 open**）— 1 Issue = 1 ブランチ（origin/main 起点）= 1 PR。#1520 Mobile「ルーチン達成率」の名前が 96px 固定で省略される（`grid-cols-[96px_1fr_40px]` の 3 列 → バーを下段に落とし、上段は名前 + パーセントの 2 要素。390px 幅で名前が約 255px 使える。jsdom にレイアウトが無いので回帰テストは構造で等価に置き換え）／ #1524 集計取得が `Promise.all` のため 1 系統の失敗で全カード 0（`Promise.allSettled` へ。9 本それぞれが自分の空値へフォールバックし、失敗した系統名を i18n した 1 文を既存 `NoticePanel` の warning 帯として Desktop / Mobile 両方に出す。Mobile は**空状態の上**にも出す = 全滅時に「まだ記録がありません」と嘘をつかないため。部分成功は `useDomainLoad` 的には成功のままにした）
- **#1476〜#1480 Analytics の実ブラウザ点検 5 件**（#1408 由来）✅（2026-09-05 実装完了・**PR #1494 merged / #1500 / #1504 / #1508 / #1511 open・4 本とも CI SUCCESS**）— 1 Issue = 1 ブランチ（origin/main 起点）= 1 PR。#1476 期間プリセットが Todo 完了トレンドに効かない（`days={30}` 直書き → `dateRangeDays()` に正本化。**作業タブは #860 の判断を尊重して据え置き・コメントで理由を明記**）／ #1477 タグ別作業時間の円グラフのラベルがカードをはみ出す（recharts の外側ラベルはクリップされない → 割合を凡例へ・名前で照合）／ #1478 ja に残る英語ラベル（区分名と No Todo を集計関数から i18n へ・Y 軸幅 80→96px）／ #1479 Todo 別作業時間の Y 軸に生 id（名前を引けない = ゴミ箱送り → #428 と同じ規則で行ごと除外）／ #1480 タイルの省略（列数がウィンドウ基準 → データカラムに `@container`・見出しは折り返しへ。ストリークの件は #1467 で解決済み）

## 予定

- **#1860〜#1867 の実ブラウザ確認は chat-main 側の担当**: #1862 ルーチン名の左端が SVG の内側にあること（DoD の rect 実測。テストで固定したのは推定幅）／ #1863 60 文字超のタグ名で数値 2 列がカード内に残ること・詳細パネルを開いた en（1100〜1440px）で Streaks の数字が省略されないこと／ #1864 ja の Work タブで「1時間30分」が Y 軸の 64px に収まること／ #1861 All time でトレンドが最古日から始まり年が読めること／ #1867 実際のスクリーンリーダーでの読み上げ（未確認）
- **8 本は同じファイルを触る組がある — merge 順で小さな衝突が出うる**: #1890 × #1898（`AnalyticsFilterContext.tsx`・関数追加と Provider 引数で離れている）／ #1896 × #1899（`TagUsageCard.tsx`・表の class と表の後ろの注記）／ #1899 × #1900（`WorkTimeHeatmap.tsx`・行の `map` とセルの属性が隣り合う）／ #1899 は #1890・#1897 とトレンド / Work タブのグラフで `XAxis` の近くを触る。衝突したら後から入る側をこのレーンで解消する
- **#1864 の残り 1 件**: Todos / Schedule タブのトレンドの日付は #1890 と同じ行を触るため `axis.date` に寄せていない（Issue の DoD は「1 タブ内」）。#1890 と #1897 の両方が入ったら `trendBucketLabel` を `labels.axis.date` に置き換える。Briefing の `WorkBreakBalance` も `axis` 未配線で言語に依存しない既定値のまま
- **worktree で main を取り込んだら 4 パッケージとも `npm ci` をやり直す**（2026-09-21 実測）: main に `@tiptap/extension-table` が増えていて、web build / web typecheck:tests / desktop build / web test の 4 ステップが TS2307 で落ちた。CI は毎回 `npm ci` するのでローカルだけの罠
- **ラベル型に必須項目を足したら、隣の既存キーを `shared/tests` と `web/tests` で grep して fixture を全数拾う**（2026-09-21 の失敗）: #1866 で `topOf` を足したとき `makeAnalyticsLabels` と自前 fixture 2 本は直したが `analyticsWeekWindow.test.tsx` の 4 本目を見落とし、`typecheck:tests` が 1 回落ちた。vitest は型を見ないので test は緑のまま
- **#1520 / #1524 の実ブラウザ確認は chat-main 側の担当**: 390×844 の「ルーチン達成率（上位 3 件）」でルーチン名が省略されずに読めること／ Analytics の 1 系統をわざと落として（未適用 migration の再現等）残りのカードの数値が残り、上部の警告帯に失敗した系統名が出ること／ 全滅時に Mobile の空状態の上へ帯が出ること
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

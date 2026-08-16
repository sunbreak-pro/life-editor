# HISTORY (chat-briefing-refine)

### 2026-08-16 - Briefing データ層 2 本をテストで固定し 3 分割（#892・PR #924 open）

#### 概要

`useBriefingData`（830 行）と `useDailySections` はテスト参照ゼロだった。Tier 1 画面のうち取得・集計・書き込みだけが無防備で、しかもここの壊れ方は全部「静かに」— read が飛ばなければブロックが空のまま、`useSyncDomains` からドメインが抜ければ二度と更新されない、ロールバックが効かなければ DB に無い状態が画面に残る。例外も出ずログも出ない。先にテスト 50 本で現状を固定し、その足場の上で 3 責務へ分けた。挙動変更ゼロ。

#### 変更点

- **順序**: 2 コミット構成。1 本目が分割**前**の実装に対するテスト、2 本目が分割。テストは 2 本目で 1 行も変えていないので、diff がそのまま「挙動が変わっていない」証拠になる（#673 と同じ「足場を先に置く」順序）。
- **追加テスト 4 本 / 50 件**: `briefingDataFetch`（7 つの read・`allSettled` の耐性・sync ドメイン宣言を**両側から** = 読むドメインの bump で再取得する / `audio`・`calendars` では再取得しない）/ `briefingDataAggregation`（local day key #413・持ち越しの経過日数と 5 件上限・両方向リンクからの目的チップ・夕刊ブロック・トレイの placed/unplaced）/ `briefingDataWrites`（楽観更新とロールバック・`completedAt` の打刻とクリア・create → ノート添付の順序 #371・各 delete の undo コマンドが実際に何をするか）/ `briefingDailySections`（section-merge write = 保存のたび最新 daily を読み直す / 2 セクションを 1 本の直列チェーンに載せる / 宣言の debounce と unmount 時 flush）。
- **空振りでないことの裏取り**: `dateKeyOf` を UTC slice に戻すと #413 のテストだけが落ち、`useSyncDomains` から `tags` を落とすと再取得のテストだけが落ちることを実測。
- **テスト基盤**: ハーネスを共有化（`web/tests/helpers/briefingHarness.tsx`）。7 つの read を各 suite で手書きすると「1 つ stub し忘れて effect が `Promise.allSettled` の中で throw し、誰も報告しない」経路を 3 回作ることになる。UndoRedo は本物の Provider ではなく**記録するスタブ**にして、「スタックが受け取ったか」ではなく「受け取ったコマンドが何をするか」を assert できる形にした。`createBumpableSync` を web 側の helpers barrel に re-export。
- **分割**: `useBriefingFetch`（7 つの read と着地先 state・write 側が結果を畳み込む setter を含む）/ `useBriefingAggregation`（取得済み行 → 紙面ブロックの純粋な派生。state も DataService 呼び出しも持たない）/ `useBriefingWrites`（全ミューテーション + 楽観更新 + undo コマンド）。`useBriefingData` は 3 本を束ねるだけで、返り値は 1 キーも変えていない。継ぎ目はレイヤの積み重ねではなく **state** で、派生側 2 本は互いに依存しない。
- **ゲート**: shared（lint 0 error / build / test 2192 件）・web（lint 0 error / build / test 458 件）すべて exit 0。warning は shared 3 / web 4 とも既存分。`desktop/` は未変更のため typecheck 対象外。
- **記録**: 実装プランの無い課題なので archive 対象なし。スコープ逸脱なし（`BriefingScreen.tsx` の view 側・他セクション・`shared/` は無変更）。AC 免除なし — DoD 4 項目のうち残るのは「merge 後に chat-main で playwright」だけで、worktree では実ブラウザを持たないため PR 本文に申し送った。実装中に浮上した別判断もなし。

### 2026-08-15 - 週・月・年の目標を朝刊に常設表示（#872・PR #914 open）

#### 概要

朝刊の「宣言」直下に週目標 / 月目標 / 年目標の 3 欄を常設し、その場で書けるようにした。保存先は予約 id `note-goals` の Note 1 枚で、本文に `## 週目標` / `## 月目標` / `## 年目標` の 3 セクションを持つ。**DDL ゼロ**なので `supabase db push` の手番が挟まらず PR 1 本で閉じた。

#### 変更点

- **保存の仕組み**: 既存の「宣言」をそのまま写した（`findSectionRange` +「読み直し → 自分の範囲だけ差し替え → 全文書き戻し」）。新テーブル / mapper / RLS / Realtime 登録がゼロで、副作用として Notes 側でも同じ目標を編集できる第 2 の導線がタダで付く。**ノートは初回保存時にだけ作る**（開いただけでは Notes に空ノートを残さない）。role-pm が比較した代替 3 案（期間アンカーの Daily / 新規 `goals` テーブル / localStorage）はいずれも却下 — 詳細は判断キュー D-20260815-briefing-1。
- **期間の扱い**: 表示ラベルだけ（「今週 8/10–8/16」「8月」「2026年」）。自動リセットも履歴も持たない。週境界は `startOfWeekKey` 経由で `weekStartsOn` 設定に追従（月曜固定にしない = #860 で寄せた線）。
- **配置**: 朝刊のみ（`EveningView.tsx` 不変）。幅共通で編集可（宣言・気分と同じ扱い）。
- **QA が出した Blocking 1 件（着地前に修正）**: 目標ノートは朝刊本体とは別リクエストなのに `loading` に繋がっておらず、**まだ読み込み中の「空に見える欄」に打つと、後から届いた本物の目標が入力中の文字に置き換わって消えていた**（`pendingRef` のタイマーが後から発火するため。undo 経路なし）。フックが自前の loading を持って既存スケルトンゲートに合流する形にして、`pendingRef` 経由の経路ごと閉じた。
- **同時に直した Important 2 件**: (1) 取得 effect が保存チェーンと直列化されておらず、保存中に走った再取得が後から解決すると表示だけ古い値に巻き戻った → 読みと書きを 1 本のチェーンに載せた。(2) `getNoteUnified` は `is_deleted` で絞らないため、Notes でゴミ箱に入れた目標ノートに**書き込み続けていた**（Notes からは見えず直せない・ゴミ箱を空にした瞬間に消える）→ 保存時に `restoreNoteUnified` を挟んで戻す。
- **既存への影響**: `dailySections.ts` の `sectionLines` を private から共有 primitive へ昇格（関数本体は 1 文字も変えず移動のみ・`intentionSection.ts` は import 差し替えのみ）。`IntentionField` に任意 prop `labelledBy` を追加。hint スタイルは `briefingStyles.ts`（import 文ゼロのモジュール = 循環回避）へ切り出して `BlockHead` と共用。
- **テスト**: `shared/tests/goalSections.test.ts`（14 件・パース / マージ / 他セクション不破壊 / 週開始曜日追従）と `web/tests/briefingGoals.test.tsx`（7 件）。後者はロードゲート（読込中はフィールドが存在せず `updateNoteUnified` が 0 回）/ 3 欄連続編集で書き込みが直列に走り 3 つとも残る / 保存中の外部変更の着地 / ゴミ箱復活の呼び順（`invocationCallOrder`）。**ロードゲートのテストは修正を巻き戻すとこの 1 本だけが落ちる**ことを実測済み（空振りテストでない裏取り）。
- **ゲート**: shared（lint 0 error / build / test 2147 件）・web（lint 0 error / build / test 401 件）すべて exit 0。warning は shared 3 / web 4 とも既存分。
- **記録**: 実装プランの無い課題なので archive 対象なし。スコープ逸脱なし（`supabase/migrations/` `syncDomains.ts` `EveningView.tsx` 無変更）。AC 免除なし。実装中に浮上した判断は D-20260815-briefing-7（保存状態キャプション）としてキューへ。

### 2026-08-15 - Mobile の朝刊 / 夕刊ヘッダーをハンバーガー行の下へ（#879・PR #901 open）

#### 概要

Mobile 幅で Briefing だけヘッダーの並びが他画面と違った（題字帯がハンバーガー行の上に出ていた）ので、紙面内での順序を入れ替えた。他セクションはこの行をページ最上段（PageContainer の header スロット）に描くため、Briefing だけ 1 画面ぶんズレていた形。

#### 変更点

- **順序の入れ替え**: `BriefingView.tsx` / `EveningView.tsx` とも、タブ帯（`tabSwitcher` — narrow ではハンバーガーを載せている = #609）を紙面の最初の行にし、masthead をその下へ移した。Briefing は `narrowHeaderInBody: true` で帯を紙面の中に描く唯一のセクションなので、外に 1 行足すのではなく**中の順序だけ**を直した（外に足すとボタン 1 個のために紙面が押し下がる）。
- **ワイド幅は無変更**: 帯のスロットは wide では undefined のまま。SectionHeader がタブを持ち、紙面は題字から始まる。
- **テスト**: `shared/tests/briefingView.test.tsx` に #879 の describe を追加し、朝刊 / 夕刊それぞれで帯が masthead より前に来ることを `compareDocumentPosition` で押さえた。jsdom にレイアウトが無い（CLAUDE.md §7.1）ので、ここで並びを決めているのは DOM 順そのもの。
- **コメント追随**: `web/src/MainScreen.tsx` と `web/src/sectionDescriptors.tsx` に「masthead の下に帯を再発行する」と書いてあった説明を実態に合わせた。
- **ゲート**: shared（lint 0 error / build / test 2135 件）・web（lint 0 error / build / test 394 件）すべて exit 0。lint の warning は shared 3 / web 4 とも本 PR 対象外の既存分。
- **記録**: 実装プランの無い課題なので archive 対象なし。スコープ逸脱なし・AC 免除なし・実装中に浮上した別判断もなし。

### 2026-08-14 - Analytics「今週」カードの週バーと Work タブ週次も暦週へ（#860・PR #868 merged）

#### 概要

#780 の続き。あちらは「今週」ラベルの**数字**だけを暦週へ寄せ、隣のグラフは別の窓のまま残っていた。裁定 D-20260813-briefing-1 = A に従い、モバイル週バー（直近 7 日）と Work タブ週次集計（月曜固定）の 2 つを暦週（`weekStartsOn` 追従）へ寄せた。

#### 変更点

- **起点の一本化**: `analyticsAggregation.ts` の私有 `startOfWeek()`（月曜固定）を削除し、`calendarWeekRange` が使っていた刻み方を `startOfCalendarWeek(d, weekStartsOn)` として切り出して両者で共有した。これで「週の始まり」の定義がファイル内に 1 つしかない。`weekStartsOn` は `calendarWeekRange` と同じく**必須引数**（既定値を置くと読み忘れた呼び手が黙って別の週を選ぶ — #860 自体がその事故）。
- **モバイル週バー**: 新関数 `aggregateCalendarWeekByDay(sessions, now, weekStartsOn)` を追加し、`MobileAnalyticsView` の `aggregateByDay(sessions, 7)` を置換。同カード内の `weekMinutes` と同一の窓になったので、数字とバーの合計が必ず一致する。
- **Work タブ週次**: `aggregateByWeek` に `weekStartsOn` を追加し、呼び手 `WorkTimeChart` が `useWeekStartPref()` で読んで渡す形にした（useMemo の deps にも追加）。`aggregateByDay(sessions, 14)` の日次ビューは「直近 14 日」の別窓なので裁定どおり不変。`aggregateByDay` 自体も存続。
- **表示値の変化（挙動変更ゼロの例外・PR 本文に明記）**: (1) 週の途中では未来の日が空バーになり、バーの並びが「今日が右端」から「週初 → 週末」に変わる。(2) 週開始曜日が日曜の場合、Work タブ週次の境界が動く。
- **テスト**: `analyticsWeekWindow.test.tsx`（#780 の続きとして同ファイル）に固定日時 3 ケース — 週の途中（水 07-15）/ 週の初日 00:00（月 07-13）/ 週の最終日 23:30（日 07-19）— と pref 追従、およびモバイルカードを render して「数字とバーが同じ週」を押さえた（月曜開始 = Mon→Sun + 60m / 日曜開始 = Sun→Sat + 90m）。**呼び手側は別ファイル `workTimeChartWeekStart.test.tsx` を新設**（recharts は tagWorkTimeChart と同じ流儀で stub）— #860 は「#780 で関数だけ直して呼び手が旧窓のまま残った」事故なので、集計関数のテストだけでは同じ抜けを繰り返す。ラベル fixture は 3 コピー目になるところだったので `tests/helpers/analyticsLabels.ts` へ切り出した（既存 2 suite は据え置き）。
- **ゲート**: shared（lint 0 error / build / test 2133 件）・web（lint 0 error / build / test 394 件）すべて exit 0。`records.mjs check`・`docs-lint` も OK。
- **記録**: `decisions/D-20260813-briefing-1.md` の `implemented-by` に `#860` を追加。実装プランは無い課題なので archive 対象なし。スコープ逸脱なし（Issue の対象 2 箇所 + その呼び手のみ）、AC 免除なし、実装中に浮上した別判断もなし。

### 2026-08-13 - Analytics「今週」の窓をカレンダー週へ統一（#780・PR #820 merged）

#### 概要

同じ「今週」ラベルの隣に別定義の数字が並んでいた状態を解消した。ノート数だけが直近 7 日のローリング窓で、作業時間・完了タスクは暦週を見ていた（#670 C3 は名前を付けただけ）。裁定 D-20260811-refactor-1 = A に従い暦週へ寄せ、週の開始曜日は `useWeekStart` の設定に追従させた。

#### 変更点

- **窓の共通化**: `calendarWeekRange(now, weekStartsOn)` の第 2 引数を**必須**にした（既定値を置くと読み忘れた呼び出し元が黙って別の週を選ぶため）。刻み方はカレンダーグリッドの `startOfWeekKey` と同式で、Analytics の週とグリッドの週が必ず同じ日に始まる。新ヘルパ `createdWithinRange` を追加し、`createdWithinLastDays` は呼び出し元ゼロ（`*.ts` / `*.tsx` 全数 grep で残存 0 = P-002）につき削除。
- **消費側 3 箇所**: `MobileAnalyticsView` / `OverviewTab` のノート数を暦週へ、`WeeklySummary` の私有 `getWeekRange()`（月曜固定のコピー）を共通ヘルパへ統合。3 コンポーネントとも `useWeekStartPref()` で pref を読み、useMemo の deps に足した。WeeklySummary は Issue の Scope 外だが、残すと DoD の「月曜固定になっていない」を満たせないため含めた。
- **表示値の変化（挙動変更ゼロの例外）**: ノート数は週の開始日より前が外れる。pref 既定が日曜始まりのため、モバイル / デスクトップ両方の「今週」の作業時間・完了タスク・セッション数が日〜土基準になる（旧: 月曜固定）。
- **テスト**: `shared/tests/analyticsWeekWindow.test.tsx` を新規追加（12 件）。週初 00:00 ちょうどは入り 1 ミリ秒前は入らない / 週末が同じ週に留まる / pref 0・1 で窓が動く / **日付切替時刻 4 時でも窓は暦どおり**（#356 の pin）/ 8 日前のノートが落ちる。既存 `analyticsCompletedDayKey.test.tsx`（#420 ガード）は境界日を新しい窓の初日へ追随させた。
- **ゲート**: shared・web の lint / build / test すべて exit 0（shared 1992 件 / web 269 件）。`records.mjs check`・`docs-lint` も OK。途中 1 回 vitest のワーカー起動タイムアウトで 7 ファイルが未起動になったが、単体再実行で全緑（環境フレークと確定）。
- **判断キュー**: 実装中に「今週」カードの中へ残る別窓 2 つ（モバイル週バー = `aggregateByDay(sessions, 7)` の直近 7 日 / Work タブの `startOfWeek()` 月曜固定）を実測で発見。#780 の裁定文は「週バーは月〜日」を前提にしていたが事実と違った。表示が変わるため P-008 に従い実装せず D-20260813-briefing-1 として起票。

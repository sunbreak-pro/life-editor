# HISTORY (chat-analytics-refine)

### 2026-09-05 - Analytics の実ブラウザ点検 5 件を 5 本の PR に（#1476〜#1480）

#### 概要

#1408 のデスクトップ画面点検で analytics に出た 5 件を、それぞれ origin/main から切った独立ブランチで直して PR にした。1 Issue = 1 ブランチ = 1 PR で、merge はユーザーの手番（P-001）。

#### 変更点

- **#1476（PR #1494・merged）期間プリセットが Todo タブに効かない**: `TodosTab` の `days={30}` 直書きを期間由来に。日数計算を `AnalyticsFilterContext::dateRangeDays()` に切り出し、`ScheduleTab` の同じ式の写しを消して正本を 1 つにした。**作業タブは意図的に据え置き**、理由を `TimeTab.tsx` の `PERIOD_DAYS` にコメントで残した — 同タブは日/週/月の窓を自前で持ち、`WorkTimeChart` のローリング 14 日は #860 の判断として `workTimeChartWeekStart.test.tsx` に固定済みで、2 つの窓コントロールを束ねるのは設計変更になる（**プリセットを作業タブにも効かせるかはユーザー判断待ち**）
- **#1477（PR #1500）タグ別作業時間の円グラフがカードをはみ出す**: recharts の `<Pie label>` は**チャートの箱の外**に描かれカードでクリップされないため、長いタグ名が 13px はみ出して切れていた。割合を凡例へ移し、リングからラベルを外した。割合は**名前で引く** — `<Legend>` は既定でアルファベット順に並べ替える（`itemSorter: "value"`）ので、添字対応だと別の行に別のパーセントが付く
- **#1478（PR #1504）ja UI に残る英語ラベル**: 経過日数分布の区分名と「No Todo」が集計関数の中に直書きされ、i18n 層より下にあってカタログから届かなかった。`StagnationBucket.label`（英語）→ `bucket: StagnationBucketId`（識別子）に変え、表示名は props 経由に。Y 軸幅も 80 → 96px（+ `interval={0}`）— 80 だと最長の区分名が 2 行に折れ、2 行目が描画領域の下に落ちて切れていた
- **#1479（PR #1508）Todo 別作業時間の Y 軸に生 id**: `todoNameMap` は live なツリーから作るので、ゴミ箱送りの Todo に紐づくセッションは名前を引けず id をそのまま出していた。#428（タグ別集計・#1375 でイベントにも拡大）と同じ規則で**行ごと除外**。「削除済み」1 行に束ねる案は、無関係な複数 Todo が 1 本の棒に積み上がって大きな 1 タスクに見えるため却下。`__none__`（対象なしで始めた作業）は実在の区分なのでガードの対象外
- **#1480（PR #1511）タイルの省略**: 列数が**ウィンドウ幅**基準だったのが原因。詳細パネルを開くと main は約 660px（データカラム約 612px）になるが窓は 1280px のままなので、`grid-cols-3` / `lg:grid-cols-5` は列を減らさない。データカラムに `@container` を付け、各タブを `grid-cols-2 @2xl:grid-cols-3`（スケジュールは `@4xl:grid-cols-5`）に。あわせて `AnalyticsStatCard` の**見出しと副題を折り返し**に変更 — 1280px でもスケジュールの 5 連はタイル約 200px で、「アクティブなルーティン」はどの字送りでも 1 行に入らない。数値だけ `truncate` を保険として残した。Issue が挙げていた「ストリークの『現在 (日)』が縦に折れる」は **#1467 が先に main へ入って解決済み**

#### つまずき

- **#1478 の「ローカル全緑」報告が誤りだった**: `shared-build` と `shared-typecheck-tests` のログを個別に開かず、テスト件数だけ見て緑と報告した。実際は `AnalyticsLabels.stagnation` がインライン型で `buckets` を欠く TS2741 と、テスト fixture の `status: "TODO"`（`TodoStatus` は `"NOT_STARTED" | "DONE"`）が落ちており、**CI で初めて露見**した。以後は各ログを `error TS` で grep して確認してから緑と言う
- **`scripts/docs-lint.sh` は stdin が開いたパイプのままだと終わらない**: background 実行のラッパー経由だと数分〜無限に待ち、`< /dev/null` を付けると数秒で `docs-lint: OK`。ローカルでまとめて回すスクリプトを書くときは各ステップの stdin を閉じる
- **`git push` が `git-credential-manager.exe` で無応答になる**: `git -c credential.helper='!gh auth git-credential' push` で通る（gh は認証済み）
- **web の vitest は `briefingEveningLazyMount` が 1 本落ちることがある**（memory `cold-vite-cache-fails-lazy-mount-tests`）。静かな状態での再実行は 113 files / 1064 tests 緑で、CI も全 PR で緑

#### 検証

5 ブランチとも CI の verify ジョブ（shared → web → desktop → mcp-server）+ `docs-lint` をローカルで全ステップ実行。最終的に **4 本の open PR すべて GitHub Actions が SUCCESS**（shared 2943 / web 1065 / desktop 30 / mcp-server 322 tests）。実ブラウザ確認（660px / 1280px のタイル・円グラフのラベル・ja のチャートラベル）は worktree では回さない規約のため chat-main 側。


### 2026-09-02 - Work の実績時間を Event にも紐づける（#1375 / PR #1456）

#### 概要

#1379 で切り出した残り全部。Work タイマーの計測先を Todo だけでなく Event にも広げ、タグ別稼働時間が両方を含むようにした。#1373 で Event から完了ピルを外した穴を「実績時間」で埋める、という Issue の狙いに沿う。DDL 1 本を含むのでマージ順にゲートがある。

#### 変更点

- **DDL `supabase/migrations/0029_timer_sessions_event_link.sql`**: `timer_sessions` に `event_id text` + 索引 + `check (task_id is null or event_id is null)`。ローカルファイル先行で **push はユーザー**（CLAUDE.md §7.3）。「先に決めること」の保存形は**参照列を足す案**を採用し、Event 側に合計値を持つ案は却下した — 集計値の二重持ちはセッションの削除・部分停止のたびに再計算が要り、ズレたときに直す手立てが無い。参照列なら実績時間は常に導出値。FK は張らない（0018 の `task_id` の理由をそのまま踏襲 = セッションは対象より長生きしてよい）。role 判別列は不要（id は role を跨いで一意 = CLAUDE.md §4 なので、どちらの列に入っているかが role そのもの）
- **Service 境界**: `startTimerSession(type, todoId?)` → `startTimerSession(type, target?: WorkTarget)`。`WorkTarget { kind: "todo" | "event"; id }` の 1 オブジェクトにしたのは、任意引数 2 本にすると両方渡せてしまい 0029 の CHECK まで気付けないため。読み側は `fetchSessionsByEventId` を新設（PostgREST の filter は列名を名指しするので `fetchSessionsByTodoId` と分けた方が素直）
- **集計 `aggregateWorkTimeByTag`**: 4 番目の引数を `TodoNode[]` → 構造型 `WorkTimeItem[]`（`{ id, isDeleted? }`）に。`aggregateTagUsage` の `TagUsageItem` と同じ考え方で、Todo だけ渡す既存呼び出しは**シグネチャも数値も変わらない**。セッションの対象 id は新設 `shared/src/utils/timerSessions.ts::sessionTargetId` が `todoId || eventId` で畳む（空文字を null に落とす挙動は必須 — 「対象なし = untagged」と「対象が live でない = 破棄」で扱いが真逆のため）
- **Work のピッカー**: Todo と「今日から 7 日先まで」の予定を **1 つのリスト**で出す。2 つのピッカーに割らないのは「今何をやっているか」が 1 つの問いだから。種類は先頭アイコンと、選択後のチップの色（chip-task 青 / chip-event 紫）で示す。読み込みは `Promise.all` の 1 ロードにまとめた（2 本に割ると速い方が着いた瞬間に skeleton が外れ、半分欠けたリストが見える）。`useSyncDomains("todos", "schedule")`・snapshotKey は `workTodoOptions` → `workTargetOptions`
- **`ActiveTodo` → `ActiveWorkItem` / `activeTodo` → `activeItem` / `setActiveTodo` → `setActiveItem` に改名**: Event が入る箱を `activeTodo` と呼び続けると「読めてしまうが間違っている」状態になり、名前の古さはコンパイラが検出できない。11 ファイル + テスト 5 本の機械的な追随
- **予定側の実績時間**: `EventEditorPane` に任意 prop `workTime`（`{ label, value }` の bundle = reminder / convert と同じイディオム）を足し、読み取り専用行として描く。文字列で受けるのは pane が copy も formatter も持たないため（§6.4）。ホスト側 `web/src/schedule/useEventWorkTime.ts` が `fetchSessionsByEventId` → `totalWorkMinutesForItem` で毎回導出する。切り替え時の値の持ち越しは **setState で消さず、結果に id を持たせて導出で判定**した（`useDomainLoad` と同じ形 — effect 内 setState は `react-hooks/set-state-in-effect` に引っかかり、実際に lint が落ちて気付いた）
- **テスト**: 新規 `shared/tests/timerSessions.test.ts`（`sessionTargetId` の空文字・列欠落・`totalWorkMinutesForItem` の break / 未終了 / 端数）。`analyticsAggregation.test.ts` に #1375 ブロックを追加 — **先頭が「Todo だけの呼び出しの数値を丸ごと固定する回帰テスト」**で、DoD の「既存集計が壊れない」をここで釘打ちしている。続いて Event の計上・Todo と Event を同じタグへ合算・タグ無し Event・**ゴミ箱の Event を破棄（#428 の規則が新列にも届くこと）**。pane / selector / reducer / mapper / WorkScreen / ScheduleEventEditor 側にもそれぞれ追加
- **検証**: CI verify ジョブを上から全部ローカル実行して緑（shared 286 files 2876 tests / web 112 files 1051 tests / desktop 30 / mcp-server 322 + `docs-lint: OK`）。実ブラウザ確認は chat-main 側

#### つまずき

- **web の vitest が全件並列だと `briefingEveningLazyMount` で 2 本落ちる**。単体では 5 秒で緑、2 回目のフル実行も緑。memory `cold-vite-cache-fails-lazy-mount-tests` の再現で、本変更とは無関係
- **web の typecheck が「無関係な既存エラー」を大量に出したのは shared の dist が古かったから**。`web/tsconfig.json` は `../shared` を参照するので、shared を build する前の web 型検査は**前回ビルドの d.ts を見ている**。`EventEditorItem` に `completed` が要る等の幻のエラーが並んだら、まず `cd shared && npm run build`

### 2026-09-01 - タグ使用状況カード（#1379 / PR #1419）

#### 概要

#1375 から切り出された Analytics 単独クローズ分。Overview に「選択期間に作られたアイテムのタグ別付与数」と「現在の生存数」を 1 行 2 列で並べるカードを追加した。窓の違う 2 つの数字を 1 つの見出しの下に置かないことが本題で、実装より**どうラベルするか**に設計が寄っている。

#### 変更点

- **集計 `aggregateTagUsage`（`shared/src/utils/analyticsAggregation.ts`）**: 戻り値 `TagUsageBucket` が `rangeCount` / `totalCount` を**別フィールドとして持つ**。単一の `count` にすると「どちらの窓か」を呼び出し側の記憶に委ねることになり、#780 / #860 で実際に起きた事故（同じ見出しの下に定義の違う数字）を型で防げない。入力の `TagUsageItem` は `{ id, createdAt, isDeleted? }` の構造型 — `wiki_tag_assignments` に role 識別子が無く id が role を跨いで一意なので、Todo / Event / Note を 1 本の配列に連結して渡せる。除外（ゴミ箱 / 削除済みタグ / 削除済み assignment）と二重付与の Set 潰しは `aggregateWorkTimeByTag` に合わせた。**同関数は無変更**（#1375 が Event 対応で触る側なので衝突を避ける）
- **期間はアイテムの `createdAt` で切る**: `wiki_tag_assignments` は `updated_at` しか持たず `created_at` が無い（`supabase/migrations/0008_data_unification_schema.sql:850`）ため、「いつタグを付けたか」は記録されていない。厳密な「期間内に何回付けたか」は DDL が要るので親 #1375 に残置
- **カード `TagUsageCard.tsx`**: 表（`<table>`）で描き、2 列それぞれに `scope="col"` の見出し（`期間内に作成` / `現在の合計（全期間）`）を置いた。加えて `ChartCard` の meta に選択中プリセット名を出すので、「期間内」がどの期間かまで読める。バーは範囲列の装飾で、先頭行を 100% とする相対幅（全体比だと数タグで全部が細くなる）
- **`fetchEvents()` を web ホストに追加（Issue の配線メモからの逸脱）**: Issue は「DataService も web ホストのフェッチも触らずに済む」と書いていたが、props にある event データはどちらの数字にも使えなかった。`scheduleItems` は (1) プリセットごとに再取得される（= 期間非依存であるべき総数がレンジ変更で動く）、(2) 予定の**開催日**でフェッチされる（= `createdAt` 基準の「期間内に作成」を答えられない）。DoD の「3 role を数える」と「総数は変わらない」を両立させる道が他に無く、AC を優先した。`fetchEvents()` は `useTaggedItemIndex` が既に使っている期間非依存の live 一覧（dismissed が外れる既知ギャップも同じ）。**この 1 点は PR 本文と memory の予定に確認事項として残した**
- **`OverviewTab` の props**: `tagCount` / `assignmentCount` の数値 2 本を `tags` / `assignments` の配列に置換し、ヘッドラインの「N tags / M assigned」を配列から導出。内訳カードと同じ行を数えるので両者が食い違えない（数値の非複製原則）
- **i18n**: `analytics.tagUsage.*` と `analytics.empty.tagUsage.*` を en / ja 両方に追加
- **テスト**: `shared/tests/analyticsAggregation.test.ts` に `aggregateTagUsage` の describe を新設（期間で数が変わる・総数は変わらない・ゴミ箱 3 種の除外・二重付与 1・順位・空）。既存の `aggregateWorkTimeByTag` describe は無変更。`shared/tests/analyticsTagUsageCard.test.tsx` で 3 role 合算・列見出し・空状態を担保。`web/tests/sectionSnapshotReplay.test.tsx` の Analytics スタブに `fetchEvents` を追加（無いと `Promise.all` の引数評価時点で落ちる — 実際に 1 本落ちて気付いた）
- **検証**: CI の verify ジョブを上から全部ローカル実行して緑（shared lint/build/typecheck:tests/test = 284 files 2822 tests・web 同 4 種 = 108 files 1019 tests・desktop typecheck/test/build・mcp-server build/typecheck:tests/test = 322・`docs-lint` OK）。実ブラウザ確認は chat-main 側

### 2026-07-28 (2) - リスト系 follow-up 3 点の消し込み（#369）

#### 概要

#283 で意図的に見送った低優先 follow-up 3 点を、手すき枠として処理。2 点を実装、1 点を根拠付きで見送り。materials レーンの持ち物だが、fan-out 計画書が「余力があれば analytics-refine」と指名していた分。

#### 変更点

- **Daily のソート拡張（実装）**: `filterAndSortDailyEntries` に `mode`（`date` / `updatedAt` / `createdAt`）を追加。`DailyListEntry` は timestamp 2 本を**必須**にした（optional + フォールバックにすると、渡し忘れたときに黙って date 順へ落ちる — #428 の `liveTasks` と同じ理由）。timestamp が同値のときは `date` で tie-break して順序を確定させる。mode は `life-editor:daily-sort-mode` に永続化し既定 `date` = 従来の並びのまま。従来 `dailySortModes` は 1 件だったため `SidebarListControls` のモードピッカーが隠れていたが、3 件になったことで表示されるようになった
- **Notes のタグ絞り込み（実装）**: 既存の `StatusFilterChips`（Mobile Tasks のステータス pill）に `size="sm"` を足して再利用。多対多タグでは「タグ X の絞り込み」＝「グループ X だけ表示」なので、単一選択 + 再クリックで解除という既存の contract がそのまま合う。ロジックは `soloTagGroup` として shared に切り出した（web には test runner が無いため、テスト可能な場所へ寄せる意図も兼ねる）。**選択が stale になったときの扱いが 2 段構え**: 描画は `soloTagGroup` が全件へフォールバックし（chips は絞り込み対象と同じ groups から描かれるので、検索でグループが空になる / タグが消えると解除用の chip ごと消えて詰む）、加えて**検索ボックスへの入力でタグ絞り込みを解除する**。後者は独立監査の指摘で追加 — フォールバックだけだと「検索でグループが空 → 一覧が開く → 検索を消すと誰も押していないのに再収縮」という無音の復活が起きる。当初は「groups を監視する effect で null に落とす」で書いたが **web の eslint が `react-hooks/set-state-in-effect` で弾く**ため、onChange 側（入力イベント）で解除する形に変更した。絞り込み手段は 2 つとも同じリストを狭めるものなので、片方を触ったらもう片方が外れるのは筋が通るし、chip の押下状態が外れて**目に見える**のが effect 版との違い。非永続（リロードで解除）にしたのは #283 の Daily filter query と同じ判断で、理由が見えないまま隠れ続けるのを避けるため
- **Mobile リスト（Notes は実装 / Daily は見送り）**: 置き場所の設計は「スクロールするグループ一覧の**外側**に固定ヘッダ」で確定（Mobile は rightSidebar 非搭載）。**Notes mobile** に `SidebarListControls`（ソートモード + 方向）+ 検索ボックス + タグ chips を追加。当初はソートピッカーを省いて「デスクトップの永続設定を尊重する」としたが、独立監査の指摘で撤回 — **localStorage は実機（Capacitor）とデスクトップで別物**なので、ピッカーが無いと実機は既定順に固定されてしまう。**副次的に直った不整合**: mobile は素の `groups` を読んでいたため、それまで永続化されたソート設定が mobile 側だけ効いていなかった（`visibleGroups` に統一。結果として mobile の並びはタイトル A→Z から選択順に変わる = ユーザー可視の変更）。**Daily mobile は見送り** — `mobilePast` は編集欄の下に出る固定 2 行のティーザーで、閲覧用リストではない（Mobile の日付移動は DateStrip）。コントロールのほうが対象より背が高くなる。根拠はコードのコメントに残置
- **絞り込み中は DnD のタグ付けが効かない件は「仕様」として明記**: ドロップ先は描画中の見出しそのものなので、1 タグに solo すると残る droppable はドラッグ元が既に持つタグだけ（untagged solo なら 0 個）。行を隠す以上は不可避で、絞り込みは非永続の一時的な表示状態だから「付け直すなら先に解除」で足りる。ファイル冒頭コメントに残置（従来は DnD を無条件の機能として書いていた）
- **i18n**: `materials.sidebar` に `sortDate` / `sortUpdated` / `sortCreated` を新設し、Notes 側の `materials.notes.sortUpdated` / `sortCreated` は同名重複になるので削除して sidebar 参照へ寄せた（`sortTitle` は Daily に無い概念なので notes 据え置き）。タグ絞り込み用 `materials.notes.tagFilterLabel` を追加。en / ja lockstep（一度足した `tagFilterAll` は参照ゼロの死にキーだったので監査指摘で撤去）
- **潰した穴 1 件**: mobile の `hasNotes` は検索後の値なので、ヒット 0 件でヘッダごと消えて**検索ボックスに触れなくなる**（＝入力を消せない）。`hasNotes || searchActive` に変更。デスクトップは検索欄を無条件描画なので元から安全
- **テスト**: `dailyListView.test.ts` を mode 対応に全面改訂（fixture は date / createdAt / updatedAt の 3 軸をわざと食い違わせ、モード取り違えでは通らない形にした）。`soloTagGroup.test.ts` 新設（stale フォールバックと sentinel リテラルの固定）。`statusFilterChips.test.tsx` に sm variant の選択 contract を追加。**mutation check 実施** — `sortKeyOf` から timestamp 分岐を落とすと新規 4 件がちょうど落ちることを確認
- **検証**: `cd shared && npm run test`（154 files / 1273 tests）・`shared` / `web` の build・`web` の lint すべて exit 0

### 2026-07-28 - Analytics 4 件の連続処理（#420 / #428 / #429 / #430）

#### 概要

open-issue fan-out（`plans/2026-07-28-open-issue-fanout.md`）で本レーンに割り当てられた 4 件を順に処理。Issue ごとに `origin/main` からブランチを切り直し、PR #437 / #440 / #442 / #445 として merge。独立監査（role-qa）の指摘を追随 PR #449 で回収した。

#### 変更点

- **#420 完了日の UTC / ローカル暦日ズレ（PR #437）**: `completedAt` は `toISOString()` の UTC 文字列なのに、Analytics のバケットは全部ローカル暦日キー（#356）。消費側 5 箇所が `completedAt.substring(0, 10)` で UTC 日を読んでいたため、**JST では 09:00 前に完了したタスクが前日に計上されて「今日」から消えていた**。全 5 箇所（`TodayDashboard` / `WeeklySummary` / `MobileAnalyticsView` ×2 / `analyticsAggregation.aggregateTaskCompletionTrend`）を `dateKeyOfInstant()` + null ガードへ。**過去データの見え方が変わる**（再集計なので DB 変更なし）旨を PR 本文に明記。新規テスト `analyticsCompletedDayKey.test.tsx`
- **#428 タグ別作業時間が trash 済みタスクを含む（PR #440）**: 仕様判断が先だったので、**案 1（trash 除外）を採用**して Issue コメントに根拠を残した。#365 の副作用ではなく **#365 のやり残し半分**（#365 自身の JSDoc がそう書いていた）で、`fetchTaskTree` と Connect の `buildGraphModel` がすでに除外側に揃っている。`aggregateWorkTimeByTag` に `liveTasks: TaskNode[]` を**必須引数**で追加（省略可にすると旧挙動が黙って戻るため）、`TagWorkTimeChart` / `TasksTab` に `nodes` prop を通した
- **#429 `aggregateTagByEntityType` の退役（PR #442）**: 呼び出し元ゼロを grep 全数実測してから撤去。統合後の `WikiTagAssignment` に `entityType` が無く、**呼ぶと黙って全ゼロを返す**状態だった。関数・`TagEntityTypeBucket` 型・legacy 型 import・専用テスト suite をまとめて撤去し、退役理由をブロックコメントで残置
- **#430 `[[` 候補フェッチの遅延化（PR #445）**: 従来は sync のたびに全候補（task / event / note の 3 role）を先読みしていた。`useItemLinkTargets` を React state 無しの ref 専用に書き換え、`loadTargets({ allowStale })` を `@tiptap/suggestion` の `items()`（Promise 可・プラグインが await する）から呼ぶ形に。**`[[` を打つまでフェッチが走らず、メニュー表示中は `allowStale` でキーストロークごとの再取得も起きない**。3 role + `balanceByRole` の配分はそのまま
- **独立監査の追随（PR #449）**: (1) **#420 のテストが CI では絶対に落ちない**（`.github/workflows/ci.yml` は ubuntu = UTC でローカル日 == UTC 日）→ `shared/vitest.config.ts` に `test.env.TZ = "Asia/Tokyo"` を固定。効くことは一時 probe テストで実測（TZ:"UTC" で offset 0、Asia/Tokyo で −540）。(2) **`createdAt` の同型 2 箇所を取りこぼし**（`OverviewTab.tsx:88` / `MobileAnalyticsView.tsx:130` の「今週のノート」）→ 修正 + テスト追加 + 片方を revert して該当 1 件だけ落ちることを確認。(3) #428 の JSDoc が実態より狭い（除外されるのは purge 済み行だけでなく R2 孤児・legacy folder 行も）→ 文面修正。(4) `s.taskId !== null` と次行の truthy 参照の非対称 → `if (s.taskId && ...)` へ
- **web 側の監査で潰した 2 件（PR #445 に同梱）**: `items()` が async になった副作用で、**`view.update` の中断中に別 update が exit 経路を完走すると、再開した `onStart` が誰も閉じないポップアップを出す**（ゾンビメニュー）→ プラグイン state の `active` を見てから開くガードを追加。もう 1 件は `inFlightRef` が生の fetch promise を持っていて相乗りした呼び出し側に reject が漏れる件 → settled 済みの形を保持するよう変更
- **検証**: `cd shared && npm run test`（150 files / 1225 tests）・`shared` / `web` の build いずれも exit 0。実ブラウザ確認は chat-main 側の担当
- **outbox 起票依頼 1 件**: legacy `WikiTagAssignment` / `WikiTagEntityType` が #429 で宣言のみになったため、DU-F の legacy タグ API 退役とまとめて掃除してほしい旨を append（PR #445 に同梱して main に着地済み）

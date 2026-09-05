# HISTORY (chat-analytics-refine)

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

### 2026-07-27 - タスク入れ子（ネスト）dead code チェーンの退役（#418 / PR #424）

#### 概要

folder 退役（#225）で `NodeType` が `"task"` 単一になった結果、`moveNodeInto` のガード `target.type === "task"` が常に真になり、階層移動が構造的に必ず失敗する状態だった。ただし唯一の呼び出し元 `web/src/tasks/useTaskTreeDnd.ts` が repo 内ゼロ参照で、ユーザーが操作して失敗する場面は存在しなかった。ユーザー判断（入れ子は使わない）により、ガードを直すのではなくチェーンごと退役させた。

#### 変更点

- **撤去した範囲**: `useTaskTreeMovement` / `useNoteTreeMovement` の `moveNodeInto` と `moveNode` の親変更分岐、`web/src/tasks/useTaskTreeDnd.ts`（281 行・ゼロ参照）、`MoveRejectionReason` の `target_is_task` / `parent_is_task`、`useTaskTreeAPI` / `useNotesUnifiedAPI` の context value からの `moveNodeInto` 公開、実態とずれていたコメント群（`useNoteTreeMovement.ts:42` の「`useTaskTreeDnd` は実際に呼んでいる」ほか `useNotesUnifiedAPI` の stale 注記 2 箇所）
- **新しい reason を増やさずに済ませた**: 親変更分岐を落とした `moveNode` は「active の兄弟リスト内での並び替え専用」になった。非兄弟へのドロップは既存の `findIndex === -1` チェックに落ちて `node_not_found` を返すため、拒否理由は差し引き 2 個減
- **残置と理由**: `moveNode` の並び替え本体（指示どおり巻き込まない）/ `moveToRoot`（legacy な子行を root に引き上げる唯一の経路）/ `isDescendantOf`（巻き添えでゼロ参照になる候補だったが、実測では `moveNode` が継続使用。KI-016 の visited guard）/ `computeNoteDropIntent`（src 内消費者ゼロになるが barrel 公開 API + 専用テスト持ちの純関数。above/below は並び替え側の primitive のため判断保留としてコメント明記）
- **Issue 記載との差分 2 点**: `target_is_task` / `parent_is_task` に対応する i18n キーは en / ja とも**元から存在しなかった**（道連れ対象なし）。「常に失敗する」を固定したテストも**存在しなかった**（`useNoteTreeMovement.cycle.test.ts` は `isDescendantOf` の循環安全性のみを見ており退役後も有効）
- **テスト**: `shared/tests/treeMovementReorderOnly.test.ts` を新設（Tasks 5 / Notes 3）。並び替えの `order` 詰め直し、別の親へのドロップが再親付けされず `node_not_found` で拒否され `persistWithHistory` が呼ばれないこと、soft-delete 拒否、`moveToRoot`、hook の公開キーが `["moveNode","moveToRoot"]` だけであることを固定。move API はどこからも呼ばれていないため型チェックでは巻き戻しを検出できず、この網が唯一の防御
- **docs 追随**: `.claude/rules/frontend.md` §Gotchas と `shared/design-system/PRINCIPLES.md` §7 の「`moveNode` と `moveNodeInto` は別操作」を退役後の記述へ差し替え。スコープ外で見つけた `docs/design/briefs/materials.md:67` の実在しない `useNoteTreeDnd.ts` 参照は触らず outbox で起票依頼
- **検証**: `cd shared && npm run test`（147 files / 1184 tests）・`cd shared && npm run build`・`cd web && npm run build` すべて exit 0
- **独立監査の追随（PR #424 merge 後 → PR #432）**: ランタイムのリグレッションはゼロ（生き残った並び替え経路は退役前の同一親分岐と空白除去して差分ゼロと機械照合）だったが、記述の不正確さを 3 件回収。(1) **requirements SSOT が退役機能を要求したまま** — `tier-1-core.md` の AC3「中央ドロップで階層移動」ほか Purpose / Boundary / AC1 / Notes 節。`rules/frontend.md` と `PRINCIPLES.md` は直したのに requirements を sweep し忘れた（docs-consistency §2 の退役 sweep の穴）。(2) **「親変更分岐は全部 always-true で死んでいた」は誤り** — ガードは `if (newParentId !== null)` の内側にあり、**root ノード隣へのドロップはガードを素通りして success していた**（legacy 子行の位置指定引き出し）。dead の真因は「呼び出し元ゼロ」で、後継 `moveToRoot` は末尾追加のみなので位置指定は失われた。(3) **「もうどの API も親子を作れない」は言い過ぎ** — `createNote({ parentId })` / `addNode(parentId)` / MCP `create_task(parent_id)` の 3 経路が健在。テストも +4（旧コードで success していた逆向き = Tasks/Notes、Notes の `node_not_found`-not-`deleted_node` 非対称、`moveToRoot` の旧兄弟 order 詰め直し = 子 1 件 fixture では詰め直しを消しても通っていた）。1188 tests + 両 build green
- **失敗の型（記録）**: 「常に真のガード」という起票時の説明を裏取りせずコメントと PR 本文に転記した。実際はガードが条件分岐の内側にあり、片方の経路は成功していた。**退役の理由づけは「なぜ死んでいるか」を分岐ごとに実測してから書く**（今回は「呼び出し元ゼロ」が真因で、ガードは無関係だった）

### 2026-07-27 - Notes folder 退役の後段と Connect の project ノード撤去（#375 / PR #405）

#### 概要

life-tags S3（#225）が Tasks 側だけ folder を撤去し、Notes 側を「意図的な過渡期非対称」として温存していた分の後始末。実データは migration 0020 で変換済みだったので、残っていたのはコードだけ。あわせて Connect グラフの `project` ノード（folder 由来）を退役させ、まとまりの表現を life-tag に一本化した。DDL 変更なし。

#### 変更点

- **型と生成導線**: `NoteNodeType = "note"` の単一値化（union 名は維持 — 再拡張が 1 行で済み、payload 行の列名としても使う）。`useNotesUnifiedAPI.createFolder` を本体・context 公開・undo ラベル i18n（en/ja lockstep）ごと撤去。プロダクション呼び出し側はゼロで、参照していたのは undoRedo の配線テスト 1 本だけだった
- **legacy 行の除外を新設**: `isLegacyNoteFolderRow` を `listNotesUnified` / `fetchDeletedNotesUnified`（Trash）/ `searchNotesUnified` / MCP `fetchLiveNotes` の 4 経路に配置。Tasks 側 `isLegacyFolderRow` と同型で、クエリ側 `.neq` を避ける（NULL note_type 行まで落ちて素のノートが消えるため）。folder を親に持つノートは孤児許容でそのまま出る。0020 は変換後の folder 行をソフトデリートで残すので、この filter が無いと **Trash に復元可能な「幽霊フォルダ」が並ぶ**
- **Connect の project 退役**: 選択肢 3 つ（種別ごと退役 / タグを project として描く / 割当ありのタグだけ project）をユーザーに提示し、**種別ごと退役**で確定。`GraphNodeType` から `project` を落とし、凡例・型フィルタ・`graph-theme` のノード色・アイコン表 4 箇所・`connect.graph.typeProject`（en/ja）を撤去。tag ノードは元から `wiki_tags` + `wiki_tag_assignments` で描かれていたので、後継はすでに存在していた形。Analytics #334（`projectTime` → `tagTime`）と同じ考え方
- **ついでに塞いだ穴**: `flattenedNotes` の再帰は「folder のときだけ潜る」だったため、folder を外すと条件が「展開中なら潜る」に広がる。対象が広がる以上 parentId のサイクルでハングし得るので visited ガードを追加（known-issues 016 と同クラス。`softDeleteNote` は元から同じガードを持っていた）
- **テスト**: 新規 6 本（mapper の legacy 判定と丸め 2 / service の folder 行除外 3 = list・孤児許容・Trash / Connect の「project ノードが無く tag ノードが後継」1）。更新 4 本（buildTagGroups は folder 除外 → parentId 非依存の確認へ、permanentDelete の subtree 2 本は親を folder から素のネストノートへ、cycle テストの型）
- **検証**: shared 145 files / 1168 tests 緑・shared / web / mcp-server の build いずれも exit 0。`npm run lint --prefix web` は `NotesView.tsx:269` で error 1 件出るが **main 時点で既存**（stash して実測確認）で本変更とは無関係
- **docs 追随**: tier-1-core の Notes 節を「過渡期注記」→「退役済み」に、`briefs/connect.md` のノード 4 種を 3 種へ、life-tags 計画の Worklog と横断後継対応行に #375 完了を記録。`briefs/materials.md` の folder 前提記述は materials レーンの持ち物なので outbox で申し送り
- **QA 追随（PR #405 merge 後・独立監査 → PR #417）**: 機能バグ 0 件だったが締め残しを回収。write 型（`NotesPayloadWriteRow` / `UpdatePatch`）の `note_type` を `NoteNodeType | null` へ narrow / テストが無かった除外 2 経路（search・MCP）を追加 / `permanentDeleteNoteUnified` の doc に「legacy folder 行は pool 外 = 復元も purge も不可」を明記 / analytics 2 ファイルの常時 true な `type === "note"` を除去 / `briefs/connect.md` のモック仕様側 6 箇所を sweep（§2/§3 だけ直して本文が残っていた）
- **コメントが実装より強い主張をしていた 2 件を訂正**: `flattenedNotes` の「moveNodeInto でネストできる」は誤り（`useNoteTreeMovement` のガードが NodeType 単一化で常に真 = 常に失敗する死んだガードになっていた）。visited Set も「016 class の hang 防止」ではなく防御的措置（null 根の walk は parentId サイクルに到達できない）。**同型の死んだガードが `useTaskTreeMovement.ts:21` に残り、そちらは `useTaskTreeDnd` が実際に呼んでいる** → tasks レーンへ起票依頼
- **報告の訂正（失敗記録）**: 「web lint の error は main 時点で既存」は誤りだった。`git stash` は自分の古い base との比較でしかなく、実際は同日 merge の PR #402（#364）が解決済み。**main 由来の判定は `git show origin/main:<path>` で行う**。着手前の `git merge origin/main`（CLAUDE.md §7.4）を踏んでいれば防げた

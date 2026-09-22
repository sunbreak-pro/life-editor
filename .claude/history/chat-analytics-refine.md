# HISTORY (chat-analytics-refine)

### 2026-09-21 - Analytics の画面別探索検証 8 件を 8 本の PR に（#1860〜#1867）

#### 概要

2026-09-21 の画面別探索検証（実ブラウザ・Desktop 1440 / Mobile 390）で analytics に出た 8 件を、番号順に 1 件ずつ、それぞれ origin/main から切った独立ブランチで直して PR にした。同じファイルを触る組（#1861/#1865・#1863/#1866・#1866/#1867）があるので順番を守り、後の Issue では前の PR が触った行を避けた。merge はユーザーの手番（P-001）。

#### 変更点

- **#1860（PR #1883）タグ別作業時間が期間を無視**: `TodosTab` がホストの全セッションをそのままリングに渡していた。`sessionsWithinRange()`（`startedAt` で判定 = 日別集計と同じ時刻）を足し、タブ側で絞る。ホストのセッションは絞らない — Work タブの合計が全期間を前提にしているため
- **#1861（PR #1890）All time が 2020-01-01 固定**: プリセットの `dateRange` はホストが予定を取得する範囲を兼ねるので 2020 開始のまま残し、**トレンドが描く期間だけ**を `trendRangeDays()` でそのグラフ自身のデータ最古日からにした（最短 1 週間・データ無しは既定の 30 日）。92 日超は週（`WEEK_STARTS_ON`）、1 年超は月にまとめ、月は常に `YYYY-MM`、日 / 週は系列が年をまたぐと年つき
- **#1862（PR #1893）ルーチン名のはみ出しと全 0%**: 12「文字」で省略していたが軸は 100px 固定で、全角 12 文字は約 105px。`fitAxisLabel()` が推定幅（全角 1em / それ以外 0.62em・コードポイント単位）で省略する。0% の棒は長さが無いので 2px の目印 + 全棒に数値ラベル（Mobile 版と同じ）
- **#1863（PR #1896）長い文字列**: Tag Usage は `table-auto` のセルに幅が無く `truncate` が効いていなかった → `table-fixed` + 数値列 `w-20`。Streaks は #1467 が値の行全体に掛けた `truncate` で数字まで省略されていた → 数字は `flex-shrink-0`、省略は単位だけ。#1467 のテストの固定を置き換えた
- **#1864（PR #1897）Work タブの単位と日付書式**: `ChartAxisFormat`（時間と日付のフォーマッタの組）をホストが 1 回作り（`web/src/analytics/axisFormat.ts`・日と月は Intl、週の記号と時間はカタログ）、`labels.axis` でタブ内の全グラフへ。`WorkTimeChart` / `TodoWorkTimeChart` は小数の時間でなく整数の分を描く。`DailyTimeline` のツールチップの直書き「min」と生 ID も解消
- **#1865（PR #1898）期間プリセットが往復で 30 days に戻る**: タブは外枠の状態で生き残り、期間はセクション層 Provider ごと unmount されていた。「両方保つ」を選択 — `useShellNavigation` がタブの隣に `analyticsPreset` を持ち、Provider の `initialPreset` へ戻す
- **#1866（PR #1899）小さな 3 点**: ヒートマップのセルは `getDay()` の番号のまま持ち、行順を `WEEK_STARTS_ON` から決める／ Tag Usage はカードが全行を受け取って自分で切り、切ったときだけ「N 件中の上位 10 件」／ `evenDateTicks()` が末尾（今日）から等間隔に目盛を置く（`preserveStartEnd` は先頭から間引くので余りが最後の間隔に出ていた）
- **#1867（PR #1900）ヒートマップの a11y**: 各セル `role="img"` + 曜日・時刻・値の名前。タブ停止位置は 168 個でなく 1 つ（roving tabindex）で、矢印 / Home / End で移動し行をまたいで回り込まない。移動はセルの DOM 順で解決するので #1899 で行順が変わっても動く

#### 設計判断

- **#1861 で `dateRange` 自体は変えなかった**: Issue の Scope は「all の開始 = データの最古日」だが、この範囲は `onDateRangeChange` 経由で予定の取得範囲にもなる。最古日を知るには先に全件を取る必要があり、範囲を狭めると取得が欠ける。描画期間だけを寄せれば DoD（開始が最古日・週 / 月バケット・年の表示）は全部満たせる
- **#1865 で保つのはプリセットだけ**: 期間そのものを保つと、日付をまたいで開き直したとき「7 days」が昨日までの 7 日になる
- **#1864 の `WorkBreakBalance` と #1867 の `labels.cell` は省略可能にした**: 前者は Briefing のパネル（別レーンの `web/src/briefing`）が同じグラフを自前のラベルで描いているため。後者は #1899 のテストが持つヒートマップの fixture が、両方 merge された後に型で落ちるのを避けるため。どちらも既定値は既に翻訳済みの部品から組み立てる
- **#1864 は Todos / Schedule タブのトレンドに触らなかった**: #1890 と同じ行を触るため。Issue の DoD は「1 タブ内」の統一

#### つまずき

- **main を取り込んだ worktree は `npm ci` が要る**: 1 回目の verify で web build / web typecheck:tests / desktop build / web test が `@tiptap/extension-table` の TS2307 で落ちた。自分の変更とは無関係で、4 パッケージとも `npm ci` をやり直して解消
- **ラベル型の必須項目を足すと自前 fixture が型で落ちる**: #1866 の `topOf` で `analyticsWeekWindow.test.tsx` を見落とし `typecheck:tests` が 1 回赤。vitest は型を見ないので test は緑だった（CLAUDE.md §7.1 の罠そのもの）
- **既存テストの recharts スタブは使う部品を列挙している**: #1862 で `LabelList` を使い始めたら `analyticsTooltipFormatter.test.tsx` が「No LabelList export on the mock」で落ちた
- **Git Bash は `origin/main:.claude/...` をパスに変換して壊す**: `git show` の引数が `origin\main;.claude\...` になる。`MSYS_NO_PATHCONV=1` を付ける
- **長い node スクリプトを Bash ツールの heredoc で流すと、引用符の解釈でコマンド全体が構文エラーになることがある**（2 回踏んだ）: 何も実行されずに終わるので被害は無いが 1 往復無駄になる。スクリプトは Write でファイルに書き出してから `node <file>` で回す

#### 検証

8 ブランチとも `.github/workflows/ci.yml` の `verify` ジョブを上から全ステップ（shared → web → desktop → mcp-server・`npm ci` を除く 14 本）+ `docs-lint` をローカル実行し、最終的にすべて exit 0。ラッパーは出力を変数に取り `$?` を見てから表示する形（CLAUDE.md §7.1）。途中で赤だったのは #1860（依存未インストール）・#1866（fixture の型）・#1867（lint 2 件）の 3 回で、どれも直してから**全ステップを回し直した**。実ブラウザ確認は worktree では回さない規約のため chat-main 側。

### 2026-09-06 - Analytics の Mobile 点検 2 件を 2 本の PR に（#1520 / #1524）

#### 概要

#1409 の Mobile 幅（390×844）画面点検で analytics に出た 2 件を、それぞれ origin/main から切った独立ブランチで直して PR にした。1 Issue = 1 ブランチ = 1 PR で、merge はユーザーの手番（P-001）。

#### 変更点

- **#1520（PR #1531）Mobile のルーチン名が 96px 固定で省略される**: 「ルーチン達成率（上位 3 件）」の行は名前・バー・パーセントを `grid-cols-[96px_1fr_40px]` で並べていた。301px の行のうち名前が 96px しか取れない一方でバーが 143px を占め、実測 139px の `PWV1409-schedule-3` が `PWV1409-sc…` に切られていた — 行の中で唯一「他から推測できない情報」がいちばん狭い枠に入っていた。バーを下段に落として上段を「名前 + パーセント」の 2 要素にし、名前がパーセント chip 以外の全部（390px 幅で約 255px）を使えるようにした。`truncate` は極端に長い名前用の保険として残置（行の高さを 1 行に保つため）
- **#1524（PR #1533）集計の 1 系統の失敗で全カードが 0 になる**: `AnalyticsScreen` の 9 本のマウント読み取りが `Promise.all` で束ねられていたため、最初の 1 本が落ちた時点で残り 8 本の答えが捨てられ、画面は全項目 0 の `EMPTY` に落ちていた。2026-09-05 に migration 0029（`timer_sessions.event_id`）未適用で `fetchTimerSessions` が 400 を返し、Todo もイベントもノートも「0 件」と表示された件がこれ。`Promise.allSettled` に置き換え、系統ごとに自分の空値へフォールバック → 失敗した系統だけを名前で集め → ホストが i18n した 1 文に組み立て → `AnalyticsView` が既存 `NoticePanel`（tone=warning / role=status）でダッシュボード上部に描く。原因そのものは帯に出さず `logServiceError` で console に残す

#### 設計判断

- **警告帯は Mobile の空状態の「上」にも出す**: 全滅すると全リストが空になるので、`MobileAnalyticsView` の `isEmpty` 分岐が「まだ記録がありません」と言い切ってしまう。これが #1524 の嘘としては最も大きいので、空状態の分岐にも帯を通した
- **部分成功は `useDomainLoad` にとっては成功のまま**にした。答えた系統は画面に出すべきなので。副作用として snapshot に部分結果が入り、次回マウントで自分の読み取りが返るまで帯ごと再生されるが、これは snapshot が元から受け入れている stale さで、0 を並べ直すよりは正確
- **i18n の系統名は `TranslationKey` 型で守る**: `SOURCE_LABEL_KEY` は定数に持って `t` へ変数で渡すため、`shared/tests/i18nKeys.test.ts` の実行時スキャン（リテラル `t("...")` しか見ない）の外に出る。代わりに #726 の `TranslationKey` で定義箇所で型検査される

#### つまずき

- **ファイル書き換えを quoted heredoc + node でやるとき、テンプレートリテラルのバッククォートをエスケープしてはいけない**: `'EOF'` の heredoc はシェル展開をしないので `\`` はバックスラッシュ + バッククォートのまま JS に渡り、マーカー照合が黙って外れる。「MARKER NOT FOUND」で 1 往復無駄にした
- **この repo の `.tsx` / `.json` は CRLF**。LF のまま差し込むと 1 ファイル内で改行コードが混在する（`core.autocrlf=true` なので commit 後は揃うが、作業コピーが汚れる）。読み書きの前後で `\r\n` ↔ `\n` を正規化する
- **`docs-lint` が 4 分かかることがある**。前回は 2 分未満だったので、遅いだけかハングかの判別のためログのタイムスタンプを見る

#### 検証

2 ブランチとも `.github/workflows/ci.yml` の `verify` ジョブを上から全ステップ（shared → web → desktop → mcp-server）+ `docs-lint` をローカル実行し、15 本すべて exit 0（shared 295 files 2973 tests / web 115 files 1079 tests）。ゲートを束ねるラッパーは CLAUDE.md §7.1 の罠を避けて、出力を先にファイルへ取り `$?` を見てから表示する形にした（`( npm run X | tail )` だと `tail` の終了コードが返って常に緑になる）。新規 web suite は単体でも 4 tests 緑を実測。実ブラウザ確認は worktree では回さない規約のため chat-main 側。


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

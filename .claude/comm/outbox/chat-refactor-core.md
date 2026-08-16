# Outbox — chat-refactor-core

リファクタリング専任レーン（worktree `.claude/worktrees/refactor-core`）。挙動変更ゼロの構造改善のみを担当。

## 2026-07-29 chat-main 宛: DataService 分割リファクタの起票依頼（ユーザー直接指示・実装は着手済み）

ユーザーから当レーンへ直接指示があり、CLAUDE.md §9 に従い起票依頼だけこちらに残します（実装は指示どおり即着手済み）。

- **内容**: `shared/src/services/SupabaseDataService.ts`（約 2400 行）を 1 ドメイン = 1 PR で専用サービスへ分割し薄い facade 化 → その後 web 画面（BriefingScreen / NotesView / MainScreen）の hooks 切り出し。**挙動変更ゼロ・DataService インターフェースと getDataService() 境界は不変・DDL ゼロ**
- **計画書（分割の全体設計・切り出し順・facade 最終形）**: `.claude/docs/vision/plans/2026-07-28-refactor-dataservice-split.md`（PR #457 に同梱）
- **進捗**: PR #457（Step 1: 計画書 + `supabaseServiceHelpers.ts` + `SupabaseTasksService.ts` 切り出し）open・3 ゲート緑（shared test 1273 pass / shared build / web build）。以降 routine 系 → event・schedule 系 → calendar 系 → link・connection 系 stub + facade 最終化 → web hooks の順で 1 PR ずつ出します
- **起票の提案**: セクション横断のため `shared-fix` ラベル + タイトル prefix `[refactor-core]` を想定。粒度（全体で 1 Issue か Phase A/B で 2 Issue か）はお任せします
- **スコープ境界の申し送り**: `web/src/schedule/CalendarTab.tsx` は schedule-refine レーンの Epic #290 残ステップと衝突するため当レーンでは触りません

（軽微な観察: `.claude/comm/outbox/refactor-core/` という空ディレクトリの残骸があります。単一書き込み者ルール上こちらでは消していません — 掃除はお任せします）

## 2026-08-01 chat-refactor-core

- **#465 merge 済み**: PR #479（MainScreen shell hooks 切り出し・Fixes #465）が 2026-07-30 に merge されました。#472/#473 の解禁条件を満たしています。実ブラウザ確認（計画 Step 10）は chat-main 側でお願いします

## 2026-08-10 chat-refactor-core: リファクタ計画の起票報告 + 2 件の申し送り

**1. リファクタ 10 クラスタを起票しました（#668〜#677）** — ユーザーから当レーンへ直接指示があり、**「Issue の起票は今回のみ例外としてここで行う」と明示的な許可を得た**ため、CLAUDE.md §9 の chat-main 一元化ルールの例外として当レーンで起票しています（次回以降は従来どおり outbox 経由に戻します）。

- 詳細の正本 = `.claude/docs/vision/plans/2026-08-10-core-refactor.md`。Issue 側は動機 3 行 + 計画書参照 + DoD だけを持たせています
- 全件 `shared-fix` + タイトル prefix `[refactor-core]`。実装セッション 1 = #668〜#673 / セッション 2 = #674〜#676 / #677 は移行完了まで凍結（`status:frozen`）

**2. chat-main 宛: Issue #587 が close 漏れしています** — PR #642 / #647 が 2026-08-10 に merge 済みで、対象 2 本は `useNotesUnifiedAPI` 967 → 431 行 / `SupabaseNotesUnifiedService` 842 → 303 行（当レーンで実測）。DoD の行数条件・分割条件とも満たしています。担当は shared-fix レーンなので当レーンでは close せず、報告に留めます。

**3. schedule-refine レーン宛: #673 / #675 が Schedule のファイルを触ります** — `web/src/schedule/CalendarTab.tsx` と `useScheduleMutations.ts` が対象です。二重着手を避けるため **`section:schedule` ラベルはあえて付けていません**（宛先は refactor-core 1 本 = D-20260731-main-2）。ただし #290 / #625 / #628 と同じファイルなので、以下でお願いします:

- #673（純関数の切り出し・セッション 1）は挙動変更ゼロ・切り出しのみ。着手前に当レーンが open PR の state を確認します
- #675（巨大ホストの分割・セッション 2）は差分が大きいため、着手時期を調整させてください。schedule-refine 側で CalendarTab に大きな変更が入る予定があれば outbox でお知らせいただけると助かります

## 2026-08-12 chat-main 宛: #671 C4 S8（i18n の型拡張）の実測結果と follow-up 起票依頼

#671 の S8（i18next `CustomTypeOptions` でキーを型に載せる）を実際に配線して計測しました。**計画書が挙げていた 3 段の障害は 3 つとも越えられます**が、越えた先の後始末が独立した作業量なので、S7（ランタイムガード）までで PR を締め、S8 は follow-up の起票をお願いしたいです。

**実測（probe は revert 済み・コードには残していません）**

- `shared/src/i18n/resources.ts` に `declare module "i18next"` を置き、`shared/src/i18n/index.ts` から side-effect import する形にすると、**web 側の `useTranslation()` の `t` までちゃんと型が届きました**。「i18next が二重に入っている（shared / web の node_modules 両方に 25.10.10）」は障害になりませんでした
- 存在しないキー `t("definitely.not.a.real.key")` を web の画面に入れると `cd web && npm run build` が落ちます。**狙いどおり機能します**
- 同時に、動的キーの呼び出しが **12 箇所**エラーになります（probe の仕込み 1 件を除いた実数）:
  - `web/src/AuthScreen.tsx:76` / `web/src/hooks/useShellChrome.tsx:115,185` / `web/src/MainScreen.tsx:306,349` / `web/src/schedule/CalendarTab.tsx:406,890,2186` / `web/src/settings/SettingsScreen.tsx:103,114` / `web/src/tasks/KanbanView.tsx:542` / `web/src/work/WorkScreen.tsx:91`

**なぜ今回入れなかったか**

12 箇所を直すには、キーを保持している定数側（section registry の `labelKey`、ショートカット定義の `descriptionKey` など）を `TranslationKey` のリテラル union に型付けし直す必要があります。これは `shared/src/sections.ts` など**他レーンも触るファイル**に波及するため、P-008（実装中スコープ凍結）に従い今回は広げませんでした。

**起票のお願い**: `shared-fix` + `[refactor-core]` prefix で「i18n キーを型に載せる（#671 S8 の続き）」。DoD 案 = 上記 12 箇所の動的キーを型付き定数に寄せる / `CustomTypeOptions` を入れて `cd web && npm run build` が未知キーで落ちる / S7 のランタイムテストは残す（動的キーは型でしか見えず、リテラルは型とテストの二重で見る）。

## 2026-08-13 chat-main 宛: #701 の横展開 Issue 起票依頼（Step 2 が着地したら）

#701 Step 2 を PR #800 で出しました。**Trash 1 画面ぶんだけ**通してあり、Issue 本文の「1 画面で形が固まってから横展開の Issue を切る」に従って他画面へは広げていません。merge 後に横展開の Issue 起票をお願いします。

- ラベル案: `shared-fix` + タイトル prefix `[refactor-core]`（宛先を当レーンに固定）
- タイトル案: 「ボタンの処理を引数から叩くテストを主要画面へ横展開する（#701 の続き）」
- 手本 = `web/tests/trashScreenActions.test.tsx`。**画面ごとに `(ボタン, 引数) → 呼ばれる DataService メソッド + その引数` の表を作り、兄弟メソッドが呼ばれないことまで assert する**形
- 道の選定は済んでいるので判断は不要（`D-20260812-refactor-2` = A+B。既定 = Testing Library で画面ごと render / 純関数切り出しは jsdom に載らない画面の逃げ道。使い分け基準は #800 で `rules/frontend.md` に明文化済み）
- 対象画面の候補（テストが presentation 止まりで、ホスト側の配線が無防備なもの）: Settings / Tags / Work / Daily。**Schedule は除外**（#673 / #675 が触る）

## 2026-08-13 chat-schedule-refine 宛: CalendarTab.tsx が 3 本で競合しています

#673（PR #819）で `CalendarTab.tsx` から 223 行を外へ出しました（ViewModel 変換 4 組 / 日付書式 / `t(...)` バンドル）。同じファイルに現在 open な PR が 2 本あります: **#813**（todo delete guard の移設）/ **#804**（day view の空日ラベル）。

- どれを先に merge しても残りは rebase が要ります。**当レーンは #819 を後回しにして構いません** — 先に #813 / #804 を通していただき、こちらが rebase します（#819 は追加が中心で、削った箇所は `useMemo` 本体の中身なので衝突は解けるはずです）
- #675（巨大ホスト 3 本の分割）は上の 3 本が片付くまで着手しません

## 2026-08-13 chat-main 宛: CLAUDE.md §7.1 の「PR 前に回すコマンド」に mcp-server が無い

**実測で刺さりました**。#821 と #822 が同じ手書きテーブル（`mcp-server/tests/toolRegistry.test.ts` の `VALID_CALLS`）を別の base から編集して main が赤くなったのですが、§7.1 のコマンド表は shared / web / desktop の 3 本しか挙げていないため、**ローカルでは最後まで見えず main の CI で初めて分かりました**（修理 = PR #829 merged）。

- CI（`.github/workflows/ci.yml`）は #687 で mcp-server を既にゲートに入れています。§7.1 の表だけが追いついていません
- 追記のお願い: `cd mcp-server && npm run build` と `cd mcp-server && npm run test` の 2 行。「desktop/ を触った時のみ」と同じ but-only-if 注記を付けるかは、mcp-server が web/shared の変更でも落ちうる（tools.ts の登録漏れ）ので **無条件で回す側**が安全だと思います
- 当レーンで直さない理由: CLAUDE.md は全レーン共有の SSOT で、並行 PR の衝突源になるため

## 2026-08-13 chat-schedule-refine 宛: #675 に着手しました（CalendarTab には触っていません）

前便のとおり #813 / #804 は merge され、#819 は main 再取り込みで CI 全緑になりました（merge 待ち = P-001）。#675 に入りましたが、**Schedule の web 側ファイルには触っていません**。

- 着手したのは #675 の**やること 3 のみ**（`shared/src/hooks/useScheduleItemsAPI.ts` の分割 = PR #833）。`shared/src/hooks/` 内で完結し、open PR のどれとも重なりません
- やること 1（`CalendarTab.tsx` の taskChips / Todo 抽出）と 2（`WeekTimeGrid.tsx` のドラッグ機構）は **#819 と同一ファイルなので着手していません**。Issue #675 自身が「各 PR は main から独立に切る（stacked にしない）」と定めているため、#819 が merge されるまで待ちます
- やること 4（`web/src/schedule/useScheduleMutations.ts` → `useRepeatMutations`）は #819 と非干渉なので着手可能な状態です。schedule-refine 側で同ファイルに予定があれば outbox でお知らせください

## 2026-08-13 chat-schedule-refine 宛: #675 を 4 項目とも PR にしました（Schedule は当面ご自由に）

前便の続報です。#819 / #833 が merge されたので、残り 3 項目も通しました。**#675 は当レーンとしてこれで打ち止め**なので、Schedule の各ファイルは以降そちらのご都合で構いません。

- open な PR: **#839**（`web/src/schedule/CalendarTab.tsx` + 新規 `useScheduleTaskChips.ts`）/ **#841**（`shared/src/components/schedule/WeekTimeGrid.tsx` + 新規 `useWeekTimeGridDrag.ts`）/ **#842**（`web/src/schedule/useScheduleMutations.ts` + 新規 `useRepeatMutations.ts`）
- **3 本とも互いにファイルが重なりません**。merge 順は自由で、rebase も不要です
- どれも公開インターフェース不変・挙動は逐語移動です。CalendarTab に別途手を入れる予定があれば、#839 の merge 後のほうが衝突が小さくなります（2,716 → 2,553 行に減っており、task 系のハンドラは別ファイルへ出ています）

## 2026-08-13 chat-main 宛: #675 merge 後の playwright 検証をお願いします

#675 の DoD で唯一残るのが実ブラウザ検証です（worktree レーンは build / 型検証まで、というルールのため当レーンでは実施できません）。

- 対象 PR: #839 / #841 / #842（+ merge 済みの #833）
- 検証項目（Issue #675 の DoD より）: 週表示 / 月表示 / ドラッグ移動 / リサイズ / 繰り返しのスコープ選択 / Todo の追加と削除
- **特に見ていただきたいのは #841 のドラッグ**です。jsdom には座標が無いので、既存テストは `getBoundingClientRect` をスタブして通しています。終日レーンへのドロップ（#562）と終日チップの「place」ドラッグ（#298）は、実際のレイアウトでしか本当のことは分かりません

## 2026-08-13 chat-main 宛: §7.1 のコマンド表に `typecheck:tests` も足してください（今日 2 度目の実測）

前便で「§7.1 に mcp-server が無い」と書きましたが、**同じ表から `typecheck:tests` も抜けています**。今日また刺さりました。

- 実測: PR #842 で `vitest run` は 365 件すべて緑なのに、CI の `web — typecheck tests` だけが赤。原因は新規テスト内の `mock.calls[0][2]` で、パラメータを宣言していない `vi.fn(() => …)` の `calls[0]` は空タプル型になるため index 2 が型エラー（`TS2493`）。**vitest は型を見ないので実行では絶対に出ません**
- このゲートは #690 で当レーンが自分で入れたものです。それでも §7.1 の表に載っていないため、ローカルの「PR 前に回すコマンド」から漏れました
- 追記のお願い: `cd shared && npm run typecheck:tests` と `cd web && npm run typecheck:tests` の 2 行。mcp-server の 2 行とあわせて 4 行です
- 補足: この 2 件はどちらも「CI にはあるが §7.1 の表に無い」型の漏れです。表を手で保つ限り再発するので、**`.github/workflows/ci.yml` を正本と明記して §7.1 は参照だけにする**手もあります（§7.1 は既に「ゲート一覧の正本は ci.yml」と書いているので、コマンド列挙のほうを削る方向）。どちらが良いかは chat-main の判断でお願いします

## 2026-08-16 chat-main 宛: mcp-server のテストが 1 件、開発端末の環境変数で落ちます（Issue 起票の判断をお願いします）

`mcp-server/tests/silentDrops.test.ts` の **"still lets a bare call mean today"** は、`LIFE_EDITOR_SUPABASE_URL` / `_ANON_KEY` / `_EMAIL` / `_PASSWORD` が環境に入っている端末で落ちます。main でも落ちるので特定の PR の起因ではありません（#895 の作業中に踏んで、`git show origin/main:mcp-server/src/tools.ts` に戻して再現を確認しました）。

- テストの意図は「引数ガードを通り抜けてハンドラまで到達したこと」を、**Supabase 資格情報が無い環境で出る例外メッセージ**で確かめること（`expect(error.message).toMatch(/Supabase/)`）
- 資格情報がある端末では呼び出しが成功してしまい、`error` が `undefined` になって `.toMatch()` が型エラーで落ちます
- CI には資格情報が無いので緑。**落ちるのは MCP を実際に使っている開発端末だけ**で、しかも「自分の変更が壊した」ように見えます
- 回避策（実測）: `env -u LIFE_EDITOR_SUPABASE_URL -u LIFE_EDITOR_SUPABASE_ANON_KEY -u LIFE_EDITOR_SUPABASE_EMAIL -u LIFE_EDITOR_SUPABASE_PASSWORD npm run test` で 20 files / 288 tests 緑
- 直すなら「到達したこと」を例外メッセージではなくハンドラのスパイで確かめる形が素直だと思います。プロダクト課題なので Issue 化が妥当と考えますが、**起票は chat-main 一元化**のルールに従って判断をお願いします

## 2026-08-16 chat-main 宛: tracker ブランチ名が 1 日に 3 本になっています

`chore/tracker-refactor-core-20260816` は PR #923 で merge 済みですが、squash merge なのでローカル / リモートに「未マージ扱いの残骸」が残ります。同名を作り直せず、今日は `-2`（PR #952）と `-3`（本 PR）を切りました。

`worktree-policy` の命名規約は `chore/tracker-<chat>-YYYYMMDD` なので、**1 日に複数回 tracker を回すレーンでは連番が要る**ことになります。規約に連番を明記するか、merge 済み tracker ブランチをローカルで削除する手順を足すか、どちらかを決めていただけると次回から迷いません。

## 2026-08-16 chat-main 宛: PR #985（analytics 3 件）の実ブラウザ裏取りをお願いします

レーンの無い analytics セクションの 3 件（#943 / #944 / #948）を **PR #985** にまとめました（3 件とも `shared/src/components/Analytics/` に落ち、#943 と #944 は同一ファイル）。merge 後に確認いただきたいのは #948 の DoD の残り半分です。

- **お願い**: Briefing を 1 回開く / Analytics のタブを一巡する操作で `width(-1) and height(-1)` の警告が **0 件**であること、および **1440px と 390px** でチャート 10 種が従来どおり描かれること。§7.4 で dev server と playwright は chat-main のみなので、当レーンは jsdom + 実物の recharts で console を読むところまでで止めています（10 チャート全部をマウントして `console.warn` を assert・修正前のコードでは 14 件落ちることを実測済み）
- **参考（同じ警告を他所で見たとき用）**: これは**レイアウトの問題ではありません**。recharts 3.7.0 の `ResponsiveContainer` はサイズ state を既定の `initialDimension = {-1, -1}` から始め（`responsiveContainerUtils.js:7`）、それを直す ResizeObserver は effect＝初回描画が警告を出した後にしか走らないので、`width="100%" height="100%"` のチャートは**全マウントで必ず 1 回出ます**。警告文が勧める `minWidth={0}` は効きません。判定は 2 辺の OR なので**高さを数値で渡せば消えます**（幅は `"100%"` のままで可）
- **#944 で 1 つ判断しました**（PR 本文にも記載）: Issue が「付け忘れ」と名指ししていた時間軸 2 本（`WorkTimeChart` / `TodoWorkTimeChart`）には `allowDecimals={false}` を**付けていません**。`hours` は小数第 1 位まで丸めた値なので、整数刻みにすると 1.5h の日が軸から読めなくなります。「整数で集計しているので一律で付けてよい」という Issue の前提が時間軸だけ成り立たない、という判断です。再起票を防ぐため理由はコード側にコメントで残しました。**違うと思われる場合は差し戻してください**

## 2026-08-16 chat-refactor-core: §7.1 の `typecheck:tests` 漏れ、同じ場所でもう一度踏みました

上の 2026-08-13 の追記依頼（§7.1 に `typecheck:tests` の 4 行を足す件）がまだ入っていないため、**PR #985 で同じ落ち方をしました**。§7.1 の 6 コマンドは全部緑・vitest も 22 件緑で、CI の `shared — typecheck tests` だけが赤。原因は `vi.spyOn(console, "warn")` の `mock.calls` を map/filter する引数が implicit any（TS7006）で、**vitest は型を見ないので実行では絶対に出ません**（前回の `mock.calls[0][2]` と同じ型の事故です）。

依頼内容は前回と同じで、§7.1 のコマンド列挙に 4 行足すか、列挙をやめて `.github/workflows/ci.yml` を正本と明記するかの二択です。**2 回続けて同じ漏れ方をしたので、後者（列挙を削って ci.yml を見る運用）に寄せるほうが再発しないと思います**。判断をお願いします。

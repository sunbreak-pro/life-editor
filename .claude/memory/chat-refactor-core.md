# MEMORY (chat-refactor-core)

## 進行中

### 🔧 コード整理監査の findings 消化（着手日: 2026-09-01）

**対象**: `shared/src/**` / `mcp-server/src/**` / `desktop/**` / `.claude/docs/vision/plans/`

- 前回: —
- 現在: **5 本すべて PR 到達（#1386 / #1387 / #1389 / #1385 / #1300）**。2026-09-01 実測で **#1415 / #1418 / #1422 / #1426 は MERGED**、**#1428（#1300）だけ open**
- 次: **#1300 の残りはユーザー手番**。(a) `release-desktop.yml` を workflow_dispatch で 1 回回す（Claude 側は権限で実行不可）→ (b) `desktop-v0.1.0` タグ → (c) 👀 Windows 11 実機受け入れ（起動判定は **Electron プロセス 4 本** = #545 の教訓）。#1301 の macOS 実機は別レーン

### 🔧 コア構造のリファクタリング（着手日: 2026-08-10）

**対象**: `shared/src/**` / `web/src/**` / `mcp-server/**` / CI・tsconfig 群
**計画書**: `.claude/docs/vision/plans/2026-08-10-core-refactor.md`

- 前回: **#1101 = #1038 案 A-1 の stale-while-revalidate（PR #1108 merged）**
- 現在: **#1184 = 警告 / お知らせ / 確認パネルの共通化（PR #1259 open・CI 全緑）**。`shared/src/components/NoticePanel.tsx` を新設し、代表 4 箇所を置換（AuthAlert を畳んで削除 / notes サイドバーのエラー帯 / オフラインバナー / schedule の繰り返しフィルタ通知）。残置換 3 グループは子 Issue へ回す依頼を outbox に積み済み
- 直前: **#1101 = #1038 案 A-1 の実装（PR #1108 merged）**。`useDomainLoad` に任意の `snapshotKey` を足し、成功した読みをモジュール store に置いて次の mount で layout effect から `apply` に流す stale-while-revalidate。ドメインフック 7 本が opt-in、キー無しの呼び出しは挙動据え置き
- **#1101 で効いた設計判断 3 つ**（同型のキャッシュを足す人向け）: (1) **replay は layout effect**。passive effect だと commit と effect flush の間に描かれうるフレームが残り、それが消したかった空リストそのもの。`apply` は呼び出し側の setState なので描画前に 1 パス増えるが、増えるだけで blink はしない。(2) **`settled` を snapshot 命中時だけ初期値で埋める**。`isLoading` は従来どおり派生値のままで、書き込む場所を増やしていない。(3) **store は 1 key = 1 エントリ**。anchor（Schedule の日付）ごとに溜めると 30 日辿れば 30 個になるので、直近だけ持って anchor 不一致は miss（= 従来挙動）に倒した
- **#891 で分かった 3 つの差分**（次に同型の載せ替えをやる人向け）: (1) **notes** — Trash の読み込みは同じトリガでも独自 try/catch を持つので load の `Promise.all` に畳めない（畳むと Trash の失敗がツリーを道連れにする）。別 effect に据え置いた。(2) **dailies** — 元から `isLoading` も `error` も**持っていなかった**ので、載せ替えは新規フィールドの追加になる。UI は未配線（エラーカードは見た目の変更なので範囲外）。(3) **wikitags** — `refetchReportsLoading: false` では足りず `loading = attemptInFlight && !hasLoaded` と書いた。**初回ロードが失敗した後の再試行**で旧コードは旗を立て直しており（`if (!hasLoadedRef.current) setLoading(true)`）、false 固定にすると「読み込み中」を「タグ 0 件」と表示してしまう
- **#948 で分かったこと（recharts を使う人向け）**: `width(-1) and height(-1)` の警告は**レイアウトの問題ではない**。`ResponsiveContainer` のサイズ state は recharts 既定の `initialDimension = {-1, -1}` から始まり（`responsiveContainerUtils.js:7`）、直すのは ResizeObserver の **effect** = 初回描画が終わって警告を出した後。つまり全チャート・全マウントで必ず出る。警告文が勧める `minWidth={0}` は最初から付いていて効かない。判定は 2 辺の **OR**（`ResponsiveContainer.js:135`）なので、**高さを数値で渡せば消える**（幅は `"100%"` のままで応答性は不変）
- 次: **PR #1259 の merge 待ち（P-001）**。merge 後は (a) オフラインバナーのトーン変更の目視と (b) 残置換 3 グループの子 Issue 起票（依頼は outbox 済み）が chat-main 手番。**2026-08-30 実測: #1108 は MERGED**（open は #1259 のみ）。merge 後の実ブラウザ確認（セクション往復で骨組みが出ないこと・他デバイス変更後の「一瞬古い」の見え方）は chat-main 手番。案 B（無駄取りの削減 = schedule 11→8 / connect 7→5 / Materials タブ 4→1）は #1101 の対象外なので、やるなら別 Issue の起票依頼を outbox へ。**2026-08-23 実測**: #1071 は MERGED、open は #1108 のみ。**2026-08-18 実測**: #958 / #960 / #963 / #985 / #1058 はすべて MERGED で、open は #1071 だけ。#898 は着手判断がユーザー手番（キュー済み）・#677 は status:frozen。**merge 後の playwright は chat-main へ引き継ぎ** — #675 分（週 / 月表示・ドラッグ・リサイズ・スコープ選択・Todo）/ #672 分（Schedule 初回描画 / 日付切替・Realtime bump 後にスケルトンが残らない・Calendar 管理ビューが refetch で白くならない・ルーチン Ctrl+Z で生成済み Event が孤児にならない）/ #891 分（Materials・Tags の初回ロードとエラー復帰）

## 直近の完了

- **コード整理監査の findings 5 本を一気通貫で PR 化** ✅（2026-09-01）: #1386（`migrateTodosToBackend` 削除 = PR #1415 merged）/ #1387（削除済み `frontend/` 前提のコメント・規範一掃 = PR #1418 merged）/ #1389（参照ゼロ export 削除 + EmptyState 改名 = PR #1422 merged）/ #1385（未使用 version カラムのバンプ廃止 = PR #1426 merged）/ #1300（desktop リリース基盤の実測記録 = PR #1428 open）。5 本とも `ci.yml` の `verify` 全ステップ + `docs-lint` をローカルで緑にしてから PR
- **#1385 で分かったこと 3 つ**: (1) **`items_meta.version` のバンプは PostgREST の制約でそのたびに SELECT を 1 本増やす**（`version = version + 1` を書けない）。読み手は shared / web 全域でゼロだった。(2) **`deleteTagGroup` の version READ は消せない** — バンプの材料であると同時に「メンバーシップを消す前に投げる」pre-flight で、後者が本体。`select("id")` に置き換えて存置した。(3) **`web/tests` の fixture は `web build` でも `web test` でも捕まらない**（build は tests を見ず vitest は型を見ない）— `typecheck:tests` だけが赤くなった実例が出た（CLAUDE.md §7.1 のとおり）
- **#1300 は「コードは既に main」だった**: PR #1348 / #1360 で version・workflow・ガード・README まで着地済みで、残っていたのは**一度も走らせていない**こと（`gh run list` も `gh release list` も空）。ローカルで空ビルドガードを両方向とも実測 — env 付きならホスト名がバンドルに焼かれ、**env 無しでもビルドは exit 0 で成功したまま**ホスト名だけが無い。計画書が保留していた `desktop/.env` の疑問も解けた（renderer の `root` は `../web` だが `envDir` はそこに従わず、`desktop/.env` は効く = README は正しい）
- **#1184 警告 / お知らせ / 確認パネルの共通化 — PR #1259 merged** ✅（2026-08-30）: `NoticePanel` は **ConfirmDialog（#707）の非モーダル側の片割れ**で、境界は「次の一手を誰が持つか」— ダイアログは進めない質問のために画面を奪い、パネルは読み飛ばせる報告をその場に置く。**トーンは `ToastVariant` の 4 つに合わせた**（同じ文言がトーストとその場表示で違う色になるのを防ぐ）。`info` / `warning` に `-subtle` の面を新設（既存レシピ = トーンを 6%（light）/ 8%（dark）で bg-secondary に焼き込む。**success-subtle が両テーマとも 1 バイト違わず再現したのでレシピを信用した**）。ビルド後の CSS に 4 トーンとも出ていることを実測 — **動的な `bg-lumen-${tone}-subtle` は Tailwind のスキャナに見えず、エラーにならず透明落ちする**（§5）
- **#1184 で残した判断 2 つ**: (1) **オフラインバナーのトーンを danger → warning に下げた**（何も失敗していない・`danger` は隣の画面で本物のエラーが使う色）。文言 / `role="status"` / `WifiOff` は据え置きで、merge 後の目視だけ chat-main 手番。(2) **auth の帯は成功トーンでも `role="alert"` を明示で渡す** — 両トーンとも「今出したフォームの結果」なので割り込むのが正で、`authCard.test.tsx` がそれを固定している。既定（success = polite）に任せると静かに退行する

- **#1101 セクション切替に stale-while-revalidate — PR #1108 open** ✅（2026-08-23）: #1038 案 A-1 の実装。`useDomainLoad` の任意オプション `snapshotKey` で、成功した読みを `state/domainSnapshotStore.ts`（モジュール store）に置き、次の mount が同じ (dataService, anchor) ならそれを **layout effect** で `apply` に流し、`settled` を埋めた状態で始める（`isLoading` が true にならない）。7 ドメインが opt-in。**メモリのみ**（D-20260818-refactor-1）で localStorage には書かない。テスト 8 件で「往復で骨組みが挟まらない / 再取得が確実に差し替わる / localStorage に書かない」を固定し、失敗した再取得・race に負けた応答は store を汚さないことも併せて固定
- **#1038 セクション切替の体感ロード調査 — PR #1071 merged** ✅（2026-08-18）: 体感の主因は本数ではなく「切替のたびに前回値を捨て、取り直しが返るまで骨組みを見せる」こと（materials 復帰 = 5 本を全件再取得・キャッシュ利用 0 本）。**使い捨ての jsdom ハーネス**で descriptor body をセクション層 Provider ごとマウントし、DataService を Proxy で数え `<Profiler>` で commit を数えた（本数と commit はデータ量に依存しないので実データ無しでも正しい。ミリ秒は主張しない = #994 の手番）。副産物 = schedule 11 本中 3 本が誰も表示に使わない Trash 用の削除済み一覧 / connect は自前 2 本が自 Provider と重複 / Materials はタブごとに WikiTags Provider を持つ。案 3 本を D-20260818-refactor-1 でキューへ
- **#1012 ボタン → DataService の routing テスト横展開 — PR #1058 merged** ✅（2026-08-18）: Settings / Tags / Work / Daily の 4 画面 42 件。**Tags / Work / Daily は real Provider を fake DataService の上にマウント**して表の終点を service にした（stub context 止まりでは見えない配線がそこにある）。Daily は pin / delete が「日付 → 行 → その行の id」で書くので、**fixture の行 id をわざと `daily-<date>` にしない**ことで id をテンプレートから作り直す実装を落とせるようにした
- **analytics のチャート 3 件 — PR #985 merged** ✅（2026-08-16）: #943（ツールチップの系列名）/ #944（分軸の 0.25m 刻み）/ #948（recharts の -1 警告）を 1 PR で。**#944 は Issue が「付け忘れ」と書いていた時間軸 2 本を、あえて直さなかった** — `hours` は小数第 1 位まで丸めた値なので `allowDecimals={false}` にすると 1.5h の日が軸から消える。理由をコードのコメントに残して再起票を防いだ。新規テスト 14 件はすべて**修正前のコードで落ちることを実測**（src だけ stash して確認）
- **#895 mcp-server tools.ts の分割 — PR #963 open** ✅（2026-08-16）: 986 行の単一配列を `tools/<domain>.ts` × 11（`handlers/` と 1 対 1）へ逐語移動。`tools.ts` は 1,120 → 93 行。**対応関係を約束でなく検査にした**（`toolDomains.test.ts` 4 件）— 片方だけあると落ちる / `tools.ts` が spread を 1 つ忘れると落ちる。後者は**放っておくと何も壊れて見えない**（`TOOLS` を歩くテストがそのツールを最初から見ない）のが怖いところ。`...TRASH_TOOLS` を落として 3 件落ちることを実測
- **#894 desktop の IPC 契約 — PR #960 open** ✅（2026-08-16）: 7 本のチャネル名を `desktop/src/shared/ipcContract.ts` に集約し、main の登録を `Record<DesktopIpcChannel, …>` 注釈の表に。**ハンドラの無いチャネルはコンパイルが通らない**。`shared` の構造的再宣言は `electron` を import できないので残し、両方を見られる desktop 側のテストで**双方向の代入可能性**を assert（署名がズレると desktop の typecheck が落ちる）。desktop に vitest + 7 件 + CI ステップ（#668 の mcp-server と同じ手当て）。テスト用 tsconfig を分けた理由 = アプリ側が `composite: true` で外部ファイルを列挙必須（TS6307）＋ shared は DOM lib が要るが main/preload には持たせたくない
- **#890 5 role mapper の items_meta 側共通化 — PR #958 open** ✅（2026-08-16）: `assertItemsMetaPair` / `toItemsMetaInsertRow` / `toItemsMetaPatch` を `itemsMeta.ts` へ。**`updated_at` bump の実装が 5 箇所 → 1 箇所**（bump 漏れは例外もログも出さず「そのドメインだけ同期が来ない」形で出るのが怖い）。既存 mapper テスト 105 件は無改変で緑。**揃えなかった差分 2 つを保存**: `{isDeleted: undefined}` の扱い（todo/note/daily は `?? false`・event/routine はスキップ）と INSERT の `version`（Todos だけクライアント値）
- **#891 の残り 3 本 — PR #949 / #950 / #951 merged** ✅（2026-08-16）: notes / dailies / wikitags を `useDomainLoad` へ。新規テスト 19 件（notes 7・dailies 6・wikitags 6）で、3 本とも load 経路のテストは**それまで 1 本も無かった**。#296 の un-latch（失敗後に読み直しが成功したらエラーが消える）が 4 ドメインすべてに行き渡った。既存の #300 スイート（`wikiTagsRefreshLoading.test.tsx`）は無改変で緑
- **C5（#672）use\*API の load effect 共通化 + eslint baseline 退役 — PR #846 open** ✅（2026-08-13）: 実装は着手前に全部着地済み（#769 / #801 / #686）だったので、足したのは `useDomainLoad` の直接テスト 4 件。3 本のドメインスイート（計 16 ケース）は呼び出し側からしか叩けず、**superseded ガード**（2 本が同時に飛んで古い方が後着する並びを作れない）/ **dep 配列の `dataService`**（service を差し替えるスイートが 1 本も無い）/ **`load`・`apply` の ref ミラー**（dep に戻すと永久ループになるがドメインスイートは落ちず回り続ける）の 3 つに届いていなかった。逆テストで 3 つとも「守りを外すと対応テストだけ落ちる」ことを実測
- **C8（#675）巨大ホスト 3 本の分割 — 4 項目すべて PR 化（#833 merged / #839・#841・#842 open）** ✅（2026-08-13）: 1 = CalendarTab の task 半分 → `useScheduleTaskChips`（2,716 → 2,553 行・16 tests）/ 2 = WeekTimeGrid のドラッグ → `useWeekTimeGridDrag`（921 → 719 行・7 tests + 既存 21 が無改造で通る）/ 4 = 繰り返し・スコープ → `useRepeatMutations`（1,041 → 456 行・16 tests。**この機構は今までテストが 1 つも無かった**）。全 PR で公開インターフェース不変・挙動変更ゼロ、各テストはソース変異で噛みを実測
- **C8（#675）やること 3 = `useScheduleItemsAPI` の分割 — PR #833 merged** ✅（2026-08-13）: `shared/` 最後の未分割 API hook。727 → 239 行 + `useScheduleItemsViewMirror`（137）/ `useScheduleItemsCRUD`（459）/ `useScheduleItemsTrash`（73）。戻り値は無改造（`ScheduleItemsContextValue` がその `ReturnType`）。新規 22 tests は 3 本ともソースをわざと壊して落ちることを実測
- **C6（#673）Schedule の純関数 pin — PR #819 open・CI 全緑** ✅（2026-08-13）: 4 組の ViewModel 変換 → `scheduleViewModels.ts`（13 tests）/ 日付書式 5 箇所 + `t(...)` バンドル → `scheduleCopy.ts`（18 tests）/ ドラッグの配置解決 → `scheduleGridLayout.resolveDrag`（29 tests）。CalendarTab 2,927 → 2,704 行・WeekTimeGrid 977 → 921 行。挙動変更ゼロ
- **main の赤 2 件を修理 — PR #829 merged** ✅（2026-08-13）: 手書きテーブル 2 本が merge の波で古びた事故。#798 が足した describe を #813 の key 改名が拾えず `kanbanView.test.tsx` が 3 本落ち、#821 と #822 が同じ `VALID_CALLS` を別の base から編集して `covers every published tool` が落ちた。どちらも「各 PR 単独では緑・組み合わせで赤」の型
- **#701 Step 2 画面を操作せずボタンの処理を叩く経路 — PR #800 open** ✅（2026-08-13）: D-20260812-refactor-2 = A+B の道で Trash 1 画面を通した（`web/tests/trashScreenActions.test.tsx` 16 tests）。使い分け基準を `rules/frontend.md` に 1 行明文化
- **C3（#670）死蔵の削除と共有物の寄せ直し — 4 PR 全完了** ✅（2026-08-11）: 単一行 Mapper シム + 孤児型 6 本の削除（#698）/ `ItemsMetaRow`・contentJson・`ShortcutRow`・`TimerState` の置き場所是正（#699）/ ブレークポイント・日付キー・`minutesToTime`・`clamp` の手写し差し替え（#703）/ keydown 3 箇所の IME ガード + Audio 誤コメント訂正（#705）
- **C1（#668）検証ゲートの穴を塞ぐ — 4 PR 全完了** ✅（2026-08-11）: mcp-server を CI へ（#687）/ web の `"strict": true` 明示 + coverage 計測（#689）/ tests を型検査に載せて CI ゲート化（#690）/ TS を 4 パッケージとも ~6.0.x へ統一（#695）
- リファクタ調査（8 領域 → 64 findings → 10 クラスタ）+ 計画書 + Issue #668〜#677 起票 ✅（2026-08-10）
- Issue #586 eslint baseline 解消（PR #638/#644/#649/#653 すべて merged・Issue closed。baseline 残 = schedule 系 3 本のみ = scope 外）✅（2026-08-10）

## 予定

- **merge 後に chat-main へ**: #948 のブラウザ側での裏取り（Briefing を開く / Analytics のタブ一巡で当該警告 0 件・1440px と 390px でチャートが従来どおり）。worktree では dev server / playwright を持てない（§7.4）ため、jsdom + 実 recharts で console を読むところまでが自分の担当
- **#1038 の案 B（無駄取りの削減）は未着手**。schedule 11→8 / connect 7→5 / Materials タブ切替 4→1 で、#1101（案 A-1）とは独立に効く。着手するなら Issue の起票依頼を outbox へ（起票は chat-main 一元化）。案 C（hover プリフェッチ）は初回訪問の chunk 待ちだけに効くので優先度は下
- **#958 / #960 / #963 / #985 / #1058 は 2026-08-18 時点で全部 merged**。merge 後にやり残しているのは #960 の**パッケージ版デスクトップの起動とログイン維持**の目視（IPC 登録経路が表になったため）— chat-main 手番
- **#898 は着手判断そのものがユーザー手番**。実装せず A/B を判断キューへ積む（#677 は status:frozen で対象外）
- 実装セッション 1 の残り: #671（#672 は chat-shared-fix が PR #801 で着手中・#673 は完了・#675 は 4 項目とも PR 化済み）
- **C1 の後始末（別 PR・小さい）**: `shared/tsconfig.test.json` の除外 12 本 + `web` の 1 本を潰す。中身は fixture の型ズレと不要な `@ts-expect-error` 5 件で、1 本直すごとに `exclude` から 1 行消える（#690 の PR 本文に全件の内訳あり）
- 実装セッション 2: 未調査領域の追加調査（計画書 §次セッションの調査計画 A-1〜A-6）→ #674 → #676(a) → #675
- **回答待ちの判断 2 件**（どちらも放置時 = 現状維持なので作業はブロックしない）: D-20260811-refactor-1（Analytics の「今週」2 定義を揃えるか）/ D-20260811-refactor-2（`window.confirm` を自前ダイアログにするか）
- merge 後に chat-main へ依頼: ルーチン undo の実ブラウザ検証（D-20260810-refactor-1 の条件）／ **#705 の IME ガード 3 経路の実ブラウザ検証**（`[[` 候補・スラッシュメニュー・Connect で変換中 Escape）

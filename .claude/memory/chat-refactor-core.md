# MEMORY (chat-refactor-core)

## 進行中

### 🔧 コア構造のリファクタリング（着手日: 2026-08-10）

**対象**: `shared/src/**` / `web/src/**` / `mcp-server/**` / CI・tsconfig 群
**計画書**: `.claude/docs/vision/plans/2026-08-10-core-refactor.md`

- 前回: **Issue sweep 完走**（#958 / #960 / #963 が open のまま merge 待ち・#891 は close 済み）
- 現在: 自分の backlog が空になったので **analytics セクション（レーン無し）の 3 件を引き受け、PR #985 で 1 本にまとめた**（#943 / #944 / #948）。3 件とも `shared/src/components/Analytics/` に落ち、#943 と #944 は同じ `WorkBreakBalance.tsx` — 3 PR に割ると自分同士で衝突を直列化するだけなので 1 PR にした
- **#891 で分かった 3 つの差分**（次に同型の載せ替えをやる人向け）: (1) **notes** — Trash の読み込みは同じトリガでも独自 try/catch を持つので load の `Promise.all` に畳めない（畳むと Trash の失敗がツリーを道連れにする）。別 effect に据え置いた。(2) **dailies** — 元から `isLoading` も `error` も**持っていなかった**ので、載せ替えは新規フィールドの追加になる。UI は未配線（エラーカードは見た目の変更なので範囲外）。(3) **wikitags** — `refetchReportsLoading: false` では足りず `loading = attemptInFlight && !hasLoaded` と書いた。**初回ロードが失敗した後の再試行**で旧コードは旗を立て直しており（`if (!hasLoadedRef.current) setLoading(true)`）、false 固定にすると「読み込み中」を「タグ 0 件」と表示してしまう
- **#948 で分かったこと（recharts を使う人向け）**: `width(-1) and height(-1)` の警告は**レイアウトの問題ではない**。`ResponsiveContainer` のサイズ state は recharts 既定の `initialDimension = {-1, -1}` から始まり（`responsiveContainerUtils.js:7`）、直すのは ResizeObserver の **effect** = 初回描画が終わって警告を出した後。つまり全チャート・全マウントで必ず出る。警告文が勧める `minWidth={0}` は最初から付いていて効かない。判定は 2 辺の **OR**（`ResponsiveContainer.js:135`）なので、**高さを数値で渡せば消える**（幅は `"100%"` のままで応答性は不変）
- 次: **4 本の merge 待ち**（#958 / #960 / #963 / #985）。#898 は着手判断がユーザー手番（キュー済み）・#677 は status:frozen。**merge 後の playwright は chat-main へ引き継ぎ** — #675 分（週 / 月表示・ドラッグ・リサイズ・スコープ選択・Todo）/ #672 分（Schedule 初回描画 / 日付切替・Realtime bump 後にスケルトンが残らない・Calendar 管理ビューが refetch で白くならない・ルーチン Ctrl+Z で生成済み Event が孤児にならない）/ #891 分（Materials・Tags の初回ロードとエラー復帰）

## 直近の完了

- **analytics のチャート 3 件 — PR #985 open** ✅（2026-08-16）: #943（ツールチップの系列名）/ #944（分軸の 0.25m 刻み）/ #948（recharts の -1 警告）を 1 PR で。**#944 は Issue が「付け忘れ」と書いていた時間軸 2 本を、あえて直さなかった** — `hours` は小数第 1 位まで丸めた値なので `allowDecimals={false}` にすると 1.5h の日が軸から消える。理由をコードのコメントに残して再起票を防いだ。新規テスト 14 件はすべて**修正前のコードで落ちることを実測**（src だけ stash して確認）
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
- **Issue sweep は完了。残るのは merge 待ちの 3 本**（#958 / #960 / #963）— merge はユーザー手番（P-001）。merge 後、#963 の `mcp-server` は実挙動の確認が要らない（純粋な再配置 + テスト）が、#960 は**パッケージ版デスクトップの起動とログイン維持**を一度見ておきたい（IPC 登録経路が表になったため）
- **#898 は着手判断そのものがユーザー手番**。実装せず A/B を判断キューへ積む（#677 は status:frozen で対象外）
- 実装セッション 1 の残り: #671（#672 は chat-shared-fix が PR #801 で着手中・#673 は完了・#675 は 4 項目とも PR 化済み）
- **C1 の後始末（別 PR・小さい）**: `shared/tsconfig.test.json` の除外 12 本 + `web` の 1 本を潰す。中身は fixture の型ズレと不要な `@ts-expect-error` 5 件で、1 本直すごとに `exclude` から 1 行消える（#690 の PR 本文に全件の内訳あり）
- 実装セッション 2: 未調査領域の追加調査（計画書 §次セッションの調査計画 A-1〜A-6）→ #674 → #676(a) → #675
- **回答待ちの判断 2 件**（どちらも放置時 = 現状維持なので作業はブロックしない）: D-20260811-refactor-1（Analytics の「今週」2 定義を揃えるか）/ D-20260811-refactor-2（`window.confirm` を自前ダイアログにするか）
- merge 後に chat-main へ依頼: ルーチン undo の実ブラウザ検証（D-20260810-refactor-1 の条件）／ **#705 の IME ガード 3 経路の実ブラウザ検証**（`[[` 候補・スラッシュメニュー・Connect で変換中 Escape）

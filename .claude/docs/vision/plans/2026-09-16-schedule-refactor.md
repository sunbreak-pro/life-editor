---
Status: IN PROGRESS
Created: 2026-09-16
Branch: claude/schedule-refactor-plan-1642
Owner-chat: schedule-refine
---

# Plan: Schedule コードのリファクタリング（工程 1 = 本書 / 工程 2 = 実装 / 工程 3 = 実ブラウザ検証）

> 本書は Issue #1642 工程 1 の成果物で、**Schedule リファクタリングの詳細の正本**。Issue 側は動機と DoD だけを持つ（数値の非複製原則）。
>
> 本書の作成中にコードは 1 行も変えていない。工程 2 は承認後・別セッションで着手する。

---

## Context

- **動機**: Schedule に不具合の報告が続いている（#1637 Undo が押せない / #1632 変換でタグが消える）。個別修正を積むのをやめ、**同じ操作が入口ごとに違う挙動になる構造**をまとめて畳む。
- **制約**: Electron + Capacitor + Supabase への移行中（移行 SSOT が優先）。コスト $0。merge は常にユーザー（P-001）。実ブラウザ検証は chat-main のみ（CLAUDE.md §7.4）。DDL 無し。
- **Non-goals**: 機能追加・UI 変更・文言変更・依存追加（**挙動変更ゼロが原則**。例外は不具合修正の作業単位だけで、振る舞いを変えない変更とは別 PR に分ける）。`supabase/migrations/` と `web/src/briefing/**`、`mcp-server/**`、`shared/src/utils/undoRedo/**` は触らない。

### 調査の方法と信頼性

4 領域を並列調査した（書き込み経路の全数 / Undo と楽観更新 / 繰り返しの範囲確認と変換 / 幅ごとの分岐とテスト）。そのうえで `rules/docs-consistency.md` §5 の実測必須則に従い、**主要な主張をメインが直接 grep / Read で spot check** した。棄却した findings は無い。

| 主張                                            | 実測結果                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 幅の分岐点は 1 箇所                             | ✅ `shared/src/constants/breakpoints.ts:25` の 768px を `CalendarTab.tsx:143` が 1 回だけ読む |
| narrow にグリッド書き込みが無い                 | ✅ `CalendarNarrowLayout.tsx:107` の props は `onSelectDay` 1 本のみ                          |
| `useScheduleMutations` を読むテストが 0         | ✅ 名前に触れる 4 ファイルはすべてコメントか別レイヤの参照                                    |
| 予定作成の undo は書き込み確定前に push される  | ✅ `useScheduleItemsCRUD.ts:126` で発火し、`:182` で await せず push                          |
| 完了トグルの undo が「set」でなく「反転」       | ✅ `useScheduleItemsCRUD.ts:324` が `toggleScheduleItemComplete` を再度呼ぶ                   |
| `undismiss` は undo に載らない                  | ✅ `useScheduleItemsCRUD.ts:412-426` に push が無い                                           |
| タグ付与 / 解除は undo に載らない               | ✅ `useWikiTagsUnifiedAPI.ts:182` `:199` に push が無い                                       |
| `updateRoutine` は書き込みが落ちても push する  | ✅ `useRoutinesAPI.ts:183` の `landed` は値で、`:196` の push を止めない                      |
| 頻度の変更は範囲を聞かずにシリーズ全体へ効く    | ✅ `useRepeatMutations.ts:252-341` に `requestScope` が無い                                   |
| 日付だけの編集は範囲を聞かない                  | ✅ `eventEditorSave.ts:52-64` の `seriesPropagatableFields` に date が無い                    |
| 「以降すべて削除」は routine 行ごと消す         | ✅ `SupabaseRoutinesService.ts:592-601`                                                       |
| MCP の予定削除は dismiss でなく soft delete     | ✅ `mcp-server/src/handlers/scheduleHandlers.ts:397-401`                                      |
| #1632 のタグ読み先が routine 側へ切り替わる     | ✅ `ScheduleEventEditor.tsx:186` が `routineId ?? item.id` を `TagPicker` に渡す              |
| Briefing が schedule の書き込みを二重実装       | ✅ `useBriefingWrites.ts:193-218` が `ds.createScheduleItem` を直接呼ぶ                       |
| Trash が `useScheduleItemsTrash` を使っていない | ✅ `TrashScreen.tsx:476-478` `:495-497` が `ds.*` 直叩き                                      |
| 祝日（#1626）の実装は存在しない                 | ✅ `web/src` / `shared/src` に該当語の一致ゼロ                                                |

棚卸し表の区分は「コード」= 該当行を読んだ / 「推定」= コードから導いたが挙動は未確認、の 2 つにする。**本工程はコードを読む工程なので「実ブラウザで再現した」は 1 件も無い。** 再現は工程 3 で行う。

### 現状の実測値（2026-09-16・baseline）

| 指標                                  | 値                                                |
| ------------------------------------- | ------------------------------------------------- |
| 対象コード                            | 71 ファイル / 19,744 行                           |
| `web/src/schedule/`                   | 38 ファイル / 8,908 行                            |
| `shared/src/components/schedule/`     | 21 ファイル / 6,155 行                            |
| データ層（hooks + services + mapper） | 12 ファイル / 5,402 行                            |
| 最大ファイル                          | `CalendarTab.tsx` 1,239 行                        |
| 最大の単一関数                        | `useRepeatMutations.ts:539-747` 209 行            |
| Schedule ドメインのテスト             | 107 suites / 1,203 cases                          |
| `docs-lint`                           | 緑（ローカルは `LC_ALL=C` 必須 — CLAUDE.md §7.1） |

#280 / #673 / #675 / #889 / #893 の分割は効いている。`CalendarTab.tsx` は 2,392 → 1,239 行、`WeekTimeGrid` の props は 28 → 6 個、`EventEditorPane` は 19 → 11 個に落ちた。**今回の報告はどれも行数と相関しない。** 残っているのは「同じ操作の入口が割れている」問題で、本計画はそこだけを狙う。

### 2026-09-19 の再計測（W0〜W12 merge 後）

| 指標                                  | 2026-09-16 baseline | 2026-09-19 実測 | 差          |
| ------------------------------------- | ------------------- | --------------- | ----------- |
| 対象コード                            | 71 / 19,744 行      | 74 / 21,932 行  | +3 / +2,188 |
| `web/src/schedule/`                   | 38 / 8,908 行       | 40 / 10,218 行  | +2 / +1,310 |
| `shared/src/components/schedule/`     | 21 / 6,155 行       | 23 / 6,722 行   | +2 / +567   |
| データ層（hooks + services + mapper） | 12 / 5,402 行       | 11 / 4,992 行   | -1 / -410   |
| `CalendarTab.tsx`                     | 1,239 行            | **1,375 行**    | **+136**    |
| `MonthGrid.tsx`                       | 623 行              | 383 行          | -240（W12） |

**増えた分を持ち込んだのはリファクタリングではなく機能追加である。** `git log --numstat -- web/src/schedule/CalendarTab.tsx` を 2026-09-16 以降で引くと、W8 / W9 / W10 / W12 をまとめた PR #1684 だけが **-1 行**で、残る +137 行は #1638 / #1639 / #1640 / #1641 / #1626 / #1664 / #1678 の 7 本が足している。

§5 は「後に回す 4 件は W15 まで着手しない」と書いたが、その 4 件（#1639 / #1640 / #1641 / #1626）は 2026-09-19 に merge された。**衝突は起きなかった**（どれも W8 / W11 の merge 後に着地している）。ただし AC の「`CalendarTab.tsx` が 1,239 行を超えない」は満たせていない。自己免除はせず、扱いを判断キューへ積む（P-008 / D-20260919-sched-6）。

---

## 1. 不具合・矛盾の棚卸し

### 1-A. Undo に載っていない経路

| ID   | 経路                                                        | 根拠                                                                          | 区分   |
| ---- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- | ------ |
| A-01 | タグの付与 / 解除（予定・繰り返し・Todo のすべて）          | `useWikiTagsUnifiedAPI.ts:182` `:199`、UI = `TagPicker.tsx:127-144`           | コード |
| A-02 | スキップの取り消し（`undismiss`）— スキップ自体は載る       | `useScheduleItemsCRUD.ts:412-426`、呼び出し = `useScheduleTodayAgenda.ts:110` | コード |
| A-03 | 繰り返しを ON にする（Event → Repeats 変換）                | `useRoutinesAPI.ts:407-443`（意図的に push しない）                           | コード |
| A-04 | 繰り返しを「なし」に戻す / 「以降すべて削除」（detach）     | `useRoutinesAPI.ts:364-385`                                                   | コード |
| A-05 | 「以降すべて」編集の伝播（`updateFutureOccurrences`）       | `useRoutinesAPI.ts:449-473`                                                   | コード |
| A-06 | 頻度変更にともなう再生成（`reconcileRoutineScheduleItems`） | `useScheduleItemsRoutineSync.ts:275-357`                                      | コード |
| A-07 | 常時生成器の書き込み                                        | `useScheduleItemsRoutineSync.ts:110-225`                                      | コード |
| A-08 | 作成パネルから付けたノート（ノート行 + リンク行）           | `useCreatePanelNotes.ts:108-139`                                              | コード |
| A-09 | ノート付きで Todo を配置したとき                            | `todoChipUndoWiring.ts:197-207`（意図的な除外）                               | コード |
| A-10 | 一括削除（`bulkDeleteScheduleItems`）                       | `useScheduleItemsCRUD.ts:490-502`                                             | コード |
| A-11 | Trash からの復元・完全削除                                  | `useScheduleItemsTrash.ts:35` `:66`                                           | コード |

A-03 と A-04 が対になっている点が重い。**繰り返しを ON にするのも OFF にするのも Undo で戻せない。** 片方が壊れているのではなく、この往復がまるごと履歴の外にある。

### 1-B. Undo はあるが元に戻りきらない

| ID   | 事象                                                                                                                                                                 | 根拠                                                                                                                                                                                         | 区分   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| B-01 | Schedule を離れるとグローバル Undo スタックが全消去される（Notes / Todo の履歴も巻き添え）                                                                           | `ScheduleItemsContext.tsx:55-58`（同型 5 本）+ マウント位置 `sectionDescriptors.tsx:184-188`                                                                                                 | コード |
| B-02 | 予定作成の undo / redo が書き込み確定前に push される。失敗しても履歴だけ残る                                                                                        | `useScheduleItemsCRUD.ts:126` 発火 → `:182` push、失敗は `:177-180` でログのみ                                                                                                               | コード |
| B-03 | 作成の redo が古い楽観行を再挿入し、サーバ確定値とリマインダーの反映を失う                                                                                           | `useScheduleItemsCRUD.ts:194-199` vs `:139-175`                                                                                                                                              | コード |
| B-04 | 作成の undo がノートとリンクを消さない（予定だけ消えてノートが孤児になる）                                                                                           | `useScheduleCreateFlow.ts:190-193` + `useCreatePanelNotes.ts:113-131`                                                                                                                        | コード |
| B-05 | 「以降すべて / すべて」編集がスタックに 2 件積む。1 回目の Ctrl+Z はテンプレートだけ戻す                                                                             | `useRepeatMutations.ts:597`（占有行）と `:624`（テンプレート）                                                                                                                               | コード |
| B-06 | `updateRoutine` は書き込みが落ちても push する                                                                                                                       | `useRoutinesAPI.ts:183` `:196`                                                                                                                                                               | コード |
| B-07 | 頻度変更の undo はリズムだけ戻し、再生成で消えた / 増えた日は戻さない                                                                                                | `useRoutinesAPI.ts:198-208` vs `useScheduleItemsRoutineSync.ts:292-346`                                                                                                                      | コード |
| B-08 | シリーズ削除の undo で、枠が埋まっていた日は Trash に取り残されログだけ出る                                                                                          | `useRoutinesAPI.ts:290-306`                                                                                                                                                                  | コード |
| B-09 | 完了トグルの undo が「元の値に戻す」でなく「もう一度反転」                                                                                                           | `useScheduleItemsCRUD.ts:324`                                                                                                                                                                | コード |
| B-10 | undo / redo の DB 書き込みが投げっぱなしで、失敗しても「元に戻しました」のトーストが出る                                                                             | `useScheduleItemsCRUD.ts:189` ほか 10 箇所 + `UndoRedoManager.ts:62-69` + `UndoRedoHost.tsx:24-29`                                                                                           | コード |
| B-11 | 削除・スキップの undo が選択状態を戻さない                                                                                                                           | `useScheduleMutations.ts:146` `:349`                                                                                                                                                         | コード |
| B-12 | 1 回の保存で「繰り返し ON + タイトル変更」をすると、繰り返しは戻せずタイトルだけ戻る                                                                                 | `EventEditorPane.tsx:561-579` + `useRepeatMutations.ts:356`                                                                                                                                  | コード |
| B-13 | ラベルの粒度が粗く、トーストが何を戻したか言えない（Todo は全部「todo change」）                                                                                     | `shared/src/i18n/locales/en.json:878` `:886` `:893`                                                                                                                                          | コード |
| B-14 | 変換とノート添付の Undo が、自分で失敗トーストを出したあと**正常終了する**。Manager は成功と見るので「元に戻しました」が重なり、失敗したのにコマンドが redo 側へ移る | `useItemConversion.ts:153-160` `:183-190`（`pushTodoToEventUndo` 側にも同じ 2 本）、`useCreatePanelNotes.ts:162-165` `:177-180` + `UndoRedoManager.ts:137-175` + `UndoRedoHost.tsx:42` `:47` | コード |

**B-14 は B-10 の裏返しで、W5 を生き延びた。** W5 は Provider 側（`useScheduleItemsCRUD`）の投げっぱなしを塞いだが、web 側のこの 2 hook は catch が例外を握って握り潰す形なので、Manager からは成功に見える。直し方 = catch でトーストを出したあと re-throw する（または catch を外して Manager に任せる）。出典 = shared-fix レーンが #1681 の工程 1 で `push(` の 30 箇所を棚卸しした報告（`.claude/comm/outbox/chat-shared-fix.md`・2026-09-19）で、`web/src/schedule/**` が本計画の Scope のため向こうでは触っていない。**本チャットが当該 4 箇所を読んで確認済み。**

**#1637 の第一容疑は B-01 である。** 変換の 4 入口はすべて `useItemConversion` に収束し、成功分岐で push している（`:298` / `:371`）。押せないとすれば、push した履歴が Provider の再マウントで消えている線が濃い。ただし**変換だけで Provider が再マウントされる経路は未特定**なので、工程 2 の最初に実ブラウザで切り分ける（推定）。

### 1-C. 楽観更新と再読み込みの競合

| ID   | 事象                                                                                                        | 根拠                                                                                                              | 区分   |
| ---- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| C-01 | `reload()` は範囲を丸ごと置き換える。await 中にユーザーが行った編集は黙って捨てられる                       | `useVisibleRangeItems.ts:49-67` `:121`、繰り返し系は `finally` で必ず呼ぶ（`useRepeatMutations.ts:659-661` ほか） | コード |
| C-02 | Realtime の再取得と書き込みが結合していない。自分の書き込みが bump を起こすため、連続操作で前の値に戻りうる | `CalendarTab.tsx:167` → `:448` → `useVisibleRangeItems.ts:67`、書き込みは投げっぱなし                             | 推定   |
| C-03 | 「スキップを戻す」が同じ tick で `undismiss` と `reload()` を撃つ                                           | `useScheduleTodayAgenda.ts:110-118`（コード内も自認）                                                             | コード |
| C-04 | 変換の `refetchTodos()` が Todo ツリーを全置換し、確定前のチップ drag を上書きする                          | `useItemConversion.ts:151` ほか 5 箇所                                                                            | コード |
| C-05 | 生成器のパスが `loadDate` を呼び、今日の未確定な編集を落とす                                                | `RoutineScheduleSync.tsx:67-78` → `useScheduleItemsAPI.ts:141-145`                                                | コード |
| C-06 | `items` と `rangeItems` が別トリガで再取得され、整合は undo 経路の viewMirror でしか取られない              | `useScheduleItemsAPI.ts:83` vs `useVisibleRangeItems.ts:33`、橋渡し = `useScheduleItemsViewMirror.ts:100-131`     | コード |

### 1-D. 失敗しても楽観更新が巻き戻らない

| ID   | 経路                                                 | 根拠                                                            | 画面に残るもの                              |
| ---- | ---------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| D-01 | 作成の失敗                                           | `useScheduleItemsCRUD.ts:177-180`                               | 実在しない予定がグリッドに残る              |
| D-02 | 更新の失敗                                           | `useScheduleItemsCRUD.ts:243-245`                               | 編集後の値が残り続ける                      |
| D-03 | スキップ / 取り消しの失敗                            | `useScheduleItemsCRUD.ts:368` `:421`                            | 生きている行が隠れたまま                    |
| D-04 | 削除の失敗                                           | `useScheduleItemsCRUD.ts:444-446`                               | グリッドから消え Trash に出るが DB には在る |
| D-05 | `updateRoutine` の失敗                               | `useRoutinesAPI.ts:183-189`                                     | 編集パネルが失敗した頻度を表示し続ける      |
| D-06 | タグ付与 / 解除の失敗                                | `TagPicker.tsx:133-135` `:141-143`                              | コンソールのみ・トーストも状態変化も無い    |
| D-07 | `reconcileRoutineScheduleItems` の失敗               | `useScheduleItemsRoutineSync.ts:352-354`                        | 半分だけ作り直されたシリーズ・通知なし      |
| D-08 | 予定の完全削除の失敗（繰り返し側は修正済みで非対称） | `useScheduleItemsTrash.ts:66-74` vs `useRoutinesAPI.ts:531-539` | Trash から消えるが DB には在る              |

D-05 はコード内のコメント（`useRepeatMutations.ts:320-326`）が「reload が元の頻度を戻す」と書いているが、`reload()` が再取得するのは schedule items だけで routines は戻らない。**コメントと実装が食い違っている。**

**残したい正しい実装**: Trash 復元のロールバック + 再読み込み（`useScheduleItemsTrash.ts:51-61`）、`detachRoutine` のロールバックと再 throw（`useRoutinesAPI.ts:374-382`）、viewMirror の順序契約（`useScheduleMutations.ts:124-133`）、`runSeriesEdit` のテンプレート先行規律（`useRepeatMutations.ts:598-654`）。工程 2 はこの 4 つを手本にする。

### 1-E. 繰り返しの「範囲」を聞く / 聞かないが入口で割れる

| ID   | 入口                                       | 聞くか   | 実際に起きること                                                 | 根拠                                                       |
| ---- | ------------------------------------------ | -------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| E-01 | 編集パネルでタイトル / 時刻を変更          | 聞く     | this / future / all                                              | `useScheduleMutations.ts:209-223`                          |
| E-02 | 編集パネルで**日付だけ**を変更             | 聞かない | 黙って「この回だけ」                                             | `eventEditorSave.ts:52-64`                                 |
| E-03 | 編集パネルで終日を切り替え（時刻が道連れ） | 聞かない | 黙って「この回だけ」                                             | `eventEditorSave.ts:59-62`                                 |
| E-04 | 週グリッドで**同じ日**の中をドラッグ       | 聞く     | this / future / all                                              | `useScheduleMutations.ts:286-292`                          |
| E-05 | 週グリッドで**別の日**へドラッグ           | 聞かない | 黙って「この回だけ」                                             | `useScheduleMutations.ts:294-298`                          |
| E-06 | 終日レーンへ drop                          | 聞かない | 黙って「この回だけ」                                             | `useScheduleMutations.ts:308-317`                          |
| E-07 | 「この予定のみ削除」ボタン                 | 聞かない | ダイアログの delete/this と同じ（dismiss）                       | `EventEditorPane.tsx:737-744`                              |
| E-08 | 頻度を変更する                             | 聞かない | テンプレート全体 + 表示範囲の作り直し = 無言の「all」            | `useRepeatMutations.ts:252-341`                            |
| E-09 | 繰り返しを「なし」に戻す                   | 聞かない | delete/future 相当（開いている回だけ残る）                       | `useRepeatMutations.ts:495-528`                            |
| E-10 | サイドバー繰り返しタブのゴミ箱             | 聞く     | ただし 2 択の確認ダイアログ・Desktop 限定                        | `useScheduleRepeats.ts:244-276`、`ScheduleSidebar.tsx:324` |
| E-11 | Briefing の行削除                          | 聞く     | 同じ 3 択だが前処理・Undo・トーストが無い                        | `useBriefingWrites.ts:340-386`                             |
| E-12 | MCP の予定更新 / 削除 / 繰り返し削除       | 聞かない | 予定削除は dismiss でなく soft delete のため生成器が翌日また作る | `scheduleHandlers.ts:302` `:397`、`routineHandlers.ts:477` |

**範囲を聞くかどうかの判定は web のホスト hook にしか無い**（`useScheduleMutations.ts`）。Provider の CRUD には繰り返しの概念が無いため、新しい呼び出し元は既定で無言の「この回だけ」になる（`useScheduleItemsCRUD.ts:213` `:355` `:430`）。E-12 はその実例である。

また「以降すべて削除」は**シリーズを分割していない**。routine 行ごと soft delete して、過去と完了済みの行を孤児として残す実装になっている（`SupabaseRoutinesService.ts:592-601`）。未来日を選ぶと生きたテンプレートが 1 本も残らない。

**E-01〜E-09 の現状は仕様として固定した**（2026-09-16 ユーザー裁定 = D-20260916-sched-2 = A）。聞く / 聞かないを揃えるための実装変更は工程 2 で行わない。#1638 の確認ダイアログは、いま `requestScope` を通る経路だけを対象にする。E-10〜E-12（Briefing・MCP）は Scope 外のため本計画では扱わない。

### 1-F. 入口ごとの挙動差・重複実装

| ID   | 事象                                                                                                       | 根拠                                                                                                                                  | 区分   |
| ---- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| F-01 | Event→Todo 変換は編集パネル経由だと未保存破棄の確認が入り、バブル経由だと入らない                          | `ScheduleOverlayHost.tsx:150-154` vs `ScheduleOverlays.tsx:226-227`                                                                   | コード |
| F-02 | Todo 削除の確認ポリシーが 2 種類（トレイ / チップバブル と 詳細パネル）                                    | `useScheduleTodoChips.ts:331` vs `:370`                                                                                               | コード |
| F-03 | Todo をカレンダーへ落とす経路が 2 本あり、時刻あり / 終日の分岐を別々に実装                                | `useScheduleMutations.ts:308-334` vs `todoChipUndoWiring.ts:119`                                                                      | コード |
| F-04 | Todo のリネームだけ hook を通らず `CalendarTab` の JSX 内で直接 `updateNode`                               | `CalendarTab.tsx:1098-1099`                                                                                                           | コード |
| F-05 | Briefing が予定の作成・削除・繰り返し削除を独自実装（Undo 無し・前処理無し・失敗通知無し）                 | `useBriefingWrites.ts:193-218` `:289-323` `:340-389`                                                                                  | コード |
| F-06 | 「生き残りから繰り返しの帯を外す」同じ写像が 3 箇所にある                                                  | `useRepeatMutations.ts:511-521` `:690-698`、`useBriefingWrites.ts:364-372`                                                            | コード |
| F-07 | Trash の復元・完全削除が `useScheduleItemsTrash` を通らず、#932 の競合ロールバックが効かない               | `TrashScreen.tsx:476-478` `:495-497`                                                                                                  | コード |
| F-08 | 予定の完了トグルは UI 経路が無いのに provider に残る（MCP 専用）                                           | `useScheduleMutations.ts:225-232` + `useScheduleItemsCRUD.ts:290`                                                                     | コード |
| F-09 | 複製した行は `routineId` を落とすため、繰り返しの複製が手動の単発になる                                    | `useScheduleItemsCRUD.ts:107`                                                                                                         | コード |
| F-10 | 書き込みの入口が 3 層に散る（ホスト hook / Provider CRUD / MCP）。範囲の門番は 1 つだけ                    | 1-E の末尾参照                                                                                                                        | コード |
| F-11 | 予定の時刻変更が、クリックパネル経由だけツアーへ通知されない。ツアー 3/10 が Edit details からしか進まない | `CalendarTab.tsx:1201-1202`（`onRetime` が素の `handleUpdate` を呼ぶ）vs `:1155`（`onSave: handleUpdateReported`）、通知は `:669-681` | コード |

**F-11 = #1747**（2026-09-19 起票・chat-main が Epic #1121 の DoD 実測で発見）。#1664 が足した `onRetime` が F 系の典型で、「同じ書き込みなのに入口ごとに副作用が落ちる」形をそのまま踏んでいる。修正は PR #1752（本計画と同じレーン・別ブランチ）。

### 1-G. 幅による分岐（Desktop / narrow）

| ID   | 事象                                                                                                                   | 根拠                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| G-01 | narrow にグリッドの書き込み経路が 1 本も無い（移動・リサイズ・終日レーン・空きスロット作成・右クリック・月セルの `+`） | Desktop = `CalendarDesktopLayout.tsx:123-126` `:262-267` vs `CalendarNarrowLayout.tsx:107` |
| G-02 | タグフィルタのパネルは narrow でもマウントされるが、開くボタンが Desktop のツールバーにしか無い                        | `ScheduleOverlays.tsx:308` vs `CalendarDesktopLayout.tsx:296`                              |
| G-03 | 週 / 月 / 日の切替と「繰り返しを隠す」が narrow に無い（narrow は月固定）                                              | `useCalendarNav.ts:53`、`CalendarTab.tsx:1170`                                             |
| G-04 | シリーズ削除が narrow で無効化される                                                                                   | `ScheduleSidebar.tsx:324`                                                                  |
| G-05 | jsdom は `matchMedia` を持たないため、**テストは既定で Desktop 幅**になる                                              | `shared/src/hooks/useMediaQuery.ts:13-22`                                                  |

G-01〜G-04 は **意図した省略として確定した**（2026-09-16 ユーザー裁定 = D-20260916-sched-1 = A）。[`mobile-scope.md`](../../requirements/mobile-scope.md) の「Consumption + Quick capture」と整合するため、穴として塞がず仕様として記録する。工程 2 でこれらを narrow に足さない。

### 1-H. 状態の所有者が 1 人でない

| ID   | 事象                                                                     | 根拠                                                         |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| H-01 | 「今日」が 2 つある（Provider の `date` とカレンダーの `anchorDate`）    | `useScheduleItemsAPI.ts:68` vs `useCalendarNav.ts:23`        |
| H-02 | 同じ行を `contextItems` と `rangeItems` が二重に持つ（C-06 と同根）      | `useScheduleMutations.ts:117-122`                            |
| H-03 | `scopeRequest` が 4 階層 prop を渡り歩く                                 | `useRepeatMutations.ts:217` → … → `ScheduleOverlays.tsx:316` |
| H-04 | サイドバーのタブ状態が選択 hook に同居                                   | `useScheduleSelection.ts:74`                                 |
| H-05 | 作成パネルの「対象の日」をパネル自身とオーバーレイ state の 2 箇所が持つ | `ItemCreatePanel.tsx:383-401` と `useScheduleOverlays.ts:43` |

### 1-I. 巨大関数・重複した描画算術・テストの穴

| ID   | 事象                                                                                  | 根拠                                                                  |
| ---- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| I-01 | `handleScopeChoose` が 209 行の 1 関数で、edit×3 / delete×3 と前処理を抱える          | `useRepeatMutations.ts:539-747`                                       |
| I-02 | `useScheduleMutations` の 9 ハンドラに直接のテストが 1 本も無い                       | `:142` `:209` `:250` `:273` `:308` `:319` `:340` `:360` `:371`        |
| I-03 | `AgendaList` が `WeekTimeGrid` の「分 → px」を別実装で持つ                            | `AgendaList.tsx:117` vs `shared/src/utils/scheduleGridLayout.ts`      |
| I-04 | `MonthGrid` 623 行が compact / full の 2 つのセル描画を抱える                         | `MonthGrid.tsx:261` `:402` `:449`                                     |
| I-05 | Desktop / narrow のレイアウト 2 本が 3 状態（読み込み / エラー / バナー）を各自で実装 | `CalendarDesktopLayout.tsx:178-195` と `CalendarNarrowLayout.tsx:132` |

**I-02 と G-01 は同じ集合である。** テストが無いハンドラ 9 本は、そのまま「Desktop でしか起動しないグリッド書き込み」と一致する。テストを書くことと narrow の穴を決着させることは、同じ作業の表と裏になる。

### 1-J. Undo 全経路の一覧（W2 の成果物）

> #1638 手順 1 の「全経路の表」。§1-A（載っていない経路）と §1-B（載っているが戻りきらない）を 1 枚に畳み、**書き込みごとに「push があるか / どの domain か / どの label か」**を並べる。行番号は 2026-09-16 に `origin/main` で grep した実測値で、根拠のある行だけを書いた。

Undo の domain は 4 つある（`scheduleItem` / `routine` / `itemConversion` / `todoTree`）。**1 回の操作が複数 domain にまたがると、Ctrl+Z は 1 回で片方しか戻さない** — B-05 と B-12 はこの形をしている。

| #   | 操作                                | 入口（ホスト hook）                               | 書き込み                                | Undo push                                               | 状態                        |
| --- | ----------------------------------- | ------------------------------------------------- | --------------------------------------- | ------------------------------------------------------- | --------------------------- |
| U01 | 予定を作る                          | `useScheduleMutations.ts:250`                     | `useScheduleItemsCRUD.ts:56`            | あり `scheduleItem` / createScheduleItem `:182`         | 確定前に push（B-02・B-03） |
| U02 | 予定を作る（Briefing）              | `briefing/hooks/useBriefingWrites.ts:196`         | ds 直呼び                               | **なし**                                                | Scope 外（F-05）            |
| U03 | タイトル / 日時 / 終日を編集        | `useScheduleMutations.ts:209`                     | `useScheduleItemsCRUD.ts:213`           | あり `scheduleItem` / updateScheduleItem `:252`         | 正常                        |
| U04 | 移動・リサイズ・終日レーンへ drop   | `useScheduleMutations.ts:273` `:308` `:319`       | `useScheduleItemsCRUD.ts:213`           | 同上                                                    | 選択が戻らない（B-11）      |
| U05 | 複製                                | `useScheduleMutations.ts:371`                     | `useScheduleItemsCRUD.ts:56`            | あり（U01 の push 1 件で戻る）                          | 正常                        |
| U06 | 完了トグル（MCP 専用・UI 経路なし） | —                                                 | `useScheduleItemsCRUD.ts:290`           | あり `scheduleItem` / toggleScheduleItemComplete `:313` | 反転で戻す（B-09）          |
| U07 | この日をスキップ                    | `useScheduleMutations.ts:142`                     | `useScheduleItemsCRUD.ts:355`           | あり `scheduleItem` / dismissScheduleItem `:371`        | 選択が戻らない（B-11）      |
| U08 | スキップを戻す                      | `useScheduleTodayAgenda.ts:112`                   | `useScheduleItemsCRUD.ts:412`           | **なし**                                                | A-02                        |
| U09 | 削除                                | `useScheduleMutations.ts:340`                     | `useScheduleItemsCRUD.ts:430`           | あり `scheduleItem` / deleteScheduleItem `:449`         | 正常                        |
| U10 | 一括削除                            | —                                                 | `useScheduleItemsCRUD.ts:490`           | **なし**                                                | A-10                        |
| U11 | Trash から復元                      | `trash/TrashScreen.tsx:478`                       | `useScheduleItemsTrash.ts:35`（未使用） | **なし**                                                | A-11 / F-07                 |
| U12 | Trash から完全削除                  | `trash/TrashScreen.tsx:497`                       | `useScheduleItemsTrash.ts:66`（未使用） | **なし**                                                | A-11 / F-07                 |
| U13 | 繰り返しを ON にする                | `useRepeatMutations.ts:252`（手動分岐 `:343`）    | `useRoutinesAPI.ts:407`                 | **なし**（意図的）                                      | A-03                        |
| U14 | 繰り返しの頻度を編集                | `useRepeatMutations.ts:255`                       | `useRoutinesAPI.ts:147`                 | あり `routine` / updateRoutine `:196`                   | 確定前に push（B-06）       |
| U15 | 頻度変更にともなう再生成            | `useRepeatMutations.ts:328`                       | `useScheduleItemsRoutineSync.ts:275`    | **なし**                                                | A-06（B-07 の片側）         |
| U16 | 繰り返しを「なし」に戻す            | `useRepeatMutations.ts:495`                       | `useRoutinesAPI.ts:364`                 | **なし**                                                | A-04                        |
| U17 | 「以降すべて / すべて」編集の伝播   | `useRepeatMutations.ts:619`                       | `useRoutinesAPI.ts:449`                 | **なし**（テンプレート側だけ U14 で載る）               | A-05 / B-05                 |
| U18 | シリーズごと削除                    | `useScheduleRepeats.ts:244`                       | `useRoutinesAPI.ts:230`                 | あり `routine` / deleteRoutine `:277`                   | 枠の競合で一部残る（B-08）  |
| U19 | 繰り返しを新規作成                  | `useScheduleRepeats.ts:169` 経由                  | `useRoutinesAPI.ts:79`                  | あり `routine` / createRoutine `:126`                   | 正常                        |
| U20 | 常時生成器（UI 操作なし）           | `RoutineScheduleSync.tsx:68`                      | `useScheduleItemsRoutineSync.ts:150`    | **なし**（意図的）                                      | A-07                        |
| U21 | Event → Todo 変換                   | `useItemConversion.ts:254`                        | ds 直呼び                               | あり `itemConversion` `:141`                            | #1637 の対象（B-01）        |
| U22 | Todo → Event 変換                   | `useItemConversion.ts:329`                        | ds 直呼び                               | あり `itemConversion` `:201`                            | 同上                        |
| U23 | Todo チップの移動 / リサイズ / 終日 | `useScheduleTodoChips.ts:239` `:253` `:268`       | `useTodoTreeCRUD.ts:139`                | あり `todoTree`（undoLabel 経由）                       | 正常                        |
| U24 | Todo をカレンダーへ drop            | `useScheduleTodoChips.ts:279`                     | `useTodoTreeCRUD.ts:139`                | あり `todoTree`                                         | 入口が 2 本（F-03）         |
| U25 | Todo をノート付きで配置             | `todoChipUndoWiring.ts:197`（`placeTodoWrite`）   | `useTodoTreeCRUD.ts:139`                | **なし**（意図的除外）                                  | A-09                        |
| U26 | 作成パネルから付けたノート          | `useCreatePanelNotes.ts:108`                      | ds 直呼び                               | **なし**                                                | A-08 / B-04                 |
| U27 | タグの付与 / 解除                   | `wikitag/TagPicker.tsx:131` `:140`                | `useWikiTagsUnifiedAPI.ts:181` `:198`   | **なし**                                                | A-01（Scope 外ファイル）    |
| U28 | 表示色に使うタグの指定              | `wikitag/TagPicker.tsx` 経由                      | `useWikiTagsUnifiedAPI.ts:352`          | **なし**                                                | A-01 と同根                 |
| U29 | MCP 経由の作成 / 更新 / 削除        | `mcp-server/src/handlers/scheduleHandlers.ts:302` | ds 直呼び                               | **なし**                                                | Scope 外（E-12）            |

**内訳**: 29 経路のうち push があるのは 14（U01 / U03〜U07 / U09 / U14 / U18 / U19 / U21〜U24）で、15 経路には無い。そのうち **W4 / W6 が Scope 内で扱えるのは 9 経路**（U08 / U10 / U13 / U15 / U16 / U17 / U20 / U25 / U26）で、残る U02 / U11 / U12 / U27 / U28 / U29 は書き込みが Scope 外のファイルに居る（Briefing・Trash・タグ・MCP）。§Acceptance Criteria の「Scope 内の 9 経路」はこの 9 本を指す。

**スタックの全消去（B-01）**: `ScheduleItemsContext.tsx:57` が unmount 時に `undoRedo.clear()` を**引数なしで**呼ぶ。`clear(domain?)` は引数が無いと全 domain を消す（`UndoRedoContextValue.ts:20`）ため、Schedule を離れると Notes / Todo の履歴も道連れになる。同型の Provider が 5 本ある。#1637 の第一容疑はここで、切り分けは W3 が実ブラウザで行う。

### 1-K. 2026-09-19 の再棚卸し（W0〜W12 merge 後に残った矛盾）

W14（実ブラウザ検証）の直前に、同じ 7 軸でコードを読み直した。**上の A〜J は 2026-09-16 時点のコードに対する棚卸しで、以下は W0〜W12 と 7 本の機能 PR が着地したあとの現状である。** 既存 ID と重なる行は載せず、**新規に見つかったものだけ**を並べる。区分は A〜J と同じ（「コード」= 該当行を読んだ / 「推定」= コードから導いたが挙動は未確認）。

| ID   | 事象                                                                                                                                                                     | 根拠                                                                                                                                      | 区分   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| K-01 | 削除の 3 スコープのうち「この回以降」(`detach-series`) だけ Undo に積まれない。「この回」と「すべて」は積む                                                              | `useRepeatMutations.ts:947-985`（push 無し）vs `useRoutinesAPI.ts:301`、`useRoutinesAPI.ts:389-410` が「No undo entry」と明記             | コード |
| K-02 | 同じ「繰り返しを解除」でも入口で Undo の有無が逆転する。エディタの「なし」は積み、スコープダイアログの「この回以降」は積まない                                           | `useRepeatMutations.ts:708-737` vs `:947-985`（どちらも `detachRoutine` を呼ぶ）                                                          | コード |
| K-03 | `dismiss` / `undismiss` だけ `prev` の存在チェック無しで push する。`prev === undefined` のまま `mirror.restore` に渡る                                                  | `useScheduleItemsCRUD.ts:408` `:472` vs ガードのある `:273` `:339` `:534`                                                                 | コード |
| K-04 | 繰り返しリストの行クリックが Undo 不能な INSERT を起こす。移動先の日の occurrence を生成するが、履歴にもトーストにも出ない                                               | `useScheduleRepeats.ts:212-225`（#1678 の周辺）                                                                                           | コード |
| K-05 | Trash 系 3 操作が Undo 対象外で、しかも巻き戻しが非対称。`permanentDeleteRoutine` は失敗時に楽観削除を戻すが `restoreRoutine` は戻さない                                 | `useRoutinesAPI.ts:509-540`（戻さない）vs `:542-567`（戻す）                                                                              | コード |
| K-06 | 複製がタグを引き継がない。新 id で作るため、複製した予定はタグのレンズから消える                                                                                         | `useScheduleMutations.ts:383-434` が `wiki_tag_assignments` に触れない（`web/tests/useScheduleMutations.test.tsx` が payload を固定済み） | コード |
| K-07 | 複製が `reminderOffset` も落とす。コピー先は Settings の既定値で作られる                                                                                                 | `useScheduleMutations.ts:396-407` vs `useScheduleItemsCRUD.ts:89` `:108-113`                                                              | コード |
| K-08 | 繰り返し解除のタグ戻しが「ピン留め 1 件」のときだけ効く。スコープダイアログ経由は `keepItemIds` 無しで呼ぶため、残った過去の回からタグが消える                           | `SupabaseRoutinesService.ts:729-736`、呼び分け `useRepeatMutations.ts:671-675`（pin 有り）vs `:962-965`（無し）                           | 推定   |
| K-09 | 繰り返し解除だけ成功時に `reload()` しない。変換・頻度変更・系列編集は `finally` で必ず呼ぶ                                                                              | `useRepeatMutations.ts:739-743` `:978-981` vs `:462-467` `:602-604` `:930-932`                                                            | コード |
| K-10 | 複製は楽観挿入のみで `reload` も `onSaved` も無い。INSERT が落ちると幽霊行が残り、トーストも出ない                                                                       | `useScheduleMutations.ts:383-434` vs `:262-283`（create は `onSaved` を渡す）                                                             | コード |
| K-11 | Todo → Event 変換に成功トーストが無い。逆方向は出す。i18n catalog に `toEventDone` キー自体が存在しない                                                                  | `useItemConversion.ts:304` vs `:375-378`、`grep -c toEventDone shared/src/i18n/locales/{en,ja}.json` = 0                                  | コード |
| K-12 | `onRepeatConvertFailed("materialise")` が到達しないデッドコード。`materialiseNewSeries` は throw を待つが、`ensureRoutineItemsForDateRange` は throw せず `false` を返す | `useRepeatMutations.ts:330-343` vs `useScheduleItemsRoutineSync.ts:219-222`（`catch` で `return false`）                                  | コード |
| K-13 | 頻度変更の reconcile 失敗が無言。テンプレート書き込みの失敗はトーストになるのに、その後の日の再整形は握り潰される                                                        | `useRepeatMutations.ts:562`（toast）vs `:572-580` + `useScheduleItemsRoutineSync.ts:352-354`                                              | コード |
| K-14 | `ensureRoutineItemsForDateRange` の失敗の扱いが呼び出し側 3 箇所で全部違う（到達しない try/catch / 戻り値を見て中断 / 握り潰して reload）                                | `useRepeatMutations.ts:330-343` / `:953-959` / `useScheduleRepeats.ts:218-224`                                                            | コード |
| K-15 | Provider 層の戻し方が 4 通り混在する（`boolean` / rethrow / `{landed}` で握り潰す / rethrow）。呼び出し側が一律に扱えない                                                | `useRoutinesAPI.ts:192-198` / `:406` / `:288-292` / `:493-495`                                                                            | コード |
| K-16 | `updateFutureOccurrences` の throw を、往路は `false` に変換してトーストし、復路（undo / redo）は握り潰す。同じ失敗が方向で報告されたりされなかったりする                | `useRepeatMutations.ts:837-849` vs `:901-909`                                                                                             | コード |

**既に判断待ちのもの**: K-01 / K-02（detach-series の Undo）は D-20260919-sched-2 に積んである。**A（載せない）を推奨**しているのは、切り離しがタグを routine → survivor へ移し、その移送が `on delete cascade` のためロールバックするとタグごと消えるからで、K-08 はその裏づけでもある。回答が付くまで K-01 / K-02 / K-08 は動かさない。

**確認の度合い**: 上のうち K-01 / K-06 / K-11 / K-12 と B-14 は本チャットが該当行を直接読んで裏を取った。残りは並列調査の報告をそのまま採ったもので、**実ブラウザ / 実 DB での再現は 1 件も無い**。とくに K-08 と K-12 は挙動としての確信度は高いが未検証なので、W14 で再現手順を 1 本ずつ通す価値がある。

**意図された差として除外したもの**: ノート併用時だけ配置が Undo されない（`todoChipUndoWiring.ts:193-207` のコメントが理由を明記）、Todo 削除の確認ポリシーの差（#573 / #775）、同日ドラッグと日跨ぎドラッグでスコープを聞く / 聞かないの差（`useScheduleMutations.ts:296-305` に設計判断として明記・W6 で仕様として固定済み）。

---

## 2. 責務の地図

### 2-1. 層の形

```
shared/src/components/schedule/**            純粋な描画（DataService も i18n も持たない）
  ↑ props
web/src/schedule/Calendar* / Schedule*       ホストの配線（幅で 2 本に分岐）
  ↑ 呼び出し
web/src/schedule/use*Mutations / useItemConversion / useScheduleTodoChips   書き込みの入口
  ↑ 注入されたコールバック
shared/src/hooks/useScheduleItems* / useRoutines*   Provider（楽観更新 + Undo コマンド）
  ↑
shared/src/services/DataService → Supabase*Service   永続化
```

### 2-2. 書き込み経路（全数）

| 操作                          | UI 入口（複数ある場合は全部）                                                                                                          | ホスト hook                                                                           | Provider                                                       | DataService               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------- |
| 予定を作る                    | ツールバー `CalendarTab.tsx:1165` / narrow の追加 `:986` / 空きスロット `:1192` / 月セル `+` `:1191` / パネルの 2 つ目のボタン `:1111` | `useScheduleCreateFlow.ts:183` → `useScheduleMutations.ts:250`                        | `useScheduleItemsCRUD.ts:56`                                   | `createScheduleItem`      |
| 予定を作る（Briefing）        | `BriefingScreen.tsx:561`                                                                                                               | **無し（二重実装）**                                                                  | **無し**                                                       | ds 直呼び                 |
| タイトル / 日時 / 終日を編集  | 編集パネル保存 `CalendarTab.tsx:1048` / バブルの inline rename `:1090`                                                                 | `useScheduleMutations.ts:209` `:360`                                                  | `useScheduleItemsCRUD.ts:213`                                  | `updateScheduleItem`      |
| 移動・リサイズ・終日へ drop   | 週グリッドの drag `CalendarTab.tsx:1193-1195`（Desktop のみ）                                                                          | `useScheduleMutations.ts:273` `:308` `:319`                                           | 同上                                                           | `updateScheduleItem`      |
| 複製                          | バブル `CalendarTab.tsx:1091`                                                                                                          | `useScheduleMutations.ts:371`                                                         | `useScheduleItemsCRUD.ts:56`                                   | `createScheduleItem`      |
| この日をスキップ              | 編集パネル `CalendarTab.tsx:1049`                                                                                                      | `useScheduleMutations.ts:142`                                                         | `useScheduleItemsCRUD.ts:355`                                  | `dismissScheduleItem`     |
| スキップを戻す                | サイドバー `CalendarTab.tsx:993`                                                                                                       | `useScheduleTodayAgenda.ts:110`                                                       | `useScheduleItemsCRUD.ts:412`                                  | `undismissScheduleItem`   |
| 削除                          | 編集パネル `CalendarTab.tsx:1050` / バブル `:1093`                                                                                     | `useScheduleMutations.ts:340`                                                         | `useScheduleItemsCRUD.ts:430`                                  | `softDeleteScheduleItem`  |
| 削除（Briefing）              | `BriefingScreen.tsx:681`                                                                                                               | **無し（二重実装）**                                                                  | **無し**                                                       | ds 直呼び                 |
| Trash 復元 / 完全削除         | `TrashScreen.tsx:478` `:497`                                                                                                           | **無し**                                                                              | **未使用**                                                     | `restoreScheduleItem` 他  |
| 繰り返しを ON にする          | 編集パネルの頻度 `CalendarTab.tsx:1063`                                                                                                | `useRepeatMutations.ts:252`（手動分岐 `:343-470`）                                    | `useRoutinesAPI.ts:407`                                        | `convertEventToRoutine`   |
| 繰り返しを編集                | 同上                                                                                                                                   | `useRepeatMutations.ts:255-342`                                                       | `useRoutinesAPI.ts:147` + `useScheduleItemsRoutineSync.ts:275` | `updateRoutine` 他        |
| 繰り返しを「なし」に戻す      | 頻度の「なし」`CalendarTab.tsx:1064`                                                                                                   | `useRepeatMutations.ts:495`                                                           | `useRoutinesAPI.ts:364`                                        | `detachRoutine`           |
| 範囲を選ぶ（編集 / 削除）     | スコープダイアログ `CalendarTab.tsx:1125`                                                                                              | `useRepeatMutations.ts:539`（6 分岐）                                                 | 分岐ごとに別                                                   | 分岐ごとに別              |
| シリーズごと削除              | 繰り返しタブ `CalendarTab.tsx:999`（Desktop のみ）                                                                                     | `useScheduleRepeats.ts:244`                                                           | `useRoutinesAPI.ts:230`                                        | `softDeleteRoutine`       |
| Event ⇄ Todo 変換             | 編集パネル `:1066` / バブル `:1092` / Todo 詳細 `:1078` / チップバブル `:1101`                                                         | `useItemConversion.ts:254` `:329`                                                     | **無し**（ds 直・reload で整合）                               | `convertEventToTodo` 他   |
| Todo チップの移動 / リサイズ  | 週グリッドの drag（`isTodoChip` で分岐）                                                                                               | `useScheduleTodoChips.ts:239` `:253` `:268`                                           | `useTodoTreeContext().updateNode`                              | `updateTodo`              |
| Todo をサイドバーから drop    | トレイ `TodayTodoTray.tsx:482` → グリッド `CalendarTab.tsx:1196`                                                                       | `useScheduleTodoChips.ts:279`（**別経路**）                                           | 同上                                                           | `updateTodo`              |
| Todo の完了 / 削除 / リネーム | トレイ / バブル / 詳細                                                                                                                 | `useScheduleTodoChips.ts:292` `:331` `:370` / **`CalendarTab.tsx:1098` にインライン** | 同上                                                           | `updateTodo`              |
| タグの付与 / 解除             | 編集パネル `ScheduleEventEditor.tsx:185` / Todo 詳細 `ScheduleTodoDetail.tsx:223`                                                      | **無し**                                                                              | `useWikiTagsUnifiedAPI.ts:182`                                 | `assignTag` 他            |
| 常時生成（UI 操作なし）       | `RoutineScheduleSync.tsx:74-78`                                                                                                        | —                                                                                     | `useScheduleItemsRoutineSync.ts:110`                           | `bulkCreateScheduleItems` |

### 2-3. hook 層を迂回している箇所

| 箇所                                       | 迂回している層                                                      |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `useItemConversion.ts`（ds 直呼び 8 箇所） | 変換に対応する Provider hook が無い（設計として `reload()` で整合） |
| `useCreatePanelNotes.ts:83` `:117`         | Notes の Provider を立てず ds 直読み書き（自己弁明コメントあり）    |
| `useEventWorkTime.ts:55`                   | 注入された DataService ではなくモジュール singleton を掴む          |
| `useBriefingWrites.ts`（7 箇所）           | Schedule の Provider を一切通らない                                 |
| `TrashScreen.tsx`（4 箇所）                | Trash 用 hook を通らない                                            |
| `ScheduleReminderBridge.tsx:59`            | 読み取り専用・Provider 外が設計（意図的）                           |

`shared/src/components/schedule/**` から Supabase サービスを直 import している箇所は無い。**CLAUDE.md §3.1 の DataService 境界は保たれている**（全数 grep 済み）。壊れているのは境界ではなく、境界の手前にある入口の一貫性である。

---

## 検討した代替案（必須）

| 案                                                       | 採否 | 却下理由                                                                                                    | 復活条件                                                            |
| -------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **入口の統一を軸に、テストで固めてから畳む**（採用）     | ✓    | —                                                                                                           | —                                                                   |
| 行数の大きいファイルから割る（#675 の続き）              | ✗    | 前回の分割で行数は既に落ちている。今回の報告はどれも入口ごとの差で、行数と相関しない                        | 1 ファイルが再び 1,500 行を超えたら単独 Issue で再開                |
| 不具合（#1632 / #1637）だけ直して構造は触らない          | ✗    | #1637 の第一容疑 B-01 は Provider の配置に由来し、構造を避けると分岐がもう 1 本増える                       | 工程 2 の着手が 2026-10 以降にずれたら、緊急分だけ先に出す          |
| Schedule を書き直して新実装へ載せ替える                  | ✗    | 1,203 件のテストと 19,744 行が同時に動き、1 PR で安全に戻せない                                             | —                                                                   |
| Undo を domain ごとのスタックに作り替える（B-01 の根治） | ✗    | `UndoRedoManager` はアプリ全体の共有資産で、Schedule の計画で作り替える範囲を超える                         | B-01 が #1637 の真因と工程 2 で確定したら、別 Issue へ昇格          |
| 繰り返しの「範囲」を全入口で必ず聞く                     | ✗    | 単発の移動のたびにダイアログが出る。聞かない 5 経路には個別の理由がコメントにある（D-20260916-sched-2 = A） | 「勝手にシリーズ全体が変わった」誤操作が実利用で出たら C から再検討 |
| narrow のグリッド書き込みを本計画で足す                  | ✗    | 機能追加で「挙動変更ゼロ」から外れる。意図した省略と確定済み（D-20260916-sched-1 = A）                      | narrow で直接編集したい要望が実利用から出たら別 Issue で実施        |
| Briefing の二重実装（F-05）も同じ PR で寄せる            | ✗    | Scope が `web/src/briefing/**` へ広がり、別レーンの計画と衝突する                                           | chat-main が Scope 拡大を認めたら 1 作業単位として追加              |
| MCP の書き込みも同じ門番に通す（E-12）                   | ✗    | `mcp-server/**` は Scope 外。ツール側の仕様変更はユーザーの運用に直接影響する                               | E-12 を Issue 化してから別計画で実施                                |

---

## Scope (Touchable Paths)

工程 2 で変更してよいパスを宣言する。

```
web/src/schedule/**
web/tests/**                          （上記に対応するテストのみ）
shared/src/components/schedule/**
shared/src/hooks/useScheduleItems*.ts
shared/src/hooks/useRoutines*.ts
shared/src/services/SupabaseScheduleItemsService.ts
shared/src/services/SupabaseRoutinesService.ts
shared/src/services/SupabaseItemConversionService.ts
shared/src/services/scheduleItemMapper.ts
shared/src/services/routineMapper.ts
shared/src/utils/itemConversion.ts
shared/src/utils/eventEditorSave.ts
shared/src/utils/scheduleGridLayout.ts
shared/src/utils/seriesEditSequence.ts
shared/tests/**                       （上記に対応するテストのみ）
shared/src/i18n/locales/{en,ja}.json  （文言の追加が要る場合のみ）
.claude/docs/vision/plans/2026-09-16-schedule-refactor.md
```

**触らない**: `supabase/migrations/` / `web/src/briefing/**` / `web/src/trash/**` / `mcp-server/**` / `shared/src/context/UndoRedoContext.tsx` と `shared/src/utils/undoRedo/**` / `shared/src/hooks/useWikiTagsUnifiedAPI.ts` / `mobile/` / `desktop/`。

スコープ外が必要になったら **P-008** に従い、実装せず `.claude/comm/decisions/chat-schedule-refine.md` へ積んで現計画を続行する。Scope は自分で広げない。

---

## 3. 分割・統合の方針

1. **入口は複数でよいが、決め事は 1 か所に置く。** 確認ダイアログ・Undo の push・楽観更新の順序を、操作ごとに 1 つの関数へ寄せる。F-01〜F-04 と E-01〜E-09 はこの原則違反である。
2. **Undo は「書き込みが確定してから push」に揃える。** 現状は作成（B-02）と `updateRoutine`（B-06）が確定前に押している。成功分岐でのみ push する形は変換（`useItemConversion.ts:298`）に既にあるので、それを手本にする。
3. **巨大分岐は「決める純関数」と「書く実行器」に割る。** `handleScopeChoose`（I-01）は、範囲と状態から**何を書くか**を返す純関数に落とす。純関数側は jsdom を要さず固定できる。
4. **`reload()` の全置換をやめる。** 進行中の楽観更新を持つ行だけ守る形にする（C-01〜C-05）。この作業は範囲が広いので単独 PR にする。
5. **幅の分岐は 1 行に寄せる。** レイアウト 2 本が各自で持つ 3 状態折り返し（I-05）と描画算術（I-03）を共有へ戻す。分岐点そのもの（768px を 1 回だけ読む形）は良いので触らない。
6. **状態の二重持ちは片方を派生にする。** H-01 / H-02 は、どちらかを正本にして他方を派生に落とす。
7. **挙動を変える PR と変えない PR を分ける。** 不具合修正はリファクタと混ぜない。

---

## 4. 作業単位（PR 単位・依存順）

| #    | 作業単位                                                             | 依存    | Gate    | Acceptance                                                                       |
| ---- | -------------------------------------------------------------------- | ------- | ------- | -------------------------------------------------------------------------------- |
| W0   | `useScheduleMutations` の 9 ハンドラを vitest で pin（挙動変更ゼロ） | —       | 🤖 自律 | `web/tests/useScheduleMutations.test.tsx` が 9 ハンドラを直接呼ぶ・CI 緑         |
| W1   | #1632 のタグ移送（サービス層のみ・挙動変更あり）                     | —       | 🤖 自律 | #1632 の DoD 全項目・ロールバックのテストが `shared/tests/` にある               |
| W2   | Undo 全経路の表を作り、押していない経路を確定（コード変更は表のみ）  | W0      | 🤖 自律 | 表が PR 本文にあり各行に `file:line`・#1638 の手順 1 を満たす                    |
| W3   | #1637 の原因確定と修正                                               | W2      | 👀 目視 | 変換 4 入口すべてで Undo が有効・各入口のテストが web/tests にある               |
| W4   | Undo の push を書き込み確定後へ揃える（B-02 / B-03 / B-06 / B-09）   | W2      | 🤖 自律 | 失敗した書き込みがスタックに残らないテスト・完了トグルの undo が set になる      |
| W5   | Undo の失敗をユーザーに見せる（B-10 / D-01〜D-08 の巻き戻し）        | W4      | 🤖 自律 | 失敗時に成功トーストが出ないテスト・楽観更新が巻き戻るテスト                     |
| W6   | 繰り返しの範囲確認を現状のまま仕様として固定（E-01〜E-09）           | —       | 🤖 自律 | 実装変更なし。#1638 の確認ダイアログは `requestScope` を通る経路だけを対象にする |
| W7   | `handleScopeChoose` を純関数 + 実行器へ割る（I-01）                  | W0      | 🤖 自律 | 単一関数が 80 行以下・6 分岐の純関数テストが shared/tests にある                 |
| W8   | 変換と Todo 削除・drop の入口統一（F-01〜F-04）                      | W3      | 🤖 自律 | 入口ごとの差が消えたことをテストで固定・CI 緑                                    |
| W9   | `reload()` の全置換をやめて競合を畳む（C-01〜C-05）                  | W7      | 👀 目視 | 進行中の編集が reload で消えないテスト・工程 3 の S03 / S05 が緑                 |
| W10  | 「今日」の一本化と 2 ストアの整理（H-01 / H-02 / C-06）              | W9      | 🤖 自律 | 2 つの日付が同じ値から派生する・既存テスト全緑                                   |
| W11  | 描画算術と 3 状態折り返しの共有化（I-03 / I-05）                     | W0      | 🤖 自律 | `AgendaList` が `scheduleGridLayout` を使う・折り返しが 1 か所                   |
| W12  | `MonthGrid` の compact / full 分離（I-04）                           | W11     | 🤖 自律 | `MonthGrid.tsx` が 400 行以下・`monthGrid.test.tsx` 全緑                         |
| W13  | narrow の省略（G-01〜G-04）を仕様として記録                          | —       | 🤖 自律 | 本書 §1-G の記述のみで完了済み。別 Issue の起票は不要                            |
| W13b | #1747 のツアー通知漏れを直す（F-11）                                 | —       | 🤖 自律 | クリックパネルの時刻変更がツアー 3/10 を進めるテストがある・CI 緑（PR #1752）    |
| W14  | 工程 3 の実ブラウザ検証（chat-main）                                 | W1〜W12 | 👀 目視 | §6 の全シナリオ合格・コンソールエラー 0 件・レポートを #1642 にリンク            |
| W15  | 本書を `archive/` へ移し Status を COMPLETED にする                  | W14     | 🤖 自律 | `docs-lint` 緑・Status enum 準拠                                                 |

**着手順の要**: W0 を必ず最初に置く（以降の回帰検知がすべてここに乗る）。W1 は独立でファイルが重ならないため並行してよい。W3 で原因が B-01 と確定した場合、`UndoRedoContext` は Scope 外なので**触らず、Schedule 側の回避で済ませるか別 Issue に出すかを PR 本文で明示する**。W6 と W13 は 2026-09-16 に裁定が付いた（D-20260916-sched-2 = A / D-20260916-sched-1 = A）ため、どちらも実装変更を伴わない記録だけの作業単位になった。

### Gate 凡例

- **🤖 自律** — Claude が完結。応答前に CI `verify` と同じコマンドを回して型崩壊を検出する
- **👀 目視** — 実ブラウザでの確認が要る（chat-main で実施）
- **🛑 人手** — ユーザー操作必須（判断キューへの回答 / PR merge）

---

## 5. open Issue との順序

| Issue | 内容                                | 扱い                         | 理由                                                                                                                   |
| ----- | ----------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| #1632 | 繰り返し変換でタグが消える          | **前に直す**（W1）           | サービス層だけで完結し、他の作業単位とファイルが重ならない。放置するほど修復するデータが増える                         |
| #1637 | 変換後に Undo が押せない            | **中で吸収**（W3）           | 第一容疑 B-01 が構造側にあり、単独修正では入口ごとの分岐がもう 1 本増える                                              |
| #1638 | Schedule の全変更を Undo 可能にする | **中で吸収**（W2 → W4 → W6） | 手順 1 の「全経路の表」は W2 そのもの。押していない 11 経路（1-A）を W4 で足し、繰り返しの確認ダイアログは W6 で入れる |
| #1639 | フィルタアイコンに件数バッジ        | **後に回す**                 | `ScheduleToolbar` と `CalendarTab` の props に触り、W11 の共有化と衝突する                                             |
| #1640 | Todo タブ名の変更と追加ボタン       | **後に回す**                 | `TodayTodoTray` を触る。W8 と同じファイルなので順に進める                                                              |
| #1641 | Todo タブの区分 / Tag フィルタ      | **後に回す**                 | #1640 の後。新規 hook を足す機能追加で、挙動変更ゼロの原則から外れる                                                   |
| #1626 | 祝日アイテム                        | **後に回す**                 | 実装がまだ無い新規機能で、グリッドの合流点とフィルタに触る。構造が固まってからのほうが安い                             |

#1625 と #1627 は close 済みのため対象外。**「後に回す」4 件は W15 まで着手しない。** 先に触るとリファクタの PR と同じファイルで衝突し続ける。

### 5-2. 2026-09-19 時点の実態（上の表の結果）

上の表は 2026-09-16 の判断で、**実際にどうなったかは以下**。W14（実ブラウザ検証）の直前に全件を `gh issue view` で引き直した。

| Issue | state              | 2026-09-16 の判断    | 実際                                                                                                                                                        |
| ----- | ------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1632 | CLOSED（PR #1656） | 前に直す（W1）       | 判断どおり。推奨方針は採れず、移送を変換の最後の一手にした（Worklog 参照）                                                                                  |
| #1637 | CLOSED（PR 無し）  | 中で吸収（W3）       | 判断どおり。真因は B-01 で、別 Issue #1727 に分けて PR #1730 で修正                                                                                         |
| #1638 | CLOSED（PR #1708） | 中で吸収（W2→W4→W6） | 判断どおり。派生で #1728 を起票                                                                                                                             |
| #1639 | CLOSED（PR #1711） | 後に回す             | **W15 を待たず先行着地。** W11 merge 後だったため衝突は起きなかった                                                                                         |
| #1640 | CLOSED（PR #1712） | 後に回す             | 同上（W8 merge 後）                                                                                                                                         |
| #1641 | CLOSED（PR #1715） | 後に回す             | 同上                                                                                                                                                        |
| #1626 | CLOSED（PR #1729） | 後に回す             | 同上                                                                                                                                                        |
| #1747 | **OPEN**           | （未起票）           | **前に直す。** W14 のツアーシナリオが赤で止まるため、W13b として W14 の前に置く（PR #1752）                                                                 |
| #1663 | **OPEN**           | （未起票）           | **後に回す。** 繰り返しのタグ色（K-08 と同根）。上書き先が DDL を要する可能性があり、本計画は `supabase/migrations/` を Non-goal にしているため吸収できない |
| #1678 | **OPEN**           | （未起票）           | **後に回す。** 繰り返しタブの行クリック（K-04 の周辺）。純粋な機能追加で「挙動変更ゼロ」の原則から外れる                                                    |

**「後に回す 4 件は W15 まで着手しない」は守られなかったが、実害は出ていない。** 4 件とも W8 / W11 の merge 後に着地したため、衝突は 1 件も起きていない。代わりに出た副作用が `CalendarTab.tsx` の +136 行で、§Acceptance Criteria の行数条件を割った。

---

## Acceptance Criteria (機械検証可能)

工程 1（本書）:

- [x] `LC_ALL=C bash scripts/docs-lint.sh` exit 0
- [x] `_TEMPLATE.md` の必須節（Context / 代替案 / Scope / Steps / AC / References / Worklog）を持つ
- [x] `web/` `shared/` `desktop/` `mcp-server/` の変更行数 0（`git diff --stat` で確認）
- [ ] PR が #1642 を参照して open になっている

工程 2（各作業単位）:

- [ ] CI `verify` ジョブの全ステップ緑（shared → web → desktop → mcp-server・`typecheck:tests` 含む）
- [ ] Schedule ドメインのテストが **107 suites / 1,203 cases**（2026-09-16 実測）から減らない
- [ ] `web/tests/useScheduleMutations.test.tsx` が存在し、9 ハンドラすべてを直接呼ぶ（W0）
- [ ] 1-A の 11 経路のうち、Scope 内の 9 経路（A-01 / A-11 を除く）が Undo に載り、各経路に「操作 → Undo → Redo」のテストがある（W4 / W6）
- [ ] `grep -n "toggleScheduleItemComplete" shared/src/hooks/useScheduleItemsCRUD.ts` の undo 分岐に一致が無い（W4 — 反転でなく set になる）
- [ ] `useRepeatMutations.ts` の最長関数が 80 行以下（W7）
- [ ] `grep -n "PX_PER_MINUTE" shared/src/components/schedule/AgendaList.tsx` が 0 件（W11）
- [x] `grep -n "updateNode(" web/src/schedule/CalendarTab.tsx` が 0 件（W8 — Todo リネームのインラインが消える）
- [x] `shared/src/components/schedule/MonthGrid.tsx` が 400 行以下（W12）
- [ ] `web/src/schedule/CalendarTab.tsx` が 1,239 行を超えない（増やさないことだけを課す）— **2026-09-19 実測 1,375 行で未達**。増やしたのはリファクタの PR ではなく 7 本の機能 PR（§Context の再計測を参照）。扱いは D-20260919-sched-6 の回答待ち
- [ ] クリックパネルの時刻変更がツアー 3/10 を進める（F-11 / #1747・W13b）
- [ ] 各 PR の diff が ±1,000 行以内
- [ ] 完了時: 本書の Status を COMPLETED にして `archive/` へ移した（W15）

AC を満たせない見込みになったら、自己免除せず **P-008** に従い判断キューへ積む。

---

## 6. 工程 3 の実ブラウザ検証シナリオ

**実行は chat-main のみ**（CLAUDE.md §7.4）。Desktop 幅と narrow 幅（390px）の両方で 1 周し、各シナリオの合否とスクリーンショットを HTML レポートにして Artifact で発行し、#1642 にリンクを貼る。**コンソールエラー 0 件**も記録する。

| #   | シナリオ                                                          | Desktop | 390px                        |
| --- | ----------------------------------------------------------------- | ------- | ---------------------------- |
| S01 | 週 / 月ビューの切替と日付移動                                     | ○       | 月のみ（G-03 の確認）        |
| S02 | 予定の作成 → タイトル変更 → 削除 → Trash から復元                 | ○       | ○（作成はシート経由）        |
| S03 | 予定の時間帯の移動とリサイズ                                      | ○       | 経路が無いことの確認（G-01） |
| S04 | 終日レーンへの drop と終日の解除                                  | ○       | 同上                         |
| S05 | 繰り返しの作成 → この回だけ編集 → 以降すべて編集                  | ○       | ○                            |
| S06 | 繰り返しの削除（この回だけ / 以降すべて / すべて）                | ○       | この回だけ（G-04 の確認）    |
| S07 | 繰り返しを「なし」に戻す（seed が残ること）                       | ○       | ○                            |
| S08 | タグ付き Event を繰り返しにしてタグ欄が空にならない（#1632）      | ○       | ○                            |
| S09 | Event → Todo 変換（編集パネル経由とバブル経由の両方）             | ○       | パネル経由のみ               |
| S10 | Todo → Event 変換（詳細パネル経由とチップバブル経由）             | ○       | 詳細パネル経由のみ           |
| S11 | S02〜S10 の各操作の直後に Undo → Redo（#1637 / #1638）            | ○       | ○                            |
| S12 | 繰り返しアイテムの Undo で確認ダイアログが出る（#1638 の仕様）    | ○       | ○                            |
| S13 | タグフィルタの適用と解除                                          | ○       | 導線の有無を確認（G-02）     |
| S14 | 「繰り返しを隠す」の切替                                          | ○       | 導線の有無を確認（G-03）     |
| S15 | rightSidebar 3 タブ（今日の流れ / Todo / 繰り返し）の操作         | ○       | ○                            |
| S16 | サイドバーの Todo をカレンダーへ drag（週の時間帯 / 月のセル）    | ○       | 経路が無いことの確認         |
| S17 | Todo の完了・削除（トレイ / バブル / 詳細の 3 経路）              | ○       | トレイと詳細                 |
| S18 | 繰り返しの**日付だけ**を変更し、範囲を聞かれるかを記録（E-02）    | ○       | ○                            |
| S19 | 繰り返しの頻度を変更し、範囲を聞かれるかを記録（E-08）            | ○       | ○                            |
| S20 | タグを付け外しして Undo できるかを記録（A-01）                    | ○       | ○                            |
| S21 | 予定を編集した直後に 2 回目の操作を続け、値が戻らないこと（C-02） | ○       | —                            |
| S22 | 別セクションへ移動して戻り、Undo の状態を確認（B-01）             | ○       | ○                            |
| S23 | リロード後にデータが残っていること                                | ○       | ○                            |

S18〜S22 は本計画で足した。**棚卸しで「推定」に留まった項目を、ユーザーが画面で見て判断できる形にする**ためである。

---

## Risks / Known Issues 参照

- 既存事例は [`known-issues/INDEX.md`](../../known-issues/INDEX.md)。特に Issue 017（単純削除を生成器が復活させる）と #932（Trash 復元の競合）は W5 / W8 の着手前に読む
- `web/tests/` は jsdom にレイアウトが無い（要素の座標がすべて 0）。ドラッグ系は座標非依存で組む（CLAUDE.md §7.1）
- テストは既定で Desktop 幅になる（G-05）。narrow の分岐を見るテストは `matchMedia` を明示的に差し替える
- ローカルでゲートをまとめて回すときは `( npm run X | tail )` で終了コードを取らない（CLAUDE.md §7.1）
- 新規 known issue 化の候補は Worklog に記録し、完了時に移送する

---

## References

- Issue: #1642（本計画の親）/ #1632 / #1637 / #1638 / #1639 / #1640 / #1641 / #1626 / #1747（F-11・W13b）/ #1663 / #1678（どちらも open・後に回す）
- 他レーンからの報告: [`comm/outbox/chat-shared-fix.md`](../../../comm/outbox/chat-shared-fix.md) 2026-09-19（#1681 の `push(` 全数棚卸しから B-14 が出た）
- 前回の分割: #280 / #673 / #675 / #889 / #893（いずれも close 済み）と [`2026-08-10-core-refactor.md`](./2026-08-10-core-refactor.md) の C6 / C8
- 規約: [`CLAUDE.md`](../../../CLAUDE.md) §3.1 DataService 境界 / §7.1 検証ゲート / §7.4 worktree、[`rules/frontend.md`](../../../rules/frontend.md)、[`rules/docs-consistency.md`](../../../rules/docs-consistency.md)
- Mobile の取捨: [`mobile-scope.md`](../../requirements/mobile-scope.md)
- 決定台帳: D-20260810-sched-2（変換が id を保つ理由）/ D-20260810-sched-4 / D-20260810-sched-5（変換の拒否メッセージ）/ D-20260811-sched-1（Event→Todo が日時を保つ）
- related skills: `test-writing` / `playwright-verify` / `worktree-policy` / `docs-workflow`

---

## Worklog

- **2026-09-16**: 工程 1。4 領域を並列調査し、主要な主張 16 件をメインが全数 spot check した（結果は §Context の表・棄却ゼロ）。棚卸し 60 件・書き込み経路 20 操作・作業単位 16 本を確定。コードは 1 行も変えていない。
  - 判断キューへ 2 件積み、**同日中に両方 A で回答を得た**（台帳 = D-20260916-sched-1 / D-20260916-sched-2）。narrow のグリッド書き込みが無いのは意図した省略として確定し、繰り返しの範囲確認は現状のまま仕様として固定した。どちらも実装変更を伴わないため、W6 と W13 は記録だけの作業単位に縮んだ。
  - 既存 Issue の無い不具合を 6 件見つけた。Issue 化するかは承認時に決める（起票は chat-main）。A-01 タグ操作が Undo に載らない / B-10 失敗しても成功トーストが出る / D-05 コメントと実装の食い違い / E-12 MCP が範囲の門番を通らず生成器に復活させられる / F-05 Briefing の二重実装 / F-07 Trash の競合ロールバック未適用。
- **2026-09-16**: 工程 2 着手。W0（`useScheduleMutations` の 9 ハンドラを pin・20 ケース）/ W1（#1632 のタグ移送）/ W2（本書 §1-J）/ W7 / W11 を、それぞれ `origin/main` から切ったブランチで PR 化した。
  - W2 で §1-J を追加した。push の実在箇所を全数 grep し直した結果、**push がある経路は 14 / 無い経路は 15** で、うち Scope 内で足せるのは 9 経路だと確定した（AC の「9 経路」の定義をこの表に固定する）。
  - W1 は #1632 の推奨方針（変換の catch に合わせてロールバック）を**採れなかった**。`wiki_tag_assignments.item_id` が `on delete cascade` のため、移送が着地した後にロールバックが走るとタグごと消える。移送を変換の最後の一手にして、失敗はログのみとし、タグは seed に残す形にした。判断の根拠は PR 本文に書いた。
- **2026-09-17**: 工程 2 の続き。W0 / W1 / W2 / W7 / W11 の 5 本は merge 済み。残りの作業単位のうち、#1637 / #1638 の PR に属さないものを 1 本の PR にまとめた（単位ごとに commit を分けた）。
  - W12: `MonthGrid.tsx` の compact / full の本体・Todo の drop 受け・+ ボタンを `MonthGridParts.tsx` へ移した。623 → 383 行。描画は不変で、`monthGrid.test.tsx` は無変更で緑。
  - W9: `useVisibleRangeItems` が書き込みごとに id へ連番を刻み、取得は開始時点より後に刻まれた行だけ手元の値を残す（`mergeRangeFetch`）。C-01 の「await 中の編集が黙って捨てられる」を塞いだ。変更を起こした操作自身の reload は編集より後に始まるので、サーバの値がそのまま入る。C-02〜C-05 は同じ仕組みで守られる経路だけが対象で、C-03（同じ tick の undismiss + reload）と C-04（Todo ツリーの全置換）と C-05（Provider 側の `loadDate`）は別ストアのため未着手のまま残す。
  - W8: F-04（Todo のリネームが `CalendarTab` の JSX に直書き）を `useScheduleTodoChips.handleTodoRename` へ移した。F-01〜F-03 はコードを読み直した結果、差を消す変更を入れなかった。F-01 はバブルと編集パネルが同時に開かない（未保存の下書きが存在しえない）。F-02 は #775 のコメントが意図した差と明記している。F-03 は 2 経路とも `todoChipMoveWrite` / `todoChipAllDayWrite` に既に収束している。
  - W10: H-01 を解消した。`useCalendarNav` がマウント時に固定していた today を、Provider の `date` から受け取る。H-02 / C-06（`contextItems` と `rangeItems` の二重持ち）は viewMirror の順序契約（§1-D の「残したい正しい実装」）で整合しているため、片方を派生にする変更は入れなかった。
  - W3 は #1637、W4 / W5 は #1638 の PR で扱う。W14 は chat-main、W15 は W14 の後。
- **2026-09-19**: W14 の直前の棚卸し（コード変更なし）。W0〜W12 と 7 本の機能 PR が着地したあとの現状を、2026-09-16 と同じ 7 軸で読み直した。
  - §Context に再計測を足した。対象コードは 19,744 → 21,932 行。**増やしたのはリファクタの PR ではない** — W8 / W9 / W10 / W12 をまとめた PR #1684 は `CalendarTab.tsx` を -1 行にしており、+137 行は #1638 / #1639 / #1640 / #1641 / #1626 / #1664 / #1678 の 7 本が足した分である。結果として AC の「1,239 行を超えない」を 136 行割った。自己免除せず判断キューへ積んだ（D-20260919-sched-6）。
  - §1-K を新設し、既存 ID と重ならない 16 件を並べた。**意図された差として 3 件を除外した**（ノート併用時の配置 Undo・Todo 削除の確認ポリシー差・日跨ぎドラッグのスコープ省略）— いずれもコード側のコメントが理由を明記している。K-01 / K-06 / K-11 / K-12 はメインが該当行を直接読んで裏を取り、残りは並列調査の報告をそのまま採った。**実ブラウザでの再現は 1 件も無い**（W14 の担当分）。
  - B-14 を足した。出典は shared-fix レーンの報告で、`web/src/schedule/**` が本計画の Scope のため向こうでは触っていない。B-10 の裏返しにあたり、catch が例外を握るため W5 の修正をすり抜けている。
  - F-11 = #1747 を足し、W13b として W14 の前に置いた（PR #1752）。#1664 が足した `onRetime` が F 系の典型をそのまま踏んだ形で、**棚卸し表が予測した種類の不具合が、棚卸しの後に新しく入った**。
  - §5-2 を足して open Issue の実態を 2026-09-19 で引き直した。2026-09-16 に「後に回す」とした 4 件は全部 merge 済みで、衝突は起きていない。未着手の open は #1747 / #1663 / #1678 の 3 件。

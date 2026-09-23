---
Status: Draft
Created: 2026-09-23
Branch: claude/schedule-refactor-plan2-1642
Owner-chat: schedule-refine
Previous: .claude/docs/vision/plans/2026-09-16-schedule-refactor.md (第 1 期。W0〜W14 と W16 は着地済みで、残る W15 = archive 化は本書の P0 が引き取る)
---

# Plan: Schedule コードのリファクタリング 第 2 期（失敗の扱いを揃え、機能が流れ込む 2 ファイルを割る）

> 本書は Issue #1642 の第 2 期の計画書で、第 2 期の詳細の正本になる。第 1 期の棚卸し ID（A〜K）は前の計画書が正本で、本書は ID で参照するだけにする（数値の非複製原則）。
>
> 本書の作成中にコードは 1 行も変えていない。実装は承認後に別セッションで始める。

---

## Context

- **動機**: 第 1 期は「同じ操作なのに入口ごとに挙動が違う」構造を畳んだ（W0〜W14・実ブラウザ検証は全シナリオ合格 = #1642 の 2026-09-20 コメント）。その後 2026-09-19〜09-23 に Schedule 系のコミットが 28 本入り、不具合修正 9 本（#1827〜#1835）で区切りが付いた。読み直すと、残っている問題は 2 種類ある。1 つ目は、書き込みが失敗したときの報告と巻き戻しが経路ごとにばらばらなことである（§1 に 22 件）。2 つ目は、新しい機能がほぼ必ず `CalendarTab.tsx` と `useRepeatMutations.ts` の 2 ファイルに行を足す形になっていることである（§Context の実測）。
- **制約**: Electron + Capacitor + Supabase への移行中（移行 SSOT が優先）。コストは $0。merge は常にユーザーが行う（P-001）。実ブラウザ検証は chat-main だけで行う（CLAUDE.md §7.4）。DDL は使わない。
- **Non-goals**: 機能追加と依存追加はしない。振る舞いを変えない変更と不具合修正は、別の PR に分ける。`supabase/migrations/`・`web/src/briefing/**`・`web/src/trash/**`・`mcp-server/**`・`shared/src/utils/undoRedo/**`・`shared/src/context/UndoRedoContext.tsx`・`shared/src/hooks/useWikiTagsUnifiedAPI.ts` は触らない。

### 現状の実測値（2026-09-23・origin/main `457b57e9`・第 2 期の baseline）

| 指標                                                 | 第 1 期 baseline（09-16） | 09-19 再計測   | 09-23 実測                  |
| ---------------------------------------------------- | ------------------------- | -------------- | --------------------------- |
| `web/src/schedule/`                                  | 38 / 8,908 行             | 40 / 10,218 行 | **41 / 10,527 行**          |
| `shared/src/components/schedule/`                    | 21 / 6,155 行             | 23 / 6,722 行  | **23 / 6,945 行**           |
| データ層（hooks + services + mapper の 11 ファイル） | 12 / 5,402 行             | 11 / 4,992 行  | **11 / 5,211 行**           |
| `CalendarTab.tsx`                                    | 1,239 行                  | 1,375 行       | **1,444 行**                |
| `useRepeatMutations.ts`                              | 776 行                    | —              | **1,134 行**                |
| `WeekTimeGrid.tsx`                                   | 786 行                    | —              | **965 行**                  |
| Schedule のテスト（下の数え方 B）                    | —                         | —              | **102 files / 1,313 cases** |

テストの数え方 B は、ファイル名で Schedule 系を拾い、行頭の `it(` / `test(` を数える（vitest が実行するケース数とは一致しない。増減の比較にだけ使う）。

```sh
F=$(ls web/tests/*.test.ts* shared/tests/*.test.ts* | grep -iE 'schedule|calendar|routine|repeat|weektimegrid|eventeditor|itemcreate|itemconversion|monthgrid|agenda|todaytodo|narrowday|todochip|frequency|seriesedit|unsavedclose|editorclose|visiblerange|holiday')
echo "$F" | wc -l
echo "$F" | xargs grep -cE '^\s*(it|test)(\.each\([^)]*\))?\(' | awk -F: '{s+=$2} END{print s}'
```

**機能 PR が 2 ファイルに流れ込んでいる。** `git log --numstat --since=2026-09-19 -- web/src/schedule/CalendarTab.tsx` を引くと、12 本の PR が 1 本残らず行を**足して**いる（+5〜+49 行）。`useRepeatMutations.ts` は #1708 / #1785 / #1788 / #1813 の 4 本で 776 → 1,134 行になった。第 1 期は「行数と今回の報告は相関しない」として行数を狙わなかった。その判断は第 1 期の範囲では正しかったが、機能を足すたびに同じ 2 ファイルを開く形が残ったままになっている。

**`CalendarTab.tsx` は描画のファイルではなく配線のファイルになっている。** JSX は `:1342` からの約 100 行だけで、その前の約 1,230 行は hook の呼び出しと子への props の組み立てである。中にはシェルからの intent を 1 回だけ受け取る処理が 4 つ、ツアー通知の包み直しが 5 つ、同じ形の pending ref が 2 本ある（§2-2）。

### 調査の方法と信頼性

3 領域を並列で調べた（書き込み経路と責務の地図 / Undo・失敗報告・楽観更新 / テストと幅の分岐）。`rules/docs-consistency.md` §5 に従い、**重い主張 11 件をメインが直接 Read / grep で確かめた**。棄却した主張は無い。

| 主張                                                        | 実測結果                                                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| シリーズ削除が 2 か所に実装され、片方だけ失敗を報告する     | ✅ `useScheduleRepeats.ts:281-293` は `landed` を見てトーストを出す。`useRepeatMutations.ts:1032-1060` は `landed` を読まない |
| `deleteRoutine` は書き込みが落ちても Undo を push する      | ✅ `useRoutinesAPI.ts:315-319` で `landed` を決め、`:321` の push 条件は `target` だけを見る                                  |
| 予定作成の失敗は範囲ストアを巻き戻さない                    | ✅ `useScheduleMutations.ts:284-294` は `onSaved` を素通しし、`useScheduleCreateFlow.ts:190-193` はノートが無いと何もしない   |
| 変換の undo は in-flight ガードに当たると黙って return する | ✅ `useItemConversion.ts:153`                                                                                                 |
| narrow ではサイドバーのシリーズ削除を隠している             | ✅ `ScheduleSidebar.tsx:343`。スコープダイアログは全レイアウトで出る（`ScheduleOverlays.tsx:428`）                            |
| Todo→Event 変換の成功トーストのキーが無い                   | ✅ `grep -c toEventDone shared/src/i18n/locales/en.json` = 0                                                                  |
| 幅の判定は 1 か所                                           | ✅ `CalendarTab.tsx:149` の `useMediaQuery(WIDE_QUERY, true)`                                                                 |
| `useScheduleItemsRoutineSync` のインスタンスが 2 つある     | ✅ `CalendarTab.tsx:182` と `RoutineScheduleSync.tsx:65`                                                                      |
| `closePopover` があるのに同じ処理のインライン版が残る       | ✅ `CalendarTab.tsx:319` と `:969` `:1255`                                                                                    |
| 同じ形の pending ref が 2 本ある                            | ✅ `CalendarTab.tsx:1012-1018` と `:1035-1041`                                                                                |
| テストの数え方 B の結果                                     | ✅ 102 files / 1,313 cases（メインが同じコマンドで再計測）                                                                    |

§1 の区分は第 1 期と同じにする。「コード」は該当行を読んだもの、「推定」はコードから導いたが挙動は確かめていないものを指す。**実ブラウザでの再現は 1 件も無い。** 再現は P12 で行う。

---

## 1. 棚卸し（第 1 期の残りと、第 2 期で新しく見つけたもの）

### 1-L. 第 1 期の ID のうち、まだ直っていないもの

2026-09-23 のコードで、第 1 期の §1-K の消化表で「未着手」だった 6 件と、関連する 3 件を引き直した。

| ID   | 状態                                                                                                                   | 根拠                                                                           | 区分   |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| K-03 | 未修正。dismiss / undismiss が `prev` を確かめずに push する。繰り返しの回でも Undo の確認ダイアログが出ない           | `useScheduleItemsCRUD.ts:397` `:408-410` `:452` `:472-474`                     | コード |
| K-05 | 未修正。ただし `restoreRoutine` / `permanentDeleteRoutine` を UI から呼ぶ箇所がゼロで、使われていない API になっている | `useRoutinesAPI.ts:606-637` vs `:639-664`、Trash は ds を直接呼ぶ              | コード |
| K-09 | 未修正。エディタの「なし」は成功しても reload しない                                                                   | `useRepeatMutations.ts:695-768` vs `:1023`                                     | コード |
| K-11 | 未修正。Todo→Event 変換に成功トーストが無く、i18n のキーも無い                                                         | `useItemConversion.ts:389-395` vs `:321`                                       | コード |
| K-13 | 未修正。頻度変更の reconcile の失敗は黙り、呼び出し側は失敗しても Undo を push する                                    | `useScheduleItemsRoutineSync.ts:352-354`、`useRepeatMutations.ts:602-631`      | コード |
| K-16 | 未修正。系列編集の失敗を、往路はトーストで伝え、undo / redo の復路は `catch {}` で握り潰す                             | `useRepeatMutations.ts:867-879` vs `:937-940`                                  | コード |
| K-06 | 未修正（判断待ちのまま）。複製がタグを引き継がない                                                                     | 第 1 期 §1-K の表の下                                                          | コード |
| B-10 | Manager 側は #1668 で直った。Provider の undo / redo 本体は今も投げっぱなしで、失敗しても「元に戻しました」が出る      | `useScheduleItemsCRUD.ts:157` `:166` `:292` `:305` `:358` `:424` `:552` `:567` | コード |
| C-03 | 未修正。スキップの取り消しが同じ tick で `undismiss` と `reload()` を撃つ                                              | `useScheduleTodayAgenda.ts:110-117`                                            | コード |

A-02 は #1708 で、K-08 は #1787 で、K-12 は #1788 で直っている。

### 1-N. 第 2 期で新しく見つけたもの

| ID   | 事象                                                                                                                                                                                        | 根拠                                                                                                                          | 区分   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------ |
| N-01 | `deleteRoutine` は書き込みが落ちても Undo を push する。実際には起きていない削除の「取り消し」がスタックに残る                                                                              | `useRoutinesAPI.ts:315-321`                                                                                                   | コード |
| N-02 | シリーズ削除の失敗の報告が入口で割れる。サイドバーはトーストを出し、スコープダイアログの「すべて」は黙る。一覧から消えた行も戻らない                                                        | `useScheduleRepeats.ts:281-293` vs `useRepeatMutations.ts:1032-1060`、楽観削除 = `useRoutinesAPI.ts:308`                      | コード |
| N-03 | シリーズ削除の確認が入口で割れる。サイドバーは確認ダイアログを出し、スコープダイアログの「すべて」は即実行する。narrow ではサイドバーのゴミ箱を隠しているが、スコープダイアログからは消せる | `useScheduleRepeats.ts:271-277`、`ScheduleSidebar.tsx:343`、`ScheduleOverlays.tsx:428`                                        | 推定   |
| N-04 | 繰り返しの解除（detach）の失敗が無言。ON にする変換の失敗はトーストを出す                                                                                                                   | `useRepeatMutations.ts:769-773` `:1024-1026` vs `:433`                                                                        | コード |
| N-05 | 頻度変更の undo / redo が `applyFrequency` の `false` も reconcile の失敗も見ないため、Manager は成功と判定する                                                                             | `useRepeatMutations.ts:548-566` `:616-629`                                                                                    | コード |
| N-06 | Undo が失敗したときの danger トーストの数が経路で違う。変換とノートは 2 件（自前 + `undoFailed`）、系列編集・CRUD・`deleteRoutine` は 0 件                                                  | `useItemConversion.ts:167-169`、`useCreatePanelNotes.ts:171-172`、`UndoRedoHost.tsx:43-46` vs `useRepeatMutations.ts:937-940` | コード |
| N-07 | 予定作成の失敗は、トーストも範囲ストアの巻き戻しもしない。複製は K-10 の修正で両方する。ノート付きのときだけ出る文言は「ノートを紐づけられませんでした」で、実際の失敗とずれる              | `useScheduleCreateFlow.ts:190-193` `:222-230`、`useScheduleMutations.ts:284-294` vs `:436-443`                                | コード |
| N-08 | 作成パネルから付けたノートが 2 本目の Undo エントリになり、ラベルが `createScheduleItem` 固定のため、1 回目の Ctrl+Z がノートだけを外して「予定の作成を戻しました」と出る                   | `useCreatePanelNotes.ts:162-163`、`useScheduleCreateFlow.ts:276-277`                                                          | コード |
| N-09 | 新しく作ったノートのリンクが失敗すると、ノートが孤児のまま残る                                                                                                                              | `useCreatePanelNotes.ts:127-142` `:187-189`                                                                                   | コード |
| N-10 | 繰り返しを ON にしてもリマインダーを routine へ写さないため、seed 以外の回はリマインダーを失う                                                                                              | `useRepeatMutations.ts:418-427`、`SupabaseRoutinesService.ts:200-220`、`routineScheduleSync.ts:85-86`                         | 推定   |
| N-11 | 繰り返しの回のリマインダーを変えても範囲を聞かず、黙って「この回だけ」になる。routine のテンプレートも `reminderOffset` を持つ                                                              | `eventEditorSave.ts:52-64`、`useRoutinesAPI.ts:172-173`                                                                       | コード |
| N-12 | 作成時の範囲ストアの楽観行に `reminderOffset` が無い。エディタは範囲ストアを優先して読むため、「作成して開く」ではリマインダーが空に見える                                                  | `scheduleDraft.ts:12-40`、`useScheduleItemsCRUD.ts:108-132`、`CalendarTab.tsx:489-495`                                        | 推定   |
| N-13 | 変換の undo / redo は in-flight ガードに当たると黙って return し、Manager がコマンドを redo 側へ移す                                                                                        | `useItemConversion.ts:153` `:175` `:217` `:239`                                                                               | コード |
| N-14 | 繰り返し ON / OFF の undo / redo で occurrence の生成が失敗すると、失敗トーストと「元に戻しました」が同時に出る                                                                             | `useRepeatMutations.ts:480-483` `:750-753` + `:361`                                                                           | コード |
| N-15 | `createRoutine` は確定前に push し、失敗しても巻き戻さない。UI から呼ぶ箇所はゼロ                                                                                                           | `useRoutinesAPI.ts:121-149`                                                                                                   | コード |
| N-16 | 繰り返し行の「次の回へ」の try/catch には到達しない。生成が `false` を返しても黙る（K-14 の直し漏れ）。この INSERT は Undo にも載らない（K-04 のまま）                                      | `useScheduleRepeats.ts:218-224`                                                                                               | コード |

**N-03 は第 1 期の仕様記録と食い違う。** 第 1 期は G-04 を「narrow ではシリーズ削除できない」と記録し、意図した省略として確定した（D-20260916-sched-1 = A）。実際には、narrow でも繰り返しの回を削除するとスコープダイアログが出て、「すべて」を選べばシリーズごと消える。どちらに揃えるかは UX が変わる判断なので、本書では決めない（§承認時に決めてほしいこと Q2）。

### 1-M. 構造の問題（不具合ではないが、機能を足すたびに効いてくるもの）

| ID   | 事象                                                                                                                                                | 根拠                                                                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| M-01 | `CalendarTab.tsx` が 6 つの独立した責務を抱える（§2-2 の ◎）                                                                                        | §2-2                                                                                                                                     |
| M-02 | `useRepeatMutations.ts` が 2 つの別フローを抱える。エディタからの繰り返し ON / 頻度 / OFF と、スコープダイアログの状態 + 3 つの実行器である         | `useRepeatMutations.ts:326-784` と `:786-1120`                                                                                           |
| M-03 | detach の Undo の持ち主が 2 通りある。エディタの「なし」は自分で push し、スコープダイアログの「この回以降」は `detachRoutine` の `{undo}` に任せる | `useRepeatMutations.ts:738` vs `:977` → `useRoutinesAPI.ts:452`                                                                          |
| M-04 | occurrence の生成（`ensureRoutineItemsForDateRange`）の呼び出しが 4 か所に散り、失敗の読み方がそれぞれ違う                                          | `useScheduleRepeats.ts:219`、`useRepeatMutations.ts:333` `:342` `:824`                                                                   |
| M-05 | Provider の書き込みの戻し方が統一されていない。`boolean` を返すもの、`{landed}` を返すもの、rethrow するもの、握り潰すものがある（K-15 の残り）     | `useRoutinesAPI.ts`、`useScheduleItemsCRUD.ts` の各書き込み                                                                              |
| M-06 | 「Desktop は選択 + オーバーレイ、narrow は選択そのものがシート」という規則が 3 か所に分かれて書かれている                                           | `ScheduleOverlayHost.tsx:193`、`useScheduleCreateFlow.ts:203` `:233`、`todoChipPanel.ts:48`                                              |
| M-07 | ID から ScheduleItem を探す処理が 3 か所にある                                                                                                      | `CalendarTab.tsx:489-496`、`useScheduleMutations.ts:139`、`:400-402`                                                                     |
| M-08 | Todo の完了トグルと Todo の作成が、それぞれ 2 か所に実装されている                                                                                  | 完了 = `useScheduleTodoChips.ts:297` と `CalendarTab.tsx:232`、作成 = `CalendarTab.tsx:896` と `useScheduleCreateFlow.ts:264`            |
| M-09 | `SupabaseRoutinesService.convertEventToRoutine` が 1 メソッドで約 366 行ある                                                                        | `SupabaseRoutinesService.ts:197-563`                                                                                                     |
| M-10 | `CalendarTab.tsx` を import して描画するテストが無く、`readFileSync` でソース文字列を読むテストが 4 本ある。ファイルを割るとこの 4 本が先に壊れる   | `scheduleTourRetime.test.ts:36`、`scheduleTourTodos.test.tsx:246`、`scheduleNarrowAdd.test.ts:36`、`scheduleNarrowHamburger.test.tsx:44` |

---

## 2. 責務の地図

### 2-1. 層の形

第 1 期 §2-1 から変わっていない（描画 → ホストの配線 → 書き込みの入口 → Provider → DataService）。DataService 境界（CLAUDE.md §3.1）は保たれている。

### 2-2. `CalendarTab.tsx` の責務（2026-09-23）

| 行                                 | 責務                                                         | 切り出し先                                                                   |
| ---------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 94-106, 351-377                    | 失敗トースト 3 種と文言テーブル                              | ◎ `useScheduleWriteErrors`                                                   |
| 220-246, 681-702, 913              | ツアーへの通知の包み直し（Todo 2 種・Event 2 種・Todo 作成） | ◎ `useScheduleTourReporting`（各書き込みを包んで返す）                       |
| 579-613, 890-894, 1091-1111        | シェルからの intent 4 種を 1 回だけ受け取る処理              | ◎ `useScheduleShellIntents`                                                  |
| 868-923, 1430-1441                 | Todo 作成ダイアログ（state・作成・描画）                     | ◎ `useTodoAddDialog`。作成パネル側の Todo 作成（M-08）との合流もここで決める |
| 986-999                            | Todo タブ用のタグ整形                                        | ◎ 既存の Todo タブのフィルタ hook へ移す                                     |
| 1012-1043, 1293-1313               | 繰り返しパネルの pending ref 2 本（同じ形）                  | ◎ `useScheduleRepeats` の `requestReveal` / `requestEditDetail`              |
| 822                                | 月の「他 N 件」                                              | ○ `useCalendarNav` へ                                                        |
| 1119-1326                          | Sidebar と Overlay の props 組み立て（約 210 行）            | △ 本書では割らない（§代替案）                                                |
| 148-203, 257-563, 617-741, 928-979 | Provider の読み取りと、解決済み hook の配線                  | 残す                                                                         |
| 1342-1443                          | 2 つのレイアウトの return                                    | 残す                                                                         |

◎ の 6 グループを出すと、約 250〜300 行が減る見込みである（見込みは推定。P2 の AC は行数でなく grep で判定する）。

### 2-3. 書き込みの失敗の扱い（第 2 期で揃えるもの）

| 書き込み                   | 失敗を知る手段           | 楽観更新の巻き戻し | ユーザーへの報告     | Undo の push               |
| -------------------------- | ------------------------ | ------------------ | -------------------- | -------------------------- |
| 予定の作成                 | `onSaved(null)`          | **しない**（N-07） | **しない**（N-07）   | 確定後                     |
| 予定の複製                 | `onSaved(null)`          | する（W16）        | する（W16）          | 確定後                     |
| 予定の更新・削除・スキップ | Provider 内              | する（W5）         | する（W5）           | 確定後                     |
| 繰り返しの ON（変換）      | throw                    | する               | する                 | 確定後                     |
| 繰り返しの頻度変更         | `false` + reconcile 無言 | する（D-05）       | 片方だけ（K-13）     | reconcile が落ちても push  |
| 繰り返しの解除             | throw → reload           | reload だけ        | **しない**（N-04）   | 入口で持ち主が違う（M-03） |
| シリーズ削除               | `{landed}`               | **しない**（N-02） | 入口で割れる（N-02） | 落ちても push（N-01）      |
| Undo / Redo の本体         | 経路で違う               | —                  | 0〜2 件（N-06）      | —                          |

**P4〜P6 はこの表の太字を消す作業である。** 手本は第 1 期の W5（Provider の巻き戻し + 報告）と W16（複製の `onSaved(null)`）で、同じ形をまだ持たない経路へ広げる。

---

## 検討した代替案（必須）

| 案                                                                           | 採否 | 却下理由                                                                                                                  | 復活条件                                                                            |
| ---------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **失敗の契約を揃え、機能が流れ込む 2 ファイルを責務で割る**（採用）          | ✓    | —                                                                                                                         | —                                                                                   |
| 不具合だけ直して構造は触らない                                               | ✗    | N-01〜N-16 の半分は M-03 / M-04 / M-05（書き込みの戻し方が揃っていない）に由来し、1 件ずつ直すと戻し方がもう 1 通り増える | ユーザーが第 2 期の構造作業（P1〜P3・P9・P10）を不要と判断したら、P4〜P8 だけを残す |
| `CalendarTab.tsx` を行数の上限で割る（D-20260919-sched-6 の案 C）            | ✗    | 行数は結果であって原因ではない。上限を AC にすると、機能 PR のたびに同じ議論が起きる（同決定の B 案の却下理由と同じ）     | —                                                                                   |
| Sidebar / Overlay の props 組み立て（約 210 行）も props builder hook へ出す | ✗    | 出しても配線の置き場所が変わるだけで、機能を足すときに開くファイルの数が 1 つ増える                                       | P2 の後も機能 PR の大半がこの 210 行を触ったら再検討                                |
| Undo を domain ごとのスタックに作り替える                                    | ✗    | `UndoRedoManager` はアプリ全体の共有資産で、Scope を超える（第 1 期と同じ判断）                                           | Schedule 以外でも同じ種類の不具合が出たら別 Issue へ                                |
| Provider の書き込みの戻り値を 1 つの型（`{landed}`）へ全部揃える             | ✗    | `boolean` / rethrow を返す既存の呼び出し元が Schedule の外（Briefing・Trash）にもあり、Scope 外のファイルを道連れにする   | Briefing / Trash のレーンが同時に揃えると合意したら、P4 の 1 単位として足す         |
| `SupabaseRoutinesService.convertEventToRoutine` を割る（M-09）を先頭に置く   | ✗    | 変換はデータを移す経路で、テストは厚いが壊れたときの修復が高くつく。失敗の契約（P4）が揃ってからのほうが安全に割れる      | —（P11 として最後に置く）                                                           |

**D-20260919-sched-6 との関係**: 同決定は「行数の上限は #1642 の AC から外す」と裁定し、案 C（追加の分割単位で行数を戻す）を却下した。本書の P2 は `CalendarTab.tsx` を割るが、狙いは行数ではなく責務（§2-2 の ◎）で、AC も grep で判定する。行数は観測値として記録するだけにする。ただし同決定の復活条件（「行数そのものが原因で改修が詰まったとき、C を別 Issue として起票する」）に近い作業であることに変わりはないので、Q1 で確認する。

---

## 承認時に決めてほしいこと

本書の承認と同時に答えてほしい判断を並べる。無回答のときは「放置時」の扱いで進める。

| #   | 問い                                                                                                      | 推奨                                                                                                                           | 放置時                                        |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Q1  | `CalendarTab.tsx` の責務分割（P2）を #1642 の第 2 期で行うか、D-20260919-sched-6 に従い別 Issue にするか  | #1642 で行う。行数ではなく責務で割り、AC を grep で判定するため、同決定が却下した「行数を戻す作業」とは別物として扱う          | P2 を外し、残りの単位だけで進める             |
| Q2  | N-03: narrow でスコープダイアログから「すべて」を選べる件をどちらに揃えるか                               | 選べるままにし、G-04 の記録を「narrow ではサイドバーから消せない」に訂正する。入口は残り、削除はダイアログで範囲を確かめている | P8 から N-03 を外す（コードも記録も変えない） |
| Q3  | N-11: 繰り返しの回のリマインダー変更で範囲を聞くか                                                        | 聞かない（現状維持）。E-01〜E-09 を仕様に固定した D-20260916-sched-2 と同じ扱いにし、本書に仕様として記録する                  | 聞かない（記録だけ）                          |
| Q4  | K-06: 複製がタグを引き継ぐか                                                                              | 引き継がない（現状維持）。タグの書き込みは Scope 外の `useWikiTagsUnifiedAPI` にあり、1 押下 = 1 Undo の約束も割れる           | 引き継がない（記録だけ）                      |
| Q5  | N-15 / K-05: UI から呼ばれていない `createRoutine` / `restoreRoutine` / `permanentDeleteRoutine` を消すか | 消す。MCP と Trash は ds を直接呼んでおり、この 3 つは誰も通らない                                                             | 残す（P9 を外す）                             |

回答が付いたら `.claude/decisions/D-*.md` へ昇格し、本書は ID で参照する（`rules/decision-queue.md`）。

---

## Scope (Touchable Paths)

実装の工程で変更してよいパスを宣言する。

```
web/src/schedule/**
web/tests/**                          （上記に対応するテストのみ）
shared/src/components/schedule/**
shared/src/hooks/useScheduleItems*.ts
shared/src/hooks/useRoutines*.ts
shared/src/services/SupabaseScheduleItemsService.ts
shared/src/services/SupabaseRoutinesService.ts
shared/src/services/scheduleItemMapper.ts
shared/src/services/routineMapper.ts
shared/src/utils/eventEditorSave.ts
shared/src/utils/scheduleDraft.ts
shared/src/utils/scheduleGridLayout.ts
shared/src/utils/routineScheduleSync.ts
shared/src/utils/seriesEditSequence.ts
shared/tests/**                       （上記に対応するテストのみ）
shared/src/i18n/locales/{en,ja}.json  （文言の追加が要る場合のみ）
.claude/docs/vision/plans/2026-09-23-schedule-refactor-phase2.md
.claude/docs/vision/plans/2026-09-16-schedule-refactor.md → .claude/archive/（P0 のみ）
```

**触らない**: `supabase/migrations/` / `web/src/briefing/**` / `web/src/trash/**` / `mcp-server/**` / `shared/src/context/UndoRedoContext.tsx` と `shared/src/utils/undoRedo/**` / `shared/src/hooks/useWikiTagsUnifiedAPI.ts` / `web/src/UndoRedoHost.tsx` / `mobile/` / `desktop/`。

スコープ外が必要になったら **P-008** に従い、実装せず `.claude/comm/decisions/chat-schedule-refine.md` へ積んで現計画を続ける。Scope は自分で広げない。

---

## 3. 分割・統合の方針

1. **書き込みの失敗は「巻き戻す・報告する・Undo を積まない」の 3 点を 1 組で扱う。** §2-3 の表の太字は、どれもこの 3 点のどれかが欠けている。手本は W5 と W16 である。
2. **Undo の本体は、失敗したら throw する。** Manager（#1668）は throw を失敗として扱い、コマンドを redo 側へ移さない。自前でトーストを出して正常終了する経路（N-06 / N-13 / N-14）は、トーストを出さずに throw する形に揃える。報告は `UndoRedoHost` の `undoFailed` 1 件にまとめる。
3. **同じ書き込みの実装は 1 つにする。** シリーズ削除（N-02 / N-03）・detach の Undo（M-03）・occurrence の生成の呼び出し（M-04）・Todo の完了と作成（M-08）は、実装を 1 つに寄せて入口から呼ぶ。
4. **配線のファイルに機能の中身を置かない。** `CalendarTab.tsx` には Provider の読み取りと hook の配線とレイアウトの return だけを残す。§2-2 の ◎ はすべて中身である。
5. **ファイルを割る前に、割ると壊れるテストを直す。** M-10 のソース文字列テストを、描画か hook 単体のテストに置き換えてから P2 に入る。
6. **挙動を変える PR と変えない PR を分ける。** P1〜P3・P9〜P11 は挙動変更ゼロで、P4〜P8 は不具合修正である。

---

## 4. 作業単位（PR 単位・依存順）

| #   | 作業単位                                                                                                                             | 種別     | 依存   | Gate    | Acceptance                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0  | 第 1 期の計画書を COMPLETED にして `archive/` へ移す（第 1 期 W15）。D-20260919-sched-6 の読み替えを AC に書く                       | docs     | —      | 🤖 自律 | `LC_ALL=C bash scripts/docs-lint.sh` exit 0・`.claude/archive/2026-09-16-schedule-refactor.md` が在り plans/ に無い・乖離レビュー 3 行がある                                                                                                                                                             |
| P1  | 割る前の固定。`useScheduleItemsCRUD` と `useItemConversion` に hook 単体のテストを足し、M-10 の 4 本をソース文字列を読まない形に直す | 挙動ゼロ | —      | 🤖 自律 | `grep -l "CalendarTab.tsx" web/tests/*.test.ts* \| xargs grep -l readFileSync` が 0 件（2026-09-23 は 4 件）・`web/tests/useItemConversion.test.tsx` と `shared/tests/useScheduleItemsCRUD.test.tsx` が在る・CI 緑                                                                                       |
| P2  | `CalendarTab.tsx` の ◎ 6 グループを hook へ出す（§2-2・Q1 の回答が要る）                                                             | 挙動ゼロ | P1     | 🤖 自律 | `grep -c "pendingRepeat" web/src/schedule/CalendarTab.tsx` = 0・`grep -c "REPEAT_FAILURE_COPY_KEY"` = 0・`grep -c "setPopover(null)"` = 1・`useState` の数が 5 から減る・CI 緑                                                                                                                           |
| P3  | `useRepeatMutations.ts` をエディタ側の繰り返し操作とスコープダイアログ側の実行器の 2 ファイルに割る（M-02）                          | 挙動ゼロ | P1     | 🤖 自律 | 割った 2 ファイルがどちらも 700 行以下・`web/tests/useRepeatMutations.test.tsx` がケース数を減らさず緑・CI 緑                                                                                                                                                                                            |
| P4  | Undo の本体の失敗を throw に揃える（B-10 の残り・K-16・N-05・N-06・N-13・N-14）                                                      | 修正     | P3     | 🤖 自律 | 各経路に「undo が失敗 → `undoFailed` が 1 件だけ出る → コマンドが undo 側に残る」のテストが K-16・N-05・N-13・N-14 の 4 経路それぞれにある・`useRepeatMutations.ts:937` の形（undo / redo の中で `catch {` がコメントだけを持ち、throw し直さない）が残っていないことを PR 本文で行番号つきで示す・CI 緑 |
| P5  | 繰り返しの削除と解除を 1 つの実装に寄せ、`landed` を読む（N-01・N-02・N-04・K-09・M-03）                                             | 修正     | P4     | 🤖 自律 | シリーズ削除の実装が 1 つ（`grep -l "deleteRoutine(" web/src/schedule/*.ts \| wc -l` = 1。2026-09-23 は 2）・失敗時に一覧の行が戻りトーストが出るテストが両入口にある・落ちた削除が Undo に積まれないテスト・CI 緑                                                                                       |
| P6  | 予定作成の失敗を複製に揃える（N-07・N-08・N-09・N-12）                                                                               | 修正     | P4     | 🤖 自律 | 作成が落ちると範囲ストアの楽観行が消えトーストが出るテスト・ノート付き作成の Ctrl+Z 1 回で予定とノートが両方戻るテスト・楽観行が `reminderOffset` を持つテスト・CI 緑                                                                                                                                    |
| P7  | 繰り返しを ON にしたときにリマインダーを routine へ写す（N-10。Q3 の回答次第で N-11 を記録）                                         | 修正     | P5     | 🤖 自律 | 変換後の非 seed の回が seed と同じ `reminderOffset` を持つテストが `shared/tests/` にある・CI 緑                                                                                                                                                                                                         |
| P8  | 小さい修正をまとめる（K-03・K-11・N-16・C-03。Q2 の回答次第で N-03）                                                                 | 修正     | P4     | 🤖 自律 | `grep -c toEventDone shared/src/i18n/locales/{en,ja}.json` が各 1 以上・dismiss の undo が `prev` の無い行で push しないテスト・「次の回へ」の生成失敗がトーストになるテスト・CI 緑                                                                                                                      |
| P9  | UI から呼ばれていない Routine API を消す（N-15・K-05。Q5 の回答が要る）                                                              | 挙動ゼロ | —      | 🤖 自律 | `grep -rn "createRoutine\|restoreRoutine\|permanentDeleteRoutine" shared/src/hooks/useRoutinesAPI.ts` が 0 件・CI 緑                                                                                                                                                                                     |
| P10 | 幅の規則（M-06）と ID 検索（M-07）を 1 か所に寄せる                                                                                  | 挙動ゼロ | P2     | 🤖 自律 | 「narrow は選択がシート」の判定関数が 1 つ（`grep -rn "isWide ?" web/src/schedule/ScheduleOverlayHost.tsx web/src/schedule/todoChipPanel.ts` が 0 件）・CI 緑                                                                                                                                            |
| P11 | `convertEventToRoutine` を段階ごとの関数に割る（M-09）                                                                               | 挙動ゼロ | P4     | 🤖 自律 | `SupabaseRoutinesService.ts` の最長メソッドが 150 行以下・変換のテストがケース数を減らさず緑・CI 緑                                                                                                                                                                                                      |
| P12 | 実ブラウザ検証（chat-main）                                                                                                          | 検証     | P2〜P8 | 👀 目視 | §6 の全シナリオ合格・コンソールエラー 0 件（意図して注入した通信断を除く）・レポートを #1642 にリンク                                                                                                                                                                                                    |
| P13 | 本書を COMPLETED にして `archive/` へ移す                                                                                            | docs     | P12    | 🤖 自律 | `docs-lint` 緑・Status enum 準拠・乖離レビュー 3 行                                                                                                                                                                                                                                                      |

**着手順の要**: P0 と P1 を最初に置く。P1 が無いまま P2 に入ると、M-10 の 4 本が「ファイルが見つからない」か「文字列が見つからない」で落ち、分割の回帰と区別できなくなる。P2 と P3 は触るファイルが重ならないので並行してよい。P4 は P3 の後にする。P4 が触る undo / redo の本体の大半が `useRepeatMutations.ts` にあり、割る前に直すと P3 の差分と衝突し続けるからである。

**機能 PR との順序**: P2 と P3 が open の間は、`CalendarTab.tsx` か `useRepeatMutations.ts` を触る機能 PR を先に merge しない。第 1 期では「後に回す」とした 4 件が先に着地し、`CalendarTab.tsx` に +136 行が乗った（第 1 期 §5-2）。今回は P2 / P3 の PR 本文に「このファイルを触る open PR」を列挙し、merge の順番をユーザーが決められるようにする。

### Gate 凡例

- **🤖 自律** — Claude が完結する。応答前に CI `verify` と同じコマンドを回して型崩壊を検出する
- **👀 目視** — 実ブラウザでの確認が要る（chat-main で実施）
- **🛑 人手** — ユーザー操作が要る。本書では、各 PR の merge と §承認時に決めてほしいことへの回答がこれにあたる

---

## 5. open Issue との順序

2026-09-23 に `gh issue list -R sunbreak-pro/life-editor --label section:schedule --state open` を引くと、open は #1642 の 1 件だけだった。第 1 期で「後に回す」とした #1663 / #1678 と、棚卸しから起票した #1667〜#1670 / #1767〜#1772 はすべて close 済みである。

したがって本書には、前に直す Issue も中で吸収する Issue も無い。§1-L / §1-N の各行を Issue にするかどうかは承認時に決める（起票は chat-main）。本書の作業単位がそのまま受け皿になるので、推奨は「Issue にせず本書の P で扱う」である。

---

## Acceptance Criteria (機械検証可能)

計画書の工程（本書の PR）:

- [ ] `LC_ALL=C bash scripts/docs-lint.sh` exit 0
- [ ] `_TEMPLATE.md` の必須節（Context / 代替案 / Scope / Steps / AC / References / Worklog）を持つ
- [ ] `git diff --stat origin/main` で `web/` `shared/` `desktop/` `mcp-server/` `supabase/` の変更行数が 0
- [ ] PR が #1642 を参照して open になっている

実装の工程（各作業単位）:

- [ ] CI `verify` ジョブの全 18 ステップが緑（shared → web → desktop → mcp-server の順。`typecheck:tests` を含む）と `docs-lint` ジョブが緑
- [ ] Schedule のテストが §Context の数え方 B で **102 files / 1,313 cases** から減らない
- [ ] 挙動ゼロの単位（P1〜P3・P9〜P11）は、既存テストのアサーションを変えずに緑（ファイル移動に伴う import パスとレンダーファクトリの変更だけを許す — D-20260816-sched-2 と同じ扱い）
- [ ] 修正の単位（P4〜P8）は、§1 の各 ID に対応するテストが少なくとも 1 本ある（PR 本文に「ID → テスト名」の表を置く）
- [ ] 各単位の §4 の Acceptance 列をすべて満たす
- [ ] 各 PR の diff が ±1,000 行以内
- [ ] 完了時: 本書の Status を COMPLETED にして `archive/` へ移した（P13）

AC を満たせない見込みになったら、自己免除せず **P-008** に従い判断キューへ積む。

---

## 6. 実ブラウザ検証のシナリオ（P12）

**実行は chat-main だけで行う**（CLAUDE.md §7.4）。Desktop 幅（1440px）と narrow 幅（390px）の両方で 1 周する。各シナリオの合否とスクリーンショットを HTML レポートにして Artifact で発行し、#1642 にリンクを貼る。

第 1 期の S01〜S23（第 1 期 §6）をそのまま回帰として再実行し、次の S24〜S35 を足す。失敗系のシナリオは、第 1 期の W14 と同じく通信断を意図して注入して再現する。

| #   | シナリオ                                                                                                                | 対応 ID    | Desktop | 390px              |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ---------- | ------- | ------------------ |
| S24 | 予定の作成を通信断で失敗させ、幽霊行が残らずトーストが出る                                                              | N-07       | ○       | ○                  |
| S25 | ノート付きで予定を作り、Ctrl+Z 1 回で予定とノートが両方消える                                                           | N-08       | ○       | —                  |
| S26 | シリーズ削除を通信断で失敗させる（サイドバー経由とスコープダイアログ経由の 2 本）                                       | N-01・N-02 | ○       | ダイアログ経由のみ |
| S27 | narrow で繰り返しの回を削除し、スコープダイアログに「すべて」が出るかを記録する                                         | N-03（Q2） | —       | ○                  |
| S28 | 繰り返しの解除を通信断で失敗させ、トーストが出る                                                                        | N-04       | ○       | ○                  |
| S29 | 系列編集の Undo を通信断で失敗させ、トーストが 1 件だけ出てコマンドが残る                                               | K-16・N-06 | ○       | ○                  |
| S30 | Event→Todo→Event の往復変換の Undo を素早く 2 回押し、2 回目が黙って消えない                                            | N-13       | ○       | —                  |
| S31 | リマインダー付きの予定を繰り返しにし、翌週の回にリマインダーが付いている                                                | N-10       | ○       | ○                  |
| S32 | 「作成して開く」で開いたエディタに既定のリマインダーが出ている                                                          | N-12       | ○       | ○                  |
| S33 | Todo→Event 変換で成功トーストが出る                                                                                     | K-11       | ○       | ○                  |
| S34 | 繰り返しの回をスキップ → 取り消し → Undo の順に操作し、値が戻らない                                                     | K-03・C-03 | ○       | ○                  |
| S35 | P2 / P3 の後で、シェルからの 4 種の intent（予定を開く・トレイを見せる・新規 Todo・Todo を開く）がそれぞれ 1 回だけ効く | M-01       | ○       | ○                  |

**記録**: コンソールエラー 0 件を記録する。意図して注入した通信断によるエラーは、件数と原因を分けて書く。

---

## Risks / Known Issues 参照

- `web/tests/` の jsdom にはレイアウトが無い（要素の座標がすべて 0）。ドラッグ系は座標に依存しない形で組む（CLAUDE.md §7.1）
- テストは既定で Desktop 幅になる（第 1 期 G-05）。narrow の分岐を見るテストは `matchMedia` を明示的に差し替える
- **描画回数を固定するテストがある。** `web/tests/monthCreatePanelRerender.test.tsx:328-393` は `format.fullDay` の呼び出し回数を固定している（#1829 で実際に赤になった）。P2 / P10 で memo の境界を動かすときは先にこのテストを読む
- **schedule 内部の相対パスを `vi.mock` するテストがある。** `web/tests/scheduleOverlayHost.test.tsx:71` `:93`。ファイルを移すと壊れるので、P2 / P3 でパスを変えるときは同じ PR で直す
- **仕様を変える単位では、今の挙動を固定している既存テストを先に grep する**（2026-09-22 の不具合修正 9 本のうち 3 本が、実装後にこの理由で赤になった）
- ローカルでゲートをまとめて回すときは `( npm run X | tail )` で終了コードを取らない（CLAUDE.md §7.1）
- 単体で緑の PR 2 本が、両方 merge された時点で main を壊すことがある（2026-09-22 に analytics レーンで 2 件）。P2 と P3 を並行させるときは、片方の merge 後にもう片方へ main を取り込んで verify を回し直す

---

## References

- Issue: #1642（本書の親）。第 1 期の棚卸しから起票されたもの = #1667 / #1668 / #1669 / #1670 / #1767 / #1768 / #1769 / #1770 / #1771 / #1772（すべて close 済み）。不具合修正 9 本 = #1827〜#1835（すべて close 済み・PR #1904 / #1908 / #1914 / #1919 / #1925 / #1927 / #1929 / #1933 / #1935）
- 第 1 期: frontmatter の `Previous`（P0 で `archive/` へ移る）。第 1 期の実ブラウザ検証 = #1642 の 2026-09-20 コメント（Artifact）
- 決定台帳: D-20260916-sched-1（narrow の省略）/ D-20260916-sched-2（範囲確認の仕様固定）/ D-20260919-sched-1（タグを Undo に載せる）/ D-20260919-sched-2（detach-series を Undo に載せる）/ D-20260919-sched-6（`CalendarTab.tsx` の行数 AC）/ D-20260816-sched-2（テストの束ね直しの扱い）
- 規約: [`CLAUDE.md`](../../../CLAUDE.md) §3.1 DataService 境界 / §7.1 検証ゲート / §7.4 worktree、[`rules/frontend.md`](../../../rules/frontend.md)、[`rules/docs-consistency.md`](../../../rules/docs-consistency.md)
- Mobile の取捨: [`mobile-scope.md`](../../requirements/mobile-scope.md)
- related skills: `test-writing` / `playwright-verify` / `worktree-policy` / `docs-workflow`

---

## Worklog

- **2026-09-23**: 計画書の工程。不具合修正 9 本（#1827〜#1835）の merge を確かめ、origin/main `457b57e9` から読み直した。3 領域を並列で調べ、重い主張 11 件をメインが直接確かめた（§Context の表・棄却ゼロ）。棚卸しは第 1 期の残り 9 件（§1-L）と新規 16 件（§1-N）と構造 10 件（§1-M）で、作業単位は P0〜P13 の 14 本になった。コードは 1 行も変えていない。
  - 第 1 期の計画書は W15（archive 化）だけが残っていた。第 2 期の計画書を別ファイルで立て、W15 は本書の P0 が引き取る形にした。第 1 期の計画書は本 PR では触っていない。
  - N-03 が第 1 期の G-04 の記録（D-20260916-sched-1）と食い違うことを見つけた。UX が変わる判断なので本書では決めず、Q2 に置いた。

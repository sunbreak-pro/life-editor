# HISTORY (chat-main)

### 2026-08-29 - Connect 後継（Tag hub + Related パネル）の方針確定と起票

#### 概要

connect-refine が #1152（Connect 退役）を実行中の裏で、Connect 機能の後継案 4 つ（Related パネル / Tag hub / Claude 製つながりダイジェスト / 局所ミニグラフ）を比較し、ユーザー確定で案 1 + 案 2 を採用。#1171 / #1172 として起票し、#1153 へ役割分担コメントを残した。

#### 変更点

- **方針確定（2026-08-29 ユーザー確定）**: 新 Connect は Tag 起点の hub ページ（力学グラフは復活させない）。#1153 との役割分担 = 時間軸の入口は Calendar / トピック軸の入口は Connect（「今日への配置」は Calendar サイドバー残留）。タグ無しアイテムは「未分類」疑似タグで受ける
- **起票**: #1171（[connect] Tag hub セクション新設・`section:connect`）/ #1172（[materials] LinkPanel の Related パネル化・`section:materials`）。どちらも **Blocked by #1152** を本文に明記
- **#1153 コメント**: 旧カンバンの「タグ軸で Todo を眺めて整理する」役割は #1171 が引き取り、サイドバー側にタグ別グルーピングを作り込まない旨を明記
- **実測の副産物**: タグの lucide アイコン + カラーはデータ列（`wiki_tags.icon` / `color`）も設定 UI（TagIconPicker / TagColorControls）も実装済みで、欠けているのは表示面（TagPill 等）だけ — 新規機能ではなく #1171 の表示要件として畳み込んだ

### 2026-08-23 - #994 モバイル体感の実ブラウザ計測 6 項目（PR #1112）+ follow-up 3 件起票

#### 概要

#797 が静的調査で止めた 6 項目を、playwright MCP の実ブラウザ（CDP で throttling）+ 作者本人の実 Supabase データで全数計測し、レポートに §8 として追記した（PR #1112 open）。実害が出た 3 点を **#1114 / #1115 / #1116** として起票し、**#992 は今の実データでは再現しない**ことを実測で確定した。

#### 実測値

| 項目                 | 実測                                                                 | 判定                            |
| -------------------- | -------------------------------------------------------------------- | ------------------------------- |
| 再レンダリング       | 初回 14 commit / 切替は Schedule だけ 164.5 ms（Materials の 13 倍） | Schedule が突出（#1101 の対象） |
| ポモドーロの REST    | 開始 1.1 秒で 5 本、残り 59 秒は 0 本、停止時 1 本                   | 約 6 本・長さに比例しない       |
| 実データの行数 / FPS | ノート 5 / Todo 4 / Event 0 → スクロールできるリストが 0             | FPS 測定不能                    |
| ツールチップ         | 1 hover = 1 commit・5.72 ms、60 fps 維持                             | 実害なし                        |
| Slow 4G + CPU 4x     | FCP 2,820 / LCP 3,860 / TBT 430 ms                                   | "needs improvement" 帯          |
| lucide eager/lazy    | eager 99.6%（466.5 KB raw / 1,704 モジュール）                       | 最大の改善余地                  |

#### 変更点

- **レポート §8 追記**（`.claude/docs/reports/2026-08-13-mobile-performance.md`）: 計測環境・6 項目の実測値・副作用の記録。§6 の未計測表から §8 へ参照を張った。docs-lint 緑
- **計測手法**: `__REACT_DEVTOOLS_GLOBAL_HOOK__` の shim を `addInitScript` で React より先に差し込み `onCommitFiberRoot` で commit 回数と `actualDuration` を集計。初期ロード系は `vite preview` の本番成果物 + CDP の `Network.emulateNetworkConditions` / `Emulation.setCPUThrottlingRate`。**コミット時間は dev ビルドでしか取れない**（本番 React は `actualDuration` を記録しない）ので、dev / prod を使い分けて注記した
- **lucide の内訳は sourcemap の mappings を復号して出力バイトをモジュールへ帰属**させて算出。eager 466.5 KB / lazy 1.7 KB = **eager 99.6%**。原因は `shared/src/components/tagIcon.ts:19` の `import { icons }`（レジストリ**オブジェクト全体**の参照で tree-shaking が無効化される）。curated 26 個の明示マップに替えた一時パッチで **gzip 417.52 → 300.64 KB（−28.0%）** を実測 → パッチは破棄（`git diff` で確認）
- **#992 の着手条件は満たされなかった**: `scrollHeight > clientHeight` の要素を全走査しても該当なし。仮想化は「今の重さを直す施策」ではなく「データが増えた後の先行投資」で、着手するなら合成データで閾値を先に決めるのが筋、と結論を残した
- **起票 3 件**: #1114（lucide・`sev:important` / shared-fix）/ #1115（Briefing のエディタ即時マウント・shared-fix）/ #1116（`Untitled todo` 自動生成 + ID 規約違反・`type:bug` / section:work）

#### 踏んだ罠

- **`performance.getEntriesByType("resource")` は resource timing バッファ上限（既定 250 件）で溢れる**。Supabase への 211 リクエストが「0 件」に見えて接続先を疑いかけた。全数が要るときは `window.fetch` を差し替えて自前で記録する
- **naive な線形外挿が結論を反転させかけた**: 60 秒で 5 本 → 30 分で 150 本、と割り算すると「ポモドーロが REST を垂れ流している」ように読めるが、実際は開始 1.1 秒に全部集中していて残りは 0 本。**バースト分布を確認せずにレートへ換算しない**
- **計測が実データを書き換えた**: タイマーを「No Todo」で開始したら `Untitled todo` が実 DB に作られた（ユーザー確認のうえソフトデリート）。supabase MCP は read-only トランザクションなので UPDATE が通らず、削除はアプリ自身の経路（life-editor MCP `delete_todo`）で行った。**書き込みを伴う操作を実データで計測するときは、何が書かれるかを先に fetch ログで押さえる**
- **CRLF のファイルに LF で追記していた**。既存ファイルへ heredoc で追記する前に行末を確認する

### 2026-08-16 - outbox の起票依頼を全消化（25 件）+ 全レーンへの /goal 配布 + §7.1 の複製撤去（#1010）

#### 概要

8 レーンの outbox に溜まっていた起票依頼を全数照合して **25 件を起票**（#991〜#1015）、レーンごとの `/goal` プロンプトを作って配布した。あわせて、その中で最優先だった **#1010（§7.1 のコマンド表が CI から遅れている）を D-20260816-main-2 = B で実装**（PR #1020）し、相対パスで作られて入れ子になっていた worktree 2 本を正しい場所へ移した。

#### 変更点

- **起票 25 件**: perf 4（#991〜#994・#797 の実測レポート由来）/ schedule follow-up 6（#995〜#998・#1000 と横展開 #999）/ mcp-server・横断 5（#1001〜#1004・#1011 = #782 の QA 見送り分）/ 公開 Web 3（#1005 CSP・#1007 manifest 色・#1009 ステータスバー文字色）/ BottomSheet の safe-area #1008 / docs・環境 4（#1006・#1010・#1013・#1015）/ mobile-scope 追随 #1014
- **7 月分の依頼はすべて起票済みだった**ことを実測で確認（#365 / #366 / #369 / #370 / #371 / #372 / #519）。未起票で残っていたのは 8 月分だけ
- **`[all]` の二重着手を避けるため 1 Issue = 1 レーンに固定**。web/ 配下の #1005 / #1009 はタイトル prefix ごと `[web-public]` へ、Notes 側の #999 は materials-refine へ寄せた（#473 で 40 分の二重実装が起きた教訓）
- **#1010 = D-20260816-main-2 = B**（ユーザー回答）: §7.1 のコマンド列挙を削除し、`.github/workflows/ci.yml` の `verify` + `docs-lint` を PR 前ゲートの正本と明記。回し方（各ステップの `working-directory` へ `cd`）と、コマンド名からは読めない罠 4 点（build はテストを見ず vitest は型を見ない / web の lint は `web/` しか歩かない / TypeScript の版が web だけ違う / docs-lint は `LC_ALL=C`）だけを残した。同じ表を指していた `loop-verify` スキルも `ci.yml` 参照へ付け替え（PR #1020）
- **踏まれた回数**: `typecheck:tests` の漏れで PR #924 / #980 / #842 / #985 の 4 本が「ローカル全緑・CI だけ赤」。追随依頼が 2 回出ても入らなかったので、表を直すのではなく複製そのものを畳んだ
- **入れ子 worktree の是正**: `workspaces/life-editor/workspaces/life-editor/settings-refine`（2 段）と同 `.../workspaces/life-editor/work-refine`（3 段）を正しい階層へ `git worktree move`。**両方とも Orca のターミナルが掴んでいて「Device or resource busy」で 1 度失敗した** — `orca terminal list --json` で handle を特定し `orca terminal close` してから移動した（worktree-policy の Windows 節と同型の詰まり方）。空になった中間ディレクトリは `rmdir` で撤去
- **副産物**: #1013（`pre-commit-tracker-guard.sh` が `history/archive/` 配下を tracker と認識せずブロックする）を起票。本 commit 自体がその穴に当たるため `[tracker-ok]` で通している

### 2026-08-15 - #675 の実ブラウザ回帰検証（6 項目 PASS）→ CLOSE + #870 起票

#### 概要

#675（Schedule の巨大ホスト 3 本を責務ごとに分割）の DoD 最終項目「merge 後に chat-main で playwright」を実施し、**6 項目すべて PASS / FAIL 0** で close した。検証中に見つかった既存挙動の不具合 1 件を **#870** として切り出した。

#### 実ブラウザ検証（main `5c86b05b` / dev server 5173）

| 項目                   | 判定   | 実測                                                                                                    |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| 週表示                 | **OK** | 日付ヘッダ 8/9–8/15・00:00–23:00 グリッド・現在時刻ライン・既存 2 件とも正常                            |
| 月表示                 | **OK** | August 2026 正常。Week ⇄ Month ⇄ Day を往復しても崩れなし                                               |
| ドラッグ移動           | **OK** | Mon 19:00 → Thu 14:00。リロード後も保持（`PATCH items_meta` / `events_payload` とも 204）               |
| リサイズ               | **OK** | 下端ハンドルで 14:00–15:00 → 14:00–17:00。リロード後も保持                                              |
| 繰り返しのスコープ選択 | **OK** | This event only / This and following / All events の 3 つが別々に効いた（下記）                         |
| Todo の追加と削除      | **OK** | ボード追加（2→3）→ トレイ「Add to today」→ 全日チップ → 時間帯へドラッグで 13:00–14:00 化 → 削除（3→2） |

スコープの内訳: **This event only** = 8/15 だけ改名し 8/14 は不変 / **This and following** = 8/14 で 06:00 に変更 → 8/14・8/15 の両方が 06:00 / **All events** = 8/15 で 05:00 に変更 → 過去側の 8/14 も 05:00。**console error 0 件**（`Invalid hook call` / `Rendered more hooks than…` は一度も出ず）・Supabase **938 リクエストすべて 200/201/204**。

#### 行数の測り方を誤っていた（自己訂正）

前セッションで「`CalendarTab.tsx` が 2,392 → 2,562 行に**増えている**」と報告したが誤り。**分割前の基準を Issue 起票時点の数字にしていた**のが原因で、分割 PR #839 の直前直後で測ると **2,716 → 2,557 行（159 行減）**。起票から分割までの間に別の機能追加（モバイル day-list の Todo 行 #761、詳細パネルからの Todo 削除 #775 ほか）が 300 行以上足していた。**行数の増減を語るときは対象コミットの直前直後で測る** — 文書に書かれた過去の数字を基準にしない。

#### DoD の数え方（コメントに明記した）

- 「`useScheduleMutations` の引数が 28 個から実質半減」は達成扱いにしたが、内訳を残す。`UseScheduleMutationsArgs` が自前で持つのは **12 個**で、繰り返し系 **17 個**（`UseRepeatMutationsArgs` 19 個 − Omit 2 個）は `useRepeatMutations` へそのまま横流し → **ホストが渡す総数は 29 個で減っていない**。「公開インターフェースの diff がゼロ」と表裏の関係
- 分割成果物のテストは実在: `shared/tests/useWeekTimeGridDrag.test.tsx` / `web/tests/useRepeatMutations.test.tsx` / `web/tests/useScheduleTodoChips.test.tsx` +（`useScheduleItemsAPI` 分割分）`agendaEmptyLabel` / `scheduleCopy` / `scheduleViewModels` / `calendarNavMonthSheet`

#### 新規起票 #870（`type:bug` / `section:schedule`）

時刻変更と繰り返し ON を**同じ Save** で行うと、生成されるルーチンのテンプレート時刻が**変更前**の値になる（当日だけ新時刻・翌日以降が旧時刻）。原因は `web/src/schedule/useRepeatMutations.ts:321` の `const seed = selected;` が下書きではなく確定済みの選択を読む点。**分割前の `useScheduleMutations.ts:628` にも同一行がある**ので #675 の退行ではない（`git show 82614e48^` で確認）。#712 で繰り返し系フィールドだけは「1 回の Save でまとめて渡る」形に直されており、時刻フィールドが取り残されている。

#### 対象外と確認した 2 件（修正不要）

- 繰り返しが翌週に生成されない = `CalendarTab.tsx:1207-1211` のコメントどおりの設計（ナビゲーションは fetch のみで materialize しない）
- 「This and following」が手編集済みの回に届かない = `SupabaseScheduleItemsService.ts:680` の rule 2「手編集は系列編集に勝つ」どおりの仕様。最初これに引っかかり、汚染のない系列を作り直して再検証した

### 2026-08-14 - #831 の stacked merge 事故を検出して復旧 + D-20260813-briefing-1 の昇格（#860 起票）

#### 概要

#831（コード上の Task → Todo 改名）の 3 PR が**すべて MERGED 表示のまま、main に届いたのは PR-A だけ**という状態を検出し、復旧 PR #865 の着地まで見届けた。あわせて判断キュー D-20260813-briefing-1 をユーザー回答 = A で確定し、台帳へ昇格して実装 Issue #860 を起票した。

#### 変更点

- **事故の正体 = stacked PR の base 張り替えレース**: #861（base=main）が 01:44:14Z、#862 が **01:44:24Z**（10 秒差）に merge。GitHub が #862 の base を main へ張り替える前に merge されたため、#862 は PR-A のブランチへ、#863 は #862 のブランチへ入った。3 本とも MERGED 表示になるので PR state だけ見ると気付けない（memory `stacked-pr-base-retarget-race` / #397 と同型）
- **検出の決め手は 3 角度**: ① `gh pr view <n> --json mergeCommit` の SHA を `git merge-base --is-ancestor <sha> origin/main` にかけると #861 = IN / #862・#863 = NOT ② main の `mcp-server/src/tools.ts` に `list_tasks` / `create_task`、i18n に `typeTask` / `noTasks` が残存 ③ `git diff --stat origin/main origin/claude/shared-fix-831-task-to-todo-mcp-docs` が **284 files / +3,461 / −3,478**
- **⚠️ 変数名の grep で誤検出しかけた**: `TaskNode` の件数で判定したら `setTaskNodes` というローカル変数に当たり、一瞬「PR-A も壊れている」と読み違えた。**改名の着地判定は型名ではなく「その PR でしか生まれない成果物」で行う** — MCP ツール名・i18n キー名・リネーム後のファイル名（`useScheduleTodoChips.test.tsx` 等）が該当する
- **復旧はやり直し不要だった**: 3 ブランチとも remote に健在で、`-mcp-docs` が PR-B + PR-C の commit を両方持っていた → main を取り込んで base=main の PR 1 本（#865）にまとめて着地。実装の書き直しはゼロ
- **着地の再確認**: `list_tasks` / `typeTask` が 0 ヒット、リネーム後ファイル 3 本が main のツリーに出現、#831 は `Closes` で自動 CLOSED
- **据え置き 3 点は無事**: `TodoNodeType = "task"`（型名だけ変わり `generateId` は `task-` を作り続ける）/ `role: "task"` が `SupabaseTodosService.ts:110,180` + `todoMapper.ts:61,295` の 4 箇所とも残存 / `tasks_payload` が mcp-server 各ハンドラで健在
- **D-20260813-briefing-1 = A**: 「今週」カードの週バー（直近 7 日）と Work タブ週次集計（月曜固定）を両方とも暦週へ寄せる。台帳 `decisions/D-20260813-briefing-1.md` を作成 → `ANSWERS.md` へ 1 行転記 → `comm/decisions/chat-briefing-refine.md` を空に
- **#860 起票**: `[analytics]` / `section:analytics`（briefing-refine レーン）。対象は `MobileAnalyticsView.tsx:121` の `aggregateByDay(sessions, 7)` と `analyticsAggregation.ts:162` の私有 `startOfWeek()` の 2 箇所で、`WorkTimeChart.tsx:56` の 14 日窓は対象外と本文に明記
- **レーン投入の順序を保留に**: #860 / #675 のプロンプトは用意済みだが、#831 が `shared/src/components` と `web/src` を丸ごと触るため投入を止めた。とくに #675 のやること 1（taskChips 抽出）は改名対象そのもの。**大規模改名は後・細かい作業が先**の順序をユーザーへ提示した

> 古いエントリは [`archive/2026-08/chat-main.md`](./archive/2026-08/chat-main.md)・[`archive/2026-07/chat-main.md`](./archive/2026-07/chat-main.md)・[`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照

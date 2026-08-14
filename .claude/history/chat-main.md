# HISTORY (chat-main)

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

### 2026-08-13 - #837 userData を productName 配下へ（PR #857 open）+ /goal 再配布が実質不要だった件

#### 概要

#837（デスクトップの設定が `%APPDATA%\desktop` に落ちて `productName` と一致しない件）を実装して PR #857 を出した。あわせて「次の一斉フェーズを /goal 配布とサブエージェントのどちらで回すか」の選定依頼に答え、前者と判断した上で配布直前に実測を取り直したところ、**各レーンは前回の /goal でまだ自走しており、こちらが配る前に 6 件を merge まで運んでいた**。

#### 変更点

- **#837 の修正**（`desktop/src/main/index.ts`）: `app.setName("Life Editor")` と `app.setPath("userData", <appData>/Life Editor)` を **Store 生成より前**に実行する。`app.getPath("userData")` は `app.getName()` 由来で、`app.getName()` は asar 内 `package.json` の `name`（= `desktop`）を返すため electron-builder の `productName` は効いていなかった。解決済みパスは初回読み取りでキャッシュされるので、順序そのものが修正の一部
- **旧 config の引き継ぎ**: 旧 `%APPDATA%\desktop\config.json` を新しい場所へ 1 回だけ copy（move ではない）。新側に config があればスキップするので、以降の編集が古い内容で上書きされることはない
- **実測（Windows 11 / `npm run dev`）**: Electron 4 プロセス起動（#545 の健康判定基準）+ `%APPDATA%\Life Editor\config.json` に旧値がそのまま（`theme=system` / `closeToTray=true` / `bounds 2560x1392`）。ゲート = desktop typecheck exit 0 / electron-vite build exit 0 / docs-lint OK（desktop に lint・test スクリプトは無い）
- **known-issue 033 に 2 点追記**: ① **worktree ごとに再発する** — `node_modules` を共有しないため、メイン clone を直しても worktree は壊れたまま残る（今回 win-verify で再発し、実機確認が一度空振りした） ② 復旧の近道 = 修復済み clone の `dist/` をコピーして `printf` で `path.txt` を書く（115MB の zip 展開より速い）
- **配布方式の判断 = 既存レーンへの /goal（サブエージェントは不採用）**: chat-main は `main` 専有で `git checkout <feature>` 禁止のため実装ブランチが切れない / `isolation: worktree` の一時 worktree は `node_modules` を持たず lint・test・build が通らない / Windows は worktree 削除が `Permission denied` で残骸化する。対して既存 11 レーンは npm install 済みで、Issue のラベルがレーンとほぼ 1:1 に対応していた
- **配布は実質不要だった**: 6 レーン分の /goal を用意した直後に取り直したところ **#838 / #830 / #826 / #827 / #672 / #793 が既に merge 済み**（06:31〜06:33 に集中）。**新規に渡す必要があったのは #795（briefing）と #708（schedule）の 2 本だけ**で、残りは貼ると二重指示になるため取り下げた
- **レーン割り当てを Issue 側へ明示（6 件）**: `shared-fix` ラベルは複数レーンが自分宛と解釈しうるため（#473 = 40 分の二重実装）、#838 / #827 → shared-fix、#797 / #792 → mobile-refine、#831 → 保留、#837 → chat-main とコメントした。うち #838 / #827 は書いた直後に merge されて空振り

### 2026-08-13 - #530 Windows 実機 golden path 通過（CLOSED）+ 11 レーンへの /goal 配布

#### 概要

open Issue 23 件を実測して 11 レーンへ /goal で配り、chat-main 自身の手番だった **#530（Windows 実機起動）を最後まで通して CLOSED** した。08-02 から止まっていた前提（`desktop/.env` 不在・#548 の白画面）が両方解けたため、ビルドからインストール、golden path の目視までを一続きで実施。途中で `npm run dev` だけが壊れている環境問題を踏み、known-issues 033 として記録した。

#### 変更点

- **/goal fan-out（11 レーン）**: Issue 本文の「担当レーン」指定と、直近 merge PR のブランチ名（誰が続きを持っているか）で割り当てた。schedule-refine = #789 → #774 → #708 → #790 / shared-fix = #672 残り → #782 / refactor-core = #701 Step 2 → #673 → #675 / web-public = #791 → #676 残り / tags-docs = #674 残り → #777 / materials-refine = #776 / settings-refine = #779 → #778 / mobile-refine = #716 の裁定済み 3 件 / work-refine = #781 / briefing-refine = #780 / harness-loop = #700 Step 2
- **#530 の前提解除**: `desktop/.env` は `web/.env.local` に必要な 2 キーが揃っていたのでコピーで配線（値を読まずに済み・`.gitignore:83` で除外済み）。renderer への注入は `out/renderer/assets/index-*.js` に `supabase.co` が 39 ヒット / `VITE_SUPABASE_URL` の未置換リテラルが 0 で確認（08-11 の実測は逆で `undefined` のままだった）
- **#530 の検証**: `build:win` exit 0 → `win-unpacked` 起動でプロセス 4 本 → NSIS サイレントインストール（`/S`・per-user）で実体を 08-02 13:17 → 08-13 00:07 に更新 → インストール先から起動して 4 本 → **ログイン → Todo 追加・編集・削除が PASS**（目視）。Menu / Tray / ウィンドウサイズ復元も PASS で、`%APPDATA%\desktop\config.json` に `windowBounds` が書かれることを実測
- **起動判定の基準**: 「プロセスが生きている」ではなく **4 本立つこと**。#545 は 1 本だけ立って落ちており、生存だけを見た煙試験が見抜けなかった
- **known-issues 033 新設**: `npm run dev` が `Error: Electron uninstall` で落ちる件。`node_modules/electron/dist` にライセンスファイル 1 個しか無く `path.txt` も欠けていた。**`build:win` は緑のまま**なので CI ゲートを素通りする（dev と electron-builder で Electron の入手経路が違う）。キャッシュ済み zip の手動展開で復旧。`path.txt` を `echo` で書くと改行がパスに混ざって `ENOENT` になる落とし穴つき（`printf` を使う）
- **新規起票 2 件**: **#831** = コード上の名前を Task → Todo に統一する（画面表示は既に Todo・DB は据え置き。実測 = ファイル 55 本 / 出現 3,470 箇所。据え置きは ID prefix `task-` / `role: "task"` の値 / DB 列名の 3 点）。**#837** = userData が `%APPDATA%\desktop` に入り `productName: Life Editor` と一致しない
- **#831 の着手条件**: `gh pr list --state open` が 0 件の谷間。起票直後に 11 レーンへ /goal が配られて open PR 4 件になったため、その旨を Issue にコメントして条件を明文化した

### 2026-08-13 - #700 Step 2: 検証用 MCP ツール 3 本（投入 / 読み出し / 後片付け）

#### 概要

検証を画面操作に頼らず回すための MCP ツールを 3 本足した（PR #821 open）。撒き先は 2026-08-12 に確定した `D-20260812-shared-fix-3`（案 A = 検証専用アカウント + RLS 分離）に従う。**「何を撒いたかツール側が覚えている」形**にしたので、検証データの削除がユーザー手番のまま残らない。実装は `mcp-server/**` に閉じ、規約を `db-conventions.md` §14 に足しただけで実運用コードには触れていない。

#### 変更点

- **`seed_verification_state`**: 指定日に task / event / note をまとめて作る。`preset: "busy_day"` = 重なった予定 2 本 + 終日予定 + 完了済み Todo + 未着手 Todo + 日付なし Todo。**書き込みは既存の `createTask` / `createScheduleItem` / `createNote` を通す**（専用の書き込み経路を持つと「その経路の fixture」になり、orphan recovery や §10.2 の bump が実データと違ってしまうため）
- **`read_verification_state`**: `items_meta` + `<role>_payload` の 2 行を 1 つの塊で返す。`run_id` / `date` / `id` のいずれか 1 つで選択（2 つ渡すと「聞かれていない条件で答える」ので拒否）。**soft delete された行も隠さず出す** — 「画面から消えた」と「行が消えた」を区別できるようにするのがこのツールの価値
- **`cleanup_verification_state`**: 台帳の id だけを hard delete（payload → `items_meta` の順。composite FK が NO ACTION のため）。soft では Trash に残るので hard。dry_run あり
- **台帳 = `mcp-server/.verification-ledger.json`**（git 非追跡）: 撒いた行を記録し、削除に成功した分だけ台帳から消す。**失敗した行は残るので再実行が復旧手順**になる。撒く途中で落ちた場合も書けた分は `finally` で記録される
- **二重の安全弁**: ① RLS（全テーブル `auth.uid() = user_id`・MCP は anon key + `signInWithPassword` の一般ユーザーで service_role を使わない）② `LIFE_EDITOR_VERIFICATION_MODE=1` が無いと 3 ツールとも**書く前に throw**。パスワードからは接続先アカウントを判別できないので、宣言を要求する形にした
- **daily は撒けない仕様**: id が日付由来（`daily-<YYYY-MM-DD>`）で実データと区別できず、id で消す cleanup が本物の日記を巻き込むため。task / event / note はランダム id なので衝突しない
- **`.mcp.json` は変更していない**（Scope 外 + 認証情報はユーザー手番）。併存方式は「検証用エントリをもう 1 本立て、その env でだけ credentials とフラグを渡す」と決め、スニペットを `db-conventions.md` §14 に記載
- **検証**: mcp-server 12 files / 196 tests・shared 217 / 1980・web 32 / 269・docs-lint すべて exit 0。テストは Supabase をメモリ上の偽テーブルに差し替えて一巡を回す（実 DB には触れない）
- **注意（実測で踏んだ）**: `npm run build \| tail` は exit code が tail のものになるため、`tsc` 未インストールの失敗が「緑」に見えた。パイプするなら `${PIPESTATUS[0]}` を見る（worktree-policy の既知の罠と同型）

### 2026-08-11 - backlog 一斉棚卸し（Phase 1 並列調査 → Phase 2 実ブラウザ検証 → Phase 3 反映）

#### 概要

chat-main の backlog を 4 体並列の読み取り専用調査 + 実ブラウザ検証 1 体で棚卸しし、Issue 側へ反映した。**実ブラウザは PASS 5 / BLOCKED 3 / FAIL 0・回帰なし**。判断キューの回答 3 件を台帳へ昇格し、実測で浮いた課題 2 件を schedule レーンへ起票（#707 / #708）。**停止条件に 2 件当たったので、#627 の子 Issue 一斉起票と #321 の close は保留**して判断キューへ積んだ。

#### Phase 2 実ブラウザ検証の結果（main = `da9ae58b` / dev server 5173）

| 項目                                               | 判定                               | 実測                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#681** blur は下書き保持・保存されない           | **PASS**                           | タイトル変更 → メモ欄へ blur で「Saved」→「Unsaved」・保存ボタン有効化・チップは旧タイトルのまま。Esc で破棄確認 → リロードしても DB は旧値（`items_meta.updated_at` 未更新）                                                                                        |
| **#681** 保存ボタンで確定する                      | **PASS**                           | 保存 → チップ即更新・「Saved」復帰・ボタン disabled・リロード後も保持（`updated_at` 更新）                                                                                                                                                                           |
| **#681** 繰り返しは保存ボタンを経由せず即時 commit | **PASS**（PR 記載どおりの caveat） | 未編集状態で「Daily」を押しただけで `POST items_meta` → `POST routines_payload` → `PATCH events_payload` → オカレンス一括 INSERT。表示は「Saved」のまま・Undo も無効                                                                                                 |
| **#684** Event ⇄ Todo 変換で id 維持               | **PASS**                           | 往復とも `schedule-b7d3c2d2-5ce2-48a3-ae03-9b18671f8e3f` で完全一致（`PATCH items_meta` で role のみ差し替え）                                                                                                                                                       |
| **#684** routine 由来は「変換は不可能です」        | **PASS**                           | 文言完全一致・書き込みリクエスト 0 件。ただし**ネイティブ `window.alert`**（`web/src/schedule/CalendarTab.tsx:1818`）→ #707 起票                                                                                                                                     |
| **#684** 子を持つ Todo の変換拒否                  | **BLOCKED**                        | 子 Todo を作る UI が無く再現不可（`shared/src/components/TaskAddDialog.tsx:72` が常に `parentId: null`・既存データにも `parent_item_id` 0 件）。入れ子は #418 で退役済みなので到達不能な分岐                                                                         |
| **#686** routine 作成の undo                       | **BLOCKED**                        | `createRoutine`（undo を積む唯一の関数 = `shared/src/hooks/useRoutinesAPI.ts:81,129`）の呼び出しが `web/src/` に 0 件。UI からの繰り返し作成は `convertEventToRoutine` 経由で意図的に undo なし（`useRoutinesAPI.ts:344-350`）                                       |
| **#686** routine 更新の undo + 翻訳トースト        | **PASS**                           | 「毎日」→「曜日」を Undo で `frequency_type: daily` に復元。トースト「元に戻しました: 繰り返しの変更」= 生キーではない                                                                                                                                               |
| **#686** routine 削除の undo + 翻訳トースト        | **PASS**（ただし要判断）           | `is_deleted: false` に戻りリスト復帰・トースト「元に戻しました: 繰り返しの削除」。**戻るのはルーチン行だけ**で、種イベント（`schedule-b7d3c2d2`）と元オカレンス（`si-1fe619b3` / `si-25634b94`）は削除済みのまま、当日分が新 id（`si-9d18df3c`）で再生成 → #708 起票 |

console error は操作区間で 0 件（warning は `apple-mobile-web-app-capable` の deprecation のみ）。テストデータは全てゴミ箱送り・言語設定は English へ復帰済み。**保存ボタン経路に回帰なし**。

#### Phase 1 調査の結果

- **#587（Notes 神ファイル分割）**: 実測 `useNotesUnifiedAPI.ts` 967 → **431 行**、`SupabaseNotesUnifiedService.ts` 842 → **303 行**（PR #642 / #647 で着地）。DoD 1〜3 はコードで満たされる（公開 IF diff・呼び出し側 diff ともに `git show --stat` が空）。**落ちているのは DoD 4 だけ** = `notesUnifiedHelpers.ts`（220 行・純粋関数 11 本）のテスト参照が repo 全体で 0 件、`useNotesUnifiedCRUD.ts`（374 行）に専用テストなし → **open のまま維持**
- **#627（保存ボタン統一 Epic）**: 起票時 5 行 → 実測 **19 行**（追加 12 / 削除 0 / 記述訂正 1）。Schedule は PR #681 で save-button 化済みだが繰り返しだけ immediate = 厳密には mixed。Settings 4 パネルは immediate だが**書き込み先が localStorage で DataService 非経由**。Briefing / Tags 画面は起票時に丸ごと抜けていた。`TaskDetailPanel` の Tasks / Schedule 両用は確認（実描画は `KanbanView.tsx:532` と `CalendarTab.tsx:2178` の 2 箇所のみ）
- **#290（Schedule redesign Epic）**: Step 2〜7 が**コード上 9/9 DONE**・本文チェックボックスと実装の乖離なし・子 Issue 9 件すべて CLOSED。残は実ブラウザ検証のみ
- **#321（Mobile UI/UX Epic）**: コード 8/8 DONE・子 Issue 11 件すべて CLOSED。ただし本文が想定しない open が 5 件（#691 / #692 と mobile 裁定 3 件）
- **#512（パレット safe-area）**: 未着手。`CommandPalette.tsx:206-216` は `paddingTop: viewport.height * 0.12` のままで safe-area 参照なし。本文の引用行番号がドリフト（`:158-164` → 実際は `:206-216`）
- **#530（Windows desktop）**: `cd desktop && npm run typecheck` / `npm run build` とも **exit 0**。`desktop/.env` は不在で、**`web/.env.local` は desktop ビルドに効かない**（electron-vite の `envDir` が `desktop/`）。今ある成果物は資格情報が `undefined` に置換されており、ログインすると落ちる。インストール済み実体は 08-02 04:17 UTC ビルドで **#548 の修正より前**なのでインストーラ作り直しが先

#### 反映

- Issue コメント: #587 / #290 / #512 / #530 / #321。**#627 は本文ごと実測表へ差し替え**（DoD 1・2 を [x] 化）
- **判断キューの回答 3 件を台帳へ昇格**（`records.mjs index` 同一コミット）: **D-20260809-main-2 = A**（`records.mjs` に archive スキャンを足して `archive/INDEX.md` を生成）/ **D-20260804-main-1 = A**（Windows タスクスケジューラ + `claude -p` で 06:03・22:33 に発火）/ **D-20260810-main-3 = A**（STALE スキル 5 本を現行アーキで書き直す）
- **新規起票**: **#707**（変換の確認・拒否をネイティブ dialog から in-app へ）/ **#708**（繰り返し削除の Undo で種イベントとオカレンスが戻らない — 方式 A/B/C の裁定が先）。どちらも `section:schedule` 単一レーン
- **停止条件 2 件を判断キューへ**: **D-20260811-main-1**（#627 の対象範囲 — Settings / Briefing / 作成フォームを含めるか。差が 2 行を大きく超えたため子 Issue の一斉起票を保留）/ **D-20260811-main-2**（#321 のスコープ確定 — #692 は完了済み #467 の巻き戻しを含むため close 前に裁定が要る）

#### 判明した運用上の事実

- **`chore/tracker-main-20260811` は使えなかった**: 別 worktree（harness-loop）が占有中で、かつその PR #682 は既に MERGED。merge 済み PR のブランチへ後追い push しても main に届かないため、**`chore/tracker-main-20260811-2` を新設**した
- サブエージェントの引用は全数スポットチェックした（`EventEditorPane.tsx:589` / `TaskDetailPanel.tsx:85,87` / `CommandPalette.tsx:206-216` / `useCalendarNav.ts:32` / `BriefingScreen.tsx:66` / `MobileShellActions.tsx:51-70` / `CalendarTab.tsx:1818` / `useRoutinesAPI.ts:344-350` / `TaskAddDialog.tsx:72` ほか）。**存在しない引用はゼロ**

> 古いエントリは [`archive/2026-08/chat-main.md`](./archive/2026-08/chat-main.md)・[`archive/2026-07/chat-main.md`](./archive/2026-07/chat-main.md)・[`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照

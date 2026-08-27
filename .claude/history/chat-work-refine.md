# HISTORY (chat-work-refine)

### 2026-08-27 - #1116 タイマーの `Untitled todo` 自動生成を止め、Todo ID の形を固定した

#### 概要

Work で Linked Todo を `No Todo` のまま Start すると実 DB に `Untitled todo` が 1 件作られていた（#994 の計測で判明）。これは #882 で意図的に入れた挙動だが、「Todo に紐付けず回す」がタイマーの普通の使い方なので、既定操作のたびに Todo リストへゴミが積まれる形になっていた。加えてその ID が `task-<uuid>` で、CLAUDE.md §4 の TodoNode 不変式（`task-<timestamp+counter>`）から外れていた。両方直した。PR #1143 open（Closes #1116・merge = 人手 P-001）。

#### 変更点

- **`shared/src/context/TimerContext.tsx`**: `startSession` の mint 経路を丸ごと撤去し、`startTimerSession(phase, todoId ?? undefined)` の 1 本に。`untitledTodoTitle` prop も削除（`web/src/TimerHost.tsx` の `useTranslation` ごと不要に）。i18n `work.todoSelector.untitled` は他に参照が無いので en / ja 両方から削除
- **DDL 変更なし（判断の根拠）**: `timer_sessions.task_id` は `text`（NOT NULL でなく FK も無い — `supabase/migrations/0018_timer_audio_tables.sql:163`）。「セッションを作るために Todo が要る」という制約は元から存在せず、null で素直に入る
- **ID 不変式**: 正しい生成器は `useTodoTreeAPI.ts` 内の module-local `generateId(type)` だけに存在し、外から呼べなかった。だから他経路は名前が似ている `utils/generateId.ts` の `generateId("task")`（= `task-<uuid>`）に手が伸びていた。前者を `generateTodoId` として `utils/generateId.ts` へ移し export、フックはそれを使う形に
- **スコープ外を 1 箇所だけ塞いだ**: `web/src/briefing/hooks/useBriefingWrites.ts` の朝刊クイック作成が同じ `generateId("task")` を呼ぶ唯一の残りだった。Issue 本文の「Todo を作る経路は必ず通す」に該当するため同 PR で切替（PR 本文に明記）
- **本番 DB の実測**（Issue が要求した確認）: `role='task'` かつ `id !~ '^task-[0-9]+$'` は #1116 報告の 1 行のみ（`task-7df08c2d-…`・既にソフトデリート済み）。他は退役済みの `folder-*` 9 行。データ側の後始末は不要
- **テスト**: `timerUntitledTodo.test.tsx` → `timerUnattributedStart.test.tsx` に反転（作らない / `task_id = null` で開く / チップが空のまま / 選択済みは素通し / 休憩も同様）。`generateTodoId.test.ts` 新規 4 件（形・単調増加・時計シード・`generateId("task")` では満たさないこと）。`web/tests/workScreenActions.test.tsx` の該当ケースも反転（`createTodo` は `WRITE_METHODS` に含まれるので `expectOnlyWrite` がそのまま「他は何も書いていない」を担保する）
- **失われたもの（PR 本文にも明記）**: #882 の目的（未紐付けの時間に名前を付ける）は撤回され、Analytics 上は再び無名の `__none__` にまとまる。両立が要るなら `timer_sessions.label`（既存の空き列）を使う別案になる
- **検証**: CI の `verify` ジョブと同じステップ列をローカルで全通し — shared lint / build / typecheck:tests / test 2551、web lint / build / typecheck:tests / test 849、desktop typecheck / test / build、mcp-server build / typecheck:tests / test 318、`bash scripts/docs-lint.sh` OK。すべて exit 0
- **未検証**: 実ブラウザ確認は worktree では回さない規約（§7.4）。merge 後 chat-main の宿題

### 2026-08-16 - #946 Pomodoro Settings の 2 列で入力欄の縦位置が揃わない

#### 概要

Work > Pomodoro Settings の 5 つの数値フィールドは 2 列グリッドだが、セルが独立して上詰めになるため、ラベルの折り返し行数の差がそのまま入力欄の縦位置の差になっていた（en の "Long break duration between sets" = 3 行の隣に "Sessions per set" = 1 行）。行の高さを使う構造に直して揃えた。PR #984 open（Closes #946・merge = 人手 P-001）。

#### 変更点

- **`shared/src/components/PomodoroSettings.tsx`（`NumberField` のみ）**: セル（`<label>`）に `h-full`、キャプション（`<span>`）に `grow`。grid セルは元から行の高さを持つので、フィールドをその高さいっぱいに伸ばし、余りをラベル側に吸わせると入力欄がどのセルでも下端に来る。ラベルは上揃え・入力欄は下揃えになり、行数が何行違っても崩れない。親の `grid grid-cols-2 gap-3` は非変更
- **ピクセル固定を採らなかった理由**: en は longBreak（3 行）> sessionsPerSet（1 行）だが ja は「セット間の休憩時間」< 「1セットあたりのセッション数」で長短が逆転する。オフセットや `min-h-*` はどちらかの catalog で必ず破綻する（Issue の第 3 案「ラベルを短くする」も同じ理由で見送り）
- **挙動は非変更**: #714 のドラフト保存モデル・#624 の空欄ダイアログには一切触れていない（既存 2328 件が無修正で通過）
- **テスト**: `shared/tests/pomodoroSettings.test.tsx` に #946 の describe 2 件（5 フィールドすべての `h-full` + キャプションの `grow` を固定 / 言語で壊れる固定高さが入っていないことを assert）。jsdom にレイアウトが無い（§7.1）ため段差そのものは測れず、既存 #880 と同じ「揃いを生む仕組みをクラスで固定する」形
- **silent fail の実測潰し**（known-issue 015 の型）: `grow` はこのリポジトリで初出のユーティリティのため、ビルド後の `web/dist/assets/*.css` に `.grow{flex-grow:1}` が出ていることを確認
- **未検証**: 実ブラウザでの見た目確認は worktree では回さない規約（§7.4）。merge 後 chat-main の宿題
- **検証**: shared lint（0 error）/ build / test 2328、web lint / build / test 482 — すべて exit 0

### 2026-08-15 - #882 Todo 未選択のタイマー開始に「無題のTodo」を作る

#### 概要

Todo を選ばずタイマーを開始すると、セッション行が紐付け先なしで保存されていた。Analytics はその手の行を全部 1 つの名無しの山（`__none__` = `shared/src/utils/analyticsAggregation.ts:346`）に入れるため、「1 時間作業した」は残るのに「何を」が残らない。WORK を未紐付けで開始したら本物の Todo を 1 件作り、それに対してセッションを開くようにした。PR #907 open（Closes #882・merge = 人手 P-001）。

#### 変更点

- **`shared/src/context/TimerContext.tsx`**: `startSession` に mint 経路を追加。`generateId("task")` + `createTodo` → 返った id で `startTimerSession` を開く。作った Todo は `SET_ACTIVE_TODO` で active にも据える（チップに名前が出るので勝手な紐付けが見える + 同じ稼働の後続フェーズが使い回す。ADVANCE / RESET とも `...state` で activeTodo を保つことを reducer で確認済み）
- **意図的な境界 2 つ**: 休憩では作らない（休憩を Todo に紐付けると「やっていない時間」がその Todo の作業時間に混ざる。既に選択済みの Todo を休憩が引き継ぐ既存挙動は非変更）／ `createTodo` が失敗しても紐付けなしでセッション行は開く（紐付けが消えるのが直したいバグで、記録ごと消えるのはより悪い）
- **タイトルはホスト注入**（`untitledTodoTitle` prop・必須）: Provider は `shared/` にあり shared は useTranslation を呼ばない規約（`rules/frontend.md`）。`web/src/TimerHost.tsx` が `t("work.todoSelector.untitled")` を解決。i18n は en / ja 両方に追加（ja =「無題のTodo」）
- **テスト**: `shared/tests/timerUntitledTodo.test.tsx` 新規 6 件（作られる / 作った id でセッションが開く / activeTodo に載る / 作成失敗でも記録は残る / 選択済みなら作らない / 休憩では作らない）。`timerProviderAutoStart` の DS スタブに `createTodo` を追加 — このスイートは Todo 未選択で WORK を開始するので新経路を通る
- **検証**: shared lint（0 error）/ build / test 2139、web lint / build / test 394 — すべて exit 0

### 2026-08-15 - #881 Mobile のスタート / 停止アイコンが上下の要素と被る

#### 概要

fullscreen（Mobile）のタイマー面だけ操作列が Desktop より大きく描かれていた（メイン 72px・左右 52px）。上に 270px リング・セッションドット・Todo チップが積まれるので、縦が短い端末では最後に置かれるこの列が押し出され、スタート / 停止が上下と重なる。Desktop 相当まで落とした。PR #904 open（Closes #881・merge = 人手 P-001）。

#### 変更点

- **`shared/src/components/PomodoroTimer.tsx`**: 左右の丸ボタンを両 variant とも 44px に統一（`roundSize` / `roundIcon` の分岐そのものを削除）、メインを 72→56px（アイコン 28→22）。縦に約 16px 戻る
- **縮小幅はユーザー確定**: 元の Issue 文「デスクトップ時より 5px ほど小さく」は、Mobile が現状 Desktop より*大きい*ため基準が一意に決まらなかった。3 案を提示して「Desktop 相当まで落とす」を選択（2026-08-15）。44px はここから先へ縮めない下限（指で押せる最小 + Card variant が元からこの値）
- **テスト**: `shared/tests/pomodoroTimer.test.tsx` に 2 件追加。jsdom にレイアウトが無いのでクラス名を固定する形（後から「Mobile を大きく」の変更が入って再発するのを防ぐのが目的）
- **未検証**: 重なりが実際に解消したかは実ブラウザ確認が要る（worktree では回せない — §7.4）。merge 後 chat-main 側の宿題
- **検証**: shared lint（0 error）/ build / test 2135、web lint / build / test 394 — すべて exit 0

### 2026-08-13 - #781 残り 3 箇所の window.confirm / alert を ConfirmDialog へ

#### 概要

裁定 D-20260811-refactor-2 = B に従い、main `da8993dd` 時点で残っていたブラウザ標準ダイアログ 3 箇所（Kanban の変換確認 / 子持ち Todo の拒否 / Settings のリセット確認）をアプリ内 `ConfirmDialog`（#707）へ載せ替えた。PR #810 open（Closes #781・merge = 人手 P-001）。

#### 変更点

- **KanbanView の変換 2 箇所**（`web/src/tasks/KanbanView.tsx`）: 確認は `itemConvert.toEvent` / `common.cancel`、子持ち拒否は **cancel ラベル無しの acknowledge 形**（`common.ok`）。Schedule 側（`CalendarTab.tsx` の同名フロー）と同じ形に揃えた — alert を Toast にしなかった理由はこれ（P-006 として PR 本文にも記載）
- **Settings のリセット**（`web/src/settings/SettingsScreen.tsx`）: `danger` 指定 + 新規 `settings.reset.confirmButton`（en / ja lockstep）。`resetLocalPreferences()` は `.then` の中だけに置いた
- **非同期化の罠を明示的に固定**: 標準 confirm はその場で答えが返るが ConfirmDialog は 1 tick 後。旧形のまま書くと「開いた瞬間に変換 / 設定全消し」が走る。`beginConvert`（#434 の in-flight 主張）は答えが返った直後に同期で立てる形を維持
- **テスト**: `web/tests/kanbanView.test.tsx` の変換 describe を全面更新（`window.confirm` spy 撤去・キャンセルで変換 0 件を含む 6 件）/ `web/tests/settingsScreen.test.tsx` 新規 3 件（質問中は未呼び出し・拒否で 0 回・確定で 1 回）
- **grep 0 件化**: 説明文として `window.confirm` を含んでいたコメント 5 ファイル分を言い換え（`ConfirmDialog.tsx` / `components/index.ts` / `TagEditModal.tsx` / `CalendarTab.tsx` / `unsavedCloseGuard.ts`）。禁止が grep で機械的に確認できる状態にするため。挙動変更なし
- **検証**: shared lint（0 error）/ build / test 1980、web lint / build / test 275、`scripts/docs-lint.sh` OK — すべて exit 0。実ブラウザ確認（リセットのキャンセルで何も消えない）は merge 後 chat-main（§7.4）

> 2026-07 のエントリ（#181 の 2 件）は `archive/2026-07/chat-work-refine.md`、#590 は `archive/2026-08/chat-work-refine.md` へ移動。

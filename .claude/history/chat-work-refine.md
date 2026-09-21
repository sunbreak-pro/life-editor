# HISTORY (chat-work-refine)

### 2026-09-21 - #1793 環境音の雑音を切り分け、原因が音源側だと実測で確定した

#### 概要

環境音に「サーッ」という雑音が重なる症状の仮説 A（音源）と B（再生経路）を分けた。公開バケット `sounds` から 5 本 + `complete.mp3` を直接落として測った結果、**A（音源側）**。Issue の判断ルール（音源がきれいなときだけ再生経路を書き換える）に従い `shared/src/context/AudioContext.tsx` は 1 行も触っていない。PR #1797 open（Refs #1793・merge = 人手 P-001）。

#### 変更点

- **`.claude/docs/reports/2026-09-21-ambient-sound-asset-measurement.md`（新規）**: 測定方法・コンテナ / レベル / ループ継ぎ目の全表・差し替え条件・再現手順
- **`shared/src/constants/sounds.ts`**: ヘッダコメントに差し替え条件を追記（コードは不変）
- **決め手 1**: 5 本とも 320 kbps / 48 kHz を名乗るのに **16.25 kHz でブリックウォール**（21〜49 dB / 500 Hz）、18 kHz 以上は -99 dB 以下。素の 320 kbps なら 20 kHz まで残る。同じバケットの `complete.mp3` にはこの壁が無い（最大落差 16.2 dB / 500 Hz）ので測定側の副産物ではない。低ビットレート素材の再エンコードか 32 kHz 素材の引き伸ばし
- **決め手 2**: 5 本とも Xing / LAME のギャップレスタグを持たず、両端に無音が焼き込まれている。`el.loop = true`（`AudioContext.tsx:202`）は末尾と先頭の無音を続けて鳴らすので **1 周ごとに 39〜139 ms 音が切れる**（wind は 25.8 秒に 1 回）
- **確定しなかったこと**: 「サーッ」が符号化ノイズかまでは言えない。帯域ごとの 5 パーセンタイルと中央値の差が全帯域で 11〜13 dB と一定で、**素材の上に乗った一定のヒスの床は検出できなかった**。広帯域ノイズは元来このくらいばらつく
- **実機で最初に見る点**: 5 プリセットは独立した `Audio` element で同時に何本でも鳴る（`AudioContext.tsx:207-224`）。2 本以上オンなら白色雑音に近づき「重なって聞こえる」症状と一致する。1 本だけオンとの聞き比べを Issue コメントに依頼済み
- **手法**: `mpg123-decoder` で MP3 をデコードし、フレームヘッダと Xing / LAME タグは生バイトで読む。スペクトルは Hann 窓 4096 点 FFT をビンごとに時間方向でパーセンタイル化。スクリプトは repo に入れていない（本番依存を増やさないため・組み直せる説明を報告書に残した）
- **検証**: CI `verify` のステップ列をローカル全通し（shared / web / desktop / mcp-server）+ `docs-lint`、すべて exit 0
- **未検証**: 音の実聴は chat-main の担当（§7.4）

### 2026-09-21 - #1792 未選択の作業対象を「フリーセッション」と読める表示にした

#### 概要

作業対象セレクタが未選択のとき「Todo か予定を選ぶ…」と出ていて、何も選ばずに始めたらどうなるかが画面から読めなかった。#1665 以降は Schedule にフリーセッションが 1 件作られるのに、その予告がどこにも無い。未選択の表示を「フリーセッション」に変え、欄の見出しを「紐づけ先」から「作業名」にした。PR #1795 open（Closes #1792・merge = 人手 P-001）。

#### 変更点

- **i18n（`shared/src/i18n/locales/{ja,en}.json`）**: `heading` 紐づけ先→作業名、`placeholder` / `select` → フリーセッション、`clearSelection` 選択を外す→フリーセッション、`clear` 紐づけを外す→フリーセッションに戻す、`emptyHint` と `history.noTarget` と `freeSession.tagDisabled` も「紐づけ」語を外した
- **`work.todoSelector.sheetTitle` を新設**: Mobile シートの見出しと未選択ボタンのラベルが `select` 1 本を共有していたため、ボタンが「フリーセッション」になるとシート見出しまで同じ語になる。参照キーを分けた（`web/src/work/WorkScreen.tsx:514`）
- **Desktop / Mobile 両方**: Desktop は `PomodoroTodoSelector` の `placeholder`、Mobile は未選択ボタンと BottomSheet の行。`PomodoroTodoSelector` / `PomodoroTodoSheet` の実装自体は不変
- **Scope から外した 1 点**: `scheduleScreen.attachedNote` / `noteAttachFailed` に「紐づけ」が残る。ノート添付という別セクションの機能で Issue の「触る場所」外のため、同じ ja.json を触る他レーンとの衝突を避けて手を付けていない。DoD の repo 全体 grep は `work.*` の範囲で満たした
- **テスト追随**: `web/tests/sectionSnapshotReplay.test.tsx:165` が旧 en 文言を直書きしていた 1 箇所のみ。他は `t()` のキーを突き合わせる形なので影響なし
- **検証**: CI `verify` のステップ列をローカル全通し（shared / web / desktop / mcp-server）+ `docs-lint`、すべて exit 0
- **未検証**: 実ブラウザ確認は chat-main の宿題（§7.4）

### 2026-09-06 - #1519 選択シートの予定行に日付を付けて発生分を区別できるようにした

#### 概要

集中の「Todo か予定を選ぶ」に、毎日の繰り返し予定が同名で 7 行並んでいた（#1409 の Mobile 幅点検で発覚）。行にタイトルしか無いので、どの日の発生分に時間を紐づけるのか選びようがない。ウィンドウを今日だけに絞る案もあったが、**7 日は「明日の予定に今から着手する」ための設計**（#1375 のコメントが根拠）なので、絞らず行の側に日付を足した。PR #1539 open（Closes #1519・merge = 人手 P-001）。

#### 変更点

- **`shared/src/components/PomodoroTodoSelector.tsx`**: `WorkTargetOption` に `subtitle?: string` を追加し、Desktop のドロップダウンでは既存の `MenuItem` の末尾スロット（`shortcut`）へ流す。新しい枠は作っていない
- **`shared/src/components/PomodoroTodoSheet.tsx`**: subtitle がある行だけ 2 行構成に。390px ではタイトルの横に置く余地が無いため、Desktop と描き分けている
- **`web/src/work/WorkScreen.tsx`**: subtitle の組み立てはホスト側（§6.4 — 部品は copy も locale も解決しない）。`formatShortDate`（`web/src/schedule/scheduleCopy.ts`）を再利用して `9/6 07:00` の形にし、終日は時刻の代わりに `work.todoSelector.allDay`。DB 上の `00:00` をそのまま出さないための分岐
- **i18n**: `work.todoSelector.allDay` を en / ja 両方に追加（`briefing.allDay` / `scheduleScreen.allDay` が既にあるが、セクションごとに持つ既存の慣習に合わせた）
- **テスト**: `web/tests/workScreenLayout.test.tsx` に 2 件（Mobile シートで 3 発生分がカレンダー順に別々の日付を出す / Desktop メニューでも同じ日付が出て Todo は 1 行のまま）。両テストの `useTranslation` mock に `i18n.language: "en"` を足した — 月日の順が機械の locale で揺れないようにするため
- **検証**: CI `verify` のステップ列をローカル全通し — shared 2973 / web 1077 / desktop / mcp-server、`docs-lint` 含めすべて exit 0。途中 1 回 shared の worker 起動タイムアウト 12 件と `briefingEveningLazyMount` 1 件が出たが、いずれも既知の環境要因で静かな状態の再実行は緑
- **未検証**: 実ブラウザ確認は worktree では回さない規約（§7.4）。merge 後 chat-main の宿題

### 2026-09-05 - #1475 中断したタイマーセッションが分析に混ざるのを止めた

#### 概要

集中タイマーを開始してすぐ止めると `timer_sessions` に「12 秒・未完了」の行が残り、分析の Todo 別作業時間と週間比較のセッション数に混ざっていた（#1408 の実ブラウザ点検で発覚・実測 id 18 / 19）。**書いているのは reset ではなく pause** だと判明したため、書き込み側ではなく読み取り側の単一判定で塞いだ。PR #1505 merged（Closes #1475）。

#### 変更点

- **原因の切り分け**: 一時停止の時点で in-flight の行が「経過秒 + `completed=false`」で閉じられる（`TimerContext.tsx` の `pause`）ため、続く reset には取り消す対象が残っていない。Issue の Scope は「リセット経路」だったが、そこを直しても書き込みは止まらない
- **方針 = 集計側で除外**（Issue の A/B のうち B。Issue コメントに根拠を記載）: アプリにセッション削除の導線が無いので、書き込み側だけ直しても既存 2 行は残り続ける。読み取り側なら過去行も同時に分析から消える
- **`shared/src/utils/timerSessions.ts`**: `ABANDONED_SESSION_SECONDS = 60` + `isCountedSession`（type predicate）を追加。落とすのは「未閉鎖（duration null）」「0 秒」「未完了 かつ 1 分未満」の 3 種。**未完了を一律で落とさない** — 20 分やってから中断して戻らなかったのはフェーズの普通の終わり方で、その時間は働いた時間。`completed` は「目標まで走ったか」だけを表し、それはポモドーロ達成率カードが別途見ている
- **`shared/src/utils/analyticsAggregation.ts`**: `getWorkSessions` / `aggregateWorkBreakBalance` / `aggregateDailyTimeline` が同判定を使用。作業時間・サマリ・ヒートマップ・タグ別・ストリーク・当日タイムライン・アイテム別作業時間がまとめて揃う
- **`shared/src/context/TimerContext.tsx`**: コメントのみ（reset がログを取り消さない理由と判定の在り処）。挙動は非変更
- **テスト 12 件**（`timerSessions.test.ts` 6 / `analyticsAggregation.test.ts` 5 + 境界）: しきい値を 0 に落とすと 7 本が落ちることを実測し、ガードが効いていることを確認（変更は差し戻し済み）
- **検証**: CI `verify` ジョブのステップ列をローカル全通し — shared 2926 / web 1064 / desktop 30 / mcp-server 322、`docs-lint` 含めすべて exit 0
- **残り**: id 18 / 19 の物理削除はユーザー手番（Issue の Gate どおり）。ただし分析にはもう出ない
- **未検証**: 実ブラウザ確認は worktree では回さない規約（§7.4）。merge 後 chat-main の宿題

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

> 2026-07 のエントリ（#181 の 2 件）は `archive/2026-07/chat-work-refine.md`、#590 と #781 は `archive/2026-08/chat-work-refine.md` へ移動。

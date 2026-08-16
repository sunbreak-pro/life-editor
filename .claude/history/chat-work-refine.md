# HISTORY (chat-work-refine)

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

### 2026-08-10 - #590 Layout Standard v2 adoption（work）

#### 概要

work セクションの Layout Standard v2 採用。Issue の前提「WorkScreen に SectionHeader 参照がゼロ」は見るファイルが違っただけで、標準ヘッダーは既に出ていた（`web/src/MainScreen.tsx:312` の既定分岐がタブ帯を持たないセクション全部に `title=section.work` 付き `<SectionHeader>` を渡している）。残っていた「タイマー面との縦の余白・視覚的な重複の調整」だけを実施し PR #641 で提出（open・merge = 人手 P-001）。

#### 変更点

- **カードスタックのリズム統一**: wide 分岐の `gap-4` → `gap-6`。先に v2 を採用した Settings（`SettingsScreen.tsx:160`）/ Trash（`TrashScreen.tsx:174`）と同値で、work だけが孤立値だった（P-006 = 余白のミクロ判断は既存パターン踏襲）。スタック自身は最初のカードの上に padding を足さないため、ヘッダー行と PageContainer の `py-6` が二重取りにならないことを確認
- **stale コメント解消**: ファイル冒頭の `width="reading"` 中央寄せの記述が #210/#305 の wide 統一で古くなっていた分（v2 計画 Worklog が「adoption で解消」と明記していた宿題）
- **テスト新規 3 件**（`web/tests/workScreenLayout.test.tsx`）: body がセクション名をどこにも出さない（画面上の heading は shell の 1 つだけ）/ `PomodoroSettings` が detail panel で開閉し body 側に出ない / 768px 未満でタスクピッカーと設定が両方到達可能。timer は Sync Provider 依存を避けるためローカル stub（#590 のスコープが `TimerContext.tsx` 非接触のため）
- **非変更の確認**: `SectionHeader` 本体・`AppShell.tsx` の diff ゼロ（DoD）。i18n 差分ゼロ
- **検証**: shared lint（0 error）/ test 1512 / build、web lint / build / test 127 — すべて exit 0。余白の見た目確認は jsdom にレイアウトが無いため merge 後 chat-main（§7.4）

> 2026-07 のエントリ（#181 の 2 件）は `archive/2026-07/chat-work-refine.md` へ移動。

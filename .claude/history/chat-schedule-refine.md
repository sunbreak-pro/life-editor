# HISTORY (chat-schedule-refine)

### 2026-08-01 - #508 BottomSheet にフォーカストラップと初期フォーカス（shared-fix `[all]`）

#### 概要

`aria-modal="true"` を名乗りながらトラップも初期フォーカスも無かった `BottomSheet` に、Modal が既に持っていた機構を共有フック `useDialogA11y` として切り出して配線した。ついでにダイアログのレイヤ順序が listener 登録順（＝スタック順の逆）で決まっていた欠陥を、module レベルのレイヤスタックに置き換えた。

#### 変更点

- **新規 `shared/src/hooks/useDialogA11y.ts`**: Esc（IME ガード付き）/ Tab 循環 / 初期フォーカス / 呼び出し元へのフォーカス復帰 / 任意の body scroll ロック。パネル側 ref を返す
- **レイヤはスタックで決める**: 全ダイアログが document で待つため、**最初に登録した＝一番古い外側**が先に走って stopPropagation していた（シートの上に開いた Modal の Esc がシートに渡る）。`layers` 配列の末尾＝最前面だけが Esc と Tab に反応する
- **`BottomSheet.tsx`**: 自前の Esc effect を撤去してフックへ。パネルに `ref` + `tabIndex={-1}`（中に focusable が無いシートは自分自身がフォーカスを受ける）。**body scroll はロックしない**（背後のリストをスクロールしたまま使う導線のため。Modal だけ `lockScroll: true`）
- **`Modal.tsx`**: 2 つの effect（Esc + trap / scroll lock + focus）をフック呼び出し 1 行に置換。パネルに `tabIndex={-1}` 追加。capture 段の stopPropagation は「最前面だけ」条件付きで維持
- **初期フォーカスは子が取っていたら触らない**: `panel.contains(document.activeElement)` で降りる。`QuickAddSheet` が effect で input を focus しており、上書きが Issue の言う「二重フォーカス」の正体
- **可視判定の layout 分岐**: `offsetParent !== null` は jsdom で全要素 null になり trap が丸ごと空振りする（#475 の「テストから見えない経路」）。`document.body.getClientRects()` で layout の有無を見て、ある時だけ適用。`disabled` / `aria-hidden` は両環境で除外
- **新規 `shared/tests/dialogFocus.test.tsx` 8 件**: 初期フォーカス / focusable ゼロ時のパネル fallback / 子のフォーカス尊重 / Tab・Shift+Tab 循環 / 外に逃げたフォーカスの引き戻し / 復帰 / IME 中の Esc 無視 / **Modal をシートの上に重ねた時に Esc が最前面だけに届く**
- 検証: 7 ゲート全緑（shared lint 0 errors / build / **167 files 1371 pass**、web lint / build / **8 files 75 pass**、`LC_ALL=C docs-lint` OK）

### 2026-07-30 - #469 の role-qa 監査対応（merge 後の hardening follow-up）

#### 概要

Stop hook のレビューゲートで role-qa を回した結果、Blocking 2 件・Should-fix 3 件。**Blocking はどちらも #484（PR merge 済み）で自分が入れた退行**だったので、追い PR で直した。監査を回している最中に #484 が merge されたため「merge 前の差し戻し」にはできなかった。

#### 変更点

- **B-1 日付を commit-on-blur に戻した**: `<input type="date">` は「完全な値しか emit しない」が正しくても、**セグメントを 1 段動かすたびに emit する**。↑ を 5 回押せば DB 書き込み 5 回 + undo エントリ 5 個、年をキーボードで打てば 2 年 → 20 年 → 202 年を経由して書き込む。commit-on-change を選んだ理由（Esc で閉じると blur が飛ばず draft が失われる）は残るので、**unmount flush**（ref に最新の commit を持たせ、空 dep の cleanup で 1 回だけ実行）で埋めた
- **B-2 日付変更時の anchor 追従を撤回した**: 追従は「行が今の週から消えるのを避ける」ためだったが、**anchor が変わると `[rangeStart, rangeEnd]` が変わり、再フェッチが `rangeItems` を配列ごと置換して着地前の楽観 patch を捨てる**。書き込みは fire-and-forget で数往復・読みは SELECT 1 発なので読みが先着し、行がどの範囲にも無い瞬間に `selected` が null → `editorItem` null → **詳細パネルが自分で閉じる**（Desktop の日表示 / Mobile では ±1 日の変更でも毎回）。追従をやめると patch 済みの行が `rangeItems` に残るのでパネルは開いたまま、行の移動は次の settled fetch が反映する。**「消えないように追従する」が消える原因そのものだった**
- **S-1 終日 OFF 後に時刻入力が空のまま残る**: draft は props からの初期値のみで再同期が無く、key も `item.id` だけだったので、時刻を持たない終日行を OFF にすると DB / グリッドは 09:00-10:00・パネルは空欄という食い違いが出ていた → `EventEditorFields` の key に `isAllDay` を含めて再マウントさせる
- **S-2 フォールバック span を shared の純関数へ**: 新設 `shared/src/utils/scheduleAllDay.ts` の `timedSpanForAllDayOff`。web にテストランナーが無いため無検証だった 3 ケースを vitest で pin — **`minutesToTime` の clamp で `"24:00"` を作る**（start 23:30 + end 空 → 23:59 に丸める）/ start だけある行で end が逆転しない / text 列に入り得る不正文字列は「時刻なし」として扱う（`minutesFromMidnight` は不正入力を 0 と読むため、放置すると start=壊れた値・end=01:00 のペアを書く）
- **N-3 / N-4**: `rangeItems.find(...) ?? selected` の二重探索を `selected` 直参照に（`editorItem` は `selected` 由来なので探索が食い違うと別行の時刻を読む方向に間抜ける）。系列ヒントの文言に memo を追加（memo も occurrence 単位）
- **docs 追随（QA の S-3）**: 計画書 Status 行 + Step 5 / Step 7 の記号、Worklog に 2026-07-30 の 3 行、Epic #290 の Step 7 行。**Step 2 / 3 の `⬜` は担当外なので outbox で chat-main へ申し送り**
- **判断キュー**: 「日付変更でカレンダーを移動先へ飛ばすか」を D-20260730-sched-1 として記録（A = 飛ばさない（採用）/ B = 書き込みの着地を待って飛ばす。B は `useScheduleItemsAPI` の書き込みを await 可能にする改修が前提）
- **ゲート**: shared vitest **158 files / 1305 pass**・shared build・web build・web lint すべて exit 0

### 2026-07-30 - #469 Step 7 編集パネルの日付ピッカー・終日トグル + 小粒回収

#### 概要

`EventEditorPane` に日付ピッカーと終日トグルを足し、計画書 §4-E の小粒 2 件を実測してから処理した（1 件は既に解消済みで回収不要、1 件は実装）。加えて前レーンで未起票のまま残していた「系列の頻度変更が失敗しても無言」を拾った。

#### 変更点

- **日付ピッカーは commit-on-change**（他フィールドの commit-on-blur とあえて違える）: overlay は Esc で閉じられ blur が飛ばないので、draft 方式だと選んだ日付が黙って捨てられる。半端な値が撃ち抜く先も無い（date は系列へ伝播しないので #279 の「半分打った時刻が系列に乗る」害が構造的に起きない）。空文字は commit しない
- **終日トグルは `role="switch"`**（先例 = `AudioMixer` / `Connect/primitives/Toggle`）。ON では時刻を**消さずに保持**（戻したときに元の時刻が復活する）。**OFF に戻すときは host が時刻を補う** — 終日で作られた行は start/end を持たない可能性があり、null のままでは時間グリッドに描けない。既定は create 経路と同じ 09:00 で、end は start から 60 分後を計算（start だけある行で逆転しない）
- **時刻入力は終日 ON で「隠す」**（disabled にしない）: #434 で踏んだ「ロックすると focusable が消える」問題を、隠す側のトグルがフォーカスを保持することで回避。ロックした入力を残すと「無視される値が正しそうに見える」欠点もある
- **`isAllDay` を伝播対象から外した**（`useScheduleMutations.ts` の `propagatable`）: routine template に `isAllDay` は無いので伝播先が存在しない。OFF 時に時刻を同梱するため、この 1 行が無いと時刻編集と誤認されて #279 の scope ダイアログが開く（適用範囲の無い変更に範囲を訊く）
- **小粒 (1) 計画書の「Known Issue 009 = Mobile 月セルに dismissed が残存」は解消済み・回収不要**（実測）: `useVisibleRangeItems.ts:52` が fetch 時に `!isDeleted && !isDismissed` で落とし、`handleDismiss` が楽観的に行を除く。月セルは `monthItems ← rangeItems` なので入り込む経路が無い。**なお `docs/known-issues/INDEX.md` の 009 は別内容**（Mobile Provider バイパス）で、計画書側の番号が古い
- **小粒 (2) 系列編集ヒントを実装**: routine occurrence に「タイトルと時刻は範囲を選ぶ / 日付と終日はこの日だけ」の 1 行。編集して scope ダイアログが出るまで挙動が分からない状態を解消
- **追加回収: 系列の頻度変更が失敗しても無言だった**（前レーンで PR #450 本文に観察として書き、未起票だったもの）。`updateRoutine` の `!landed` で reconcile を飛ばした後、finally の reload が**古い頻度に戻す**ので「コントロールが壊れている」ように見えていた。#434 の `onRepeatConvertFailed` に reason `"update"` を足して toast（文言 = 「前の設定のままです」）
- **見送り 2 件**（理由付きで Issue #469 に記録・起票依頼を outbox へ）: scope 編集後の template 更新（`useScheduleMutations.ts:807` — await していない）と routine 未ロード時の `void updateRoutine`（同 492）。どちらも失敗の意味が「未来の生成が古い値になる」で、toast 1 行では復旧手順を伝えられない
- **ゲート**: shared vitest **154 files / 1279 pass**（main 比 +22 tests・`eventEditorPane.test.tsx` に日付 / 終日 / ヒントの 6 ケース追加）・shared build・web build・web lint すべて exit 0。実ブラウザ検証は chat-main に残す

### 2026-07-30 - #466 Step 5-b Calendar グリッドの繰り返しフィルタ（PR #480 merge 済み・main `9ff4a813`）

#### 概要

グリッドから繰り返し由来（routine 生成）のアイテムを畳むトグルを入れた。粒度は **案 A「繰り返し由来を隠す」を採用し、案 B「この繰り返しだけ表示」を却下**。絞り込みは**永続化しない**（起動時に骨組みの無いカレンダーが出ると、空いて見えるスロットに二重予約する事故になる）。

#### 変更点

- **フィルタは view 層だけに掛ける**: 新設 `shared/src/utils/scheduleGridFilter.ts` の `applyRepeatFilter` を `gridRangeItems` として 1 箇所で適用し、`rangeItems`（`useVisibleRangeItems` の楽観ストア）は素のまま残した。`selected` / mutation 層 / コンテキストメニューはすべて `rangeItems` を引くので、**隠しても編集が書く内容は変わらず、隠れたアイテムは flow タブから編集できる**。差し替え先は `gridItems` / `monthItems` / `anchorDayItems` / `monthDayItems` の 4 つ
- **件数は同じ呼び出しから返す**: `applyRepeatFilter` が `{ visible, hiddenCount }` を返し、ツールバーのラベルはその `hiddenCount` を使う。**バッジとグリッドが別々に数えないので数字が食い違えない**。フィルタ OFF は同一参照を返す identity ケース（下流 memo が無駄に無効化しない）
- **「隠している」を隠さない**: ON 中はツールバーのボタン自体が「繰り返し N 件を非表示」＋ accent 表示になり（`aria-pressed`）、Repeats タブにも同じ state を読む注記と解除ボタンを出す。**フラグが 1 つなので「片方だけ更新されない」が構造的に起きない**。ON にした瞬間、選択中が routine 由来なら選択と popover を落とす（描画されない行を editor / popover が指し続けるのを防ぐ）
- **適用範囲を絞った**: rightSidebar の「今日の流れ」・Todo トレイ・完了集計はフィルタしない（集計の意味が変わるため）。Mobile はトグルを出さない（#467 で List + FAB に絞る側で扱う。derived は既にフィルタ後を読むので配線だけで足りる）
- **テスト**: `scheduleGridFilter.test.ts`（identity / 件数の一致 / null・未定義 routineId の生存 / 非破壊）+ `scheduleToolbar.test.tsx`（prop 省略で非表示 / `aria-pressed` / ラベル切替）。web にテストランナーが無いので判定は shared の純関数に寄せた
- **ゲート**: shared vitest **156 files / 1281 pass**（main 比 +2 files / +24 tests）・shared build・web build・web lint すべて exit 0。実ブラウザ検証は chat-main に残す

### 2026-07-28 - #411 Todo ボードを Materials から Schedule へ移設（PR #454 merge 済み・main `218d8dab`）

#### 概要

Materials を Notes / Daily の 2 タブに、Schedule を Calendar / Todo の 2 タブにした。「今日を組む場所」に組む材料（Todo）と組む先（カレンダー）を同居させる Epic #290 の構成再編で、rightSidebar の「本日の Todo」トレイは元から同じ task を読んでいたためデータ側は 1 本のまま。#408 が同じタブ構造を撤去した直後に足し直す順序（Issue の推奨）で進めた。

#### 変更点

- **導線の全数追随（実質の本体）**: 移設そのものは小さいが、Todo へ行く経路を 1 本でも取りこぼすと「タスクへ飛ぶ」が黙って死ぬ。4 本すべて追随 — nav ショートカット（`nav:tasks` / `nav:schedule` の**両方**がタブを明示 set。片方だけだと `nav:tasks` の直後に `nav:schedule` を押しても Todo に貼り付く）/ `[[link]]` の着地（`MATERIALS_TAB_FOR_ROLE` → `ITEM_NAV_TARGET` に変更し section+tab の組を返す。3 role が 1 セクションを共有しなくなったためタブ名だけでは行き先が決まらない）/ `global:new-task`（Schedule → Todo へ移動してから pending フラグ）/ コマンドパレット（Calendar / Todo の 2 エントリ追加。素の「Schedule」エントリは Materials 同様 sticky のまま）
- **Provider は再利用**: Kanban が要る TaskTree + WikiTags は**どちらも Schedule 側に既に居る**（カレンダーの task チップ用）ので、2 組目を入れ子にせず再利用した。task の持ち主がチップ・トレイ・ボードで 1 つになる。`persistSelection`（#282）はボードと一緒にその mount へ移した
- **narrow はハンバーガーを足していない**: Calendar / Todo の SegmentedControl だけを PageContainer header に出す。Calendar 本体は自前でハンバーガーを描いており、Todo 本体は 768px 未満で drawer を閉じる（モバイル Kanban は詳細パネルを持たない `MobileTaskList`）ため、置くと片方は重複・片方は空 drawer を開くボタンになる
- **型の置き場所を #408 前から変更**: `ScheduleTab` は `ScheduleScreen.tsx` が export し `MainScreen` が import する（switch する側と型を同居させる）
- **docs**: `mobile-scope.md` #4（narrow が Calendar 固定ではなくなった）と #6（materials / tasks → schedule / todo）。design brief は本文を履歴として残し materials.md 冒頭 + schedule.md の #408 注記に差分を追記。`taskSelector.emptyHint` の「Materials で Todo を作成」も両 catalog で修正。Epic #290 に 5-d として追記
- **検証**: shared test 153 files / **1257 tests**・shared build・web build・web lint すべて exit 0。**新規テストは無し**（変更は web/ のホスト配線で web に test runner が無く、shared へ出す判定ロジックでもない）。実ブラウザ検証は merge 後 chat-main（特に narrow の 3 段スタックと Todo タブでの Kanban の高さ）
- **PR を立てる前に自己レビューを済ませた**（#452 の再発防止）。push 直後に `gh pr list --json state,headRefOid` で local HEAD `cd36c25a` との一致を実測 — **が、その後の tracker 更新を push する前に #454 が merge され、`e395e5e0` が置き去りになった**（この worktree で 3 度目・通算 6 度目）。`origin/main` から `claude/schedule-411-tracker` を切って cherry-pick で回収（コンフリクトなし・docs のみなのでゲートは回していない）。**教訓の更新** = 予防策は「レビューを PR より前に」だけでは足りず、**tracker 更新まで含めて全部 commit してから PR を立てる**のが正しい形

### 2026-07-28 - #408 Routines タブ退役 + rightSidebar 繰り返し一覧（PR #452 merge 済み / QA 回収 = PR #453 も merge 済み）

#### 概要

Schedule のヘッダーから Routines タブを外し、繰り返しの編集を Calendar のアイテム編集パネルへ一本化した（Epic #290 Step 5-a）。編集パネル自体はユーザー指示どおり不変で、追加は rightSidebar の「繰り返し」タブ 1 つだけ。役割 QA が Blocking を 1 件返したが、その修正 push の前に PR #452 が merge されてしまい、置き去りコミットを PR #453 で回収している。

#### 変更点

- **設計判断（失われる操作 5 件の切り分け）**: 事前調査で挙げた 5 件のうち **(1) 空 routine の新規作成 / (3) テンプレの直接編集は意図的に退役**（(1) は CLAUDE.md §4「UI 上は Event + 繰り返し設定として提示し、Routine は実装詳細」、(3) は #279 の scope ダイアログが代替）。**埋めたのは (2) 到達性 / (4) テンプレ削除 / (5) order 俯瞰**。**(2)+(4) を落とすと実行日が 1 日も無い routine が永久に到達不能になる**（オカレンスが無いので Calendar から選べず、Routines タブも無い）— #407 のゾンビ 2 件が実在するので机上の穴ではない
- **新規**: `shared/src/components/schedule/RepeatListPanel.tsx`（純粋表示・全 routine を `order` 順）/ `nextRoutineOccurrence`。**null が「この行は飛び先が無い」の判定そのもの**で、その行はボタンにせず span にする（#434 S-1 と同じ「押しても何も起きないコントロールは壊れて見える」原則）が削除ボタンは残す
- **退役**: `RoutinesTab.tsx` / `RoutineEditorForm.tsx` + 型 3 種 + その test / i18n 4 キー（`scheduleScreen.routines`・`newRoutine`・`selectHint`・`tabDetail`）。`ScheduleTab` 型・`scheduleTab` state・タブ帯・`handleBriefingNavigate` も撤去し、Schedule のヘッダーは他セクションと同じ `SectionHeader title` 経路へ。**`useRoutinesAPI.createRoutine` は残した**（UI 呼び出しゼロでも DataService 層の API であって死んだ UI コードではない）
- **role-qa アドバーサリアルラウンド = B 1 / S 4 / N 4。引用 4 件を自分で spot check して全て実在を確認**（`rules/docs-consistency.md` §5）。**B-1 は #408 の主目的そのものが未達だった**: カレンダーのナビゲーションは範囲を**取得するだけ**で occurrence を生成しないため、開始日が未来の繰り返しは一覧に「次回 9月1日」と出てクリックできるのに飛び先が空で、編集する対象が存在しない。`handleOpenRepeat` がジャンプ後に `ensureRoutineItemsForDateRange(next, next, [routine])` を打ってから `reload()` するよう修正
- **S-1** = 行のゴミ箱 1 クリックで系列全体（完了済みの過去分含む）が消え、undo は routine 1 行しか戻さない → 行内に 2 段確認。**S-2** = `deleteRoutine` が失敗しても無言（一覧から行だけ消え occurrence は全部残る）→ 戻り値に `landed` を足して toast。**S-3** = `nextRoutineOccurrence` が頻度しか見ておらず archived な routine に飛び先が出ていた → `routineScheduleSync.ts` へ移して `shouldCreateRoutineItem` を呼ぶ（判定の二重定義を解消。逆向き import は循環になるのでこの向きしかない）。**S-4** = docs 退役 sweep（tier-1-core / 再設計プラン / design brief）
- **置き去り再発（この worktree で 2 度目・通算 5 回目）**: PR #452 を出してから role-qa を起動したため、監査修正 `d6cff838` を push した時点で既に merge 済みだった。`origin/main`（`e503f328`）から `claude/schedule-408-qa-recover` を切って cherry-pick（コンフリクトなし）→ PR #453。**予防策は「PR を立てる前にレビューまで済ませる」の一点**
- 検証 = shared vitest **153 files / 1257 pass**・shared build・web build・web lint すべて exit 0（PR #453 のブランチ = 動いた main の上で再実行）。Epic #290 の Step 5 は 5-a / 5-b / 5-c に内訳を分け、5-a のみ #408 に紐付け（チェックは付けず）

### 2026-07-28 - #434 繰り返し変換の pending 表示・失敗 toast とガードの shared 切り出し（PR #450）

#### 概要

#423（#407）の role-qa 監査で残した follow-up 2 件を実装した。「見送り可」扱いだった 2 も実装している — 1 の実装でガードに描画用の state ミラーが増え、ref と state がずれると「ずっと変換中のまま」か「一度もロックされない」のどちらかに化けるため、テストで固定する価値が新たに出たため。

#### 変更点

- **黙って捨てられていた 2 つの経路**: #407 の in-flight ガードは変換中の 2 回目の頻度クリックを無言で捨て、条件付き attach が reject したときもエディタが reload で「なし」に戻るだけだった。どちらも操作した側からは「押しても無反応」と区別が付かない
- **`FrequencyEditor` に `pending`**（`shared/src/components/schedule/FrequencyEditor.tsx`）: セグメント / 曜日チップ / interval 数値 / 開始日入力を一括 disabled、節に `aria-busy`、頻度ラベルの右に `role="status"` で理由を表示。`labels.converting` は optional なので Routines タブ（`RoutineEditorForm` 経由）は無変更で通る。`SegmentedControl` には対になる `disabled` を追加し、ポインタとキーボード（`stepSegmentFocus`）の両方を no-op に
- **失敗 toast**: `useScheduleMutations` に `onRepeatConvertFailed` を注入し `convertEventToRoutine` の catch で発火 → `CalendarTab` が `showToast("danger", ...)` に配線（#376 `noteAttachFailed` と同契約）。i18n は `scheduleScreen.repeatConverting` / `repeatConvertFailed` を en・ja 両 catalog へ
- **ガードを shared へ**（新設 `shared/src/hooks/useInFlightGuard.ts`）: 肝は **`begin(id)` が check と claim を 1 呼び出しに畳む**こと。「has で見てから add する」2 文に戻せないので、#407 を生んだ check-then-act の隙間を呼び手が再導入できない。**同期の ref が権威で state は描画専用のミラー** — 2 クリックは同じ tick に届きうるので、バッチされる state 書き込みでは 2 個目を素通しする。`inFlightIds` は 1 レンダー遅れうるため書き込み経路の分岐に使わない旨をコメントで明示した。`begin` が true を返したら `finally` で必ず `end` する責務は呼び手側（漏らすとそのセッション中ロックされたまま）
- **テスト**: `frequencyEditor.test.tsx` に pending 4 本、新設 `inFlightGuard.test.ts` に 5 本（**同一 `act` 内の二重 claim を拒否** = 二重クリック相当 / id 独立 / 描画ミラー / 未 claim の `end` は no-op / claim が同期で見える）
- **role-qa アドバーサリアルラウンド（Stop hook ゲート・別コンテキスト・2 コミット目 `69ca32e6`）**: B=0 / S=2 / N=4 で **S 2 件とも修正**（N-4 も取り込み）。**S-1 は自分が入れた退行** = 本物の `disabled` で節をロックすると focusable が 1 つも無くなり、キーボードでセグメントを押した瞬間フォーカスが `<body>` へ退避して戻らない。セグメント / 曜日チップを `aria-disabled` + ハンドラ無効化に、入力を `readOnly` に変更した。**ここで先例をそのまま真似なかった** — QA が挙げた `Menu.tsx:185` / `ItemActionRow.tsx:34` は `disabled` と `aria-disabled` の**併用**だが、あれはメニュー項目で個別に無効化される前提。tablist は roving tabindex を持ち全 segment が同時にロックされるため、併用だと節から focusable が消える。S-2 = `ensureRoutineItemsForDateRange` の reject が `void` された promise の外へ抜け、unhandled rejection になったうえ `reload()` をスキップしていた → catch し、`reload()` を `finally` へ移して**どの出口でもちょうど 1 回**再読込に。この経路は**繰り返し自体は成立している**ので「設定できませんでした」は嘘になる → `onRepeatConvertFailed(reason: "attach" | "materialise")` に変え `repeatMaterialiseFailed` を追加
- **検証**: shared vitest **151 files / 1234 pass**（main 比 +25）、shared build / web build / web lint すべて exit 0
- **スコープ外にした観察**（PR 本文に記載・未起票）: 同じ「黙って失敗する」型が系列パス（既に routine が付いたアイテムの頻度変更）にはまだ残る（`useScheduleMutations.ts:516` の `if (!landed) return;`）。本 Issue の DoD は変換時の attach reject に限定されているので触っていない

### 2026-07-28 - #433 置き去りコミットの回収（PR #435）+ #408 の事前調査

#### 概要

PR #423（#407）の merge **直後**に push した role-qa 修正 2 コミットが main に届いていなかった（#433）ので、`origin/main` から新ブランチを切って cherry-pick で回収し PR #435 を出した。あわせて、merge 待ちで次タスクに着手できない時間を使って #408（Routines タブ廃止）の事前調査を読み取りのみで実施した。

#### 変更点

- **回収の実測**: `git branch -r --contains a873e583` の結果が `origin/claude/schedule-407-repeat-desync` **のみ**で、置き去りが事実であることを確認してから着手。`origin/main`（`415cb185`）から `claude/schedule-433-recover` を切り、`a873e583`（コード）→ `52b6d081`（tracker）の順に cherry-pick。**両方ともコンフリクトなし**。差分は Issue #433 の実測（対象 7 ファイル・174 insertions / 75 deletions）とコード部分が一致し、per-chat tracker 3 ファイルが上乗せされた形
- **着地前 main の実害**: #423 で頻度判定を fail closed（不正な設定は発火しない）にした一方、`FrequencyEditor` の date input が**クリア時に空文字を emit する**経路が main に残っていた。空文字は fail-closed 下で「発火しない」と読まれるため、**開始日をクリアすると reconcile が未来行を掃除する**退行が起きうる状態だった。DoD の `seedFrequencyPatch` が `if (!start)` になっていることを `routineFrequency.ts:115` で実測確認
- **検証**: shared vitest **149 files / 1209 tests 全 pass**、shared build / web build / **web lint** すべて exit 0。web lint はこの worktree で長らく `NotesView.tsx:291` の main 由来 error で赤だったが、今回 origin/main `415cb185` では**再現しない**（引き継ぎメモを訂正済み。どの PR で消えたかは未追跡）
- **#408 事前調査（実装ゼロ・読み取りのみ）**: Routines タブを廃止して Calendar の編集パネルへ一本化したときに**失われる操作 5 件**を特定（空 routine の新規作成 / 全 routine への到達性 / scope ダイアログを挟まないテンプレ直接編集 / テンプレ単位の直接削除 / `order` 順の俯瞰）。加えて reconcile 窓の挙動差（RoutinesTab は今日から 41 日固定 `RoutinesTab.tsx:49`、CalendarTab は可視範囲 `useScheduleMutations.ts:497`）と、道連れ退役候補（`RoutineEditorForm` + 型 3 種・`createRoutine` の UI 呼び出し・i18n 7 キー）を grep 実測で洗い出した。詳細は memory の「予定」節。**サブエージェント報告の file:line は `RoutinesTab.tsx:49` / `ScheduleScreen.tsx:21` / `CalendarTab.tsx:1117` 等を spot check して実在を確認済み**（`rules/docs-consistency.md` §5）
- **#411 の下ごしらえ**: `setMaterialsTab` の呼び出し箇所を `web/src/MainScreen.tsx` で全数 grep（`:246` / `:269` / `:289` / `:318` + タブ定義 9 箇所）。取りこぼすとタスク導線が全部死ぬ箇所なので memory に位置を残した
- **残**: PR #435 の merge（🛑 ユーザーゲート）。着地後に `claude/schedule-407-repeat-desync` を削除し、#434 → #408 → #411 へ進む

### 2026-07-27 - #407 繰り返し表示の不整合 — malformed interval の毎日発火とゾンビ routine を根絶

#### 概要

「繰り返しを『なし』にしたのにアイコンが出続ける / Calendar の重複・欠落が不安定」（#407・Fable 5 指定）の Root Cause を DB 実測（Supabase MCP・SELECT のみ・DML/DDL ゼロ）とコード読解で特定し、fail-closed 化 + 二重変換ガードで修正。PR #423（merge は 🛑 ユーザーゲート）。再現手順と Root Cause 全文は Issue #407 のコメント（`#issuecomment-5089420957`）。

#### 変更点

- **Root Cause（実測）**: live routine「新規予定」が **2 本**（2026-07-16 に 6 秒差で作成）。うち `routine-3c4a1f09` は `interval` 型なのに `frequency_interval` / `frequency_start_date` が NULL で、`shouldRoutineRunOnDate` が malformed interval を `true`（= **毎日発火**）に degrade するため、アプリを開いた日（7/16・7/19・7/26・7/27）ごとに繰り返しアイコン付きの「新規予定」を生成していた。「なし」の detach が切れるのは表示中アイテムが指す 1 本だけなので、もう 1 本が翌日また産む — 症状 1・2 の両方がこれで説明される（DB の行自体は破損なし: 削除済み routine を指す live 行 0 件・partial UNIQUE 違反なし。描画判定 `CalendarTab.tsx` の `isRoutine` も無罪）
- **二重変換レース**: `handleChangeRepeat` の手動→変換分岐は `selected.routineId == null` で判定するが、変換 + 楽観 patch の反映が非同期（range refetch による clobber もあり得る）ため、2 回目の頻度クリックが同じ種イベントを再変換できる。attach は無条件 UPDATE の後勝ちなので、負けた routine が誰からも参照されないまま live に残る（ゾンビ生成経路）
- **修正 1 `shared/src/utils/routineFrequency.ts`**: interval の malformed 設定（NULL/0/負値 interval・開始日なし）は **fail closed（発火しない）**。`default` 分岐（Issue 017 の暴走生成ガード）と同じ思想。既存ゾンビも DML なしで発火が止まる
- **修正 2 `shared/src/services/SupabaseDataService.ts`**: `convertEventToRoutine` の attach を「種がまだ未 attach のときだけ」（`.is("routine_item_id", null)` + 影響行読み戻し）の条件付き UPDATE に変更。負けた変換は routine をロールバックして reject（`DataService.ts` の契約コメントも追随）
- **修正 3 `web/src/schedule/useScheduleMutations.ts`**: `convertingSeedsRef`（in-flight ガード）で変換中の種への追加頻度クリックを無視
- **回帰テスト**: `routineScheduleSync.test.ts` に fail-closed 5 分岐（NULL/0/-2 interval・NULL/空文字開始日 — 旧「degrade to true」テストを反転）、`convertEventToRoutine.test.ts` に条件付き attach の `.is()` フィルタ検証 + already-attached 時のロールバック/reject
- **role-qa アドバーサリアルラウンド（Stop hook ゲート・別コンテキスト・2 コミット目 `a873e583`）**: B-2 採用 = `FrequencyEditor` の date input が空文字を emit し、fail-closed 化で「開始日クリア → reconcile が未来行を掃除」に化ける退行 → 空 emit 抑止 + `seedFrequencyPatch` の "" 補修 + テスト 2 本。S-1 = routine 不在 fallback（Calendar / Routines 両導線）に seeding を配線。S-2 = 変換 rollback の supabase-js 非 throw 失敗を `logServiceError` で可視化。S-3 = ガード解放を try/finally 一本化。S-5 = attach 0 行時の文言に missing-seed を含める。N-1 = plan doc Worklog 追随。**B-1「fail-closed は既存ゾンビを止められない」は DB 実測で反証**（`3c4a1f09` は #352 seeding 導入前の malformed。現行コードの敗者双子は条件付き attach がロールバックで殺す）。S-4 / S-6 は follow-up として outbox で起票依頼
- **検証**: shared vitest 145 files / 1175 pass（+2）、shared build / web build / web lint 全て exit 0
- **残**: merge 後にユーザーが Routines タブから「新規予定」routine 2 本（`3c4a1f09` / `b15eb258`）を削除（生成済み si- 行は cascade で掃除）。実ブラウザ検証は chat-main（§7.4）

### 2026-07-27 - #367 Schedule サイドバーのソート・フィルタ = 見送りで決着（実装ゼロ）

#### 概要

#283（Notes / Daily の rightSidebar ソート・フィルタ）の follow-up として起票された #367 を、**導入しない**判断で close した。共有部品 `SidebarListControls` は既にあるが、「部品があるから付ける」ではなく実際に使う場面があるかで判断せよ、というユーザー指示に沿ってコード実測 + 本番 DB 実測を根拠にした。コード変更ゼロのため PR なし。根拠は Issue コメントに全文を残し、再オープン条件も併記した（判断を残さず閉じない）。

#### 判断の根拠（4 点）

- **Issue の前提が実装とズレていた**: Routines タブの rightSidebar は `RoutineEditorForm`（選択中 1 件の編集フォーム）だけで、**リストが存在しない**（`web/src/schedule/RoutinesTab.tsx:200-221`）。ルーチン一覧は main area 側（同 `:168-194`・`order` 昇順）。`SidebarListControls` は自身のヘッダコメントで「sized for a ~240px sidebar」と宣言している部品なので、幅の広い main area の一覧に載せる対象ではない
- **Calendar サイドバーの 2 リストは当日スコープ**: `AgendaList`（今日の流れ）と `TodayTodoTray`（本日の Todo）はどちらも毎日リセットされる。#283 が対象にした Notes / Daily は逆に**積み上がるアーカイブ**（Daily は毎日 1 件増える）で、「過去から探す」局面が実在する — 性質が違う。本番 DB 実測（`events_payload` × `items_meta`）で **events は 1 日あたり最大 3 件・平均 1.5 件**、routines live 3 / tasks live 5（比較: notes 9 / dailies 6）。最大 3 行のリストの上にソート選択 + フィルタ欄を積むと、操作 UI のほうがリスト本体より背が高くなる
- **並び順の反転は「好み」ではなく機能破壊**: `AgendaList` の now-line は `findIndex(startTime >= nowMinutes)` で挿入位置を決めており**昇順ソート済みが前提**（`shared/src/components/schedule/AgendaList.tsx:98-104`）。direction toggle で desc に倒すと線が過去側に描かれる。「今日の流れ」は時系列であること自体が機能なので方向を選ばせる意味がない
- **フィルタが効きそうな唯一のリストは既に別導線でカバー済み**: 日スコープでない pool は `pickAddableTasks`（未スケジュール・未完了の leaf task / `shared/src/utils/todayTodo.ts:25-38`）だけだが、**同じ pool を使う `ItemCreatePanel` のタスクタブには既に検索欄がある**（`shared/src/components/schedule/ItemCreatePanel.tsx:311, 436-442`）。live task 5 件の現状で 2 つ目の検索 UI を足す理由がない

#### 変更点

- **Issue #367**: 上記を根拠コメントとして投稿（`#issuecomment-5088740620`）→ `NOT_PLANNED` で close。再オープン条件も明記 =「タスクから追加」の候補が常時 20 件超で tray が縦スクロールするようになったら `TodayTodoTray` に **filter だけ**（sort 不要）を載せる / Routines の一覧が rightSidebar へ移設されたか 20 件を超えたら再検討
- **コード変更なし**: `SidebarListControls` は #283 のまま存置（Notes / Daily が使用中）。ブランチ `claude/schedule-367-sidebar-controls` は `origin/main` から作成したが、実装差分はゼロで本 tracker 更新のみを載せた
- **副産物の実測**: PR #400 が merge 済み・Issue #376 が close 済みであることを `gh pr list` / `gh issue view` で確認し、前セッションから持ち越していた「#400 OPEN」の進行中ブロックを完了へ確定した

### 2026-07-26 - #376 統合アイテム生成パネル（Step A merge / Step B レビュー待ち）

#### 概要

Schedule の生成パネルを予定専用フォームから 予定 / タスク / ノート の 3 タブに拡張した。ノートは時刻を持たないため 3 つ目の作成対象にはせず、作られる予定・タスクへ紐づく「添付」として実装（ユーザー決定 2026-07-26）。Step A = PR #393 merge 済み、Step B = PR #395 レビュー待ち。

#### 変更点

- **新部品 `ItemCreatePanel`**: `EventCreateFields`（#299）を置換し、Desktop 生成オーバーレイと Mobile QuickCaptureSheet の両方が同一パネルを描く。タイトルと時刻の下書きは種類タブを跨いで共有（途中で「予定じゃなくタスクだ」と気づいても打ち直しにならない）
- **タスクタブ**: 「新規作成」= `addNode("task", null, title, { scheduledAt, scheduledEndAt, isAllDay:false })`、「既存から選ぶ」= `pickAddableTasks` プールを部分一致検索 → `updateNode` で同じ配置。Schedule にタスク詳細エディタが無い（#297）ため「追加して詳細へ」の相方は置かない
- **ノートタブ（添付方式）**: 新規作成 or 既存選択を staged し、submit の 4 番目の引数 `ItemCreateNoteDraft | null` として渡す。ホストが新規なら `createNoteUnified` → `createItemLink(itemId, noteId)`（向き = アイテム → ノート・DailyView と同型）。パネルは直前の 予定 / タスクタブを `target` として保持するので、ノートタブを開いてもフッターの submit が死なない
- **実測に基づく設計判断**: `ScheduleItem.noteId` は型にあるが `SupabaseDataService` が `void noteId` で捨てる（events↔notes は列ではなくリンク）。よって item link モデル一択
- **ノート一覧の取得**: `web/src/schedule/useCreatePanelNotes.ts` がパネルを開いている間だけ `listNotesUnified()` で引く。`NotesUnifiedProvider` は本文 hydration とゴミ箱まで抱えて Realtime のたび走り直すため、タイトルだけの picker には常時コストが重い
- **共通化**: task / note の picker を `PickerList` に集約。選択は現在の検索結果を通して解決するので、絞り込みで消えた行は選択も外れる（見えないものを操作しない）
- **docs**: `plans/2026-07-14-schedule-redesign.md` §4.6 に #298 トレイとの棲み分け（宣言 vs 配置）とノートタブの設計判断を明文化。§2-4 の `schedulePanel.*` 記述に「#341 で削除済み」の歴史注記
- **i18n**: `scheduleScreen.*` にタスク系 + ノート系キーを en/ja 追加、`taskSource*` → `source*` に改名、孤立した `quickAddTitle` を削除。`generateId` を shared のルート export に追加
- **検証**: shared vitest 143 files / 1141 pass、shared・web の `tsc -b` と vite build 全て exit 0。web lint は既存 1 件（`NotesView.tsx:268`）のみ。DDL ゼロ
- **運用上の事故と回収**: PR #393 が Step B の push 前に merge されたため、Step B を `origin/main` から切り直した `claude/schedule-376-note` に cherry-pick して PR #395 に分離。衝突は `shared/src/index.ts` の隣接追加 1 箇所（#371 の `pendingItemLinks` export）のみで、両方残して解消

### 2026-07-26 - #299 follow-up 3 本（#353 / #354 / #355）+ main ビルド復旧

#### 概要

#352 に続けて #299 の follow-up 3 本を 1 Issue = 1 ブランチ = 1 PR で提出。途中で **main の `shared` が型検査を通らない**ことを発見し、ユーザー判断で復旧のみの別 PR を先出しした。各 Issue とも role-qa 独立監査を通し、Blocker 0 / Should は同 PR 内で解消。

#### #353 生成パネルに対象日を表示（PR #382）

- `EventCreateFields` に読み取り専用の日付行（`dateLabel` prop）。Desktop オーバーレイと Mobile QuickCaptureSheet が同部品を使うので 1 箇所で両方に出る。整形はホスト（対象日 + ロケールの保有者）が `Intl.DateTimeFormat` で行い、年も含める（月をまたいで移動した先で開くため）
- 生成の入口 3 経路（ツールバー / 空きスロット / 月セル）が全て `openCreatePanel` を通ることを実測で確認
- i18n `scheduleScreen.date`（en/ja）。role-qa: 日付が `YYYY-MM-DD` をローカル解釈しているか（UTC 解釈だと TZ で 1 日ずれる）を実測確認 → PASS。Should 1 件（`dateLabel` の JSDoc が型的に存在し得ない「legacy host」に言及）を修正

#### #354 生成後に新規アイテムを開く導線（PR #384）

- **プロダクト判断はユーザーがチャットで直接選択**（3 案提示 → 押し分け方式）。生成パネルを「予定を追加」/「追加して詳細へ」の 2 ボタンに
- **Mobile のプレーン作成はあえて何も選択しない**: Mobile は選択＝詳細シート表示（`editorPane` が `selected` から算出）なので、選択すると 2 ボタンが同じ動きになる。Desktop は選択リングのみ（ただし MonthGrid は `selectedId` を受け取らない部品なので月ビューはマーカー無し — role-qa 指摘で コメントを実態に合わせた）
- Enter はプレーン作成のまま（速い経路を速いまま保つ）。i18n `scheduleScreen.addEventAndOpen`（en/ja）

#### #355 ダブルクリック時の吹き出しフラッシュ抑制（PR #386）

- 原因はブラウザのイベント順（click → click → dblclick）で、1 クリック目では判別不能。**吹き出しだけ 350ms 待たせ**、ダブルクリック側が取り消す。選択は即時のまま
- 当初 200ms → role-qa 指摘（Windows のダブルクリック閾値 500ms に対し 200-500ms 帯でフラッシュが残る）で 350ms に。400ms 超は反応が鈍く感じ始めるため手前に置く
- 取り消しは **effect 1 本に集約**（当初は詳細 / 右クリック / 生成パネルに個別実装 → role-qa がカレンダー管理モーダルと繰り返し範囲ダイアログの 2 経路漏れを指摘。開く場所が本ファイルと mutation 層に散っており個別方式では次に増えたとき必ず漏れる）
- 仕組みは `shared/src/hooks/useDeferredAction.ts`。**web にテストランナーが無い**ためホスト内 ref ではなく shared のフックにしてテスト可能化（7 ケース）

#### main のビルド復旧（PR #385・キュー外）→ **重複で空マージ。診断も誤っていた**

- **事象**: `shared` がクリーンビルドで 6 エラー。`analyticsAggregation.ts` が `../types/wikiTag` から `WikiTag` / `WikiTagAssignment` を二重宣言し、実使用中の別名 `WikiTagUnified` / `WikiTagAssignmentUnified` が消えていた（未使用の `WikiTagConnection` も混入）。原因は `d80e9fc6`（PR #378 / #356）の squash merge で、主題（`todayCalendarKey` への置換）と無関係な import 群が書き換わった事故
- **修正内容自体は正しかった**（別名 import を戻す 3 行入れ替え。#378 の他の変更には触れず）。role-qa も型・呼び出し側・実データ形状の一貫性を実測して PASS
- **しかし PR #385 は不要だった**: **#383（`eb893f94`, 11:29）が既にバイト単位で同一の修正**を入れており、11:49 作成の私の PR は差分ゼロで squash merge された（`fe8f0362`）。着手前に `git fetch origin` していれば気付けた（CLAUDE.md §7.4 はブランチ作成のたびに効く）
- **根本原因の診断も誤っていた**（role-qa の監査で判明・memory と outbox を訂正済み）: 「`tsc -b` が増分だから見逃された」と書いたが、**`web/package.json` の build は最初から `tsc -b --force`** で references 経由の shared をフルチェックしている。同セッションの #353 / #354 が緑だったのは増分のせいではなく、**分岐元 main がまだ壊れていなかった**だけ（`git merge-base` で実測可）。壊れた版はどのブランチにも存在せず**マージ後の main にだけ現れた**ので、手元の検証をいくら厳しくしても捕まらない。実効的な対策は「マージ後の main でビルドを回すゲート」であり、当初 chat-main に依頼しかけた「検証時は `--force` を明文化」は的外れだった

#### 検証

- shared クリーンビルド（`*.tsbuildinfo` 削除 → `tsc -b --force`）exit 0 / vitest **1110 pass**（140 files）/ web build exit 0 / `web` eslint は変更ファイル単体で 0 指摘
- 既知の赤: `cd web && npm run lint` は `web/src/notes/NotesView.tsx:291` で 1 error（main 由来・変更範囲外・chat-main へ起票依頼済み）

#### 申し送り（outbox → chat-main、起票依頼 3 件）

- `NotesView.tsx` の lint error（main 由来）
- Mobile 月表示で FAB が `mobileSelectedDay` ではなく `anchorDate` に作る（#353 以前からの挙動だが日付表示でズレが可視化される）
- 生成直後の楽観行が同期リフェッチで消えると、開いたばかりの詳細エディタが閉じる（#354 が「作ってすぐ書き足す」を推奨導線にしたため露出面が拡大）

### 2026-07-26 - #352 Epic #290 Step 4: Routine 頻度編集の未来伝播（reconcile 配線）+ dead code / RoutineGroup 削除

#### 概要

Routine の**頻度**を変えても materialise 済みの未来 occurrence が古いリズムのまま据え置かれる穴を埋めた（テンプレ更新は「これからの生成」にしか効かないため、発火しなくなった日に予定が残り、新たに発火する日は空のままだった）。`reconcileRoutineScheduleItems` を Calendar のイベント詳細 + Routines タブの両導線に配線し、競合ルール（tier-1 §Schedule 1-3）を vitest で pin。あわせて未配線 dead code と RoutineGroup を撤去（**DDL ゼロ**）。role-qa 独立監査で Blocker 1 + Should 3 を受け同 PR 内で修正。**PR #381**（`Closes #352`・merge は 🛑 ユーザーゲート）。

#### 変更点

- **reconcile 本体** (`shared/src/hooks/useScheduleItemsRoutineSync.ts`): 掃除フィルタを競合ルール準拠に改修 — done / dismissed / 過去 / 手動移動（`source_date` ドリフト）に加え、**編集前テンプレート（title / startTime / endTime）と不一致 = 手動編集**の行を除外（時刻 null は生成デフォルト 09:00-09:30 を実効値として比較 = #279 と同じ規則）。生成側は `collectRoutineItemsForDates` に委譲して deleted/archived/hidden ガードを継承 + 過去日への materialise 禁止。書き込みゼロなら `onChanged` 不発火。`group` 引数を廃し `(routine, dateRange?, template?)` に
- **配線** (`web/src/schedule/useScheduleMutations.ts` / `RoutinesTab.tsx` / `ScheduleScreen.tsx` / `CalendarTab.tsx`): 繰り返し設定の編集で テンプレ更新 → reconcile → reload。窓は Calendar = 表示中の範囲 / Routines タブ = 今日から 6 週間（月グリッド最大幅・同タブは可視範囲を持たないため）
- **削除**: 未配線 3 関数（`ensureRoutineItemsForWeek` / `backfillMissedRoutineItems` / `syncScheduleItemsWithRoutines`）+ 唯一の消費者を失った `fetchLastRoutineDate` + `diffRoutineScheduleItems` の `toUpdate`（#279 で適用停止済み）+ RoutineGroup 一式（型 / mapper 2 / DataService 6 メソッド / Supabase サービス 2 クラス / `buildGroupForRoutineMap` / FrequencyEditor の group UI / i18n 2 キー / 関連テスト）。**-2337 / +454 行**
- **DDL ゼロの帰結**: テーブルと 0008 CHECK の `'group'` が残るため、`normaliseFrequency`（routineMapper）が legacy 行を「発火しない routine」に正規化する（throw させると 1 行で Routine 一覧全体が壊れる）。`REALTIME_TABLES` も publication 完全一致の不変式（`syncRealtimeTables.test.ts`）があるため 2 テーブルを維持 — **一度外して落としたので戻した**
- **role-qa 対応** (`fe79fc6d`): **B-1** セグメント切替は `{ frequencyType }` 単体で届くため「曜日」直後は発火ゼロ / 「N日ごと」直後は毎日発火の中間状態になり、reconcile 配線によりこれが即破壊的操作化していた（曜日を選ぶ前にシリーズの未来が一掃される）→ 純粋関数 `seedFrequencyPatch` で補完。あわせて `fetchScheduleItemsByRoutineId` が日付フィルタを持たない事実に対し**掃除範囲を再生成範囲と対称化**（無制限掃除 → `dateRange` 内に限定）。**S-1** Routines タブ未配線を配線。**S-2** `updateRoutine` を `Promise<boolean>` 化し、テンプレ更新失敗時は reconcile 中止（ねじれ防止・既存の fire-and-forget 呼び出し側は無変更）。**S-3** reconcile の JSDoc が「bulkCreate の upsert が吸収」と書いていたが実装は plain INSERT + 事前 pre-check（衝突は 23505 でバッチ全体ロールバック）で真逆 → 実体に訂正。**S-4** rule 2 が memo を見ない点を tier-1 に明記
- **docs**: tier-1-core.md（Routine 変更の反映 / backfill / 競合ルール 2 / AC2 — **AC2 は `[x]` を撤回して未達に戻した**: Routines タブに時刻の系列伝播経路が無いため）/ plans Step 4 を ✅ + Worklog 2 本 / briefs schedule.md の RoutineGroup 行
- **検証**: shared `tsc -b` + vitest **1066 pass**（135 files）/ web `tsc -b --force` + vite build green。新規 `shared/tests/reconcileRoutine.test.tsx` + `seedFrequencyPatch` 6 ケース + `normaliseFrequency` 3 ケース。`supabase/` 差分 0 件
- **既存問題の申し送り**: `cd web && npm run lint` が `web/src/notes/NotesView.tsx:291` で 1 error。**当該ファイルは origin/main と同一**で本件スコープ外 → outbox で chat-main へ起票依頼

### 2026-07-25 - #299 アイテム操作 UI 刷新（生成パネル化 + 吹き出し + 詳細オーバーレイ）

#### 概要

Schedule のアイテム操作を「1クリック=吹き出し / ダブルクリック=詳細オーバーレイ / 右クリック=既存メニュー維持」に再編し、イベント生成をパネル化、rightSidebar の detail 編集タブを撤去した（flow/todo タブは温存）。前提部品 #307 itemActions（ItemActionPopover / ItemDetailOverlay / floating.ts）を merge 済み土台として消費。今回はイベント生成に絞り、task/note 統合パネルは将来 Issue（前回 outbox 起票依頼済み）。role-pm → role-engineer → role-qa（別コンテキスト独立監査 PASS・Blocking 0）のフルチェーン。

#### 変更点

- **塊0 グリッド配管**: WeekTimeGrid / MonthGrid / AgendaList に `onItemActivate(id,{x,y})` + `onItemDoubleClick` を追加。WeekTimeGrid は pointer-up の非ドラッグ分岐（`d.moved` false）でのみ activate 発火し #297 drag/resize と非衝突・座標は pointerup event から取得
- **塊1 吹き出し**: CalendarTab に popover state 追加、handleSelectItem を detail タブ遷移から ItemActionPopover 表示へ。概要 + 「詳細を編集」+ duplicate/delete クイック操作。Escape / 外側クリックで閉じる（floating.ts の IME ガード済み dismiss）
- **塊2 詳細オーバーレイ**: ItemDetailOverlay（Modal ラップ・不透明・focus trap）に既存 EventEditorPane を children としてホスト。ダブルクリック / 「詳細を編集」の両経路から開く
- **塊3 生成パネル化 + detail タブ撤去**: 新規 `EventCreateFields`（title/start/end 共有生成フォーム・IME ガード・prefill）を QuickCaptureSheet に内包。ツールバー「イベント追加」+ グリッド空きスロット + 月セルの 3 経路を生成オーバーレイ（Desktop）/ QuickCaptureSheet（Mobile）に統一・空きスロットはクリック時刻をプリフィル。#278 pendingDraft の eager-create を撤去し `handleCreate(date,title,start,end)` の送信時生成へ一本化。sidebarTab 型を `"flow"|"detail"|"todo"` → `"flow"|"todo"` に縮小し detailBody 削除（`tabDetail`/`selectHint` は RoutinesTab が消費中のため catalog 保持・CalendarTab 参照のみ除去）
- **i18n**: `scheduleScreen.editDetail` / `itemActionsLabel` を en/ja 追加
- **検証**: shared `tsc -b` + vitest **1115 pass**（140 files・新規 eventCreateFields 4 本）/ web `tsc -b --force` + vite build green。メイン独立実測でも一致（docs-consistency §5 spot check 済み）
- **follow-up（outbox 経由 chat-main へ起票依頼）**: N1 ダブルクリック時の吹き出し一瞬フラッシュ（cosmetic）/ N2 生成オーバーレイに対象日非表示（UX 改善）/ N4 生成後に新規アイテム未オープン（プロダクト判断）
- **PR**: `claude/schedule-refine` から提出（`Closes #299`・merge は 🛑 ユーザーゲート・実ブラウザ確認は merge 後 chat-main）

### 2026-07-20 - #296 消失バグ + #297 A-2 双方向書き込み（PR #309 同梱）

#### 概要

#296（Schedule アイテムが繰り返し操作周辺で消える）と #297（Step 2 / A-2: 予定済み task チップを drag/resize して `scheduledAt`/`scheduledEndAt` を書き戻す双方向連携）を実装。#296 の PR #309 が open のまま同ブランチに #297 を積んだため、ユーザー決定で **#309 を #296+#297 の 1 本に統合**した（`Fixes #296, #297`）。role-qa は両 Issue とも別コンテキストで PASS。

#### 変更点

- **#296** (`39b51c99`): `detachRoutine` に `keepItemIds`（編集中 occurrence をピン留め）/ 新設 `convertEventToRoutine`（seed を in-place attach・routine 作成→meta bump→attach 順で失敗時ロールバック・楽観 routine のリスト追加を await 後に遅延）/ 生成器の掃除を物理削除→ソフトデリート化・hand-moved 行（`date≠sourceDate`）除外 / `loadDateRange` throw 化 + visible-range 前回リスト保持 + retry バナー + `syncVersion` 再取得 / この予定のみ削除に「スキップ済み」+戻す UI。`events_payload.source_date`→`ScheduleItem.sourceDate`（read-only）を通した。vitest 3 本追加
- **#297** (`d80e0b96`): `taskCalendarChips` に純関数 `unwrapTaskChipId` + `localDateTimeToISO`（UTC→local 読み取りの逆変換・`24:00`→翌日`00:00`）追加 / `WeekTimeGrid` に `taskInteractive` prop（default false で A-1 読み取り専用維持）/ `useScheduleMutations` が task チップの move/resize を host コールバックへ委譲 / `CalendarTab` が `updateNode` で scheduled フィールドを書き両グリッドに `taskInteractive` 注入。純関数テスト 5 本追加
- **検証**: shared `tsc -b` + vitest **1069 pass** / web `tsc -b` + vite build green / web eslint 0 error（1 warning は非対象 `DebouncedTextInput.tsx` の既存分）
- **後追い**: 多日/overnight task を drag すると span が潰れる deferrable エッジ（A-1 の切り詰め描画 + `minutesToTime` 24:00 クランプ）を outbox で chat-main に Issue 起票依頼（Epic #290 配下）
- **PR 運用メモ**: `claude/schedule-refine` は long-lived ブランチで、open PR に次 Issue を積むと同梱される。厳密な 1 Issue=1 PR は「前 PR が merge されるまで次を積まない」運用が前提

### 2026-07-19 - section:schedule スプリント完了（#281 #278 #279 #280）

#### 概要

section:schedule の open Issue 4 件を実装 → 検証 → close した。#279 は範囲選択ダイアログ（この予定のみ/今後/すべて）+ Repeats 変換の可視化、#280 は CalendarTab の責務分離リファクタ（1740 → 994 行・behavior-preserving）。全段で QA アドバーサリアル監査を通し、shared 992 tests + shared/web build green。

#### 変更点

- **#281** (`0c4837c3`): 週ビュー hover 背景の除去 + Day ビュー背景の標準トークン化
- **#278** (`dcb57550`): 未保存 draft がある間のクリック新規生成防止（fetchedRange による自己修復ガード）
- **#279** (`3205cc5e`): RepeatScopeDialog 新設（i18n en/ja・Cancel 先頭フォーカス）/ `updateFutureScheduleItemsByRoutine`（競合ルール 1・2 準拠フィルタ・null テンプレはデフォルト時刻照合）/ 変換時の窓クランプ付き materialise / 生成器 creation-only 化 / 時刻入力 commit-on-blur / Modal Esc stopPropagation。docs 追随 = tier-1-core 競合ルール 5 + unification plan 補遺
- **#280 Stage A** (`3205cc5e` 後続): 純ドメインを shared/utils へ — scheduleLabels 移設・todayCalendarKey 統合（3 重実装解消）・calendarView 正規化/可視範囲・taskChipId/isTaskChip・makeOptimisticScheduleItem。全モジュールに vitest
- **#280 Stage B** (`0270728e`): CalendarTab を useCalendarNav / useVisibleRangeItems / useScheduleMutations に分割・QuickCaptureSheet を shared 部品化（IME ガードテスト含む）
- **運用**: outbox に routineFrequency の frequencyStartDate 無視問題（Step 4 候補）の起票依頼を append

### 2026-07-18 - #217 完了確定（PR #265 merge 取り込み）

#### 概要

PR #265（weekStartsOn prefs のカレンダー配線・Closes #217）の merge を origin/main から取り込み、tracker を完了へ確定した。実ブラウザでの表示確認は chat-main 側で実測する（§7.4 localhost 集約ポリシー）。

#### 変更点

- **git 同期**: `git pull --ff-only`（自ブランチ up to date）+ `origin/main` merge（briefing/notes/i18n 系の差分・衝突なし）
- **tracker**: 進行中を空にし、#217 を直近の完了へ移動。予定に schedule-redesign Step 2（Task↔Schedule 統合）の下調べを登録

### 2026-07-16 - #217 weekStartsOn prefs のカレンダー配線 (PR #265)

#### 概要

週の始まり（日曜/月曜）prefs をカレンダー描画に配線した。settings 側の保存 API が未実装だったため、#218（day-start-hour）と同じ分担で pref フック自体を shared に新設し、読み手（CalendarTab）まで配線して PR #265 を提出した（Closes #217・merge = 🛑 ユーザーゲート）。

#### 変更点

- **shared**: `hooks/useWeekStart.ts` 新規 — キー `life-editor-week-start`（"0"=日曜既定 / "1"=月曜）、`useWeekStartPref()` + 純関数 `parseWeekStart` / `getWeekStartsOn`（React 外読み手用・#218 の `getDayStartHour` と対）。index.ts から export
- **web**: `CalendarTab.tsx` — `startOfWeekKey` / `monthGridKeys` / `MonthGrid`（desktop + mobile）へ pref を配線（従来はハードコード 0）。`WeekTimeGrid` は day key からラベル導出のため props 不要（`weekStart` の補正だけで追随）
- **テスト**: `shared/tests/useWeekStart.test.ts` 新規（parse/read の純関数テスト）。shared vitest 113 files / 908 tests green・shared/web build green
- **運用**: Settings 書き込み UI は settings 領分のため未実装 — chat-main へ起票依頼を outbox に追記（#218 の day-start-hour UI 未配線も同 Issue に含める提案）。worktree 環境整備として node_modules install + `.claude/comm/.session-name`（schedule-refine）を作成

### 2026-07-12 - life-tags S3 完了確認 + #185 Step 3-4 外部完了の記録整理

#### 概要

materials-refine の S3（NodeType folder 除去・PR #244）の merge をこのレーンから実測確認し、schedule 側の無事故（build/test green）を検証した。また #185 Step 3-4 が別セッション（chat-schedule-event-routine・PR #245）で完了・#185 closed になっていたため tracker を整理した。

#### 変更点

- **S3 確認**: PR #244 merge・epic #225 closed・`NodeType = "task"` 単一値（残る "folder" は経緯コメントのみ — taskTree.ts / Kanban を grep 実測）。main 取り込み（衝突なし）後、shared build + vitest 884/884・web build green — schedule レーンに S3 起因の破壊なし
- **db push 事後**: 0015〜0021 適用済み・0021（calendars.tag_id + FK）・0020（変換 = 新規タグ 5 / assignment 1 / active folder 0 = 計画 §B-7 一致）を read-only SQL で検証済み（前セッション）
- **#185**: Step 3-4（Event 編集の繰り返しセクション + detachRoutine）は PR #245 で実装済み・#185 closed。残 Step 5（runtime 確認）/ Step 6（MCP 切り出し起票）は chat-main 領分 — 本レーンの予定から除去
- **次タスク**: open Issue #217（weekStartsOn prefs のカレンダー配線）が本レーンの唯一のキュー

- 2026-07-11: [途中] life-tags 統一 S2（CalendarView folder→life-tag rebind）— main merge・folder 依存の全数実測・Issue #231 起票・materials-refine へ案(a) life-tag バインド合意返信（outbox）。実装は合意確定後

### 2026-07-11 - life-tags 統一 S2: calendars の folder→life-tag rebind (#231, PR #239)

#### 概要

folder ノード廃止（life-tags 統一・epic #225）に伴う Schedule 側追随として、calendars の folder バインドを life-tag（WikiTag）直接参照に置換し PR #239 を提出した。materials-refine と outbox 合意済みの案 (a)。S1（PR #237）と独立に実装し、merge で S3（NodeType folder 除去）が解禁される。

#### 変更点

- **DB**: `0021_calendars_tag_rebind.sql` 新規（ローカル先行・🛑 ユーザー push ゲート）— `calendars_folder_id_fkey`（0008 §15 の items_meta 参照）+ `idx_calendars_folder` を drop、`folder_id` → `tag_id` rename（DO ガードで冪等）、`calendars_tag_id_fkey` → `wiki_tags(id)` ON DELETE CASCADE + `idx_calendars_tag`。本番 0 行のためデータ移行なし
- **shared**: `CalendarNode.folderId` → `tagId`（types/calendar・calendarMapper・useCalendarsAPI・DataService・SupabaseDataService）。tag_id は update 経路 immutable（rebind = 再作成）を維持し、whitelist 免疫テスト（scheduleMapper.test.ts）も新列名へ追随。sync.ts はドメイン型参照のみで自動追随
- **web**: CalendarView を folder select → tag select（`useWikiTagsUnifiedContext().allTags`・active のみ・未知/soft-deleted は id fallback + 作成ガード）。MainScreen の schedule 分岐から TaskTreeProvider 撤去（消費者ゼロを grep で確認・tasks 分岐は温存）。stale コメント刷新
- **監査**: role-qa PASS with findings（Blocking 0）/ migration-validator PASS（FK 系譜・冪等性・RLS/Realtime 無影響を確認）/ sync-auditor PASS（sync class 契約維持・列名直書きゼロ）。指摘反映 = 0021 コメント精緻化（INSERT 経路・dangling tag 注記）+ 免疫テスト差し替え
- **検証**: shared vitest 852/852・shared/web build pass。runtime 実測は merge 後 chat-main。**運用注意: 0021 の db push はコード merge より先（同時）・push 直前に calendars 0 行確認**

### 2026-07-11 - Schedule UX 3 件: status タグ / 右クリックメニュー / セルクリック→パネル (#222 #223 #224, PR #230)

#### 概要

ユーザー直接指示 3 件を Issue 起票(#222/#223/#224)→ role-engineer 2 体逐次実装 → role-qa 独立監査 → Important 指摘修正の流れで消化し、PR #230 を提出した。先行して #185 Step 2(FrequencyEditor)分を PR #221 として提出し、ユーザー merge 済み。

#### 変更点

- **#222 status タグ**: `deriveScheduleStatus`(shared/src/utils/scheduleStatus.ts)で時刻から 3 値導出(DB 変更なし = ユーザー決定)。`ScheduleStatusTag` 新設(未着手=グレー/着手中=青/完了=緑・`schedule-tag-*` 9 トークンを tokens.css に light/dark で追加)。AgendaList(丸チェック置換・タグクリックでトグル・aria-pressed 維持)/ EventEditorPane / WeekTimeGrid に配線。MonthGrid chip は幅都合で非適用
- **#223 右クリックメニュー**: `ScheduleItemContextMenu` 新設(portal・端クランプ・Escape/外側 close・lumen)。rename(インライン・IME ガード)/ duplicate / delete(ソフト)。WeekTimeGrid・MonthGrid に `onItemContextMenu` prop 追加。Desktop 限定
- **#224 セルクリック**: 月セル・アイテムクリックの `setView("day")` 撤去 → 作成(デフォルト時刻)+ rightSidebar 詳細パネル表示に変更。Toolbar の明示 view 切替と mobile 分岐は温存
- **QA Important 修正**: 複製時 memo の後追い UPDATE が create INSERT と競合し得る問題 → memo を `createScheduleItem`(DataService 層まで optional param)に畳み込み単一 INSERT 化。複製の undo も 1 回に
- **検証**: shared vitest 845/845(+26 新規)・shared/web build pass・eslint CalendarTab 0 warn。runtime 実測は merge 後 chat-main(localhost 集約ポリシー)

# HISTORY (chat-schedule-refine)

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

### 2026-07-11 - Layout Standard v2 adoption — schedule (#204)

#### 概要

v2 共通部品 merge 後の adoption として、Schedule の Calendar / Routines タブ帯を標準 SectionHeader（AppShell header slot）へ移行し、二重ヘッダー（標準タイトル行 + in-body タブ帯）と重複 rightSidebar トグルを解消した。担当 Issue 不在のため #204 を自分で起票してから着手（section:schedule 運用）。

#### 変更点

- **ScheduleScreen.tsx**: タブ state を props（`tab` / `onTabChange`）化し、in-body HeaderTabs + 自前 RightSidebarToggle を撤去。narrow は従来どおり常に Calendar（AppShell header slot は wide 専用 = v2 non-goal）
- **MainScreen.tsx（最小 diff・layout-standard へ outbox 告知）**: `scheduleTab` state 追加 + `sectionHeader` に schedule 分岐（Materials と同形の tabs パターン・divider={false}）+ ScheduleScreen への props 注入
- **i18n**: 撤去で未使用化した `scheduleScreen.openPanel` / `closePanel` を en/ja から削除（標準ヘッダーは `detailPanel.open/close` を使用）
- **orders 台帳**: v2 adoption 節を #204 実装済みに更新（全幅表示・パネル開閉位置の runtime 確認は chat-main 実測待ち）
- **検証**: shared tsc -b + vitest 803/803 pass・web tsc -b + vite build pass

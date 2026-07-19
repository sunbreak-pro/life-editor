# HISTORY (chat-schedule-refine)

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

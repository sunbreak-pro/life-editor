# HISTORY (chat-schedule-refine)

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

### 2026-07-11 - #183 close + #181 schedule 行 adoption (PR #191) + #185 詳細計画化

#### 概要

orders 台帳（2026-07-11-schedule-refine-orders.md）の「今すぐ着手可」3 件を消化した。#183 は #180 修正の実測確認で close、#181 schedule 行は gutter トークン化を PR #191 で提出、#185 は案 B（DDL ゼロの UI 統合）の詳細計画書を作成し同 PR に同梱（merge = 承認ゲート）。

#### 変更点

- **#183 close**: SegmentedControl 連結表示の解消を playwright で実測（desktop: 各セグメント独立幅 + 2px gap / mobile 390px: 3px gap・console error 0）。検証用アカウントは Sign up で即時作成できると判明（メール確認なし — user memory に知見保存）
- **#181 schedule 行**: `CalendarTab.tsx`（desktop/mobile wrapper）+ `ScheduleScreen.tsx`（Routines タブ wrapper）の rem ベース gutter 3 箇所を `px-lumen-gutter` / `md:px-lumen-gutter-wide` へ移行。shared test 768/768 pass（初回 15 fail は並行 worktree 負荷の 5s timeout フレーク・再実行で全 pass）
- **#185 計画書**: `plans/2026-07-11-event-routine-unification.md` 新規作成。Explore agent の実装マップを spot check の上で案 B を採択。mcp-server が全 handler 未移行（Supabase 接続なし）と実測判明 → MCP 移行の shared-fix 切り出しを Issue #185 に提案

### 2026-07-10 - Schedule: アイテム詳細の rightSidebar 化 + grid hover 改善 + Event/Routine 統合起票

#### 概要

Schedule セクションの UI 修正 3 件を実装し、Event/Routine 統合要件を Issue #185 として起票した。shell 所有ファイル（MainScreen / RightSidebar 系 / SegmentedControl 等）と tokens.css には無差分（#181 単一書込者原則を遵守）。

#### 変更点

- **hover 改善**: `WeekTimeGrid.tsx` の空きスロット hover を `bg-lumen-hover`（grid 線とほぼ同色のグレー）→ `bg-lumen-accent-subtle` + `border-lumen-accent` 破線に変更。Day/Week 両ビュー対応（同一コンポーネント）
- **rightSidebar 2 タブ化**: `CalendarTab.tsx` — 単一 RightSidebarPortal 内に ScheduleSidebarTabs（今日の流れ / 詳細）を新設。アイテム選択で詳細タブへ自動切替 + open()。メイン `<aside>` の editorPane を撤去し grid 全幅化。Mobile は BottomSheet 維持
- **Routines タブ**: `RoutinesTab.tsx` — MasterDetail を廃し RoutineEditorForm を rightSidebar へ移設。選択・作成はハンドラ直呼びで open（再選択でも開く — QA 指摘反映）
- **新規部品**: `shared/src/components/schedule/ScheduleSidebarTabs.tsx`（純表示・i18n props 注入・単一タブ時は shell 見出しと重複しないよう switcher 非表示・tabpanel a11y）
- **i18n**: `scheduleScreen.tabDetail` / `detailPanelLabel` を en/ja 追加
- **Issue 起票**: #185 Event/Routine 単一アイテム統合（データモデル実測・方針案 A/B・影響範囲を記載、shared-fix ラベルで他 worktree へ共有）
- **検証**: shared tsc/vitest 749 pass・web build/lint pass・role-qa PASS。playwright runtime 検証は認証ゲートで BLOCKED（テスト資格情報待ち）

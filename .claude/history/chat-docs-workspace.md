# HISTORY (chat-docs-workspace)

### 2026-07-17 - Issue #257: tier-1-core.md に Briefing requirements 節を追加（PR #267）

#### 概要

shared-fix `[docs-workspace]` キューの Issue #257 を実行。`docs/requirements/tier-1-core.md` に `Feature: Briefing（朝刊 — ホーム面）` 節を新設し、CLAUDE.md §8 の「tier-1 requirements 節は追って追加」注記と briefing-loop References の「未作成」記述を同一 PR で解消した。

#### 変更点

- **tier-1-core.md**: Briefing 節を §8 の並び順どおり先頭に追加。紙面ブロック（列挙の出典 = briefing-loop §1・全ブロック構成の正 = `BriefingView.tsx`）/ `extractBriefing` 規約（TipTap `heading` ノード「朝刊」/「Briefing」大文字小文字不問・段落 1 = フォーカス・次 heading で終了）/ 夕刊規約（「夕刊」見出し・英 alias Evening・1 行成立・「気分: n/5」・入力 UI = F-6 ヘッダータブ）を要件化。AC 5 件（Step 2 / 3 依存分は明記）。冒頭の機能数記述は数値の非複製原則に沿って CLAUDE.md §8 参照へ整理
- **CLAUDE.md §8**: 「tier-1 requirements 節は追って追加」→「requirements 節 = tier-1-core.md §Briefing」に解消
- **briefing-loop.md**: References の「未作成 — 追って追加」を追加済みへ更新 + Worklog 追記
- **実測**: 節の記述は `extractBriefing.ts` / `BriefingView.tsx` / loop-friction-fixes F-6 をコード・計画書で直接確認して書き起こし（sweep で「追って追加 / 未作成」残骸ゼロ確認・outbox の過去ログは履歴として残置）
- **PR**: commit 630cad69 → PR #267 open（merge = 人手ゲート・docs のみ。merge で #257 自動 close）。前タスクの PR #254 は merge 済みを確認し memory を追随

### 2026-07-16 - ループ摩擦除去計画書（loop-friction-fixes）新設 + briefing-loop / tier-3 追随（PR #254）

#### 概要

ユーザー要件 6 件（Daily 見出し / 朝刊の操作性 / Note Links / Claude 起動ボタン / 名称変更・反映バグ / Analytics 維持）を実測精査し、`docs/vision/plans/2026-07-16-loop-friction-fixes.md`（Status: IN PROGRESS・briefing-loop の子計画）として正本化。精査で「手書きの朝刊・夕刊は現状の Daily では紙面に出ない」というループ土台欠陥を発見した。

#### 変更点

- **計画書新設**: 事実確認 7 件（file:line 付き・Explore 3 本 + メイン spot check）・決定録 6 件（Daily TipTap 化 / 朝刊行操作 = 名称横の移動ボタン + 名称タップ = 完了トグル / Links = rightSidebar 開閉パネル / Claude 起動口 = 定時自動先行・API 直課金不採用 / ラベル改名は i18n のみ / Analytics 破棄しない）・F-1〜F-5 の仕様と AC
- **重要発見**: Daily 本文 = 平文 textarea（`DailyView.tsx:102`）・`extractBriefing` = TipTap 見出しノード必須 → **F-1（Daily TipTap 化）が Step 2（MCP 書き込み）と並ぶループ開通の 2 大前提**
- **briefing-loop.md**: 決定録 5（Claude 起動口）+ Risks（手書き不成立）+ References / Worklog 追記
- **tier-3-experimental.md**: Analytics Verdict に「破棄しない・現行デザイン維持・配線/開発凍結・完成間近に再開」（2026-07-16 ユーザー決定）を追記
- **outbox**: chat-main 宛起票依頼 5 件（F-1〜F-5・ラベル案 + DoD 付き）
- **PR**: commit 5b77c158 → PR #254 open（merge = 人手ゲート・docs のみ）。前タスクの PR #253 は本日 merge 済みを確認し memory の記載を追随（docs-consistency §4）

### 2026-07-16 - briefing テーマの正本計画書（briefing-loop）新設 + CLAUDE.md §8 追随（PR #253）

#### 概要

ユーザーとのビジョン話し合い（「何を軸に機能を改善・削除・追加するか」）の成果を `docs/vision/plans/2026-07-15-briefing-loop.md`（Status: ACTIVE (adopted policy)）として正本化。コードコメントが参照していた「Briefing plan」のリポジトリ内実体が初めてできた。

#### 変更点

- **計画書新設**: 1 日 1 周ループ（朝刊=読む → Schedule=組む → Work=没入 → 夕刊=閉じる → Claude 分析=翌朝刊を書く）の定義・追加/改善/削除/凍結の判定基準・完成の定義（平日 5 日連続でループ完走 = Daily の朝刊/夕刊セクション存在で機械判定可能な AC）・現在地マップ・ロードマップ Step 1〜6（Step 1 = #249 出荷済み、番号はコード既存参照と整合）
- **決定録 4 件（2026-07-15 ユーザー確定）**: 夕刊 = Daily「夕刊」見出しセクション（新 UI ゼロ・DDL ゼロ・1 行でも成立）/ Claude 分析 = 定時自動路線（経路設計 = Step 5・確定まで手動 `claude` 起動）/ 完成 = 5 日連続ループ / 本書 = briefing 正本
- **CLAUDE.md §8**: Tier 1 に Briefing 追記（(6)→(7)・正本ポインタ = 本計画書。tier-1-core の requirements 節は起票依頼で後続）
- **outbox**: chat-main 宛起票依頼 2 件（朝刊ループ Step 2 = MCP schedule handler の Supabase 化 + `get_today_context` / `write_briefing`、tier-1 Briefing requirements 節）
- **PR**: commit 0c8f49b1 → PR #253 open（merge = 人手ゲート・docs のみで build 影響なし）

### 2026-07-15 - Schedule 再設計 Step 1: scheduledAt タスクをカレンダーに blue チップで読み取り表示（A-1）

#### 概要

ユーザー直接指示で `2026-07-14-schedule-redesign.md` Step 1 を実装。scheduledAt を持つ TaskNode が Week/Day/Month/今日の流れに task=blue チップで表示される（読み取り専用・DDL ゼロ）。着手前に main を merge（コンフリクト 2 件 = dateKey.ts の DST 注記 / 自 outbox — 双方とも自分側の新しい版を採用して解消）。

#### 変更点

- **純ヘルパー**: `shared/src/utils/taskCalendarChips.ts` 新設（UTC ISO → ローカル date/HH:MM・終日 / 60 分デフォルト・deleted 除外・done は completed 保持・複数日は開始日のみ）+ barrel export + TZ 非依存テスト 7 件
- **3 コンポーネント**: WeekTimeGrid / MonthGrid / AgendaList の variant union に `"task"` 追加（blue トークン。Repeat グリフ / 左バンドなし。WeekTimeGrid は task に drag/resize affordance 非付与）
- **トークン**: `--color-schedule-task-bg`（light #dbeafe / dark #1d2348）+ `@theme` エイリアス `lumen-schedule-task-bg`・欠落していた `lumen-chip-task-dot` を追加
- **配線**: `MainScreen` schedule 分岐最外に `TaskTreeProvider`、`CalendarTab` は派生層（gridItems/monthItems/agenda）でのみ合流。`taskchip-` prefix で select/toggle/move/resize/contextMenu 全 no-op・`rangeItems` 非混入
- **i18n**: `scheduleScreen.originTask`（en/ja。配線は Step 2/3 で消費する先行キー）
- **検証**: shared vitest 891 pass / shared・web tsc -b green / web vite build green。role-qa 独立監査 PASS（Blocker 0。既知の限界 = Week/Day 全日レーンは variant 非依存描画のため終日タスクは青くならない — Step 2 送り・計画書に記録済み）。実ブラウザ検証は merge 後 chat-main

### 2026-07-11 - Issue #218: day-start-hour pref を daily/routine の「今日」計算に配線（PR #242）

#### 概要

shared-fix `[docs-workspace]` キューの #218 を実装し PR #242 を open。settings 側の pref 参照方法が未共有だったため、読み手側から契約（localStorage キー `life-editor-day-start-hour` + pure reader）を定義した。既定 0 = 現行挙動不変。

#### 変更点

- **utils/dateKey**: `DAY_START_HOUR_STORAGE_KEY` / `parseDayStartHour` / `getDayStartHour` / `todayDateKey()`（HH:00 前 = 前日扱い）を追加
- **読み手配線**: `useDailiesUnifiedAPI`（初期 selectedDate）+ `useScheduleItemsRoutineSync` の「今日」境界 3 箇所を `todayDateKey()` へ
- **書き込み側フック**: `useDayStartHourPref`（`useStartupSectionPref` と同型）を新設・barrel export
- **テスト**: `shared/tests/dayStartHour.test.ts`（parse / read / 境界 / 月跨ぎ / localStorage 連携）— shared vitest 863 pass / shared・web build green
- **調整**: main 取り込み時の CLAUDE.md / _TEMPLATE.md コンフリクト解消（origin/main の Issue 駆動 dispatch 側を採用）。outbox に結果報告 + settings UI / analytics 追随の起票依頼を append

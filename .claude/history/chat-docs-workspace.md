# HISTORY (chat-docs-workspace)

### 2026-07-11 - Issue #218: day-start-hour pref を daily/routine の「今日」計算に配線（PR #242）

#### 概要

shared-fix `[docs-workspace]` キューの #218 を実装し PR #242 を open。settings 側の pref 参照方法が未共有だったため、読み手側から契約（localStorage キー `life-editor-day-start-hour` + pure reader）を定義した。既定 0 = 現行挙動不変。

#### 変更点

- **utils/dateKey**: `DAY_START_HOUR_STORAGE_KEY` / `parseDayStartHour` / `getDayStartHour` / `todayDateKey()`（HH:00 前 = 前日扱い）を追加
- **読み手配線**: `useDailiesUnifiedAPI`（初期 selectedDate）+ `useScheduleItemsRoutineSync` の「今日」境界 3 箇所を `todayDateKey()` へ
- **書き込み側フック**: `useDayStartHourPref`（`useStartupSectionPref` と同型）を新設・barrel export
- **テスト**: `shared/tests/dayStartHour.test.ts`（parse / read / 境界 / 月跨ぎ / localStorage 連携）— shared vitest 863 pass / shared・web build green
- **調整**: main 取り込み時の CLAUDE.md / _TEMPLATE.md コンフリクト解消（origin/main の Issue 駆動 dispatch 側を採用）。outbox に結果報告 + settings UI / analytics 追随の起票依頼を append

### 2026-07-11 - レイアウト統一 v2 + life-tags の計画書 8 枚作成（PR #190）

#### 概要

2026-07-11 ユーザー要件（全画面レイアウト統一 5 項目 + life-tags 統一）を精査し、GitHub Issue ラベル（section:\* / shared-fix）から各 worktree の作業台帳を含む計画書 8 枚を作成して PR #190 を open。

#### 変更点

- **親計画 layout-standard-v2**: 要件 1〜5 の仕様正本（共通セクションヘッダー / rightSidebar 全 7 セクション化 / パネルは区切り線の下で開閉 / 幅切替 2 段タブ + 初期値表）。v1（#180/#181）と同じ「共通部品先行 → adoption」2 段構え
- **親計画 life-tags-unification**: 要件 6 の方向正本。ユーザー AskUserQuestion 4 決定 = WikiTag 拡張一本化 / folder ノードのみ廃止（サブタスク存続）/ status 独立軸 / v2 後着手
- **orders × 6**（schedule / materials / connect / work / analytics / settings）: 担当 Issue スナップショット（#185 #183 #182 #118 #181）+ v2 adoption 個別メモ + boot 行
- **未実施**: v2 Issue 2 枚の起票（権限の自動判定で拒否 → 親計画 Step 2 にユーザー承認ゲートとして配置）

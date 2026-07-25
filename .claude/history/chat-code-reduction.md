# HISTORY (chat-code-reduction)

### 2026-07-25 - code-reduction Steps 1-3 (PR #338) + A19 follow-up (PR #339)

#### 概要

計画書 `2026-07-25-code-reduction.md` の Steps 1-3（承認 11 項目）を実行し、参照ゼロのデッドコードを削除した。PR #338（追加 0 行・削除 1,152 行・14 ファイル）と follow-up PR #339（A19・追加 1 行・削除 25 行）の 2 本で main へ merge 済み。/goal の完了条件「diff は削除のみ」を守るため、A19 だけは前提誤りの判明を受けて一旦見送り → ユーザー承認の 1 行書き換えで別 PR 化した。role-qa の独立監査（削除シンボル全件の参照ゼロ実測）PASS。

#### 変更点

- **ファイルごと削除**: `shared/src/types/{sync,fileExplorer,diagnostics}.ts` / `shared/src/services/noteLinkMapper.ts`（+ テスト）/ `web/src/components/{DebouncedTextInput.tsx,TreeNodeIndent.tsx,treeCollision.ts}`
- **DataService.ts**: 参照ゼロのインターフェースメソッド一括削除（330 行）。実装側 `SupabaseDataService` は Proxy ベース（`implements` なし）のため宣言削除で壊れない
- **analyticsAggregation.ts**: 未使用の集計関数 5 本 + 付随型（195 行）。`aggregateTagByEntityType` はテスト経由で現役のため残置
- **その他**: `loadPositions`（graphStorage）/ `SoundSettingsMap`（sound）/ `RoutineSyncResolved`（useScheduleItemsRoutineSync）
- **A19（PR #339）**: `schedule.ts` の `RoutineStats` 24 行削除 + `index.ts:51` の barrel 行から除去する 1 行書き換え。計画書の前提「参照: barrel のみ」は誤りで、同じ行が現役 `ScheduleItem` を共 export（`web/src/schedule/scheduleLabels.ts` が消費）— 行削除では web build が壊れる
- **A8 先食いの検知と復元**: A3 の機械スキャンが Step 5（👀 ゲート）領分の `// Databases` 13 メソッド + `types/database` import まで削除していたのを role-qa 監査で検出し、main 原文どおり復元。ゲート迂回なし
- **検証**: shared `tsc -b` + vitest 137 files / 1084 tests・web `tsc -b --force` + vite build — merge 前後とも green
- **運用知見**: PostToolUse(Edit) の prettier が multi-line import を 80 桁に畳んで「追加行」を作るため、削除のみ diff の維持には Edit を使わず Bash + node スクリプトで外科的に変更する（`restore-a8.mjs` / `apply-a19.mjs` 方式）。squash merge 済み判定は `gh pr view --json state` が正
- **残タスク（chat-main 宛 outbox 送付済み）**: 計画書修正 4 件（A19 前提訂正 / A15 SUPERSEDED / A3 に A8 境界注記 / 孤児型 `CalendarDataKind`・`BulkSoftDeleteResult` 追記）

# HISTORY (chat-code-reduction)

### 2026-07-25 - code-reduction Steps 6+8 (PR #341 / PR #342)

#### 概要

計画書 `2026-07-25-code-reduction.md` の Step 6（A2/B1 = i18n 完全死亡 namespace 削除）と Step 8（A10/A12/A13/A21/A23/A25 = リポジトリ周辺残骸）を /goal 指示で実行し、Step ごとに PR を作成した（PR #341: 追加 0 / 削除 2,976 行、PR #342: 追加 0 / 削除 400 行 + バイナリ 1。いずれも 100% 削除 diff・merge はユーザー判断待ち）。

#### 変更点

- **Step 6（PR #341）**: en/ja から死亡 namespace 54 個を各 1,488 行削除。削除前に live source 554 ファイルへの部分文字列スキャン + 動的 t() 呼び出し全数チェックで実測し、**計画書 B1 が死亡と記載した blockMenu が現役（web/src/notes/RichTextEditor.tsx:208-214）と判明したため残置**。database namespace は Step 5（👀 ゲート）領分として残置。B5 動的キー 11 個の生存・en/ja 対称性（残 1,176 キー）・builds/tests green を検証済み
- **Step 8（PR #342）**: ROUTINE.md / loop-engine 4 ファイル（check.sh は残置）/ Android 雛形テスト 2 本 / .gitignore 重複+Tauri ブロック 9 行 / d3-ease 依存 4 行 / Vite scaffold アセット 4 ファイル（favicon.svg は残置）。A23 のロック再生成（npm install）も追加 0 行の純粋削除（shared/web 各 -2 行）
- **手法**: 削除は全て Bash + node スクリプトによる外科的行削除（Edit ツールの保存時整形による追加行を回避 — Steps 1-3 の運用知見を踏襲）。JSON 末尾カンマ調整は結果的に不要だった
- **検証**: shared build / web build exit 0・vitest 137 files / 1,084 tests all pass（両 Step とも）・PR #341 CI 両ジョブ pass
- **記録**: docs-lint がローカル（Git Bash）で 2026-06-19 plan の Status 行を FAILED 判定するが CI（ubuntu）は pass する環境差を確認 — outbox で chat-main へ FYI 済み

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

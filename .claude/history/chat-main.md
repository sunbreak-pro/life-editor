# HISTORY (chat-main)

### 2026-05-24 - 並行作業基盤強化（Stop hook + Plan Gate Convention + 計画書テンプレ）

#### 概要

並行 worktree / 複数チャット運用で「見てない隙の品質劣化」「Supabase 手動操作で計画書が止まる不安」「人手ゲートを置きたくない誘惑」が認知負荷を上げていた問題に対し、調査（Anthropic 公式 / Supabase 公式 / 個人開発者事例の triangulation）を踏まえて 3 つのメタ運用基盤を追加。計画書テンプレに Gate 列（🤖 自律 / 👀 目視 / 🛑 人手）を必須化し、Stop hook で per-chat outbox に build 結果スナップショットを蓄積する仕組み。frontend 実装は無変更。

#### 変更点

- **計画書テンプレ新設**: `.claude/docs/vision/plans/_TEMPLATE.md` を新規作成。Scope 宣言 / Gate 列 / 機械検証可能な Acceptance Criteria / DB Migration Notes（ローカルファイル先行 + ユーザー `supabase db push` ルール）を含む。新規・大改訂時に使用、既存 14 本は触る時に逐次移行
- **Stop hook 新設**: `.claude/hooks/stop-check.sh` を新規作成（実行権限付与）。応答終了時に `git diff` で frontend 変更を検知し、バックグラウンドで `npm run build` を走らせ結果を `.claude/comm/outbox/<chat>/stop-report.md` に追記。ユーザー待ち時間 0（subshell + & + disown）
- **settings.json 新設**: `.claude/settings.json` を新規作成し `hooks.Stop` に stop-check.sh を登録。auto-mode classifier が一度ブロックしたためユーザー明示承認を取得して再書き込み
- **CLAUDE.md §7.3 追加**: 「Plan Gate Convention」小節を新設し、テンプレ・hook・Gate 凡例・DB Migration ルールを SSOT 化。session-verifier との役割分担も明示（verifier = commit 前明示呼び出し / Stop hook = 毎ターン自動スナップショット、重複しない）
- **設計判断**: 「人手ゲートを減らす」のではなく「人手 1 コマンドで通せる形に圧縮する」方針を採用。`apply_migration` MCP 単独使用は schema drift を確定させるため禁止と明記
- **検証**: hook dry run（frontend 変更なし → 即 exit 0）成功。本番動作は次回応答終了時から有効化

### 2026-05-23 - Schedule 無限ループ修正（RoutineScheduleSync no-op 化）

#### 概要

DU-C/D pending stubs 投入後のユーザー実機検証で「Routine 生成時にコンソールエラーが永遠に吐き出される」バグが顕在化。原因を特定して `web/src/schedule/RoutineScheduleSync.tsx` を DU-C 完了まで no-op 化することで根本撤去。

#### 変更点

- **Frontend / web**: `web/src/schedule/RoutineScheduleSync.tsx` の useEffect + `useScheduleItemsRoutineSync` 呼び出しを全削除して `return null` 化（87 → 70 行）
- **Root cause 記録**: 無限ループ経路 6 ステップ（createRoutine → setRoutines optimistic → effect 発火 → ensure → bulkCreate stub throw → **catch 外**の `if (toCreate.length > 0) notifyChanged()` 発火 → loadDate → setItems(新空配列) → context 新参照 → 再 render → effect 再発火 → ループ）と DU-C 完了時の復活手順をコンポーネント先頭コメントに保存
- **検証**: shared `npx tsc -b` 緑 / shared `npm test` 91/91 緑 / web `npm run build` 緑（929 kB）
- **session-verifier**: 全 6 Gate PASS（Types / Lint / Tests / Coverage skip / Structural / Bug Scan）

### 2026-05-23 - DU-C/D pending stubs（8 services 一時 no-op）

#### 概要

`0007_drop_legacy_item_tables.sql` で旧 9 テーブルが drop され、Tasks 以外の Service が `notes` / `routines` / `schedule_items` 等の dropped table を叩いて `Could not find the table 'public.<name>' in the schema cache` エラーで web 起動が壊れていた問題を、8 Service の stub 化（fetch → [] / null、write → 明示 throw）で短期対応。実 DB には `items_meta + <role>_payload` が既に揃っていることを Supabase MCP `list_tables` で確認済（dailies_payload / notes_payload / routines_payload / events_payload など）。

#### 変更点

- **Shared services**: `SupabaseDataService.ts` の Daily / Notes / NoteLink / NoteConnection / Routines / RoutineGroups / RoutineGroupAssignments / ScheduleItems 8 Service を stub クラスに置換（3257 → 1774 行、head/tail splice）
- **共通ヘルパー**: `_pendingDuRewrite(method, domain)` で明示エラーメッセージ + 計画書パスを統一
- **Tasks / Calendars**: DU-B-3 実装と既存 Calendar 系は無変更
- **検証**: shared `tsc -b` / `npm test` 91/91 / web `npm run build` 全緑

### 2026-05-23 - fix(tasks): TaskTreeView DnD into-folder

#### 概要

DU-B-5 ユーザー検証で「folder の中に DnD で入れられない（並び替えと中→外は OK）」と報告。バックエンド (`updateTask` の parentId 変更経路) は無罪、frontend `web/src/tasks/TaskTreeView.tsx:198-205` の `handleDragEnd` が `moveNodeInto` を意図的に呼んでいなかった（"out of this minimal UI's scope" コメント付き）ことが判明。Notes 側 `useNoteTreeDnd` 相当の 3 zone（above/inside/below）判定を移植して修正。

#### 変更点

- **Frontend / web**: `TaskTreeView.tsx` に `computeFolderPosition` + `getPointerY` helper + 3 zone 判定付き `handleDragEnd` を実装
- **挙動**: folder 上 25% = above（moveNode）/ 中央 50% = inside（moveNodeInto）/ 下 25% = below（折りたたみは moveNode、展開済みは moveNodeInto）。task drop は上下半分判定
- **DB / shared 無変更**: `useTaskTreeMovement.moveNodeInto` は既存実装、`updateTask` の parentId UPDATE 経路も DU-B-3 で動作確認済

### 2026-05-23 - DU-B-6 partial（db-conventions §10 + known-issues 021-024）

#### 概要

DU-B-1 / B-2 / B-3 で得た知見を恒久ドキュメント化。`db-conventions.md` に Payload Mapper 規約（10.1 2 行分割マッピング、10.2 DB-Q2 bump、10.3 generated 列の書き込み禁止、10.4 composite FK パターン、10.5 R2 orphan recovery、10.6 DB-Q1/Q2/Q3 サマリ）を新規 §10 として追加。known-issues に 4 件追加（PG generated + composite FK + SET NULL 不可 / Supabase SQL Editor postgres role auth.uid NULL / Supabase CLI v2.101 CSV 出力 / PG 2BP01 依存連鎖）。

#### 変更点

- **Docs / vision**: `.claude/docs/vision/db-conventions.md` 末尾に §10 Payload Mapper 規約を新設
- **Docs / known-issues**: 021/022/023/024 を新規追加 + `INDEX.md` の Fixed セクション + Category 別インデックス + Status 集計を更新（19 件 → 並行チャットの 025 追加で 20 件）
- **保留**: CLAUDE.md §4.3 一行追記は並行チャットの CLAUDE.md 編集との干渉回避で別タイミング。計画書 archive 移動も DU-B 全体クローズ時に実施

> 古いエントリは [`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照（DU-B-4 taskMapper + sortByDepthDesc vitest / DU-B-3 SupabaseTasksService 9 methods 本実装 ほか）

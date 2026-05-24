# HISTORY (chat-main)

### 2026-05-24 - DU-C+ scope-reduced 完了（CalendarTag DROP + shared 層 WikiTag mapper/service/Provider 整備）

#### 概要

DU-C+（Events 限定 WikiTag/Link + CalendarTag 吸収）の実装途中で frontend↔shared 統合が Phase 2 完成タスクとして残っていることが判明し、Events UI 実装 / NoteProvider 置き換え等を DU-F に統合する形で scope reduction。DU-C+ は「DB migration 0012_drop_calendar_tags.sql 適用 + shared 層 (mapper 5 / SupabaseWikiTagsUnifiedService / Pattern A Provider) 整備 + 単体テスト 18 緑」のみで完了とした。shared 層は build-clean 状態で温存され、DU-F の frontend↔shared 統合と同時に活性化される設計。

#### 変更点

- **DB migration 0012**: `supabase/migrations/0012_drop_calendar_tags.sql` 新規。`calendar_tag_assignments` + `calendar_tag_definitions` を CASCADE DROP。0007 で truncate のみ済の 2 テーブル構造を完全削除。`calendars` テーブルは保持（Schedule フォルダフィルタマスタとして）。supabase CLI 経由で push 適用（履歴乖離が判明したため migration repair で 0009/0010/0011 を applied として補正後 0012 のみ流す手順）
- **shared types**: `shared/src/types/wikiTagUnified.ts` 新規。Supabase 0008 設計（items_meta(id) FK / 5 role 共通）に対応する WikiTag / WikiTagGroup / WikiTagAssignment / WikiTagConnection / WikiTagGroupAssignment 5 型。既存 `wikiTag.ts`（Tauri 時代 polymorphic entityType 設計）と並存（DU-F で旧型削除）
- **shared mapper 5**: `wikiTagMapper.ts` / `wikiTagGroupMapper.ts` / `wikiTagAssignmentMapper.ts` / `wikiTagConnectionMapper.ts` / `wikiTagGroupAssignmentMapper.ts` 新規。Row 型 + INSERT / Patch 型 + SELECT カラムリスト + rowTo... / ...ToRow / updatesToPatch 関数。`updatesToPatch` は ALWAYS `updated_at` を bump（DB-Q2 同型契約）。`wikiTagConnectionToRow` は self-loop を mapper 層で reject（DB CHECK の二重防衛）
- **shared service**: `SupabaseWikiTagsUnifiedService.ts` 新規（2.8k 行の SupabaseDataService.ts を肥大化させない判断）。11 メソッド: tag master CRUD (4) / item↔tag assignment (3) / item↔item link (4)。`user_id` を insert object に含めず DB default `auth.uid()` に任せる設計（frontend が userId を threading 不要）。`PHASE2_WIKI_TAGS_UNIFIED_METHODS` を export し SupabaseDataService の Proxy route に登録
- **shared DataService interface**: `DataService.ts` に 11 メソッドを `*Unified` サフィックスで追加。既存 `fetchWikiTags()` 等 (Tauri polymorphic 旧 API、現状 `not implemented in phase 2` を throw) は touched=NO で温存（DU-F で削除）
- **shared hook + Provider**: `useWikiTagsUnifiedAPI` + `WikiTagsUnifiedContext` (Pattern A 3 ファイル) + `useWikiTagsUnifiedContext` consumer hook。`dataService` injection（CLAUDE.md §6.4）/ `syncVersion` 連動 / generateId は shared util を使用
- **shared/src/{context,index}.ts**: 新 Provider / Context / 型を re-export
- **単体テスト**: `wikiTagMapper.test.ts` (8) + `wikiTagAssignmentMapper.test.ts` (6) + `wikiTagConnectionMapper.test.ts` (5) = 18 / 18 緑
- **frontend 軽修正**: `frontend/src/services/data/scheduleItems.ts` の unused `ScheduleItemUpdate` import 削除（main 由来の既存 build error 解消）
- **計画書改訂**: DU-C+ 計画書を v2 (SCOPE-REDUCED) に。DU-D 計画書も同じ問題で SCOPE-REDUCED に（frontend NoteProvider 置き換え + UI 動作確認は DU-F へ）。親計画書の DU-C+ / DU-D / DU-F 行を更新（DU-F は **EXPANDED** で frontend↔shared 統合 + 後送り分を吸収）

#### 検証

- shared `npx tsc --noEmit`: exit 0
- shared `npx vitest run tests/wikiTag*.test.ts`: 18/18 pass
- frontend `npm run build`: exit 0（vite build 緑）
- Supabase: `mcp__supabase__list_migrations` で 0012 適用確認 / `calendar_tag_*` 2 テーブル不在 / `wiki_tags` 系 5 テーブル健在 / `calendars` 健在 / advisor lint は既知 WARN (auth_leaked_password_protection) のみ

#### 設計判断 / 残知見

- **frontend↔shared 統合未達の発覚**: frontend は独自 `tauriDataService` のみ参照、shared パッケージ（`@life-editor/shared`）への vite alias / tsconfig path 未設定。Phase 2 (Tauri→Web 移行) が frontend 側で完了していない状態。DU-C+ の Events UI 実装には vite alias + tsconfig 追加 + getDataService 切替が必要 = Phase 2 完成相当のタスク → DU-F に統合の判断
- **shared SupabaseDataService の WikiTag メソッド未実装の発見**: 既存 DataService.ts は WikiTag メソッド多数宣言（Tauri 時代 polymorphic 設計）だが、SupabaseDataService の Proxy route に WikiTag が登録されておらず、呼ぶと `not implemented in phase 2` を throw する状態だった。新 `*Unified` メソッドを別系統で追加し、旧 API を temporarily 温存する判断
- **userId injection 設計の単純化**: 当初 `useWikiTagsUnifiedAPI(options: { dataService, userId })` を想定したが、frontend に userId 取得経路がなかった（`getSession()` 等を呼んでいない）。`user_id` を insert object から省略 → DB default `auth.uid()` に任せる設計に変更。RLS policy で `auth.uid() = user_id` を強制しているため正しく動作
- **Supabase CLI migration repair の必要性**: `supabase db push` 初回実行時に CLI 履歴（`supabase_migrations.schema_migrations`）と実 DB schema の乖離（0009/0010/0011 が MCP `apply_migration` 経由で適用済だが CLI 履歴未登録）が露見し、`0009_rollback.sql` を未適用 migration として実行してエラー。修復手順: rollback ファイルを `supabase/migrations_archive_rollback/` へ退避 + `supabase migration repair --status applied 0009 0010 0011` で履歴補正後 push 成功

#### 概要

DU-C/D pending stubs 投入後の実機検証で顕在化した「Routine 削除→key duplicate 警告→無限ループ」バグの根本治療として、DU-A (0008) で用意済の `items_meta + <role>_payload` スキーマに Routines / RoutineGroups / RoutineGroupAssignments / ScheduleItems の 4 ドメインを 2-row pattern で本実装。0011 migration で events_payload に composite FK + initplan-cache RLS を追加し、最後に RoutineScheduleSync の no-op 状態を解除して useScheduleItemsRoutineSync の notifyChanged を try ブロック内へ移動 (landmine 構造除去)。

#### 変更点

- **DB / migration 0011** (commit 564a4d8): `supabase/migrations/0011_du_c_events_payload_fk.sql` 新規。events_payload に `routine_item_role text GENERATED ALWAYS AS ('routine') STORED` + composite FK `(routine_item_id, routine_item_role) → items_meta(id, role)` NO ACTION。BEFORE INSERT trigger `trg_events_payload_init_cache` で is_deleted_cache 初期化 (UPDATE trigger は 0008 既存)。events_payload / routines_payload / routine_groups / routine_group_assignments の 16 RLS policy を `(select auth.uid())` initplan キャッシュ形式へ。本番 Supabase は SQL Editor 経由で apply (`supabase` CLI 不在 + MCP `--read-only` mode のため)、Acceptance Criteria A〜F 全件緑
- **Shared mapper** (commit 5fd8574): routineMapper / routineGroupMapper / routineGroupAssignmentMapper / scheduleItemMapper を 2-row pattern に書き換え。legacy API は deprecated shim として並走。新規 vitest 2 ファイル合計 36 ケース (routineMapper 18 + scheduleItemMapper 18) — `shared npm test` 127/127 緑 (91 base + 36)。`RoutineNode` に `version?: number` を TaskNode 整合で追加
- **SupabaseRoutinesService** (commit 6d02c1e): 8 methods 本実装。softDeleteRoutine が events_payload の routine_item_id 経由で由来 events を連動 soft-delete し `{ deletedScheduleItemIds }` を返す (trigger は単一行ミラーのみなのでアプリ層責務)。permanentDeleteRoutine は composite FK NO ACTION のため依存 events を先に hard-delete
- **SupabaseRoutineGroupsService + AssignmentsService** (commit c22992e): 6 methods 本実装。`deleteRoutineGroup` は 0008 schema が is_deleted 列を持つので **soft-delete** に変更 (Phase 2 物理削除と挙動差)。`setGroupsForRoutine` は diff 計算 (current LIVE vs new set) → 新規 INSERT + 削除 soft-delete (Issue 008 contract)
- **SupabaseScheduleItemsService** (commit 2c12119): 19 methods 本実装。`fetchByPayloadFilter` ヘルパで payload-first フィルタ + items_meta JOIN。`bulkCreateScheduleItems` は events_payload upsert ON CONFLICT (routine_item_id, source_date) ignoreDuplicates で Issue 011 partial UNIQUE 衝突を冪等吸収。`source_date` は routine_item_id 非 null の場合のみ start_at から patch (mapper INSERT path は DU-A pre-spec で null)
- **RoutineScheduleSync 復活 + ハードニング** (commit 1ea4371): web/src/schedule/RoutineScheduleSync.tsx を Phase 2 (S4-5) 実装に復元。shared/src/hooks/useScheduleItemsRoutineSync.ts の `notifyChanged()` を try ブロック判定下へ移動し、`bulkCreateOk` フラグで bulkCreate 失敗時抑止を構造的保証 (2026-05-23 stub-throw 無限ループ landmine の構造除去)
- **Docs** (commit fbc7cab): db-conventions.md §10.7 (events_payload 案 A 完成記録) + §10.8 (bulkCreate ON CONFLICT 戦略) 追加。子計画書を Status=COMPLETED + commit ハッシュ 6 件記録 + Worklog 時系列追記して `.claude/archive/` へ git mv

#### 検証

- shared `npx tsc -b`: exit 0 (全 commit 後)
- shared `npm test`: 127/127 pass (91 base + routineMapper 18 + scheduleItemMapper 18)
- web `npm run build`: exit 0
- Supabase 0011 適用後 Acceptance Criteria A〜F: 全件緑 (composite FK / generated 列 / 同期 trigger 2 種 / 16 RLS policy initplan / advisor auth_rls_initplan WARN は DU-C 4 テーブルで 0 件)
- 残: 👀 ユーザー実機確認 (Routine 作成/削除/復元 + 連続フリック / 月またぎで bulkCreate ループしないこと)

#### 設計判断 / 残知見

- **Supabase CLI 不在 + MCP `--read-only` mode**: `supabase db push` が使えない (CLI 未インストール + 過去 history table 不在で不発と判明) + MCP の write 系も `--read-only` でブロック → 確立パターンは **SQL Editor 直貼り** (0001-0008 と同じ経路)。MCP は read-only verification (execute_sql / get_advisors) に専念
- **`apply_migration` MCP 単独使用禁止** (CLAUDE.md §7.3) はファイル先行ルールを意味し、ファイルがコミット済なら MCP push 自体は許容される — ただ `--read-only` モードでは blocked のため事実上 SQL Editor 経路一択
- **Routine→Event cascade はアプリ層責務**: 0008/0011 の sync trigger は events_payload.item_id 単位でしかミラーしない。Routine soft-delete からの events 連動は `SupabaseRoutinesService.softDeleteRoutine` が `.in()` で一括 UPDATE
- **`source_date` populate ルール**: routine 由来 event は `source_date = start_at` で partial UNIQUE 有効化。手動 event は source_date=null で partial UNIQUE 非発火 — 手動 event 同日同 routineId は重複可能 (routineId=null なので空集合)

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

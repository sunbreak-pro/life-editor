# HISTORY.md - 変更履歴

> **🧊 FROZEN since 2026-05-23 (worktree: prototype/mobile-ui)** — このファイルは read-only。新規エントリは `.claude/history/chat-<name>.md` (per-chat 機構) に書くこと。main worktree で per-chat 化が完了しており、本 worktree でも task-tracker は legacy モードへフォールバックするが、追記すると main マージ時に論理衝突する。
>
> **計画書の参照手段** (本 worktree からは直接参照不可。次のいずれかで読む):
>
> - main worktree 内から: `git show main:.claude/docs/vision/plans/2026-05-23-memory-history-per-chat-split.md`
> - main worktree (`/Users/newlife/dev/apps/life-editor`) に `cd` して直接 open
> - prototype 側で読みたい場合: 本 worktree から `git show main:.claude/docs/vision/plans/2026-05-23-memory-history-per-chat-split.md` で出力可能 (worktree は単一リポジトリの ref を共有するため `main` ref で到達)

### 2026-05-19 - Phase 2 S4 完全クローズ（0006 本番 apply 成功 + 実ブラウザ 2 バグ修正）

#### 概要

S4 コード完了後、ユーザーが 0006 を Supabase SQL Editor で本番 apply。初回は `cloud/db/migrations/0006_*`（旧 Cloudflare D1 = SQLite 構文 `INSERT OR IGNORE`/`_v2`）を誤って貼り 42601 構文エラー → 正しい `supabase/migrations/0006_schedule_full_schema.sql`（純 PostgreSQL・SQLite 構文混入 0 件検証済）で再実行し成功・手動確認 OK。実ブラウザ確認で 2 実バグが顕在（S4 計画の「実ブラウザ確認」が機能）。lead-pipeline 中ティア（role-pm 分解 → ユーザー判断 → role-engineer 実装 → role-qa 独立監査 Issue 017 専用検証 → task-tracker）で修正。バグ3（RoutineGroup 空表示）はユーザー明示でデモにつき未修正・SSOT 既知制約 1 行記録のみ。

#### 変更点

- **0006 apply トラブルと解決**: `0006_` 番号が `supabase/migrations/`（Postgres）と `cloud/db/migrations/`（旧 D1 SQLite・廃止予定）で衝突。ユーザーが後者を誤貼り → `INSERT OR IGNORE INTO calendar_tag_assignments_v2` で PostgreSQL 42601。原因＝コードバグでなくファイル取り違えと特定、正ファイル（570 行・SQLite 構文 grep 0 件）を案内し再 apply 成功。S4 SSOT Verification 全項目 [x]・Status=COMPLETE 化
- **バグ1（Calendar 作成 409 FK 違反）**: `calendars.folder_id` は `tasks(id)` NOT NULL FK だが web `CalendarView` が folderId を自由入力テキスト受け → 存在しない id で `calendars_folder_id_fkey` 409。修正＝`useTaskTreeContext` の `type==="folder"` task を `<select>` 選択化（value=task.id・title 表示）、`MainScreen` schedule セクションに `TaskTreeProvider` 追加（SyncProvider 直下・schedule trio 外側＝§6.2 整合・trio 依存順非破壊）。stale id ガード + folder 0 件時 Add UI 非表示の二重防御で 409 構造的に発生不能
- **バグ2（Routine item が Delete forever で復活＝Issue 017 震源地）**: routine 生成 item を物理/soft-delete すると `createScheduleItem` の (routine_id,date) 重複ガード（`SupabaseDataService.ts:1771-1778` `.eq("is_deleted",false)`）をすり抜け、生成器が routine 在存中ゆえ再生成。修正＝`ScheduleItemsView` で `item.routineId` 真値の item から Delete（soft-delete）/ Trash の Delete-forever 導線を条件レンダリングで非表示、Dismiss を主導線化。Trash 一覧も `deletedManualItems = filter(!routineId)` で routine item 除外。Dismiss 行（is_deleted=false, is_dismissed=true）は重複ガードが拾い再生成阻止 + by-date クエリ（is_dismissed=false）で表示から消える＝frontend Rust モデル忠実。手動 item（routineId=null）は soft-delete/Restore/forever 非変更
- **Routine 自体の削除（既存実装の検証）**: ユーザー回答「Routine のデリート関数を実装」に対し調査の結果 `useRoutinesAPI.deleteRoutine`（=`softDeleteRoutine` 子 schedule_items cascade）+ `ScheduleView:403` Delete ボタン + Trash は S4-2/S4-3 で実装済と判明。`softDeleteRoutine` が子 cascade soft-delete + routine.is_deleted=true、生成器 host が live routines のみ渡す + `shouldCreateRoutineItem` の routine.isDeleted short-circuit の二重ガードで「Routine 削除→既存生成 item も消え再生成なし」を role-qa がコードパス実証
- **shared 非変更**: dedup ガードは frontend 忠実で正しいため未改変（git diff shared/ = 0）。UI 層で routine item を物理削除経路に流さない設計で Issue 017 を構造的に断つ
- **独立監査（role-qa 別コンテキスト）**: PASS / Blocker0 Major0 Minor0。Issue 017 が UI 非表示 + DataService 重複ガードの二重防御でコードパス上遮断されたことを実証。Dismiss→生成器再生成なし / routine item の Delete/Trash 到達不能 / Routine 削除 cascade / 手動 item 回帰なし / バグ1 folder select FK 不能 を全トレース。security/ipc/migration/sync-auditor いずれも不要判定（新規攻撃面・IPC・migration・sync 区分変更なし）。frontend/src-tauri/cloud/shared/supabase diff 完全 0、vitest 71/71 非回帰
- **commit**: `297ead6`（web 3 + S4 SSOT 1 行）pathspec 指定で `phase-2/schedule-migration` push。`03_demo_mobile_redesign.html`（無関係 untracked）除外
- **次/申し送り**: `phase-2/schedule-migration` を `refactor/web-first-v2` へマージ判断（ブランチ戦略ユーザー確認待ち）→ S5 WikiTags。S8 申し送り 6 項は S4 SSOT 維持。CalendarView の folder 0 件ヒント文日本語は web i18n 一括テーブル化（Settings S-step）時に回収（既知債務群と同レーン、新規債務でない）

### 2026-05-17 - Phase 2 S4 Schedule 移植 コード完了（子ブランチ phase-2/schedule-migration、7 サブステップ全 QA PASS）

#### 概要

Phase 2 最大規模ドメイン Schedule を子ブランチ `phase-2/schedule-migration`（`refactor/web-first-v2` の `c817c61` から分岐）で S4-0〜S4-6 の 7 サブステップに分割し、lead-pipeline 重チェーン（role-pm 分解 → ユーザー判断 → role-engineer 実装 → session-verifier → role-qa 独立監査、要所で security-reviewer / life-editor-sync-auditor 並列）で完了。アーキは Option A 厳守（shared UI フリー / web 新規ミニ UI）。`frontend/` `src-tauri/` `cloud/` は全サブで git diff 0＝不可侵厳守。並行チャット（移行 SSOT 復元・frontend リファクタ）が同一 working tree / 同一ブランチに同居したため全 commit を pathspec 指定（`git add -A` 厳禁、`.claude/MEMORY.md`/`HISTORY.md`/`CLAUDE.md` 不可侵）。0006 本番 apply（MCP write 凍結中＝手動 SQL Editor）と実ブラウザ確認は次セッション初手に持ち越し。S8（Realtime/delta）に向けた構造的申し送り 6 項を S4 SSOT に記録。

#### 変更点

- **S4-0 調査（role-engineer read-only）**: スキーマ正本特定（SQLite full_schema+v61_plus V69 / D1 0001+0004+0007 / shared/src/types 既存 forward-port 済）。sync 区分 7 テーブル確定（routine_groups/calendars は version 有・soft-delete 無＝物理削除 versioned、is_deleted 列を作らない）。date/start_time/end_time は text 厳守（timestamptz 化で JST 境界ズレ）。CalendarTag.id=integer identity。calendar_tag_definitions が cta FK 先で本体必須と判明→6→7 テーブルに修正
- **S4-1 migration+mapper（role-qa+security-reviewer 並列 PASS）**: `0006_schedule_full_schema.sql`（7 テーブル単一・FK 先行 CREATE 順・RLS owner-only 4policy×7・Issue 011 partial UNIQUE `(routine_id,date) WHERE routine_id IS NOT NULL AND is_deleted=false`・冪等 drop cascade 逆順・手動 SQL Editor ヘッダ）+ mapper 7 種 + roundtrip 16/16 + vitest（frequency_days JSON↔number[] 往復 / updatesToPatch whitelist）。security: Critical0 High0 Medium0、check-rls selftest 20/20 offender0
- **S4-2 SupabaseDataService（role-qa PASS Blocker0 Major0 Minor0）**: 7 テーブルの Proxy throw を実装置換。Issue 020（updateScheduleItem 単一 whitelist patch + maybeSingle 0行合成 return、read-then-write 排除）/ 008（rga unassign=is_deleted soft-delete-aware）/ 011（createScheduleItem (routine_id,date) live ガード）/ 017（softDeleteRoutine 子 schedule_items cascade soft-delete）
- **S4-3 RoutineProvider（role-qa PASS）**: Pattern A 3 ファイル + `useRoutinesAPI`（routines/groups/rga CRUD、DataService 注入、初回ロードガードで membership `[]` 全消失防止）+ `web/src/schedule/ScheduleView.tsx` + MainScreen 配線（Sync 内側・トリオ先頭）
- **S4-4 ScheduleItemsProvider（role-qa PASS）**: Pattern A + `useScheduleItemsAPI`（effect deps `[ds,syncVersion,date]`）+ `ScheduleItemsView.tsx` + RoutineProvider 内側配線。生成器 import/呼出 0 件（grep 実証）、createScheduleItem routine_id=null 固定
- **S4-5 Routine 生成器（role-qa+sync-auditor PASS）**: `routineScheduleSync.ts`/`routineFrequency.ts` を frontend から**論理 diff ゼロ**で shared/src/utils へ忠実移植（QA が実ファイル diff 実証、`shouldCreateRoutineItem` 弾き順序厳密一致）+ `useScheduleItemsRoutineSync`（DI: dataService/onChanged）+ `RoutineScheduleSync.tsx` headless トリガー + frequencyStartDate UI 追補。Issue 017 四系統ガード実証、vitest 17 パリティ追加（71/71）。sync-auditor: Critical0、High2/Medium3 は全て S8 申し送り（現状非顕在）
- **S4-6 Calendar+CalendarTags（role-qa+sync-auditor PASS）**: Calendar 通常 Pattern A + CalendarTags Pattern A + **Mobile Optional バリアント**（`useCalendarTagsContextOptional`+`createOptionalContextHook`、frontend MobileProviders 構成と整合）+ ctd integer-identity + web CalendarView/CalendarTagsView + 配線（Sync>Calendar>Routine>SI>CalendarTags）。**cta 孤児化対策**: `purgeCalendarTagAssignments` を物理削除 3 パスに配線（最大孤児源＝生成器 bulkDeleteScheduleItems カバー、permanentDelete は order-flip で live 行 tag 誤消去防止）。sync-auditor: Cloud 残留は解決済、cta 削除の delta 伝播は S8 持ち越し（tombstone or 親不在推論）
- **S8 必須申し送り（S4 SSOT 記録）**: ①rga delta は updated_at 直接ページング確定し親 routine bump 削除 ②cta tombstone 化（0006 に soft-delete 列追加 migration）or 親不在推論、task 側も同機構で一括 ③7 テーブルに server_updated_at 相当 or Supabase Realtime ④delta pull は cursor pagination（Issue 012 半実装回避）⑤ctd は full-replicate＝delta 対象外 ⑥Tauri→Supabase data import で schedule_items version 振り直し
- **commit/push**: S4-0〜S4-6 を 9 commit に分割（`567f860`→`d809f06`）、各 pathspec 指定で `phase-2/schedule-migration` へ push。親計画書 `2026-05-16-phase2-core-migration.md` の S4 を [x] 化（次=S5 WikiTags）、chat-web-migration outbox に S4 完了 + S8 申し送りをブロードキャスト
- **残課題**: 0006 本番 SQL Editor apply + 実ブラウザ Schedule CRUD/Routine 生成/Calendar 表示確認（次セッション初手、ヘッダ post-verify クエリ実行）→ S4 SSOT Verification クローズ → 子ブランチを `refactor/web-first-v2` へマージ → S5 WikiTags。実ブラウザ観測項目: 月高速連打の生成件数 + 生成直後ちらつき / Calendar inline-edit version+1 連打 / Mobile build で CalendarTags Provider 不在時 CalendarTagsView=null

### 2026-05-17 - 移行 SSOT 復元 + MEMORY/CLAUDE ドキュメント陳腐化一掃 + orphan DB 削除

#### 概要

ユーザー要請「MEMORY.md にすでに解決済み・矛盾があれば調査」→ general-purpose で MEMORY 予定/保留/バグ温床を移行 SSOT・コード実体・git・KI INDEX と突合棚卸し。調査中に**重大事故を発見**: 移行全体 SSOT `.claude/2026-05-04-cross-platform-migration.md`(495行) が commit `60f5f63`「docs: tidy migration Phase 2 planning docs」で*古い Tauri 期 docs 整理のついで*に巻き込まれ削除されており、CLAUDE.md が 5 箇所で参照する SSOT リンクが全てデッド。続くユーザー指示「陳腐化削除・orphan DB 削除・矛盾統一」に基づき復元と一掃を実施。並行 S4 チャットが共有作業ツリーを `phase-2/schedule-migration` へ切替済のため commit はそのブランチに着地（ユーザー判断で据置＝S4 マージ時トランクへ）。

#### 変更点

- **棚卸し（general-purpose・read-only）**: MEMORY 予定14+保留2+バグ温床16 を ✅解決済/🗑️陳腐化/🔄要リスコープ/✔️有効/❓ユーザー判断 で分類。frontend `npm run build`=green(予定[3]TSエラー解決確認)/`npm run lint`=109問題(未解消だが frontend は Phase5 drop)/orphan DB 実在/移行 SSOT デッドリンク を実証
- **移行 SSOT 復元（事故修復）**: `git show 60f5f63^:.claude/2026-05-04-cross-platform-migration.md`(495行)を逐語復元。Status 行のみ「S0-S3 完了・次 S4・最新は MEMORY/plans 正本・60f5f63 で誤削除→復元」に現状化。内容は陳腐化なし(2026-05-14 方針更新含む)。CLAUDE.md L5/L13/L45/L203 の SSOT リンク復活
- **MEMORY 予定 一掃**: 陳腐化 11 項目削除（[4]Q2 Cloud Sync検証/[5]リファクタ検証計画(デッドリンク)/[6]Realtime frontend SyncContext/[7]Mobile Re-syncボタン frontend/[8]Desktop cargo tauri build/[9]orphan DB(実施済)/[10]iOS実機受入/[11]iOS4G/[12]Mobile手動検証(新リデザイン計画へ)/[14]frontend lint 一括(Phase5 drop)/[1]Point Graph継続FB frontend）。[13]を「Capacitor Mobile 追加機能要件 backlog」へ統一(実装パスでなく機能要件のみ保持・Tauri-iOS/user-global plan 参照除去)。保留[15]Tauri IPC naming 削除・[16]React Compiler を「アーキ非依存・移行後判断」へ再框組み。[2]Mobile設計明文化は有効で保持。冒頭注記を「2026-05-17 一括削除済」へ更新
- **バグの温床 一掃**: Cloudflare D1/wrangler/Tauri-Xcode 専用 10 項目削除（c/d/g/h/i/j/m/n/o/p）。整理メモ残置。残置 a/b/e/f/k/l は移行後有効な恒久知見、f/k は【Supabase 文脈へ書換候補・未着手】注記
- **クロス参照ドリフト修正**: 予定[4]内「Known Issue 016 検討」死参照除去（016 は番号再利用され現 INDEX では別 issue=タスクツリー循環 OOM）/ バグ b「Known Issue 014」→「013(旧 014 統合分)」（014 は 2026-04-25 に 013 へ統合済の不在番号）。[4]自体は今回の陳腐化削除で消滅
- **CLAUDE.md §8 統一**: `2026-04-26-windows-android-port.md` デッドリンク（同じ 60f5f63 で削除）を「Windows/Android 配布は移行 SSOT Phase 5 に統合済・逐語は git 履歴」へ書換。`requirements/ios-additions.md`(実在)は据置
- **orphan DB 削除（破壊的・手順遵守）**: 削除前検証 — `com.lifeEditor.app/life-editor.db`(user_version=59, tasks=1/notes=1, 最終更新 2026-04-15＝旧バンドル残骸) を `~/Backups/orphan-life-editor-com.lifeEditor.app-20260517.db` へ単一ファイル退避後 rm（+shm/wal）。`sonic-flow/life-editor.db`(0byte/0table) は退避不要で rm。検証: `find` で `life-editor/life-editor.db`(active, user_version=70, tasks=2)のみ残存、別PJ `sonic-flow/sonic-flow.db` 保持を確認
- **commit（並行 S4 ブランチ着地・据置判断）**: セッション開始時 `refactor/web-first-v2` だったが並行 S4 チャットが共有作業ツリーを `phase-2/schedule-migration` へ切替済。SSOT 復元+MEMORY 初回整理は `f7738ac` としてそのブランチに着地(push は upstream 無しで未実行＝リモート影響0)。ユーザー判断「S4 ブランチに据置・git 追加手術なし」＝S4 マージ時にトランクへ自然到達。本セッションの追加 docs 編集も同ブランチへ pathspec commit。shared/(S4 並行作業)・frontend/ 不可侵維持、`git add -A` 厳禁
- **未着手（報告のみ）**: 🔄書換候補=バグ f/k(Supabase 文脈)・保留 React Compiler / ❓ユーザー判断=なし(Point Graph/[13] は今回整理で処置済、orphan DB 実施済) / 残デッドリンク=なし(windows-android-port は §8 統一済、refactoring-verification-plan は予定[5]ごと削除済)

### 2026-05-17 - shared+web セキュリティ監査 → H1 循環ガード退行修正 + 安全網テスト整備（pathspec commit/push 済）

#### 概要

ユーザーから 3 並行タスク（A=shared+web 脆弱性監査 / B=Phase 5 frontend リファクタ / C=未移植ドメイン安全網テスト）+「別チャットが Phase 4 Schedule 実行中なので注意」の要請。multi-session-coordinator 起動で**重要な誤認を是正**: 別チャット chat-refactor が進めるのは「frontend リファクタ計画の Phase 4」であり移行 SSOT の「Phase 4 = Schedule(S4) 移植」ではない（S4 は未着手・着手チャット無し）。chat-refactor は frontend リファクタ Phase 5 を「要承認」で保留中・MEMORY/HISTORY 不可侵宣言済＝本レーンが tracker 単独オーナー（並行 override 不要）。競合判定: A=Read のみ無衝突 / B=`frontend/src` が chat-refactor 専有書込レーン＝衝突確定 / C=`shared/`+`web/` 新規 `*.test.ts` 限定なら無衝突。ユーザー判断: B は chat-refactor レーンに委譲し本レーン非着手 / C は A の監査結果で対象決定（A→C 逐次）/ C スコープ=H1 修正+安全網テスト。lead-pipeline 中チェーン（security-reviewer 監査 → role-engineer 実装 → session-verifier → role-qa 別コンテキスト独立監査 → task-tracker）。

#### 変更点

- **multi-session-coordinator（状況是正）**: `.claude/active-sessions/` + `.claude/comm/outbox/chat-refactor.md` 照合で「Phase 4 Schedule 実行中」がユーザーの誤認（実体=frontend リファクタ Phase 4・commit 済 / Schedule S4 未着手）と判明。chat-refactor の forward-port 監査レポート（`.claude/reports/2026-05-17-shared-forward-port-audit.md`）を A の入力に活用、二重作業回避
- **タスクA セキュリティ監査（security-reviewer・read-only）**: `shared/src` + `web/src` + `supabase/migrations|scripts` を 7 観点（PostgREST インジェクション/RLS 網羅/秘密情報/認証/XSS/DoS/ソフトデリート）で監査。判定 Critical0 High1 Med3 Low3 + 既知債務1(悪化なし)。レポート `.claude/reports/2026-05-17-shared-web-security-audit.md`。**負の結果を明示**: service_role/PAT 非露出・`.env*` gitignore・全出荷テーブル RLS owner-only 4policy 正・`pgrstQuoteValue` 文法ブレイクアウト遮断・`dangerouslySetInnerHTML` 皆無・Link protocol allowlist 適切・ソフトデリートフィルタ漏れ無し
- **H1（新規 finding・forward-port 監査の盲点）**: `shared/src/hooks/useNoteTreeMovement.ts` のローカル `isDescendantOf` に循環ガード欠落。FP#1 は `getDescendantTasks.ts` の 3 関数だけ visited 化、forward-port 監査は本ヘルパを「判定対象外」と明記してスルー＝退行が残存。`parent_id` 循環で `moveNode`/`moveNodeInto` ドラッグ毎にメインスレッド凍結/OOM（KI-016 同型・別ファイル別ヘルパ）。0005 が自己参照 FK を許し Cloud Sync LWW で循環永続化しうる自己被害
- **タスクC H1 修正（role-engineer）**: 正本 `getDescendantTasks.ts:90-124` の `isDescendantOf` と探索構造が完全同一だったため visited Set パターンを構造そのまま忠実移植（target match を guard より前に維持＝2 ノード循環でも直接到達子を即検出、非循環は挙動完全不変）。コメントで KI-016 参照
- **タスクC 安全網テスト（role-engineer）**: shared に vitest `^4` 配備（`shared/vitest.config.ts`、`include:["tests/**"]`+node 環境）。**テストを `src/` 外の `shared/tests/` に分離**＝composite project（`include:["src"]`/`outDir:dist`）が dist にテストを emit し consumer 出荷する事故を構造回避（dist 非汚染を実確認）。A 監査 Top5 を新規 5 ファイル/30 テストでカバー（useNoteTreeMovement 循環停止+target-before-guard 不変条件 / pgrstQuoteValue 注入境界+M1 `%`/`_` ギャップを「修正でなく現状記録」と明示 / getDescendantTasks 3 関数 visited / noteUpdatesToPatch の password_hash・has_password・version 非混入 / walkAncestors 既存ガード pin）。可視性のみの最小 export 追加（`isDescendantOf` / `pgrstQuoteValue` を named export 化・ロジック不変）
- **session-verifier**: scope=shared/ のみ（frontend/ 無変更を git status 確認）。Gate1 型=`tsc -b` EXIT0 / Gate2 lint=shared 未配備でスキップ / Gate3 テスト=30/30 PASS / Gate4 カバレッジ=Top5 全カバー新規 export 使用済 / Gate5 構造=コメント有・死コード無 / Gate6 バグスキャン=循環ガード正当性を自己参照/2 ノード/3 ノードで手動トレース確認。PASS
- **role-qa 独立監査（別コンテキスト）**: APPROVE / Blocker0 Major0 Minor0。正本との 1 行照合・全循環パターン論理トレース・テスト実効性（修正前ハング入力を実投与+戻り値 assert）・バレル非汚染（`shared/src/index.ts` に未追加・テストは相対 import）・dist 非汚染（`find dist -name "*.test.*"` 空）・レーン制約（`git status --porcelain` で shared/ のみ）を実ファイル実証。security/sync/migration/ipc validator 追加起動は不要判定（防御強化+可視性のみ・スキーマ/IPC/sync 機構変更なし）
- **タスクB（非着手・委譲）**: Phase 5 frontend リファクタは chat-refactor の専有書込レーン＋当人が保留中の当該作業のため本レーンで起動せず。ユーザー判断で chat-refactor レーンに委譲（こちらからの outbox 通知は専有レーン侵害回避で行わない）
- **commit/push（task-tracker auto-git override）**: 計画書なし finding 起点だが実コード変更ありのため skill の「計画書なし→.claude/ のみ」ヒューリスティックを override。並行 chat-refactor frontend/ 同居のため `git add -A` 厳禁、パス明示指定（`shared/src/hooks/useNoteTreeMovement.ts` `shared/src/services/SupabaseDataService.ts` `shared/package.json` `shared/package-lock.json` `shared/vitest.config.ts` `shared/tests/` `.claude/reports/` 2 監査 `.claude/MEMORY.md` `.claude/HISTORY.md`）→ `refactor/web-first-v2` push（main 直 push 禁止維持）。`03_demo_mobile_redesign.html`（無関係 untracked）・`frontend/`・`.mcp.json` 除外
- **次/Backlog**: M1（searchNotes LIKE `%`/`_` 非エスケープ）は申し送り④と整合の既知ギャップでテストにより挙動固定（未修正）/ M3 list 系 pagination 欠落は将来課題 / web 側 vitest は対象テストが web に出た時点で配備 / 次セッション S4 Schedule 移植は従前どおり

### 2026-05-17 - Phase 2 S3 Notes PR1 正式クローズ（role-qa 独立監査 PASS）+ forward-port #1#2#3 適用（pathspec commit/push 済）

#### 概要

前セッションで実装・コミット済（02c9045）だが「未監査・計画書未クローズ」で宙吊りだった Notes Web PR1 を正式クローズ。並行チャット chat-refactor の handoff（`.claude/comm/outbox/chat-refactor.md` + `.claude/reports/2026-05-17-shared-forward-port-audit.md`、Critical 1 含む forward-port 5 件）と合流。lead-pipeline 重チェーン（role-pm 分解 → ユーザー判断 4 点 → role-engineer 実装 → role-qa 別コンテキスト統合監査 → 計画書クローズ → task-tracker）。role-pm が「次に進む」候補（PR1 QA / FP#1 / FP#2-5 / PR2 Backlog）を Tier 判定で分解し曖昧点 4 件を抽出。ユーザー判断: Q1=#1 先行→PR1 QA / Q2=FP #1+#2+#3 を今回（#4#5 はスコープ外）/ Q3=PR2 やらない / Q4=④ folder restore 子孫残存は既知制約として受容。FP#1#2#3 を shared/ に適用、PR1 を独立監査でクローズ。両監査とも Blocker0 Major0 PASS。chat-refactor は frontend/ レーンで MEMORY/HISTORY 非編集と handoff 明記、本レーンが tracker 通常管轄。

#### 変更点

- **role-pm 要件分解**: PR1 が 02c9045（前セッション）で①②③④実装済だが role-qa 未実施・計画書 [ ] のまま宙吊りと診断。「次」候補を Tier 化（FP#1=必須最優先・軽 / PR1 QA=必須・中 / FP#2#3=推奨・軽 / FP#4#5=任意 / PR2=任意・大）、曖昧点 4 件を AskUserQuestion で確認可能化。スコープクリープ警告（⑤を同 PR にしない / Q4(b) で PR1 再オープンしない / Critical 修正に UX 相乗りしない / #1 をついでにリファクタしない）
- **ユーザー判断 4 点**: Q1=#1 先行→PR1 QA（OOM ブロッカー最優先）/ Q2=FP #1+#2+#3 を今回（Critical+High+1行、#4#5 は MEMORY 予定へ）/ Q3=PR2 今回やらない（UX 段階的方針）/ Q4=④ folder restore 単一ノード制約=既知制約受容（Backlog⑧、再オープンしない）
- **FP#1 Critical（role-engineer）**: `shared/src/utils/getDescendantTasks.ts` の 3 関数（`getDescendantTasks`/`collectDescendantIds`/`isDescendantOf`）に visited ガード追加。`git show d62a2dc -- frontend/src/utils/getDescendantTasks.ts` の 3 hunk をそのまま適用（独自改変なし）。KI-016 同型 OOM（循環 parentId 無限ループ）を有限終了化、非循環入力で挙動完全不変。`shared/src/index.ts:63-67` 公開 export シグネチャ不変＝`useTaskTreeMovement`/`useTaskTreeDeletion` 経由の呼出側無改修
- **FP#2 High（role-engineer）**: `shared/src/types/wikiTag.ts` の `entityType: "task"|"memo"|"note"` → `WikiTagEntityType`（`"task"|"daily"|"note"`）参照化、型エイリアスを `WikiTagAssignment` の前へ移動。同ファイル :18 との型矛盾解消（daily タグ集計の死にコード化を是正）
- **FP#3 Mid（role-engineer）**: `shared/src/hooks/createContextHook.ts:9` `if (!value)` → `if (value == null)`（falsy だが non-null な Context value `0`/`""`/`false` の誤判定を排除、シグネチャ不変）
- **role-qa 統合監査（別コンテキスト・2 監査）**: A=FP#1#2#3 → マージ可（#1 は適用元 d62a2dc とバイト一致・`isDescendantOf` の一致判定がガード前で 2 ノード循環も即検出・非循環不変、#2 は shared 内 `entityType:"memo"` 残存 grep 0、#3 は consumer 4 件すべて非 primitive Context で回帰なし）。B=PR1(02c9045) → クローズ可（Verification ①②③④ 全達成、最重点④は hook 層 post-order DFS 子カスケード+`seen` 循環ガードで孤児化防止・データ層は単一行据置の設計妥当、restore 単一ノード制約は Backlog⑧ 明文化済で受容）。Blocker0 Major0、Minor2/Nit1 はいずれも実害なし設計妥当。security/sync/migration/ipc validator いずれも不要判定（IPC/スキーマ/sync 機構変更なし）
- **計画書クローズ（メイン）**: `2026-05-17-notes-web-parity.md` の Status を「PR1 COMPLETE（QA PASS）+ FP#1#2#3 適用済」へ、PR1 ①②③④ + Verification 全項目 + 新規 forward-port セクション #1#2#3 を [x] 化。FP#4#5 は [ ] スコープ外明記。Backlog⑤⑥⑦⑧ は据置
- **commit/push（task-tracker auto-git override）**: 並行チャット chat-refactor の frontend/ レーン同居のため `git add -A` 厳禁、6 パス明示指定（`shared/src/utils/getDescendantTasks.ts` `shared/src/types/wikiTag.ts` `shared/src/hooks/createContextHook.ts` `.claude/docs/vision/plans/2026-05-17-notes-web-parity.md` `.claude/MEMORY.md` `.claude/HISTORY.md`）→ `refactor/web-first-v2` push（main 直 push 禁止維持）。`03_demo_mobile_redesign.html`（無関係 untracked）除外
- **次/Backlog**: 次セッション S4 Schedule 移植（最大規模・着手前 role-pm 分解）。FP#4#5（型集約 Low・挙動不変）は別フェーズ。PR2 UX（⑤行内アクション収束/⑥drop indicator/⑦chevron 間隔）+⑧subtree restore は計画書 Backlog 記録済。HISTORY-archive ロールは並行チャット衝突回避で見送り継続（prepend のみ、エントリ数許容）

### 2026-05-17 - Phase 2 S3 Notes ステップ2(0005 実DB検証) + PR1 バグ修正 + 406 A-1 修正 + 循環ガード + known-issue 020（pathspec commit/push 済）

#### 概要

S3 申し送り①「0005 本番未apply＝実機未確認」を解消。ユーザーが 0005 を手動 SQL Editor 適用済の前提で、実 Supabase に対し検証を実行: 3テーブル rowsecurity=true + 各4policy / S0 RLS gate `check-rls.sql` 全文を MCP `execute_sql` で実行し offender0(sentinel のみ＝public 全テーブル clean) / PostgREST FK名 `note_links_source_note_id_fkey` ほか3 FK が実DBデフォルト命名と一致 / get_advisors(security) RLS lint0(WARN は無関係の auth_leaked_password_protection のみ)。続いて実ブラウザ評価をユーザーが実施し7問題を報告→方針確認「バグ修正優先・UX 段階的」。旧来 Tauri 版 frontend を Explore 調査し根本原因を file:line で確定、計画書 `2026-05-17-notes-web-parity.md` 作成(PR1 スコープ + PR2/3 Backlog + ⑧)。PR1 を lead-pipeline 重チェーン（role-engineer 実装 → role-qa 別コンテキスト独立監査 PASS-with-fixes Blocker0 → 明文化適用）で完了。未commit・実ブラウザ確認待ち。並行チャット IME refactor が frontend/ に同居継続のためコミットはパス指定必須。

#### 変更点

- **ステップ2 実DB検証(コード変更なし)**: Supabase MCP `execute_sql` で post-apply 検証。`pg_policies`/`pg_class.relrowsecurity`/`pg_constraint` 照会で notes(4)/note_links(4)/note_connections(4) policy + RLS有効 + FK4本(note_links_source/target_note_id_fkey, note_connections_source/target_note_id_fkey)を実証。`check-rls.sql` 全文(allowlist 空)を実行し戻り値が `___RLS_GATE_OK___` 単独＝offender0。`get_advisors(security)` は RLS 系 lint ゼロ
- **根本原因確定(Explore 調査)**: ①`NotesView.tsx:448` `key={id:title}` で debounce 保存→title 変化→input remount→focus 喪失(folder は prompt rename で無症状) ②`useNotesAPI.ts:486` `loadDeletedNotes()` 未呼出で `deletedNotes` 常時空→Trash `<details>` 非描画 ③unlock 状態管理不在で本文常時 full 描画・blur/overlay 無し ④folder はクリックで toggleExpand のみ→selectedNote 化せず右ペイン Delete 到達不能・行削除も無し
- **PR1 実装(role-engineer / 2ファイル)**: ①`NoteTitleInput` の key を `selected.id` のみへ(title 除去) ②初回ロード effect(`[ds,syncVersion]`)に `fetchDeletedNotes` IIFE 追加 + `softDeleteNote` で subtree を `setDeletedNotes` ローカル push(`known` Set で二重防止)・undo/redo も subtree 整合 ③`useState<Set>` セッション unlock + `hasPassword && !unlocked` で `RichTextEditor` を `blur-md select-none pointer-events-none`+`aria-hidden`、クリック overlay→verify→成功で unlock 追加 ④`NoteRow` に `group`+ホバー Trash2(stopPropagation)、hook `softDeleteNote` で post-order DFS 子孫収集→subtree 単位 `ds.softDeleteNote` 多重呼び(旧来は単発でカスケード無し＝今回改善)
- **独立監査(role-qa 別コンテキスト)**: PASS-with-fixes / Blocker0。Major1=② syncVersion 再ロードと楽観 push のレースは総置換 SSOT で最終収束(実害=Trash 件数一瞬チラつきのみ)・現状維持推奨。Minor=folder restore 非対称(子孫 Trash 残存)未明文化。検証 tsc/eslint/build 実出力で追認。security-reviewer/migration-validator/sync-auditor は不要判定(IPC/スキーマ変更なし・認証は既存 verifyNotePassword 委譲)
- **明文化適用(メイン)**: `useNotesAPI.ts restoreNote` 直前に「restore は単一ノードのみ＝folder 子孫 Trash 残存(PR1 既知制約・Backlog⑧)」コメント追記。計画書 Backlog に「⑧ subtree restore」追加 + Verification④ を実態へ更新
- **実ブラウザ確認(ユーザー手動)**: ①②③④ いずれも機能 OK。ただし本文編集/アンマウント時に別系統コンソールエラー `notes?select=version&id=eq... 406` → `updateNote failed: Cannot coerce the result to a single JSON object` を報告
- **406 根本原因(debug-strategy)**: 楽観 create(`useNotesAPI.createNote` ローカル即追加 + fire-and-forget INSERT) × `SupabaseDataService.updateNote` の version read `.single()`(0行 throw)。INSERT 完了前の unmount flush→updateNote→未確定行 select 0行→PostgREST 406。データ破壊なし(ローカル state 保持・次 flush 救済)。MEMORY S8 申し送り「upsert read-then-write LWW」の前倒し顕在化。StrictMode 二重 invoke は増幅要因(一次でない)
- **406 修正 案 A-1(role-engineer)**: `SupabaseDataService.ts` notes `updateNote` の version read を `.single()`→`.maybeSingle()`、0行は DB write skip + well-formed 合成 node return(戻り値は全呼出 `.catch` 終端で非消費を横断 grep 確認)、真エラー `if(readErr)throw` は維持し 0行と区別。横展開判断: `upsertDaily` は元から `.maybeSingle()`→INSERT 継続で無変更(skip 化すると Daily 保存回帰)、`toggleBoolean`/`nextVersion` は明示操作経路でレース通路でなく戻り値契約上 0行の正解非一意のため意図的現状維持(known-issue 020 残課題で追跡)
- **循環ガード追加(メイン・軽)**: PR1 ④ の subtree `collect` に `seen: Set<string>` ガード。破損 parentId 循環での無限再帰(known-issues 016 タスクツリー OOM 同型)を有限打ち切り。正常木では発火せず post-order DFS 不変(統合 role-qa が正当性検証)
- **known-issue 020 起票**: `docs/known-issues/020-supabase-readthenwrite-single-zero-row-race.md`(Root Cause/Impact/Fix/横展開判断/残課題=案B createNote await・案C flush 差分ガード・toggleBoolean/nextVersion 0行確定/Lessons=`.single()` 禁則・upsert vs update-only 分岐則) + INDEX 更新(Bug カテゴリ、Fixed 集計整合、grep キーワード)。Status=Fixed
- **統合最終監査(role-qa 別コンテキスト)**: PASS / Blocker0 Major0。循環ガード正当(seen.add タイミング・leaf/通常木挙動不変・循環有限打ち切り)、A-1 正当(真エラー/0行区別・upsertDaily 回帰なし)、PR1 既知制約維持。検証 web/shared `tsc -b`+eslint+vite build 実出力 green、frontend/src-tauri/cloud diff0 非破壊、`.mcp.json` 参照プレースホルダ維持、§8 更新不要(Tier1 既存 Notes バグ修正)。security/sync/migration/ipc validator いずれも不要判定
- **commit/push(メイン・task-tracker auto-git override)**: 並行チャット IME refactor(frontend/)同居のため `git add -A` 厳禁、QA 承認の 8 パス明示指定 commit(`shared/src/hooks/useNotesAPI.ts` `shared/src/services/SupabaseDataService.ts` `web/src/notes/NotesView.tsx` `.claude/docs/known-issues/020-*.md` `INDEX.md` `2026-05-17-notes-web-parity.md` `MEMORY.md` `HISTORY.md`)→ `refactor/web-first-v2` へ push(main 直 push 禁止維持)。`03_demo_mobile_redesign.html`(無関係 untracked)除外
- **次/Backlog**: 次セッション S4 Schedule 移植(最大規模・着手前 role-pm 分解)。PR2 UX(⑤行内アクション収束/⑥drop indicator/⑦chevron 間隔)+⑧subtree restore は計画書 Backlog 記録済

### 2026-05-17 - クロスプラットフォーム移行 Phase 2 S3(Notes) コード完了（Option A 確定 + 0005 スキーマ + lean TipTap + password/lock UI）

#### 概要

Phase 2 S3（Notes ドメイン Web 移植）をコード完了。lead-pipeline 重ティアのフルチェーン（session-manager START → role-pm 分解 → execution-router 戦略 → role-engineer 実装 → session-verifier → role-qa+security-reviewer+frontend-react-designer 並列独立監査 → 集中修正 → security 再確認 → task-tracker END）。8 サブタスクを Group A(並列: deps+schema) → B(backend) → C(frontend) で実装。**最重要のアーキ決定: Option A 確定**。計画書 SSOT の「`frontend/components/Notes → shared/components/Notes`」記述は S1/S2 実装が既に意図的逸脱しており実態と乖離（shared は UI フリー＝context/hooks/services/types のみ / web/src/<domain>/ に shared データ経路を叩く新規ミニ UI）。role-engineer が矛盾を検出しメイン差し戻し→ユーザー承認で Option A に統一、計画書文言も実態へ補正。Group A が投機的に shared へ追加した TipTap/@dnd-kit を web へ移動。3 監査いずれも Blocker/致命 AntiPattern ゼロ、PASS-with-fixes の安く高価値な指摘を集中修正パスで解消。**0005 本番未apply＝実ブラウザ動作確認は次セッション初手**。working tree に並行チャットの未コミット IME 安全化リファクタ(frontend/ ~30ファイル)が同居、frontend/ 全除外のパス指定ステージで完全分離。

#### 変更点

- **アーキ決定 Option A**: shared UI フリー維持（S1/S2 実態準拠）。`shared/src/context/NoteContext`(Pattern A 3ファイル) + `hooks/{useNoteContext,useNoteTreeMovement,useNotesAPI}.ts` + `utils/generateId.ts` のみ追加。UI は `web/src/notes/` に新規記述（移植でなく目的特化リーン実装）。TipTap/@dnd-kit/lucide-react は frontend lock 同バージョンで `web/package.json` へ（Group A が shared に追加→Option A 確定で web へ移動）。計画書 `2026-05-16-phase2-core-migration.md` の S0-S3 を [x] 化 + S3 に Option A 実態注記を追加（S4 以降も Option A 前提と明記）
- **0005_notes_full_schema.sql**: `notes`(versioned: 階層 parent_id/order/soft-delete/version/`has_password` generated col `password_hash is not null`/`is_edit_locked`/password_hash 非SELECT) + `note_links`(versioned) + `note_connections`(relation: 最小列・実体削除)。3テーブル全て RLS enable + owner-only 4 policy(`to authenticated`+`auth.uid()=user_id`) + `user_id default auth.uid()`。0003/0004 と byte 一致パターン、S0 ゲートロジック機械シミュレートで 3テーブル CLEAN
- **shared services**: `noteMapper.ts`/`noteLinkMapper.ts`(SELECT_COLUMNS 素カラム名のみ・password_hash 非選択・SQL 式混入ゼロ＝S2 再発防止知見遵守) + `noteMapper.roundtrip.ts`(10/10 PASS) / `SupabaseDataService.ts` notes/noteLink/noteConnection 系25メソッド本実装（Proxy throw 全置換、version read-then-write、plaintext-equality 踏襲+将来 RPC 化債務コメント3箇所）
- **web/src/notes/**: `NotesView.tsx`(階層ツリー+DnD+pin/lock/password 配線+Loading/Error 状態) / `RichTextEditor.tsx`(lean TipTap=見出し/リスト/リンク/コード等、debounce 800ms+flush、Link protocols allowlist) / `NotePasswordDialog.tsx`(set/remove/verify、role=dialog+aria-modal+focus 管理+aria-invalid/describedby) / `useNoteTreeDnd.ts`(@dnd-kit→shared move glue)。`MainScreen.tsx` に NoteProvider(§6.2 順 Daily の後・Sync 内)+notes セクション、`index.css` に .note-editor notion トークンスタイル
- **3監査並列(別コンテキスト)**: role-qa=PASS-with-fixes(Blocker0/要件6項目全達成/移植忠実性 frontend useNotes と制御フロー一致) / security-reviewer=Critical0 High0 Medium2(RLS 3テーブル clean 静的トレース実証・password plaintext 踏襲で悪化なし=0004 と同型・XSS 安全) / frontend-react-designer=致命AntiPattern0(notion トークン/IME/i18n props PASS、要修正は a11y/状態網羅)
- **集中修正パス**: B1(password set 失敗が「required」と誤表示するバグ修正+NotesView Loading/Error 状態を S1 手本準拠で追加) / A2(dialog input aria-invalid+aria-describedby) / A3(全 interactive 要素 focus-visible リング定数化) / B2(title input を子コンポ+key 再マウントで debounce 化) / B3(submit aria-busy) / A1(focus trap 意図的延期コメント) / security Low-1(Link protocols allowlist) / **security Medium-1+qa Important**: `deleteNoteConnectionByPair` 未エスケープ補間 + `searchNotes` の不正エスケープを共通ヘルパ `pgrstQuoteValue`(PostgREST ダブルクオート囲み+`\`/`"` エスケープ)に統一(DRY)。security 再確認で「修正方式妥当・注入経路遮断・退行なし・Critical/High/Medium なし」
- **検証**: session-verifier(Group B 後)PASS。全工程後 直接検証: shared `tsc -b`=0 / web `tsc -b`+eslint+vite build green / **frontend `tsc -b`=0(並立非破壊実測)** / noteMapper round-trip 10/10 / password_hash 非SELECT・SQL 式混入ゼロ grep。スコープ封じ込め確認(shared/web/supabase のみ、src-tauri/cloud 無変更)
- **commit**: パス指定ステージ（shared/src の note 系9ファイル + SupabaseDataService + context/index.ts + index.ts + shared/package*.json / web/src/notes + MainScreen + index.css + web/package*.json / supabase/migrations/0005 + .claude tracker/plan/active-sessions）。**frontend/ 配下(並行チャット IME refactor ~30ファイル) は1ファイルも stage せず**、`.claude/2026-*.md`削除・`.mcp.json`・frontend-refactor plan の M も `git add -A` 不使用で完全分離

#### 残課題

- **[次セッション初手・最重要] 0005 本番未apply**: SQL Editor 手動 apply 後 (a)S0 RLS ゲート実DB実行 (b)PostgREST FK名 `note_links_source_note_id_fkey` デフォルト命名一致確認 (c)カンマ/括弧/`\` 入り検索 sanity (d)実ブラウザ Notes CRUD/階層DnD/lean TipTap/backlink/password・lock 動作確認
- **[既存債務・悪化なし]** plaintext password の RPC security-invoker 化が将来の正攻法（コード/SQL コメント既設、Medium-2）。Low-A: searchNotes の LIKE メタ %/\_ 非リテラル化は Tauri SQLite LIKE 同挙動＝移植方針上現状維持が正
- **[インフラ候補]** shared/web に vitest 未配備で Gate3-4 SKIP。Phase 2 横断で一括整備候補（最優先=noteMapper/noteLinkMapper 純粋関数, useNoteTreeMovement 循環ガード）。designer 改善: prefers-reduced-motion 一括無効化 / NotesView 英語直書きの i18n テーブル化(Settings S-step)
- **[アーキ・S4 前提]** Option A 確定。S4 Schedule も shared UI フリー / web 新規ミニ UI、TipTap/dnd 等は web 側。計画書文言は補正済
- **[別チャット同居]** working tree に並行チャット IME 安全化リファクタ(frontend/ ~30+imeSafe.ts/test+useSlashCommand.ts)が未コミット同居。S3 commit はパス明示で frontend/ 全除外、`git add -A` 厳禁。HISTORY-archive ロールは衝突回避で見送り継続(prepend のみ、エントリ数許容)

### 2026-05-16 - クロスプラットフォーム移行 Phase 2 S2(Daily) 完了（PostgREST select バグ修正 + generated column 化 + 実機 parity 実証）

#### 概要

S2 は「コードのみ commit 済・実機未確認」だった。手動 parity 確認で本番ブロッカーを発見: `dailyMapper.ts` の `DAILY_SELECT_COLUMNS` に PostgREST 非対応の SQL 式 `password_hash is not null as has_password` が埋め込まれ、`column dailies.password_hashisnotnullashas_password does not exist` の 400 で Daily 全 read/upsert が全滅、本番 `public.dailies` は 0 行（fire-and-forget な upsertDaily がエラーを握り潰し optimistic state のみ生存→リロードで消失）。root cause を実機コンソールで確定後、サブエージェント分担で構造修正（実装=role-engineer / 監査=role-qa=APPROVE W/C + security-reviewer=PASS W/N、いずれも別コンテキスト）。0004 を本番 SQL Editor 再適用（MCP write は前提未達で凍結維持）、MCP read-only で RLS owner-only 4 policy + `has_password` generated column ALWAYS を実証、実機 parity green。password 設定 UI は web DailyView 意図的未実装のため S3 へ申し送り（ユーザー承認）。ブランチ refactor/web-first-v2、別チャット（frontend-refactor + doc 整理）同居でパス指定ステージ。

#### 変更点

- **root cause（PostgREST select の SQL 式不可）**: PostgREST `select=` はカラム名 or DB 側 generated column / computed field のみ受理し任意 SQL 式を評価しない。`password_hash is not null as has_password` がスペース詰めで存在しないカラム名として 400 化。`DAILY_SELECT_COLUMNS` を使う全 read/upsert（fetchAllDailies / fetchDailyByDate / fetchDeletedDailies / upsertDaily の .select / setDailyPassword / removeDailyPassword）が全滅していた。tasks は別 mapper のため無事
- **修正（generated column 化）**: `0004_dailies_full_schema.sql` の `password_hash text` 直後に `has_password boolean generated always as (password_hash is not null) stored` を追加（raw hash 非投影のセキュリティ要件を維持しつつ PostgREST が素のカラム名で projection 可能に）。`dailyMapper.ts` の `DAILY_SELECT_COLUMNS` を SQL 式 → 素カラム名 `has_password` に修正、`DailyRow`/`DailyWriteRow`/各 docstring を generated column の事実へ整合更新。`dailyMapper.roundtrip.ts` はコメントのみ。0004 の idempotent `drop ... cascade`+create / RLS 4 policy / `enable row level security` / `user_id default auth.uid()` / `date not null unique` は不変
- **本番再適用 + RLS 実証**: 0004 をユーザーが SQL Editor 再適用（idempotent・現状 0 行で損失なし）。MCP read-only で `rls_enabled=true` / `policy_count=4`（select/insert/update/delete 全 `to authenticated`+`auth.uid()=user_id`、UPDATE は USING+WITH CHECK）/ `has_password_is_generated=ALWAYS` / `generation_expression=(password_hash IS NOT NULL)` / `password_hash` 列存続を確認。`get_advisors(security)` のテーブル RLS lint 0
- **実機 parity 実証**: pin parity を実機操作 + MCP 客観確認。`daily-2026-05-16` が content 再編集を繰り返し `version=9` まで `is_pinned=true` を保持（DEFAULT 潰れなし＝PostgREST merge-duplicates の partial-payload DO UPDATE が送信列のみ更新）、リロード永続化、`restoreDaily` も機能。`password_hash` は `is_pinned` と同一の upsert payload 非含有列で帰納的に parity 成立（role-qa が PostgREST セマンティクスで論理確認）
- **監査**: role-qa=APPROVE WITH COMMENTS（Blocker0/Important0、全 write パス精読で generated column write 混入なしを独立再確認、round-trip 8/8 独立再現、frontend `tsc -b`=0 非破壊）/ security-reviewer=PASS WITH NOTES（Critical/High/Medium0、raw `password_hash` 非到達維持・むしろ改善、RLS 不変、インジェクション余地なし、plaintext-equality は既存債務で悪化なし、Low2 は将来提案）
- **検証**: session-verifier 3 回 PASS（role-engineer / role-qa 独立再現 + メイン最終差分）— web `tsc -b`=0 / frontend(Tauri) `tsc -b`=0 非破壊 / dailyMapper round-trip 8/8
- **commit**: パス指定ステージ（`shared/src/services/dailyMapper.ts` `dailyMapper.roundtrip.ts` `supabase/migrations/0004_dailies_full_schema.sql` + `.claude/MEMORY.md` `.claude/HISTORY.md`）。別チャット領域（`.claude/2026-*.md` 削除 / `.mcp.json` / `.claude/docs/*` / HISTORY-archive ロール）は `git add -A` 不使用で巻き込まず

#### 残課題

- **[再発防止知見]** PostgREST `select=` に任意 SQL 式不可（カラム名 or generated column / DB 関数のみ）。computed boolean は generated column 化が定石。S3+ の mapper でも厳守。known-issues 起票は別チャット doc 整理(`.claude/docs/known-issues/*`)衝突回避で見送り＝MEMORY が記録正本
- **[軽微・別途修正候補]** 0004 冒頭コメントが「APPLY VIA SUPABASE MCP apply_migration — NOT manual SQL Editor paste」と実運用（MCP write 凍結＝SQL Editor 手動）に不整合
- **[要ユーザー判断]** `get_advisors(security)` の `auth_leaked_password_protection` WARN（dailies 無関係の Supabase Auth 設定・HaveIBeenPwned 照合無効）。完成後/友達配布時判断
- **[S3 申し送り]** password 設定/解除/lock UI は web DailyView 意図的未実装で S3(TipTap + password/lock dialog 横断)に移譲（ユーザー承認済）。upsertDaily payload 付近に partial-payload 意図コメント追記推奨(Suggestion) / plaintext-equality password の docs/known-issues 化は Phase 後段 / password verify の raw hash クライアント転送は既存債務(悪化なし・将来 RPC security invoker 化案)
- **[未解消・要ユーザー]** PAT 露出インシデント止血継続（MCP write 昇格前提=専用組織/write時のみ token/直後 check-rls/破壊的 DDL 人間目視/版固定 未達のため write 凍結維持）/ upsert read-then-write LWW(S8) / SyncProvider 二重ラップ(S8) / `web/src/TasksScreen.tsx` dead code 要確認
- **[別チャット同居]** `.claude/HISTORY-archive.md.bak`・frontend-refactor・doc 整理が混在。HISTORY-archive ロールは衝突回避で見送り継続（HISTORY.md は prepend のみ、6 エントリ許容）

### 2026-05-16 - クロスプラットフォーム移行 Phase 2 S2 コード完了 + Supabase MCP 採用 + token インシデント止血（0003 本番適用・RLS 実証）

#### 概要

S1 完了後: 0003 を本番適用（Phase1 同様 SQL Editor 経由＝`supabase db push` は履歴テーブル不在+非タイムスタンプ命名で不発の既知問題判明）、Supabase MCP read-only で **0003 RLS 実証**（advisor lints 0 + owner-only 4 policy 確認、42P05 pooler 問題を MCP で回避）。Supabase 接続の摩擦解消のため **Supabase MCP Server を Phase 2 migration/検証経路に採用**（公式パッケージ・`--read-only`・`--project-ref` スコープ・token は env 間接参照）。S2（Daily 移植）コード実装完了（role-engineer→role-qa=APPROVE W/C）。**セキュリティインシデント**: `.mcp.json` に PAT 平文ベタ書きを security-reviewer が検出（git tracked・未 commit で止血間に合い）、`${SUPABASE_ACCESS_TOKEN}` 間接参照へ修正。token ローテーション等はユーザー対応（下記残課題）。ブランチ refactor/web-first-v2、別チャット（frontend-refactor + doc 整理）と同居でパス指定ステージ。

#### 変更点

- **0003 本番適用 + RLS 実証**: tasks が text id・28列・CHECK(type/status/folder_type/priority)・FK・rows 0 で稼働。Supabase MCP `get_advisors(security)` lints 0 + `pg_policies` 4 owner-only policy（SELECT/INSERT/UPDATE/DELETE すべて `to authenticated` + `auth.uid()=user_id`、UPDATE は USING+WITH CHECK）を確認＝S1-9 の RLS/スキーマ検証完了（実ブラウザ CRUD は残）
- **Supabase 接続知見**: `supabase db push` 不発（履歴テーブル無し+`0001_`命名）/ Transaction pooler 6543+`pgbouncer=true` は prepared stmt 非互換(`42P05`)/ パスワード percent-encode 必須。memory `project_supabase_migration_gotchas` に記録。解決＝MCP 採用
- **Supabase MCP 採用**: `.mcp.json` に `@supabase/mcp-server-supabase@latest --read-only --project-ref=mcrfdnjplfmqwnwbcbol`、token は `${SUPABASE_ACCESS_TOKEN}` 間接参照。`supabase/scripts/db-push.sh` 新規（gate→`--db-url` push 1コマンド化、URL 手打ち全角スペース混入回避）+ `package.json db:push` 差し替え。`check-rls.sql` を Postgres compound ORDER BY 準拠に修正（派生テーブルラップ、self-test 20/20）
- **S2 Daily コード**: `0004_dailies_full_schema.sql`（id text PK=`daily-<date>`/user_id default auth.uid()/soft-delete/version/RLS owner-only 4 policy、0003 と同形、冪等）/ `dailyMapper.ts`+`roundtrip.ts`（ランタイム検証・`Omit<...,"user_id">`・往復8/8）/ `SupabaseDataService` daily 12メソッド（`DAILY_SELECT_COLUMNS` は `password_hash is not null as has_password` 投影で raw hash 非返却）/ `DailyContext`(Pattern A)+`useDailyAPI`+`dateKey` / `web/src/MainScreen.tsx`(旧 TasksScreen rename)+`daily/DailyView.tsx`(plain textarea、TipTap は S3)。バグ3自己修正（App.tsx 参照漏れ/roundtrip コメント`*/`早期終了/DailyView setState-in-effect）
- **検証**: session-verifier（engineer+QA 独立再現）PASS — shared/web/**frontend `tsc -b`=0 非破壊** / web vite build / eslint / dailyMapper round-trip 8/8 / check-rls self-test 20/20

#### 残課題

- **[Critical・要ユーザー] PAT ローテーション必須**: `sbp_2d4f...` が会話ログ・`~/.zshrc`・監査ログに露出。Supabase Dashboard で Revoke→再発行、新 token は `~/.zshrc`(`chmod 600`) のみ、`~/.zsh_history` の旧 token も削除。完了まで **MCP write(`apply_migration`) 凍結＝0004 本番適用不可＝S2 未完**
- **[要ユーザー] MCP write 昇格前提（security High）**: 専用 Supabase 組織分離 / write 時のみ token 投入・作業後 unset / `apply_migration` 直後に同セッション check-rls 検証 / 破壊的 DDL は人間が SQL 目視 / `@latest`→バージョン固定
- **[S2 完了条件] 0004 適用後の手動 upsert parity 確認**（QA High-1）: 新規日作成→pin/password 設定→本文再編集 blur→pin/password 保持を実機確認するまで S2 完了マークしない
- **[申し送り] password 平文保存・平文比較**（Tauri 1:1 移植 pre-existing、raw hash 非返却は QA 確認済）/ upsert read-then-write LWW(S8) / SyncProvider 二重ラップ(S8 再構成) / upsert payload から id 除外(Suggestion) / `web/src/TasksScreen.tsx` 残存（MainScreen rename 後の dead code 要確認）
- **[別チャット同居]** `.claude/HISTORY-archive.md.bak`・frontend-refactor の `frontend/**/*.test.*`・known-issues・doc 整理が混在。S2 commit はパス明示で巻き込まず（`git add -A` 禁止）。HISTORY-archive ロールは別チャット圧縮と衝突回避で見送り

#### 概要

`.claude/archive/` 肥大化の解消と、CLAUDE.md / MEMORY.md 等の矛盾調査をサブエージェント3並列で実施。(A) archive 圧縮統合、(B) HISTORY-archive コンパクト化、(C) ドキュメント矛盾調査 を独立ワークストリームで並行。ユーザー判断: archive 個別プランは要約統合後に全削除 / HISTORY-archive は古い部分のみ要点圧縮し最近は温存 / サブディレクトリも対象 / vision-tauri も含め全削除 / 矛盾修正は Top3+#3 / 検出した未起票 known-issues を新規作成。並行して Claude Desktop に life-editor MCP サーバを登録（config はリポジトリ外 `~/Library/.../claude_desktop_config.json`、GUI 起動のため node 絶対パス必須）。ブランチ refactor/web-first-v2、別チャットの pre-existing 変更（shared/ web/ 等 38 ファイル）と分離するためパス指定で `.claude/` のみコミット。

#### 変更点

- **archive 圧縮統合**: `.claude/archive/` の 28 プラン .md + TODO.md + サブディレクトリ docs/dropped/rules/vision-tauri（計 50 tracked ファイル）を `git rm`。`archive/SUMMARY.md`（283 行 / 元 601KB → 約 22KB、96% 削減）に「目的 / 結果採否 / Lessons」をテーマ別5グループで圧縮統合。削除前に vision-tauri の恒久知見（単一データソース原則 / 無料 Apple ID 7日署名制約 / Realtime レイテンシ目標）を SUMMARY.md へ抽出（逐語原文は git 履歴で復元可）
- **HISTORY-archive コンパクト化**: `HISTORY-archive.md` 1257 行/269KB → 413 行/82KB（69% 減）。実効カットオフ 2026-04-29（指示の 2026-04-01 だと対象ゼロのため調整）、2026-04-29 以降は逐語温存、2026-04-19〜04-27 の Tauri 期 29 エントリを要点圧縮（見出し45件は全保持）。原本を `HISTORY-archive.md.bak` に退避（git 未追跡・コミット対象外）
- **ドキュメント矛盾修正（Top3+#3）**: ①リンク切れ解消 — CLAUDE.md §8 / MEMORY.md / 移行SSOT の `vision-tauri/`・`docs/vision/realtime-sync.md` 等を `archive/SUMMARY.md` へ張替（残参照0確認）②Phase 表記 — CLAUDE.md §1 + 移行SSOT Status を「Phase 1 着手準備中」→「Phase 2 進行中（Phase 1 完了 / S0・S1 完了 / S2 準備中）」③IPC 同期矛盾 — `coding-principles.md` の「3 点同期」→「4 点同期」+ DataService.ts 追記 + 正本=CLAUDE.md §7.2 明記 ④MCP ツール数 — CLAUDE.md §5.1「30 ツール」→ 実数 32 + Schedule に dismiss/undismiss 追記
- **known-issues 新規 3 件**: 017（カレンダーに soft-deleted task 残存 + Routine 削除後 schedule_items 再生成）/ 018（macOS WebKit で button クリックが focus を奪わず autoFocus input の blur 先行）/ 019（createPortal 配下 DOM 分離で click-outside 誤発火しパネル即閉じ）。INDEX.md に Fixed 追記 + Category/Status 集計更新（Fixed 11→14、合計 12→15）。mobile-data-parity Provider バイパスは既存 009 で収載済のためスキップ、D1 multi-statement は web-first 移行で廃止予定のため起票せず
- **Claude Desktop MCP 設定**: `~/Library/Application Support/Claude/claude_desktop_config.json` の mcpServers に `life-editor` 追加（既存 pencil 保持）。GUI アプリは nvm の PATH 非継承のため `command` に node 絶対パス（`/Users/newlife/.nvm/versions/node/v20.20.0/bin/node`）指定。mcp-server を `npm run build` で最新化（dist は gitignore 対象）、起動スモークテストで tools/list 応答確認。リポジトリ外変更のため commit 対象外

#### 残課題

- **`HISTORY-archive.md.bak`（1257 行・git 未追跡）**: 当面保持。`.gitignore` 追加 or 削除はユーザー判断（MEMORY.md S1 申し送り⑤と連動）
- **Agent C 検出の残 5 件未修正**: 🟡 core.md「Web UI 非対象」自己矛盾 / §7.1 に Web スタックコマンド欠落、🟢 §3.4「全テーブル sync」/ §3.3 Section Routing の Tauri 前提 / MEMORY.md 予定セクション凍結化。今回は Top3+#3 のみ指定のため別タスク
- **コミット範囲**: 作業ツリーに別チャットの pre-existing 変更（shared/ web/ App.tsx 等 38 ファイル）混在。本コミットはパス指定で `.claude/` のみ、`git add -A` 不使用で完全分離

### 2026-05-16 - クロスプラットフォーム移行 Phase 2 S1 完了（Tasks 移植: 0003 スキーマ + SupabaseDataService + shared TaskTree）

#### 概要

Phase 2 S1（Tasks ドメインの Web 移植）を完了。サブエージェント分担（実装=role-engineer / 監査=role-qa+security-reviewer / 統括=メイン）。tasks を `0001`(uuid id, RLS deny-all) → **`0003`(text id = CLAUDE.md §4.3 準拠, owner-only 4 policy) に破壊的 rebuild**。`SupabaseDataService` の tasks 系を Phase1 最小4メソッドから9メソッド全列実装へ拡張、`row.status as TaskNode["status"]` 型詐称を `taskMapper.ts` のランタイム検証へ撤廃（申し送り④解消）。`frontend/src/components/Tasks/` の Tauri 非依存ロジック（hooks/context/utils）を依存注入化して `shared/src/` へ移植、web に @dnd-kit ベースの機能的 TaskTree UI を新規実装。TipTap(TaskDetail)/i18n/UndoRedo フルチェーンは計画書通り S3/S6 に分離（web は no-op UndoRedo 注入）。監査: role-qa=APPROVE WITH COMMENTS（回帰独立再現 frontend/web/shared `tsc -b`=0）、security-reviewer=SECURE WITH RECOMMENDATIONS（0003 RLS 完全・IDOR 不成立・check-rls ゲート論理通過 offender 0、Critical/High なし）。Important-1（folder_type の DB CHECK 欠落↔validator 乖離）を 0003 push 前に CHECK 追加で解消。ブランチ refactor/web-first-v2、別チャット frontend-refactor 同居のためパス指定ステージ。

#### 変更点

- **0003_tasks_full_schema.sql 新規**: tasks 全27カラムを Postgres 化（`id text primary key` クライアント生成 §4.3 / `type`/`status`/`folder_type`/`priority` を CHECK 制約化 / `parent_id text references tasks(id)` / `"order" integer` / soft-delete `is_deleted`+`deleted_at` §4.4 / `user_id uuid not null default auth.uid()` / `version integer default 1`）。`drop table ... cascade` で 0001/0002 を破壊的 rebuild（Phase1 残骸ユーザー掃除済）。RLS enable + owner-only 4 policy（select USING / insert WITH CHECK / update USING+WITH CHECK / delete USING すべて `to authenticated` + `auth.uid()=user_id`）。1 ファイル完結（README 分割禁止規約準拠）
- **shared services**: `taskMapper.ts` 新規（純マッパー、`toNodeType/toStatus/toFolderType/toPriority` が不正値で throw = 型詐称撤廃、`TaskWriteRow=Omit<TaskRow,"user_id"|"due_date">` で server-derived 列を書き込みから除外）/ `taskMapper.roundtrip.ts`（往復8ケース、Node 直実行）/ `SupabaseDataService.ts` tasks 9メソッド全列実装（fetch/create/update/permanentDelete/fetchDeleted/syncTaskTree/softDelete/restore + migrateTasksToBackend=no-op）
- **shared context/hooks/utils 移植**: Pattern A 3ファイル `TaskTreeContext{Value}` + web 用 no-op `SyncContext`（§6.3 例外条項明文化、`syncVersion=0` 固定）+ barrel。`useTaskTree{API,CRUD,Deletion,Movement,History}` を DataService/UndoRedo/config 依存注入化（§6.4 準拠、UndoRedo は `createNoopUndoRedo()` 注入で S6 置換可能）。`walkAncestors/folderTag/getDescendantTasks/sortTaskNodes` 等 tree utils（`SortDirection` を UI 非依存に独立化）
- **shared React 化**: `shared/package.json` に react を peer(>=19)+dev / `@types/react` dev、`tsconfig.json` に `jsx:react-jsx`+`types:["react"]`。S0(b) composite/project-references 設計維持（web/frontend `tsc -b` 双方0で実証）、peerDependency 化で React 実体重複回避。計画書 Files 表に追記要（S1 達成に不可分の必要変更と QA 判定）
- **web 配線**: `web/src/tasks/TaskTreeView.tsx` 新規（@dnd-kit core/sortable/utilities、notion トークン、CRUD/階層/soft-delete/restore/trash）、`TasksScreen.tsx` を Provider 配線（§6.2 順 Sync→TaskTree、`createSupabaseDataService` 注入）。`web/package.json` に @dnd-kit 追加
- **RLS ゲート回帰拡張**: `check-rls-selftest.sh` に B9/B10（0003 qual パリティ）+ C2（0003 静的構造）追加 = 18/18
- **Important-1 解消**: 0003 L64 `folder_type text` → `check (folder_type is null or folder_type in ('normal','complete'))`。DB CHECK と `taskMapper::toFolderType` 受理集合 `{null,normal,complete}` を完全一致（type/status/priority 3列と設計統一）。ゲートは pg_constraint 非参照のため非回帰、self-test 18/18・round-trip 8/8 維持
- **検証**: session-verifier コミット前ゲート PASS — shared `tsc -b`=0 / web `tsc -b`=0 / **frontend `tsc -b`=0（非破壊実測）** / web `eslint`=0 / web `vite build` green / self-test 18/18 / round-trip 8/8

#### 残課題

- **[要ユーザー対応] SUPABASE_DB_URL パース失敗**: `supabase/.env` 配置済だが pooler 接続文字列のパスワード部に未エンコード特殊文字（`net/url: invalid userinfo`）。RLS ゲート本番実行は exit 2(INCONCLUSIVE) で正しく fail-safe（誤 PASS せず）。0003 push 前にパスワードを URL エンコード or Session pooler/Direct connection 文字列へ要修正
- **[S1-9 未実施] 実ブラウザ CRUD/DnD 検証**: SUPABASE_DB_URL 修正 → `npm run db:check-rls` green → `npx supabase db push`(ユーザー確認) → web で実 CRUD/DnD/soft-delete/restore + RLS 実証（別アカウントで他者行不可視）。S8 Realtime 未実装のため他タブ非反映は想定挙動
- **[S8 へ申し送り] M1 version 非増分**: softDelete/restore/update が `version` を増分せず LWW 同期前提と乖離。複数デバイスで削除復活リスク（自分のデータ範囲）。S8 同期実装で対処
- **[低優先 申し送り]** M2 mutation 0行サイレント / L1 0003 再適用 runbook / L2 parent_id FK on delete 未指定 / Suggestion(Proxy Symbol ガード, created_at クライアント送信) → S2 以降
- **[別チャット同居]** 作業ツリーに frontend-refactor-pre-migration（別チャット）の `frontend/src/**/*.test.ts`・`vitest.config.ts`・`known-issues/*`・plan `.md`・`HISTORY-archive.md.bak` が混在。S1 commit はパス明示で `supabase/migrations/0003*` `supabase/scripts/check-rls-selftest.sh` `shared/` `web/{src,package*.json}` + `.claude` tracker のみ、`git add -A` 不使用で完全分離

### 2026-05-16 - クロスプラットフォーム移行 Phase 2 S0 完了（RLS 漏れ検出ゲート + tsconfig project references 化）

#### 概要

Phase 2（コア機能 Web 移植）の申し送り先行対処 S0 を完了。サブエージェント分担（設計=role-pm / 実装=role-engineer / 監査=role-qa+security-reviewer / 統括=メイン）。**S0(a)** Supabase は anon key 公開前提のため RLS 漏れ = 全行流出 Critical。`supabase db push` 前に「RLS 無効 / policy 0件 / 全開 policy（anon・public ロール / 無スコープ述語 / WITH CHECK 欠落 / auth.uid() 非 owner 等値）」を機械検出するゲートを新設。初回監査で security-reviewer が **VULNERABLE（Critical-1: 全開 policy 素通り）** を指摘、engineer 3 ラウンド + 監査 3 ラウンドで Critical-1 / High-1（`auth.uid() is not null` 型すり抜け）/ High-2（migration 分割 deny-all 盲点）/ Medium-1,2 / Low-1 を全 CLOSED、self-test 15/15。番兵行方式で接続失敗を安全側（exit 2）に倒し「未検証なのに push 通過」を構造的に排除。**S0(b)** `shared` を composite project 化 + `web` を project references 化（Phase 1 申し送り②）。`frontend/`(Tauri) `tsc -b`=0 で並立非破壊を維持。ユーザー判断: tasks id 型=text（CLAUDE.md §4.3 準拠）/ S0(b) を S1 前実施 / 検証は本番直 push（S0a ゲートを安全網に）/ Phase1 検証残骸はユーザー手動掃除。ブランチ refactor/web-first-v2、別チャット Point Graph 同居のためパス指定ステージ。

#### 変更点

- **S0(a) RLS ゲート（新規）**: `supabase/scripts/check-rls.sql`（pg_catalog/pg_policies read-only 走査。`relkind in ('r','p')`、5 検出器: rls_disabled / no_policy / anon_or_public / unscoped_true / qual_no_authuid + insert_no_check + owner_table_no_authuid WARN、`(table_name, why_reason)` 複合 allowlist で誤検知のみ WARN 降格・detector は弱めない、末尾番兵行 `___RLS_GATE_OK___`）/ `check-rls.sh`（stdout・stderr 分離、番兵有無で完走判定 → 接続失敗 exit 2 / leak exit 1 / safe exit 0、`source .env` 廃止し `SUPABASE_DB_URL` 1 行のみ安全抽出、DSN パスワードマスク、`tail -n +2` でヘッダ除去）/ `check-rls-selftest.sh`（DB レス 15 ケース、SEC-High-1 B4/B5 含む）/ `supabase/package.json`（`db:check-rls` && `db:push` 直列、`db:check-rls:selftest`、supabase devDependency 固定）/ `supabase/README.md`（1 テーブル 1 migration 分割禁止明文化、ゲート射程外節 = view/SECURITY DEFINER/owner bypass/foreign table は手動レビュー、複合 allowlist 運用手順、WARN/BLOCK 表記是正）
- **S0(b) tsconfig project references**: `shared/tsconfig.json` を `composite:true`+`declaration`+`declarationMap`+`outDir:dist`、`shared/package.json` に `build`(tsc -b) + `typecheck` が build 兼任の旨注記 + main/types/exports を dist 指す。`web/tsconfig.app.json` の `include` から `../shared/src` 除去 → `references:[{path:"../shared"}]` + `paths` を `dist/index.d.ts`、`web/tsconfig.json` solution に shared 参照追加。`web/package.json` build を `tsc -b --force && vite build`（dist stale 耐性）。`.gitignore` に `shared/dist/` `supabase/node_modules/` + `supabase/.env` 多層防御コメント
- **計画書追記**: `.claude/docs/vision/plans/2026-05-16-phase2-core-migration.md` の S0(b) 決定（Vite=shared/src 直 import / tsc=shared/dist .d.ts の二経路維持、web `tsc -b` を正、references が cascade build、型定義削除/リネーム時は `rm -rf shared/dist` 後 build）を追記
- **検証**: session-verifier コミット前ゲート PASS — shared `tsc -b`=0 / web `tsc -b`=0 / **frontend `tsc -b`=0（非破壊実測）** / web `eslint`=0 / web `vite build` green（174ms）/ `bash -n` ×2 OK / self-test 15/15。TS/React ソース変更ゼロ・frontend/src-tauri/cloud 無変更・Point Graph ファイル無変更を構造確認
- **監査収束**: round1 QA=APPROVE W/C・security=**VULNERABLE** → round2 security=Crit-1/High-2 **CLOSED**・新規 High-1 → round3 security=High-1 **CLOSED / S1 着手可 Yes**。当初の anon-key 公開前提の致命的 RLS 偽陰性を S1 で実 policy を書く前に封鎖

#### 残課題

- **[非ブロッカー] `%true%or%`/`%or%true%` over-report**: Phase 2 で `is_public OR owner` 系の意図的公開 policy を誤 BLOCK しうる。allowlist 1 行（`(table, 'policy_qual_no_authuid')`）で WARN 降格・セキュリティ実害なし。S1 で共有テーブル設計時に「誤 BLOCK → allowlist 登録」フローを事前周知
- **[要ユーザー対応] 実接続検証ブロック中**: `SUPABASE_DB_URL` 未提供のため pg_catalog 実走査は未実施（self-test で論理担保）。最初の Phase 2 新テーブル push 直前に `supabase/.env` へ接続文字列を置き `npm run db:check-rls` green を 1 回必須（README 運用ルール化済）
- **[要ユーザー対応] Phase1 検証残骸**: `rls.a@gmail.com` / `rls.b@gmail.com` / テスト行 "A-task" を Supabase ダッシュボードから手動掃除（S1-1 適用前推奨）

### 2026-05-16 - Connect/Node タブを Point Graph (Canvas2D + d3-force) へ全面置換

#### 概要

別チャットで、Connect タブの Node サブタブを React Flow ベース `TagGraphView`（1438 行）から Canvas2D + d3-force の Point Graph に全面置換。添付の `PointGraphView.jsx` デモと `point-view-implementation-plan.md` を基に、life-editor 実コードへ適合させた専用計画書 `2026-05-13-point-graph-connect-node.md`（12 ステップ）を作成→実装。汎用計画の前提（新規 Memo ビュー / Rust `graph_load_snapshot` 新設）は本タスクでは不要と判断し、既存 props からフロントで `GraphSnapshot` を合成（Rust/DB/MCP 完全不変・読取のみ）。実装後、ユーザー追加要望で「フィルタパネルの閉じる手段追加 / Connect モード廃止 / 左 perf HUD 削除」を追補。各ステップ個別コミット、計画書は archive へ。ブランチ refactor/web-first-v2（別セッションのクロスプラットフォーム移行と同居、パス指定ステージで相互非干渉）。

#### 変更点

- **データ合成（S2）**: `usePointGraphModel` が `notes/dailies/tags/assignments/noteConnections/noteLinks` から GraphSnapshot を生成。folder→project / note→note / daily→daily / tag→独立ノード（`tag:` prefix）。エッジ 5 種（hierarchy=parentId / wikilink=noteLinks / manual=noteConnections / tag=assignments / temporal=daily 連鎖）。`sourceMemoDate`→`daily-<date>` で daily id 整合（旧 `memo-` 不整合を是正）、両端非存在エッジ破棄、deleted 除外
- **テーマ（S3）**: `graph-theme.ts` が `--color-*` CSS 変数を `getComputedStyle` で解決し Canvas 描画色化。`MutationObserver`(data-theme/class) でライト/ダーク + テーマ切替に追従。Catppuccin ハードコード全廃（§6.4 準拠、不透明背景）
- **Canvas/Sim（S4-S5）**: `usePointGraphSimulation`（d3-force ライフサイクル / 位置キャッシュ / forceX-Y センタリング / リサイズ時リセンタリング / 4s 永続化）+ `usePointGraphInteraction`（d3-zoom / window pointer drag で指が外れても切れない / quadtree hit-test / 選択スムーズパン=interrupt+authoritative zoomTransform+no offsets / ホバー隣接強調 / ズームゲートラベル k≥0.85）。React 19 `react-hooks/refs` 厳格 lint に合わせ ref アクセスを effect 内へ移動、位置キャッシュ復元も sim effect 内へ
- **UI（S6-S7）**: notion トークン化 primitives（Slider/Toggle/IconButton/Section）、`GraphControlPanel`（キャンバス内フローティング・折りたたみ Section 6）、`SelectedNodeCard`、`GraphTopBar`。`graph-filters.ts` 純粋パイプライン（type/tag/search-1hop/local-graph/orphan）+ `useGraphFilters`。i18n `connect.graph.*`（en/ja）。`set-state-in-effect` 回避のため外部選択同期は「レンダー時 prev 比較で state 調整」公式パターンに
- **連動・既存機能保全（S8-S9）**: `sidebarSelectedItemId`/`selectedTagId`/`focusedNoteId` ↔ 選択+パン双方向、グラフ tag ノード選択→`onSelectTag`。ダブルクリック遷移 / `UnifiedColorPicker`（onUpdateNoteColor）/ manual エッジ click 削除（線分 hit-test）/ Delete soft-delete / 位置・ビューポート永続化（d3 座標系のため `POINT_GRAPH_*` 専用キー新設、React Flow ストレージと非衝突）
- **スワップ・整理（S10-S11）**: `ConnectView.tsx::renderContent` の `case "node"` を `<PointGraphView/>` に（ReactFlowProvider ラッパ除去、Board は不変）。props 同一 I/F で無改修。旧 Node 系 9 ファイル削除（`TagGraphView`/Note・DailyNodeComponent/CurvedEdge/forceLayout/layoutTemplates/TagGraphSelectionContext/tagGraphStorage+test、ユーザー確認後）。`reactFlowMerge`/`CanvasControls` は Paper で継続使用のため保持
- **追補（ユーザー要望）**: `GraphControlPanel` にヘッダ X 閉じるボタン + 外側 `pointerdown` 検知で閉じる（トップバーのトグルは `data-marker="panel-toggle"` で除外し再オープン防止）、`useGraphFilters.closePanel` 追加。Connect モード一式廃止（ボタン/クリック接続フロー/ConnectPanel/pending state/Esc 分岐/onConnectViaTag 配線）。左 perf HUD（稼働ドット/α/fps/Cpu）削除（node/edge 数・clear-filters・zoom% は保持）。連鎖で孤立化した `ConnectPanel.tsx` を削除（session-verifier 検出 + ユーザー指示）
- **Verification**: `tsc -b` 0 / eslint（PointGraph + ConnectView スコープ）0 / `vite` 本番ビルド成功（7.11s、d3 import エラーなし、チャンク警告は既存大バンドル由来） / 新規 `graph-filters.test.ts` 8 件 + `reactFlowMerge.test.ts` 17 件 pass / session-verifier 2 回 PASS。コードベース他所の eslint 36 件は既存負債（本変更非該当・未修正）

#### 残課題

- **手動 UI 検証未実施**: ライト/ダーク配色・FPS（ノード ~1000）・ドラッグ/ピンチ体感・パネル外クリック閉じ・ConnectSidebar 連動・ノード→エディタ遷移はヘッドレスのため未確認。`cargo tauri dev` で Connect→Node タブ要確認
- **[INFO] keydown effect が `filters` 全体依存**: 毎レンダー再購読（機能影響なし・性能微）
- **並行セッション同居**: refactor/web-first-v2 に別セッションのクロスプラットフォーム移行 WIP（Mobile/migration/generateTaskId 等の未コミット変更）が同居。本タスクはパス指定ステージで分離コミット、`git add -A` 不使用

### 2026-05-16 - クロスプラットフォーム移行 Phase 1 完了 — 新スタック土台 + Supabase Auth/RLS（RLS 実証済み）

#### 概要

Tauri+D1 → Electron+Capacitor+Web+Supabase 移行の Phase 1 に実着手。サブエージェント分担（管理=multi-session-coordinator / 設計=role-pm / 実装=role-engineer / 監査=role-qa+security-reviewer、メイン=統括）。2 ラウンド: (R1) Supabase 不要の自走部スキャフォールド commit `d1abd8a`、(R2) ユーザー Supabase 作成後の Auth/RLS/CRUD 配線 commit `ce6a5cb`。両ラウンドとも role-qa=PASS / security=Critical/High0。**コードは Phase 1 着手順序 1-9 完了、migration リモート適用 + RLS runtime 実証のみユーザー操作 2 ブロッカーで保留**。

#### 変更点

- **web/ 新規**: `npm create vite@latest -- --template react-ts` 雛形 + Tailwind 4（`@tailwindcss/vite`）。notion-\* トークンは frontend/src/index.css から最小限 9 トークンのみ移植（1490 行丸ごとコピーしない）。`npm run dev`/`npm run build` 通過確認
- **shared/ 新規**: `@life-editor/shared`。`frontend/src/services/DataService.ts`（約200メソッド）+ 依存型23ファイルを **byte 一致 verbatim コピー**（`diff -q` 確認）。`SupabaseDataService.ts` は tasks 系4メソッドのみ実装、他は Proxy で `not implemented in phase 1` throw（`value.bind(target)` で this.client 解決バグを実装中に自己検出・修正）
- **supabase/migrations/0001_initial.sql 新規**: `tasks` テーブル + **RLS enable（policy 無し = deny-all fail-safe）**。security-reviewer の Medium 指摘（anon key 公開前提で RLS が唯一の防御、警告不在）を受け WARNING コメント + 先行 RLS 有効化で安全側に倒した。policy + `user_id default auth.uid()` は Phase 1 step 7（Supabase 作成後）
- **.gitignore**: `.env*.local` 全変種を root で除外（`git check-ignore` で web/.env.local まで実検証クリーン）。秘密情報非追跡を commit 前に担保
- **不可侵維持**: `frontend/` `src-tauri/` `cloud/` `desktop/` `mobile/` は一切作成・変更なし（Phase 2/3/4 前借りゼロ、role-qa スコープ監査 PASS）
- **R2 supabase/migrations/0002_rls_tasks.sql 新規**: `user_id set default auth.uid()`（クライアントは user_id 非送信＝サーバ導出で詐称不能）+ owner-only CRUD 4 policy。security Low 指摘を受け全 policy に `to authenticated` を追加（式評価 + ロール層の二重防御）。idempotent（drop if exists→create）
- **R2 shared/services 追加**: `supabaseClient.ts`（モジュール単一インスタンス＝Auth と DataService が同一 JWT/セッション共有、RLS 空振りアンチパターン回避、`detectSessionInUrl:false`）/ `SupabaseAuth.ts`（signUp/signIn/signOut/getSession/onAuthStateChange、Email+PW、Confirm email オフ前提）。`SupabaseDataService.ts` を共有クライアント利用に変更
- **R2 web/ 配線**: `App.tsx` を session ゲート（loading→Auth/Tasks）に rewrite、`AuthScreen.tsx`/`TasksScreen.tsx` 新規（notion-\* 最小 UI、TasksScreen 初回 fetch は active-guard 付き inline effect で StrictMode/unmount stale 回避）。`@supabase/supabase-js` 追加、`@life-editor/shared` alias、`.gitignore` に `supabase/.temp .branches .env`
- **監査**: 両ラウンド role-qa=PASS（スコープ違反0、frontend `tsc -b`=0 で非破壊実測）/ security=Critical0 High0。Phase2 申し送り＝①新テーブル RLS 漏れの CI 機械検証 ②`tsconfig` project references 化 ③`signOut` scope 堅牢化
- **並行作業**: 別チャットが Point Graph を並行コミット（f996339 / 7bef5f8 他）。Phase 1 は web/ shared/ supabase/ .gitignore のみパス指定ステージで完全分離（`git add -A` 不使用、別チャット frontend WIP / SSOT doc を巻き込まず）。commit `d1abd8a`（R1）/ `ce6a5cb`（R2）
- **ブロッカー解消（ユーザー操作）**: ①`web/.env.local` URL をホスト形式へ修正 ②supabase CLI 非対話ログイン不可 + メールレート制限のため、0001/0002 を **Supabase SQL Editor で適用**（CLI 管理は Phase5 へ申し送り）③メール確認 OFF + ダッシュボードで Auto Confirm ユーザー 2 名手動作成し probe を signUp→signInWithPassword 方式へ変更
- **RLS 実証完了（probe）**: `supabase/.temp/probe.mjs`（gitignore 済）実行で 完了判定 5/5 達成 — 未認証 read 0 行 / USER A signIn→insert(user_id=auth.uid() 既定)→自分の 1 行可視 / USER B は A の行 0 件・delete 0 件 / `frontend/`(Tauri) `tsc -b`=0。実証後 probe 削除（成果物に残さず）。SSOT `2026-05-04-cross-platform-migration.md` の Phase 1 完了判定 5 項目を [x] 化
- **後始末**: throwaway 検証ユーザー `rls.a@gmail.com`/`rls.b@gmail.com` + テスト行 "A-task" はユーザーが Supabase ダッシュボードから削除（要対応・記載）
- **commit**: `d1abd8a`(R1) / `ce6a5cb`(R2) / `ec540ec`(tracker) + 本クローズ tracker commit。次フェーズ Phase 2（コア機能 `shared/` 移植）はユーザー指示待ち

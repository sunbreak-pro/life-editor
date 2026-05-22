# HISTORY.md - 変更履歴

### 2026-05-23 - モバイルUIプロトタイプ環境 計画策定（要件定義書01 + 実装計画書02）+ Artifacts 原本隔離

#### 概要

Claude Artifacts 上で磨いてきた 3 つのモバイル版デモ TSX（Schedule 統合 / Work / Materials）を、本番 `frontend/` のビルド・データ層オーバーヘッドから切り離して実環境確認できるよう、純粋 Web の Vite 単体プロトタイプ環境を設計。ユーザー提供の要件定義書原稿（`~/dev/apps/01_要件定義書_プロトタイプ環境.md`）を `.claude/docs/vision/plans/01_要件定義書_プロトタイプ環境.md` として配置し、続いて Phase 0-4 の実装計画書 `02` を作成。実装（Vite 環境構築）は未着手で、本セッションは「計画策定 + 原本隔離（Phase 0）」がスコープ。

#### 変更点

- **配置判断（本セッションの核）**: ユーザーが当初 3 TSX を `.claude/docs/vision/plans/` に置いていたが、`.claude/` は本番ビルド対象外かつ「完了プランは archive 送り」運用のため動く部品の置き場として不適と指摘。専用ディレクトリは repo root の `prototype/`（要件定義書 §6 が既に指定）が正と判断
- **要件定義書 01**: ユーザー原稿を逐語配置。UI/UX 工程と CRUD 工程の完全分離 / 独立起動（`/schedule` `/work` `/materials`）+ 統合プレビュー（`/unified` 下タブ）/ 依存最小（react / react-router-dom / lucide-react / vite / tailwind v3 のみ、Tauri・Electron・Capacitor・Supabase 禁止）/ 1ファイルTSX維持 / Catppuccin Mocha 固定 / Provider・Context 不使用 / 永続化なし
- **実装計画書 02（新規作成）**: Phase 0（原本隔離）〜 Phase 4（README + マージ）を具体コマンド + 完了チェック + 想定工数付きで策定。オープン課題（要件定義 §11）への回答案: ブランチ=`prototype/mobile-ui` / フォルダ=`prototype/` / ルータ=HashRouter / Settings=プレースホルダ / 配色=`const C` JSオブジェクト方式（原本踏襲）
- **要件定義との差分検出**: 要件定義 §2.3 は Catppuccin を `bg-[#xxxxxx]` arbitrary value 想定だが、原本実物は `const C = {...}` + インライン style 方式。移植差分最小化を優先し原本方式を採用、計画書 §3 / §8 に明記
- **Phase 0 実行（原本隔離）**: `life editor unified demo.tsx` / `mobile work section demo.tsx` / `materials demo.tsx` の 3 点を `.claude/docs/vision/plans/` から `prototype/_artifacts/` へ移動（凍結原本＝以後改変せず Phase 2 移植元 + 不変要件マニフェスト MV-1〜SIDEBAR-1 の照合基準に）
- **commit/push（今回のセッション分のみ）**: ユーザー明示の「今回のセッションのみ」に従い pathspec 指定（`git add -A` 厳禁）。対象=`01`/`02` 計画書 + `prototype/` + `.claude/MEMORY.md` / `HISTORY.md` / `HISTORY-archive.md`。ブランチは現状 `data-unification/items-meta-redesign`（計画書は本来 `prototype/mobile-ui` 想定だが、planning docs のため現ブランチに同居・ユーザーへ申し送り）
- **HISTORY ローリングアーカイブ**: 6 件目追加に伴い最古エントリ（2026-05-17 shared+web セキュリティ監査）を `HISTORY-archive.md` へ移動、HISTORY は最新 5 件保持

### 2026-05-23 - Data Unification 親計画書策定（旧 Phase 3 → 改名）+ Phase 2 完全クローズ + ブランチ準備

#### 概要

Schedule セクション全体の再設計（unified-item モデル）の親計画書を lead-pipeline 重ティアフルチェーンで策定。Calendar/Dayflow/Tasks/Events の 4 タブ + 並立データモデル（tasks/schedule_items/routines/notes/dailies）を、`items_meta`（共通メタ）+ `payload`（種別詳細）のハイブリッド 2 層へ統一する設計。実装は未着手（計画書策定のみがスコープ）。Phase 命名は移行 SSOT の Phase 3（Electron 包装）と衝突するため「Data Unification」へ改名。Phase 2（S0-S4 コア移植）を完全クローズし、`refactor/web-first-v2` へ FF マージ。

#### 変更点

- **要件確定（Q1-Q15）**: ユーザーと 3 ラウンドの対話で確定。スコープ=5 種（task/event/routine/note/daily）統一 / DB=ハイブリッド（items_meta + 5 payload + 7 専用/relation = 13 テーブル）/ 既存データ=破壊的リセット（calendars 系 3 テーブルは Phase 2 のまま維持）/ Calendar=月+3 日の 2 ビュー（Dayflow 廃止）/ role=本質型・変更不可（作り直し UX）/ payload=専用列厚く JSONB 最小（Notes/Daily の content_json のみ）/ RoutineGroup・WikiTag・wiki_tag_groups=専用テーブル独立 / template_event=専用列分解
- **プロセス（重ティアフルチェーン）**: session-manager(START) → role-pm（要件分解・Phase 分割・リスク R1-R13）→ 親計画書作成 → role-qa **3 周独立監査**（1st: Blocker3+Major7+Minor5=15 項 / 2nd: Blocker2+Major3+Minor2=7 項 / 3rd: 表記 2 項）すべて解消
- **Phase 分割**: DU-A(DB スキーマ) → DU-B(Tasks)/DU-C(Events+Routine)/DU-D(Notes+Daily) → DU-E(Calendar 2 ビュー) → DU-F(WikiTag/WikiLink グラフ)。子計画書は Phase 進行時に都度作成
- **成果物**: `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md`（v3、commit `dcc8484`）+ HTML ビュー派生 `.claude/reports/2026-05-21-data-unification-items-meta.html`（git 非追跡）
- **Phase 2 完全クローズ + ブランチ準備**: `phase-2/schedule-migration` を `refactor/web-first-v2` に FF マージ（merge commit なし）→ 新ブランチ `data-unification/items-meta-redesign` 作成 + push。S5 WikiTags 旧計画は本計画に吸収（旧ファイルは commit 8ceae24 で削除済、設計領域は Data Unification が継承）
- **HISTORY ローリングアーカイブ**: 13 エントリ蓄積していた HISTORY を最新 5 件保持に整理。S3 系以前の 9 エントリ（2026-05-17 PR1 クローズ以前）を HISTORY-archive.md へ移動（archive 47→56 件）
- **申し送り**: `origin/refactor/web-first-v2` への push は保留（並行チャット chat-refactor の共有ブランチのため要調整）/ DU-A 着手は Supabase 破壊的 apply の最終承認が前提（二段承認）/ Phase 2 S8 申し送り（Realtime/delta sync）は Data Unification でも継承

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

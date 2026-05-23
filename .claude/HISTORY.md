# HISTORY.md - 変更履歴

### 2026-05-23 - Data Unification DU-B-1 完了（0009 v3-rev2 + 差分 v3-rev3 + 0010 本番 apply + 検証 9 件クリア + PG 落とし穴 2 件解消）

#### 概要

Data Unification DU-B-1 (DB schema + composite FK + policy hardening) を本番 Supabase に apply 完了。子計画書 v1 → 3 監査 (migration-validator / role-qa / security-reviewer) で v2 化 (Blocker 1 + Major 5 + High 2 + Medium 1 + Low 1 反映) → v3 apply 試行で **PG 制約に起因する apply エラーを 2 段階で解消**: (a) GENERATED 列 + composite FK に SET NULL 不可 (SQLSTATE 42601) を NO ACTION 化、(b) 全体再 apply で UNIQUE 依存連鎖 (2BP01) を差分 SQL 化。advisor 持ち込み WARN 2 件を v3-rev3 で initplan キャッシュ化 (`(select auth.uid())`)、さらに 0010 で DU-A 由来 6 policy も同型化 → items_meta + tasks_payload 範囲で auth_rls_initplan WARN 0。検証 9 件 (A-G SQL + RLS gate + advisor) すべてクリア。次フェーズ = DU-B-2 (taskMapper 2 行分割書き換え) 着手判断。

#### 変更点

- **DU-B 子計画書 v1 → v3-rev3**: `.claude/docs/vision/plans/2026-05-23-data-unification-b-tasks.md`。v1 で Recovery Playbook R1-R8 + ロールバック SQL 雛形 + 0009_rollback.sql 整合 + Risks 8 件網羅 + DoD 11 項目を確定 → v2 で 3 監査の Blocker-1 (softDelete → hard delete) + Major 1-5 + H1-2 + Medium-1 (parent EXISTS 追加) + Low-A (旧 index drop) を反映 → v3 で apply 試行 → v3-rev2 で ON DELETE NO ACTION 化 + v3-rev3 で initplan キャッシュ化、すべて経緯 SSOT として保存
- **親計画書 v3 への DU-B 確定事項反映**: `parent_item_id 設計判断`「composite FK + ON DELETE NO ACTION」/ `Sync への影響`「mapper 側で updated_at bump 明示」/ `Migration 戦略`「0009 追加 + クライアント直列 atomicity」3 章を annotation 追記
- **0009_tasks_payload_parent_fk.sql (260 行、v3-rev3 最終)**: items_meta `(id, role)` UNIQUE 追加 + tasks_payload composite FK (`parent_item_role` text generated always as ('task') stored + `(parent_item_id, parent_item_role) REFERENCES items_meta (id, role) MATCH SIMPLE ON DELETE NO ACTION`) + parent_item_id 側 EXISTS policy 強化 (security Medium-1) + 旧単独 index `idx_tasks_payload_parent` drop (Low-A) + 新規補助 index 2 本 + policy 内 `auth.uid()` を `(select auth.uid())` でラップ (initplan キャッシュ化、Supabase 公式 RLS ベストプラクティス)。POST-APPLY VERIFICATION A-I を末尾コメントに完備、F は NO ACTION 検証 (子がいる親 hard-delete 拒否 + 子先消し後の親消し成功) の 2 段
- **0009_rollback.sql**: 7 操作対称巻き戻し (policy 復元 / composite FK drop / 列 drop / UNIQUE drop / 単独 FK 復元 / 補助 index drop / 旧単独 index 復元)、再 apply 前の cross-role 違反行確認 SQL を header に
- **0010_du_b_initplan_cache.sql (94 行)**: DU-A 由来 items_meta 4 + tasks_payload 残 2 (select/delete) = 6 policy を `(select auth.uid())` 化。DU-B-1 ついで修正 + DU-D Notes で初版から踏襲する型を確立。0003-0006 由来 56 件は別 plan「initplan cleanup plan」へ申し送り
- **check-rls-selftest 拡張**: B11/B12 ケース追加で 0008 payload の owner-eq + EXISTS 二重防衛 qual が gate に緑判定されることを実証 (22/22 緑、DU-A 申し送り④消化)
- **DB-Q1/Q2/Q3 ユーザー確定**: (Q1) Atomicity = クライアント直列 2 回 invoke、createTask try/catch で **hard delete** (softDelete は Sync TrashView 汚染で v2 改訂) / (Q2) updated_at bump = mapper 側で明示 invoke (DB トリガ不採用) / (Q3) cross-role parent 防止 = composite FK 採択
- **3 監査並列起動 → 全 APPROVE**: migration-validator (整合性) / role-qa (要件達成 + リスク + DoD) / security-reviewer (composite FK セキュリティ)。v2 改訂後の軽量再監査も APPROVE
- **本番 apply 4 段階**: (1) 0009 v2 → 42601 で失敗 (transaction rollback で DB 無傷) (2) v3-rev2 (NO ACTION) → apply 成功 + A-G 検証クリア (SQL Editor は postgres role で auth.uid() = NULL のため user_id 明示が必要と判明) (3) v3-rev3 全体再 apply → 2BP01 で失敗 (UNIQUE drop が composite FK 依存で blocking) → 差分 SQL (policy 2 本だけ drop + create) で成功 (4) 0010 apply → 6 policy initplan キャッシュ化成功
- **検証 9 件 (A-G + RLS gate + advisor) 全クリア**: A 1 row / B 2 row / C 'task' / D-G 全成功 / E と F-1 は期待通り FK violation / RLS gate `___RLS_GATE_OK___` sentinel + offender 0 / Security advisor 既知 WARN 1 件のみ / Performance advisor items_meta + tasks_payload で auth_rls_initplan WARN 0
- **Known Issue 候補 4 件 (DU-B-6 で `docs/known-issues/` に記録予定)**: ①PG GENERATED 列含む composite FK に SET NULL 不可 (42601) ②Supabase SQL Editor は postgres role で `auth.uid() = NULL`、検証 INSERT は user_id 明示 ③`check-rls.sh` wrapper が Supabase CLI v2.101 `--output csv` 廃止で動作不能、`check-rls.sql` 単独 SQL Editor 実行で代替 ④再 apply で UNIQUE drop が composite FK 依存で 2BP01、差分 SQL or `drop ... cascade` で回避
- **commit**: `a999489` (DU-B 子計画書 v2 + 0009 v2 + rollback + selftest 拡張) → `1ec2cca` (v3-rev2 NO ACTION) → `ba1b6f1` (v3-rev3 initplan キャッシュ化) → `7d164be` (0010 + child plan v3-rev3 反映)。data-unification ブランチに push 済み
- **outbox 報告**: `.claude/comm/outbox/chat-web-migration.md` の先頭に DU-B-1 完了 + apply 履歴 + 検証結果 + Known Issue 候補 + DU-B-2 着手判断待ちを記録
- **次フェーズ**: DU-B-2 (Tasks role mapper 移植) — `shared/src/services/taskMapper.ts` を items_meta + tasks_payload 2 行分割マッピングに書き換え → `taskMapper.roundtrip.ts` 更新 → `npm run -w shared build` 緑確認 → role-qa 監査 → DU-B-3 (SupabaseTasksService 9 メソッド書き換え)

### 2026-05-23 - Data Unification DU-A 完全完了（0007 drop + 0008 schema 本番 apply 成功 + 全 5 検証クリア）（計画書: archive/2026-05-23-data-unification-a-db-schema.md）

#### 概要

Data Unification 第 1 フェーズ (DU-A: DB スキーマ設計 + apply) を完了。子計画書 v2 作成 → 0007/0008 SQL 実装 → 4 ラウンド独立監査 (migration-validator x2 / security-reviewer / role-qa x2) で全 APPROVE → Supabase 本番 SQL Editor で破壊的 apply 成功 (ユーザー実施、二段承認後)。9 テーブル DROP + 13 テーブル CREATE + 52 RLS policy + 6 partial unique + 1 トリガ + calendars FK 再ターゲット。全 5 検証クリアで items_meta 空状態の新スキーマが本番稼働開始。実装層 (mapper/Provider/UI) は未着手 = DU-B 以降。

#### 変更点

- **DU-A 子計画書 v2 作成**: `.claude/docs/vision/plans/2026-05-23-data-unification-a-db-schema.md`。親計画書 v3 の DU-A 章を SQL 直前まで具体化。DD-1/2/3 確定 (folder=task sub-type / calendars データ truncate + FK retarget / note_links 廃止 → wiki_tag_connections 一元化)。1 周目 role-qa が現行スキーマ実態 (calendars.folder_id NOT NULL → tasks ON CASCADE、note_links/note_connections の notes 依存) を発見 → 親計画書「DROP 7」→ **実際は 9 テーブル**に訂正
- **0007_drop_legacy_item_tables.sql (79 行)**: FK 外し (calendars.folder_id) → truncate (cta + calendars のみ・ctd 不触) → 9 テーブル DROP cascade (schedule_items → rga → routine_groups → routines → note_connections → note_links → notes → dailies → tasks)。冪等性 = DROP は if exists、truncate 対象は維持テーブルゆえ常に存在
- **0008_data_unification_schema.sql (1033 行)**: 13 テーブル CREATE (items_meta + 5 payload + routine_groups/rga + wiki_tags/groups/group_assignments/assignments/connections) + 52 RLS policy (4 × 13、全 `to authenticated` + owner equality + payload は EXISTS 二重防衛で items_meta.user_id = auth.uid()) + 6 partial UNIQUE (`uq_events_payload_routine_date` 含む) + 1 トリガ (`sync_event_deleted_cache`、SECURITY INVOKER + `set search_path = public, pg_temp`) + calendars.folder_id FK 再張り (items_meta(id) ON CASCADE)
- **監査 4 ラウンド**: ①migration-validator v1 = Critical/High 0、Medium 2 (DU-B 層) ②security-reviewer = Critical/High 0、Medium 2 ③role-qa v1 = NEEDS REVISION (列移植欠落 Blocker 2 + Major 1 = notes_payload.note_type / events_payload の is_dismissed/completed_at/is_all_day / routines_payload.sort_order) → role-engineer が 5 列追加 + 意図的ドロップ列の根拠コメント追記 (+35 行) ④role-qa v2 + migration-validator v2 再監査 = 副作用なし APPROVE
- **events_payload 列の意図的簡略化** (要件 4「簡素な ToDo・RichEditor 非搭載」遵守): is_dismissed (Issue 017 防御復活、commit 297ead6 の S4 dismiss-only 設計を保つ) / completed_at / is_all_day を**追加**。content (TipTap rich) / note_id (wiki_tag_connections に一元化) / reminder_enabled+offset (reminder_at 絶対時刻に一本化) / template_id (DU 後続計画) を**ドロップ**、根拠は SQL コメントに明記
- **破壊的 apply 成功 (二段承認後)**: ユーザーが Supabase SQL Editor で 0007 → 0008 の順で apply。前回の S4 0006 apply で発生した `cloud/db/migrations/` 誤貼り事故を念頭に正本パス (`supabase/migrations/`) を明示案内。apply 後の Supabase MCP read-only 検証で 5 項目クリア: items_meta 行数=0 / 新規 13 テーブル全て作成 + RLS enabled / RLS policy 52 / partial unique 6 + トリガ 1 / calendars.folder_id FK が items_meta(id) を参照 (DD-2 案A 成立)。get_advisors 既知 WARN 1件のみ (auth_leaked_password_protection = 完成後判断、新規問題ゼロ)
- **ブランチ運用**: `data-unification/items-meta-redesign` で作業。`refactor/web-first-v2` + `phase-2/schedule-migration` への push 漏れも本セッション冒頭で解消。並行チャット (chat-refactor / prototype レーン) が working tree を共有しているため commit は全て pathspec 指定 (`git add -A` 厳禁)
- **commit/push**: `dcc8484` (親計画書 v3) → `987c79c` (tracker 整理 1st) → `5801341` (DU-A 成果物 = 子計画書 v2 + 0007 + 0008、3 ファイル) → 本 tracker commit。data-unification ブランチに push 済み
- **HISTORY ローリングアーカイブ**: 13 エントリ蓄積していた HISTORY を最新 5 件保持に再整理 (前回 tracker END の整理が並行チャットの 62ddac0 merge で巻き戻されたため再実行)。S4 移植以前の 9 エントリ (2026-05-17 移行 SSOT 復元以降) を `HISTORY-archive.md` へ移動 (archive 47→58 件)
- **次フェーズ**: DU-B (Tasks role 移植)。子計画書を code-plan-editor で作成 → TasksProvider が items_meta + tasks_payload 経由で動作 + ツリー DnD + 期限 + 3 ステータス + 現行 frontend tasks 業務列マッパー → 各層監査。順序: DU-B → DU-C (Events + Routine) → DU-D (Notes + Daily) → DU-E (Calendar 2 ビュー) → DU-F (WikiTag/WikiLink グラフ)
- **申し送り (DU-B 着手前に確定)**: ①is_deleted_cache の INSERT 経路同期 (BEFORE INSERT トリガ or mapper 不変条件) ②payload 単独 mutation 時の items_meta.updated_at bump 責務 (mapper or トリガ) ③check-rls-selftest に payload EXISTS ケース 1 件追加で B1 緑実証 ④wtga の EXISTS 要否 (二重防衛非対称の設計判断) ⑤MCP Server 16 ツール書き換えは凍結継続、後続「MCP catch-up plan」で別計画化

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

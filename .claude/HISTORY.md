# HISTORY.md - 変更履歴

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

### 2026-05-16 - Schedule/ゴミ箱 削除 UX 刷新 + 危険な全消去ボタン撤去 + エラーマスキング / V69 migration ドリフト修正 + 移行プラン再整理

#### 概要

ユーザーの「Schedule データ削除」一連の要望を起点に、(1) 移行プラン 2026-05-14 改訂、(2) 「リセット失敗: 不明のエラー」の根本原因調査、(3) 削除 UX の全面刷新、を 1 セッションで実施。調査の結果「不明のエラー」は **Tauri `invoke()` が文字列で reject するため `e instanceof Error ? e.message : unknownError` が常に fallback に落ちる二次バグ**が真因隠蔽していたと判明。修正後に表出した本当のエラー `no such table: routine_group_tag_assignments` から、**`data_reset`/`data_import`/`data_export` が V69 で DROP 済の routine_tag 系 3 テーブルを参照し続ける migration ドリフト**を特定・修正。さらにユーザー指摘で「ゴミ箱タブ右サイドバーの『すべてのデータをリセット』ボタンが実は `data_reset`（全テーブル完全ハード削除）でゴミ箱限定ではない」危険な誤配置を確認し完全撤去、代わりに per-category 削除導線（Schedule の Events/Routine 個別ソフト削除ボタン + TrashView の per-category「ゴミ箱をからにする」）を新設。i18n 用語も統一（Routine→ルーティン、Schedule items→生成された予定）。コミットは `567190d`（移行プラン）/ `463b28f`（エラーマスキング+migration ドリフト）/ 本コミット（削除 UX 刷新）の 3 本。ブランチ refactor/web-first-v2、未 push。

#### 変更点

- **移行プラン再整理（commit `567190d`）**: `.claude/2026-05-04-cross-platform-migration.md` を三原則（学習スパイク廃止＝やりながら学ぶ / 学習用 Markdown ログ廃止 / Phase 5 完了=完成までコスト $0 厳守）で全面改訂。旧 Phase 0（学習スパイク 2.5 週）削除し Phase 1-5 再構成、「完成後の判断」表追加。Tauri 前提で失効した vision/ 4 ファイル（mobile-porting / mobile-data-parity / ios-everywhere-sync / realtime-sync）を `archive/vision-tauri/` へ git mv（理由 README 付）、旧 iOS プラン 2 件を `archive/` へ。`core.md`/`db-conventions.md` に失効警告、CLAUDE.md 冒頭警告を新方針化。memory に `feedback_no_learning_logs` / `feedback_cost_zero_until_complete` 追加。セッション途中で並行 worktree により branch が `feat/calendar-soft-delete-integrity` に切替→stash 経由で refactor/web-first-v2 に正着地
- **エラーマスキング修正（commit `463b28f`）**: `frontend/src/utils/logError.ts` に `getErrorMessage(error, fallback)` 追加（Tauri は文字列 reject する旨を doc 明記）。`CalendarDataResetDialog` / `DataManagement`（2 箇所）/ `Settings`(後に削除) / `MobileSettingsView`（2 箇所）の計 6 catch を `getErrorMessage` 化。クリップボード系（DOMException=Error）はスコープ外
- **V69 migration ドリフト修正（commit `463b28f`）**: `data_io_commands.rs` の `data_reset` から DROP 済 `routine_group_tag_assignments`/`routine_tag_assignments`/`routine_tag_definitions` の DELETE を除去 + 取りこぼし 5 テーブル（`routine_group_assignments`/`note_aliases`/`note_links`/`sidebar_links`/`timer_settings`）を FK 安全順で追加。`data_import` の clear batch から `routine_tag_assignments` 除去 + 旧テーブル import ブロック 2 件 + validation list 2 件除去、未使用化した `import_array_or_ignore` 削除。`data_export` の旧テーブル SELECT 2 件除去。`full_schema.rs` は V60 歴史スナップショットとして意図的に旧テーブル CREATE（V69 が drop、`fresh_db_reaches_latest_without_orphan_tables` が保証）と判明したためコード不変・設計意図コメントのみ追加（コメント内二重引用符が Rust 文字列を閉じる初期ミスを修正）
- **削除 UX 刷新（本コミット）**: 新規 `frontend/src/components/ScheduleList/BulkCategoryDeleteButton.tsx` — kind 別表記（`schedule.bulkDelete.{events,routines,tasks}`）/ 2 段階クリック確認 / 既存 `bulkSoftDeleteCalendarData([kind])` を単一 kind で再利用 / 成功時 0.8s reload / `getErrorMessage` でエラー表出。Events タブヘッダ（`ScheduleEventsContent.tsx`、+作成ボタン隣）と Routine 管理オーバーレイヘッダ（`RoutineManagementOverlay.tsx`、×閉じる隣）に配置。新規テスト `BulkCategoryDeleteButton.test.tsx` 4 件
- **TrashView per-category 空化（本コミット）**: `TrashView.tsx` に `categoryLabel`/`categoryCount`/`handleEmptyCategory`/`renderEmptyHeader` 追加。各カテゴリ表示上部に「{カテゴリ}のゴミ箱をからにする」ボタン（件数 0 で disabled）、`ConfirmDialog` で件数+不可逆警告を提示後、検索フィルタ無視でそのカテゴリの全ゴミ箱項目を既存 per-item `permanentDelete*` ループで完全削除（新規 IPC 不要）。5 カテゴリ＝TrashView の tasks/routine/events/materials/sounds と一致
- **危険ボタン撤去（本コミット）**: `Settings.tsx` のゴミ箱サイドバーから「すべてのデータをリセット」（実体 `data_reset`＝全テーブル完全ハード削除、ゴミ箱限定ではない誤配置）を完全撤去。連動 dead code（`handleReset` / reset 系 state 3 個 / `ConfirmDialog` ブロック）+ 未使用化 import 3 件（`getDataService`/`getErrorMessage`/`ConfirmDialog`）除去（49 行削除・追加 0）。`data_reset` Rust コマンド自体は残存だが UI 導線は消滅
- **i18n 用語統一（本コミット）**: `settings.calendarReset.*` を ja/en で平易化（Routine→「ルーティン」、Schedule Items→「（ルーティンから）生成された予定」、tasks/events/dailies/notes→タスク/イベント/デイリー/ノート、title/description/success/kinds/footnote）。新規 `schedule.bulkDelete.*` / `trash.emptyCategory*` を ja/en 両方に追加、parity 確認済
- **Verification**: `tsc -b` 0 / eslint は `Settings.tsx:225` `react-hooks/set-state-in-effect` の既存問題 1 件のみ（git diff は 49 行削除のみ・当該 effect は hunk 外、行番号 252→225 にずれただけ＝リグレッション非該当）/ 全 45 files 398 tests pass + 新規 4 件 pass / i18n ja-en parity OK / data_io Rust テスト 5 件 pass / cargo check 警告 0

#### 残課題

- **手動 UI 検証未実施**: (a) Events タブ「全Eventを削除」2 段階確認→ソフト削除→ゴミ箱復元可 / (b) Routine 管理オーバーレイ「全Routineを削除」で派生 schedule_items も cascade / (c) TrashView 各カテゴリ「〜のゴミ箱をからにする」で当該カテゴリのみ完全削除・他カテゴリ不変 / (d) Calendar 一括削除ダイアログの新用語表示。`cargo tauri dev` 起動が必要
- **[IMPORTANT・既存] `Settings.tsx:225` set-state-in-effect**: 変更前から存在（本セッション中 stash 検証済）。`initialTab` effect は今回未編集。別タスクで cleanup 推奨
- **[MINOR] `TrashView.handleEmptyCategory` の部分失敗**: per-item try/catch なし、1 件 reject でループ中断・残り未削除（UI 状態は finally で復帰）。既存 per-item 削除と同挙動のため非ブロッキング、任意で堅牢化余地
- **`data_reset` UI 導線消滅**: 全消去 Rust コマンドは残るがどこからも呼べない。将来「工場出荷リセット」が必要なら明示的に再配置要
- **push 判断**: refactor/web-first-v2 にローカル 5 コミット（含本セッション 3 本）未 push。PR / push 方針は別途
- **並行セッション干渉**: 本セッション中に worktree-agent による branch 切替が発生。`.claude/docs/vision/PointGraphView.jsx` 等 untracked は別セッション由来でコミット対象外

---

### 2026-05-16 - statusline 縦並び化（横一行 → 3 行グループ化レイアウト）

#### 概要

ユーザー要望「/statusline スキルで設定した UI が全て横並び、これを縦並びにできないか」を受けて `~/.claude/statusline-command.sh` を横一行 → 3 行グループ化レイアウトに改修。AskUserQuestion で粒度 3 択（3 行グループ化 / 完全縦並び / 2 行）を preview 付きで提示しユーザーが「3 行グループ化」を選択。本変更は life-editor の git repo 外（`~/.claude/` global config）のため commit 対象は `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` の 3 ファイルのみ。

> 注: 本エントリは HISTORY-archive.md へロール予定だったが、別チャット（frontend-refactor）が HISTORY-archive.md を並行で要点圧縮中（`.bak` 退避済）のため、衝突回避で本セッションはロールを見送り HISTORY.md に保持。archive 統合は並行作業収束後にユーザー/次セッションで実施。

#### 変更点

- **`~/.claude/statusline-command.sh` 改修**: 各セグメント変数から行頭 `" | "` プレフィックスを除去、末尾の単一 `printf` を 3 行組み立てに置換（line1=`user@host  cwd` / line2=branch・ctx・cost / line3=`▶ active-task`）。各行を個別に `\033[2m … \033[0m` で dim 化。line2/line3 は空なら行スキップ
- **動作確認**: dummy JSON で 3 行出力 + 行頭余計区切りなし + per-line dim ANSI を確認。git 管理外 / MEMORY.md 不在時の空行スキップ維持

#### 残課題

- **次回プロンプト送信時に反映**: statusLine は次の Claude Code 描画タイミングで再読み込み。3 行表示の見た目はユーザー実機で目視確認推奨

# MEMORY.md - タスクトラッカー

## 進行中

### 🔧 Data Unification — Schedule items_meta + payload 再設計（着手日: 2026-05-21、ステータス: **DU-B 着手中**）

**対象**: `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md`（親計画書 v3 + DU-B 確定追記済）+ `.claude/docs/vision/plans/2026-05-23-data-unification-b-tasks.md`（DU-B 子計画書 v1 DRAFT）/ `supabase/migrations/0009_*.sql`（DU-B-1 着手用）/ `shared/src/services/{taskMapper,SupabaseDataService}.ts`（DU-B-2/3）/ `shared/tests/taskMapper.test.ts`（DU-B-4 新規）
**計画書**: 親=`2026-05-21-data-unification-items-meta.md` / DU-A 子=`archive/2026-05-23-data-unification-a-db-schema.md` / DU-B 子=`2026-05-23-data-unification-b-tasks.md`
**ブランチ**: `data-unification/items-meta-redesign`（現在チェックアウト中、リモートと同期済 HEAD `39270cf`）

- 前回: DU-A 完了 (0007 drop + 0008 schema 本番 apply 成功 + 全 5 検証クリア)。commit `5801341` + `39270cf`
- 現在: **DU-B 子計画書 v1 DRAFT 作成**（Recovery Playbook R1-R7 復旧手順 + 0009_rollback.sql 雛形を明示）。親計画書 v3 の「parent_item_id 設計判断 / Sync への影響 / Migration 戦略」3 章に DU-B 確定事項 (DB-Q1=クライアント直列 2 回 invoke / DB-Q2=mapper 側で updated_at bump / DB-Q3=composite FK で cross-role 防止) を annotation 追記済。3 確定事項はユーザー対話で確定 (2026-05-23)
- 次: **DU-B-1 着手** — (1) 0009 SQL 2 本ドラフト作成（`0009_tasks_payload_parent_fk.sql` 本体 + `0009_rollback.sql` 巻き戻し）→ (2) check-rls-selftest に payload EXISTS ケース 1 件追加（DU-A 申し送り④消化）→ (3) migration-validator 監査依頼 → (4) ユーザーに 0009 apply 最終承認 → (5) 本番 SQL Editor apply → (6) DU-B-2 (taskMapper 書き換え) へ

**DU-B 子計画書 DoD 11 項目**: 0009 apply / check-rls.sh 緑 / advisor lint 0 / taskMapper 2 行分割 / roundtrip 緑 / SupabaseTasksService 9 メソッド書き換え / vitest 緑 (roundtrip + bump + parent role guard + soft-delete) / web golden path / docs 更新 / 3 層監査 PASS / HISTORY+MEMORY 更新
**DU-A 確定事項**: DD-1 folder=task sub-type (task_type/folder_type) / DD-2 calendars データ truncate + folder_id FK → items_meta(id) / DD-3 note_links 廃止 → wiki_tag_connections 一元化 / events 列の意図的簡略化 / トリガ SECURITY INVOKER + search_path 固定
**DU-B 確定事項 (2026-05-23)**: DB-Q1 Atomicity=クライアント直列 2 回 invoke (FK 順序強制) + createTask try/catch で失敗時 items_meta softDelete / DB-Q2 updated_at bump=mapper 側で明示 invoke (DB トリガ不採用) / DB-Q3 cross-role parent 防止=composite FK ((id, role) UNIQUE + parent_item_role generated 列)
**申し送り**: ①MCP Server 16 ツール書き換えは本計画では凍結②WikiLink グラフ可視化 UI も別計画③`origin/refactor/web-first-v2` push は並行 chat-refactor 調整待ち④S8 Realtime/delta sync 申し送りは Data Unification でも継承⑤is_deleted_cache INSERT 経路は **events 専用 = Tasks 範囲外**（DU-C で扱う）⑥check-rls-selftest payload EXISTS ケース 1 件追加は DU-B-1 内で消化⑦DU-D Notes も composite FK パターン踏襲予定
**サブエージェント分担**: 設計=role-pm（必要時）→ code-plan-editor（子計画書）/ 実装=role-engineer（DU-B-2/3/4）/ 監査=role-qa+security-reviewer+life-editor-migration-validator（各 Step）/ 統括=メイン

## 直近の完了

- Data Unification DU-A 完了 (0007 drop + 0008 schema 本番 apply 成功) ✅（2026-05-23）— 子計画書 v2 (DD-1/2/3 確定 + 監査15+7+2+5+2項反映) + 0007 (79行・9テーブルDROP + calendars FK外し + cta/calendars truncate) + 0008 (1033行・items_meta + 5 payload + 7 専用/relation = 13テーブル + 52 policy + 6 partial unique + 1 トリガ + calendars FK 再ターゲット)。4 ラウンド監査 PASS (migration-validator x2 + security-reviewer + role-qa x2、Critical/High 0)。Supabase 本番 SQL Editor で apply 成功・全 5 検証クリア (items_meta=0 / 13テーブル + RLS enabled / 52 policy / partial unique 6 + トリガ 1 / calendars.folder_id → items_meta(id) / advisor 既知WARN1のみ)。commit `5801341`。詳細 HISTORY 参照
- モバイルUIプロトタイプ環境 計画策定 ✅（2026-05-23）— 要件定義書 `01_要件定義書_プロトタイプ環境.md` + 実装計画書 `02_実装計画書_プロトタイプ環境.md`（Phase 0-4）を作成。Artifacts 原本3 TSX を `prototype/_artifacts/` へ隔離（Phase 0 完了）。Vite 環境構築（Phase 1-4）は未着手。詳細 HISTORY 参照
- Data Unification 親計画書策定（旧 Phase 3 改名）+ Phase 2 完全クローズ + ブランチ準備 ✅（2026-05-23）— Schedule 再設計の親計画書 v3 を lead-pipeline 重ティアフルチェーンで策定（role-qa 3 周監査 15+7+2 項全解消）。items_meta + payload ハイブリッド 13 テーブル / role 5 種統一 / Calendar 月+3 日 2 ビュー。Phase 2 を `refactor/web-first-v2` に FF マージ → 新ブランチ `data-unification/items-meta-redesign` 作成。計画書 `dcc8484`。詳細 HISTORY 参照

## 予定

> **注**: 2026-05-17 に旧 Tauri / Cloudflare 前提の陳腐化タスクを一括削除済（Q2 Cloud Sync 検証 / リファクタ検証計画 / Realtime Phase1(frontend SyncContext) / Mobile Full Re-sync ボタン(frontend) / Desktop パッケージ更新(cargo tauri) / orphan DB(実施済) / iOS 実機受入 / iOS 4G / Mobile Schedule 手動検証(新リデザイン計画へ) / frontend lint 一括 / Point Graph 継続FB / Tauri IPC naming。逐語は git 履歴）。残置は移行後も有効なもののみ。

### モバイルUIプロトタイプ環境の Vite 構築（Phase 1-4）

**対象**: repo root `prototype/`（`prototype/src/` + `prototype/_artifacts/`（隔離済原本））
**計画書**: `.claude/docs/vision/plans/02_実装計画書_プロトタイプ環境.md`（Phase 0 完了・Phase 1-4 未着手）
**ブランチ**: 計画書は `refactor/web-first-v2` → `prototype/mobile-ui` を想定（現状の計画書 commit は `data-unification/items-meta-redesign` に同居）

- Phase 1: Vite + React + Tailwind v3 初期セットアップ（依存は NFR-2 許可リストのみ・`server: { host: true }` で iPhone 実機確認）
- Phase 2: `_artifacts` の 3 TSX を `src/screens/` へ作業コピー化 + 独立起動（`/schedule` `/work` `/materials`）
- Phase 3: `/unified` 下タブ統合 + モックインタラクション（FR-4）
- Phase 4: README 整備 + `refactor/web-first-v2` へマージ
- **配置判断の核**: `.claude/` はビルド対象外のため、動く部品は repo root `prototype/` 配下に置く（生 TSX を plans/ に置くのは用途違い）

### Mobile vs Desktop 設計方針の docs/vision/ への明文化

**対象**: 新規 `.claude/docs/vision/mobile-design.md`（仮名）
**背景**: 2026-05-12 セッションで CLAUDE.md §2 Platform に直接追記したが working tree から消失（並行チャットまたはリンターによる巻き戻しを推定）。CLAUDE.md は 400 行以下目標 + 「新機能は §8 + docs/requirements/」が原則のため §2 直接追記は不適切、`docs/vision/` 配下の独立ファイル化が筋。本セッションで取りまとめた内容:

- Desktop = クリエイティブ重視、Mobile = コンパクト重視
- Mobile 必須セクションは Schedule (予定/タスク/ルーティン) / Work (標準ミュージックのみ、カスタム音源追加は Mobile では非対応) / Notes (デイリー/ノート) / Settings の 4 つだけ
- Mobile は Desktop の縮小コピーではなく専用に再設計
- スラッシュコマンド・タグ付けは Mobile でも 1〜2 タップで到達できるよう設計

**手順**: `mobile-design.md` 新規作成 → CLAUDE.md §2 末尾に 1 行リンク追加 → `2026-05-04-cross-platform-migration.md` と相互リンク。並行チャットとの衝突回避のため、編集前に `.claude/comm/outbox/` で予告するか multi-session-coordinator でロック取得を検討

### Mobile 追加機能要件の残タスク（Capacitor Mobile・要再仕分け）

**性質**: Tauri-iOS 期に積んだ Mobile 機能要件。コンポーネント実体（旧 frontend `NoteTreeNode` 等）は移行で再実装されるため、**実装パスでなく「機能要件」だけを backlog として保持**。Capacitor Mobile 移行（移行 SSOT Phase 3）着手時に web/shared 文脈へ再仕分けする。
**保持する機能要件**:

- **行スワイプ (edit / pin / delete)**: Notes ツリー行の touch-UX。DnD と両立する操作設計が必要
- **TipTap slash command + empty line hint**: スラッシュコマンド + 空行ヒントのポップオーバー
- **Calendar filter / sort**: role multi-select + sort（drawer 内 filter sheet 想定）
- **ScheduleItemForm 5-role 対応**: event 専用から 5-role 選択対応へ

> 旧参照 `~/.claude/plans/life-editor-note-ios-calm-moth.md`（Tauri-iOS 期・user-global）は移行後の SSOT ではない。再仕分け時は移行 SSOT Phase 3 + `docs/vision/plans/` の Mobile リデザイン計画（01/02）に統合する。

### 保留（将来再評価）

- **React Compiler 有効化**: アーキ非依存（React 19 + Vite は移行後も継続）。移行後 shared/web で有効化するかは独立の技術判断。旧「S-4 Drop 判定で切り離し」文脈は失効（旧リファクタ計画）

## バグの温床 / 今後の注意点(2026-04-23 更新)

以下は本 session で顕在化した構造的な脆弱性。同類のバグが再発する可能性が高い領域として記録。DB 系の再発防止ルールは [`docs/vision/db-conventions.md`](./docs/vision/db-conventions.md) に集約:

> 整理メモ（2026-05-17）: Cloudflare D1 / wrangler / Tauri-Xcode 専用の陳腐化 10 項目を削除（旧 c=D1/Desktop 同一テーブル前提・d=Cloud deploy×D1 タイミング・g=/sync/changes pagination 半実装・h=D1 compound SELECT 5本・i=wrangler d1 引数・j=client/server has_more flag・m=Xcode ⌘R×Tauri・n=Xcode PATH cargo・o=Desktop パッケージ V64 乖離・p=iOS/Cloud 三者不整合）。逐語は git 履歴。残置は移行後も有効な恒久知見のみ。なお f/k は Supabase 文脈への書換候補（報告のみ・未着手）

- **timestamp 形式混在（Known Issue 013）**: SQL 内 `datetime('now')` と `new Date().toISOString()` / `helpers::now()` が同じテーブルに書き込まれ、スペース区切り vs ISO 8601 の混在で sync 文字列比較が壊れる。ASCII 順 space(0x20) < T(0x54) のため一度 since が ISO になると同日 space 行が永久に push から漏れる。恒久教訓: 書き込み側を ISO 8601 に統一（Supabase 移行後も timestamp 形式統一は厳守）
- **delta sync が updated_at 単調性に依存（Known Issue 013、旧 014 統合分）**: 高 version + 古 updated_at の行が居座ると `WHERE updated_at > since` では永久に pull されない。恒久教訓: delta cursor は client 時刻でなく server 側単調増加列（Supabase 移行後は `server_updated_at` 相当）に置く。※「Known Issue 014」は INDEX 統合履歴で 013 に吸収済の番号（2026-04-25）
- **論理的一意性を持つテーブルの UNIQUE 制約**: schedule_items で発覚したが、tasks / dailies / notes / routines も同じ「`id` PK のみで論理キー UNIQUE 無し」。特に複合キー relation（旧 `routine_tag_assignments (routine_id, tag_id)` 型）は要再点検。Supabase 0006 でも `schedule_items (routine_id,date)` partial UNIQUE として継承（Issue 011）
- **sync 衝突解決が ID 単独**【Supabase 文脈へ書換候補・未着手】: `ON CONFLICT(id)` + version 比較の LWW は複合キー衝突(異 id 同 payload)を検知できない。Supabase upsert-on-id でも該当（Issue 020 read-then-write レースと同根）
- **Mobile UI の機能欠落(Full Re-sync)**【Supabase 文脈へ書換候補・未着手】: Desktop と Mobile で sync workaround の実装差分があり障害時に Mobile で詰む。Supabase Mobile Settings 移植時に解消要（予定[7]と重複）
- **`tsc --noEmit` at frontend root は無意味**: solution-style tsconfig(`files: []` + references のみ)で実際の型チェックが走らない。`tsc -b` または `npm run build` を使う（アーキ非依存・shared/web でも同型。session-verifier skill / CLAUDE.md §7.1 に記録済）

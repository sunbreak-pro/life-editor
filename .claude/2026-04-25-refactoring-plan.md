---
Status: IN_PROGRESS (Phase 0 ✅ / Phase 1 ✅ / Phase 2-1 ✅ / Phase 2-2 ✅ / Phase 2-3a TaskDetailPanel ✅ / Phase 2-3b-d, 2-4, 3 pending)
Created: 2026-04-25
Updated: 2026-04-26 (Phase 2-2 TauriDataService 分割 完了)
Task: MEMORY.md §予定（リファクタリング計画 Phase 2 残）
Project path: /Users/newlife/dev/apps/life-editor
Related: [.claude/docs/code-inventory.md](./docs/code-inventory.md) — アクティブ / 凍結 / 重複 / 削除候補の棚卸し
---

# Plan: Life Editor リファクタリング計画（Phase 0-3）

## Context

### 動機

- iOS Phase 0-7 / Cloud Sync 014 完了で **構造的負債が顕在化**: 1000+ 行のコンポーネント 5 件、`migrations.rs` 2328 行、`sync.ts` 単一ファイル 459 行、Provider 16 層ネスト
- `MEMORY.md §バグの温床` が 17 項目に膨張、同じ罠の再発リスク高
- `@deprecated` 4 件 / 中粒度 grep で確定 dead file は検出されないが、formatter / row_to_model 重複で 250+ 行削減可能
- 既存 lint 116 問題が滞留（React Compiler memoization / unused vars）

### 制約

- N=1 ユーザー（作者本人）の体験を壊さない。**機能撤去 / UI 変更は原則禁止**、内部構造のみリファクタ
- Tier 3 凍結機能（Paper Boards / Analytics）は **使用中につき archive せず維持**
- 各 Phase は独立検証可能、**1 セッション内で commit 可能** な粒度に切る
- `.claude/CLAUDE.md` §6.4 共有規約 / §6.2 Provider 順序を遵守
- Cloud Sync 互換は破らない（`server_updated_at` cursor / version LWW を維持）

### Non-goals

- Tier 3 凍結機能の物理削除（Paper Boards / Analytics）
- IPC 150 コマンドの typed struct 一括移行（S-2、MEMORY.md §保留）
- React Compiler 全有効化（S-4 Drop 判定後）
- MCP Server の整理（今回スコープ外）
- Mobile UI の機能拡張（既存 MEMORY.md §予定で別タスク）

### 規模感（推定）

| Phase   | 期間目安        | 行数増減        | リスク |
| ------- | --------------- | --------------- | ------ |
| Phase 0 | 1 セッション    | **-58（実績）** | 低     |
| Phase 1 | 2-3 セッション  | -500 〜 -800    | 中     |
| Phase 2 | 4-6 セッション  | -1500 〜 -2500  | 中-高  |
| Phase 3 | 6-10 セッション | -2000 〜 -4000  | 高     |

> Phase 0 当初見積もり -200〜-400 → 実績 -58。理由: formatter「18+ 箇所」が実態 1 箇所だった (`code-inventory.md §3.1` 参照)。

---

## Phase 0: Quick Wins（1 セッション、低リスク）— ✅ COMPLETED 2026-04-25

> ROI 最高。@deprecated と微小重複の即時除去。動作影響ほぼゼロ。実績 -58 行 / 7 ファイル変更 / 255 tests pass。

### Steps

- [x] **0-1**: `@deprecated` 4 件の整理
  - `context/ScheduleContextValue.ts` を **削除**（参照ゼロ確認後） + `context/index.ts` re-export 削除
  - `components/Tasks/Schedule/DayFlow/GroupFrame.tsx` から `onDoubleClick` prop を削除（caller が onClick のみ使用していたため）
  - `components/shared/UndoRedo/UndoRedoButtons.tsx` から `domain` prop を削除（caller 2 箇所とも `domains` を使用していたため）
- [x] **0-2**: formatTime ローカル関数 1 箇所の統合（**実態は 1 箇所のみ** — `code-inventory.md §3.1` 参照）
  - `components/Schedule/ScheduleItemEditPopup.tsx:52` の local `formatTime(h, m)` を削除し `utils/timeGridUtils.ts` から import に置換
  - **当初計画の「dateFormat.ts 新設」は実施せず**: `formatTime` は 4 シグネチャに分かれており機械的統合が不可能と精査で判明
- [x] **0-3**: `utils/tiptapText.ts:18` の innerHTML XSS 緩和
  - JSON parse 失敗時のフォールバックを `DOMParser.parseFromString(content, "text/html")` ベースに変更
  - 旧経路: `tmp.innerHTML = content` → DOM 注入で `<script>` / `<img onerror>` のリスク
  - 新経路: DOMParser は inert ドキュメントを生成、textContent 抽出のみ
- [x] **0-4**: `MEMORY.md §バグの温床` の重複行削除
  - 行 102-112 を削除（行 103-111 は行 90-100 の単純重複、行 112 は migration 0003 適用済で陳腐化）

### Files（実績）

| File                                                            | Op     | Notes                                       |
| --------------------------------------------------------------- | ------ | ------------------------------------------- |
| `frontend/src/context/ScheduleContextValue.ts`                  | Delete | 32 行削除、参照ゼロ                         |
| `frontend/src/context/index.ts`                                 | Edit   | -3 行                                       |
| `frontend/src/components/Tasks/Schedule/DayFlow/GroupFrame.tsx` | Edit   | -9 行                                       |
| `frontend/src/components/shared/UndoRedo/UndoRedoButtons.tsx`   | Edit   | domain prop 削除                            |
| `frontend/src/components/Schedule/ScheduleItemEditPopup.tsx`    | Edit   | -5 行 (local formatTime 削除 + import 追加) |
| `frontend/src/utils/tiptapText.ts`                              | Edit   | innerHTML → DOMParser                       |
| `.claude/MEMORY.md`                                             | Edit   | -11 行                                      |

### Verification（実績）

- [x] `cd frontend && npx tsc -b` 通過（出力なし＝success）
- [x] `cd frontend && npm run test` **255/255 pass** (31 test files)
- [x] `grep -rn "@deprecated" frontend/src` → **0 件**
- [ ] 手動 UI 確認: Schedule / Calendar / Timer (次セッション時に確認)

---

## Phase 1: Critical Cleanup（2-3 セッション、中リスク）— ✅ COMPLETED 2026-04-25

> 構造的負債で「次のバグ温床」が確実な部分を先回り。1 セッションで 4 step 全完遂。実績: cloud +297 / frontend +54 / rust +22 行（doc + SAFETY コメント分が大半、ロジック本体は減）。

### Steps

- [x] **1-1**: `cloud/src/routes/sync.ts` 責務分割（既知 Issue 012 の前提地ならし）
  - `routes/sync/versioned.ts` / `routes/sync/relations.ts` / `routes/sync/shared.ts` に分割
  - `VERSIONED_TABLES` / `RELATION_TABLES_*` を `config/syncTables.ts` に切り出し
  - INSERT + UPDATE stamping 3 ブロック重複を `applyServerTimestamp(table)` ヘルパでループ化（80+ 行削減）
  - Bearer token 比較を `crypto.subtle.timingSafeEqual` ベースに置換（`middleware/auth.ts`）
  - request body validation を `utils/schema.ts` で zod 化（`/sync/push`）
- [x] **1-2**: `frontend/src/main.tsx` の Provider tree 共通化
  - `<DesktopProviders>` / `<MobileProviders>` を `frontend/src/providers/` 新設で抽出
  - main.tsx 97 → 38 行（共通外殻 ErrorBoundary / Theme / Toast / Sync のみ残置）
  - **CLAUDE.md §6.2 の文書記述と実コードに乖離あり**: 文書では Mobile が WikiTag を省くとされているが実コードは含む。乖離は今回踏襲（=既存挙動維持）、修正は別タスク
- [x] **1-3**: Rust `helpers.rs` / `sync_engine.rs:177` の `row_to_json` 重複統合
  - `db/row_converter.rs` 新設し `pub fn row_to_json(...)` を集約
  - helpers.rs と sync_engine.rs はそれぞれの local fn を削除して re-import
  - `row_to_string_map` / `row_value_to_serde` は実在しなかったため対象外（plan の見立て修正）
- [x] **1-4**: SQL injection 防御の明示化
  - `sync_engine.rs:94,100` の format!() interpolation 直前に SAFETY コメント追加
  - `db/helpers.rs::next_order` の doc-comment に「callers MUST pass static literals」契約を明記
  - **debug_assert!(is_known_table) は不採用**: 既存呼出はすべて const slice 反復 or repository 内静的リテラルで構造的に安全。assert を入れる維持コストの方が高いと判断

### Files

| File                                                    | Op     | Notes                                   |
| ------------------------------------------------------- | ------ | --------------------------------------- |
| `cloud/src/routes/sync.ts`                              | Delete | versioned.ts / relations.ts へ分割移行  |
| `cloud/src/routes/sync/{versioned,relations,shared}.ts` | Create | 責務分離                                |
| `cloud/src/config/syncTables.ts`                        | Create | テーブル定数集約                        |
| `cloud/src/utils/schema.ts`                             | Create | zod validation                          |
| `cloud/src/middleware/auth.ts`                          | Edit   | timing-safe compare                     |
| `cloud/package.json`                                    | Edit   | zod 追加                                |
| `frontend/src/main.tsx`                                 | Edit   | Provider tree 抽出                      |
| `frontend/src/providers/DesktopProviders.tsx`           | Create | Desktop tree                            |
| `frontend/src/providers/MobileProviders.tsx`            | Create | Mobile tree                             |
| `src-tauri/src/db/row_converter.rs`                     | Create | row_to_json 集約                        |
| `src-tauri/src/db/helpers.rs`                           | Edit   | row_to_json は re-export                |
| `src-tauri/src/sync/sync_engine.rs`                     | Edit   | row_to_json import 化 + SAFETY コメント |
| `src-tauri/src/db/mod.rs`                               | Edit   | row_converter mod 追加                  |

### Verification

- [ ] `cd cloud && npx wrangler dev` 起動し `/sync/push` `/sync/changes` `/sync/full` を curl 確認（手動）
- [ ] D1 staging（`wrangler dev --remote`）で push + pull の round-trip 確認
- [ ] `cd src-tauri && cargo build` 警告増加なし
- [ ] `cargo test --lib` 通過（sync_engine の既存 test）
- [ ] Frontend Desktop / Mobile 両方の起動で Provider 関連 console error なし
- [ ] Phase 0 と組み合わせて `MEMORY.md §バグの温床` から 2 項目削除（formatter / SQL whitelist）

### Risks / Mitigations

- **Cloud sync 分割**で Worker の bundle size 増 → wrangler の `compatibility_date` を変更しない、`hono` re-import で吸収
- **Provider tree 抽出**で順序が崩れて Context null エラー → `.claude/CLAUDE.md §6.2` の順序を厳守、抽出前に Provider 順序の test snapshot を作成

---

## Phase 2: Structural Decomposition（4-6 セッション、中-高リスク）

> 大型ファイルの分割と Mobile/Desktop 共通化。アーキテクチャ改善の本丸。

### Steps

- [x] **2-1** ✅ 2026-04-25: `src-tauri/src/db/migrations.rs` (2431 行 / V65/V66 で増加) を 6 ファイルに分割（commit `e36845b`）
  - `migrations/mod.rs` (341) — `pub fn run_migrations` orchestrator + 旧 fn `run_incremental_migrations` の dispatch + 末尾の defensive backfill (schedule_items.template_id / routine_groups.version) + 既存 7 tests
  - `migrations/full_schema.rs` (592) — `pub(super) fn create_full_schema` (V60 final state CREATE TABLE batch)
  - `migrations/util.rs` (32) — `exec_ignore` / `has_column` / `has_table` を `pub(super)` で集約
  - `migrations/v2_v30.rs` (688) / `migrations/v31_v60.rs` (536) / `migrations/v61_plus.rs` (311) — 各バージョンレンジの `if current_version < N { ... }` ブロック群を `pub(super) fn apply(conn, current_version)` でラップ
  - 副次改善: `LATEST_USER_VERSION` 定数化で `assert_eq!(user_version, 64)` 5 箇所のハードコード削除（Q2 patch V65/V66 追加で陳腐化していた既存 5 件のテスト失敗を解消、tests 2/7 → 7/7 pass に）
  - 公開 API 不変、各 SQL ブロックは byte-identical、`cargo check --lib` clean
- [x] **2-2** ✅ 2026-04-26: `services/TauriDataService.ts` (1502 行) を domain ごとに分割
  - 19 ドメインモジュール作成 (`services/data/{tasks,timer,sound,daily,notes,calendars,routines,scheduleItems,playlists,wikiTags,timeMemos,paper,databases,files,sidebar,system,templates,sync,misc}.ts`)
  - `TauriDataService.ts` は **52 行** に縮約 (目標 200 行以下を達成)
  - 設計: 各ドメインが const オブジェクトを export → composition root で spread し DataService 型に集約 → class は constructor で `Object.assign(this, composed)` + interface 宣言マージで TS 型互換維持
  - 既存 import (`new TauriDataService()` in `dataServiceFactory.ts` など) は無改変
  - `tsc -b` clean、288/288 tests pass
- [ ] **2-3**: 巨大コンポーネント分割（DataService 構造を真似た subcomponent 化）
  - [x] **2-3a TaskDetailPanel** (947→55 行) ✅ 2026-04-25 — sibling files: `InlineEditableHeading.tsx`(76) / `DebouncedTextarea.tsx`(62) / `TaskSidebarContent.tsx`(244) / `FolderSidebarContent.tsx`(536)。本来の plan 案 `TaskDetailPanel/{index,Header,Body,Tabs,Hooks}.tsx` のサブディレクトリ + tab 構造ではなく、既存の Task vs Folder 分岐に沿った sibling 構造を選択（commit 661b370）
  - [ ] **2-3b ScheduleTimeGrid** (1220) → `ScheduleTimeGrid/{index,GridLayer,EventLayer,DragHandlers,Hooks}.tsx`
  - [ ] **2-3c OneDaySchedule** (1165) → 1 関数 1165 行、内部に多数の useState / useCallback。`useDayFlowFilters` / `useDayFlowDialogs` のカスタムフック抽出 + 主コンポーネントは render 専念へ
  - [ ] **2-3d TagGraphView** (1443) → `TagGraphView/{index,ForceLayout,Renderer,Interactions,Hooks}.tsx`
  - 各分割は **1 セッション 1 ファイル** で独立 commit + UI 手動検証必須（自動テスト無し）
- [ ] **2-4**: Calendar Mobile/Desktop 統合
  - `hooks/useCalendarViewLogic.ts` 新設（`CalendarView.tsx` と `MobileCalendarView.tsx` の共通ロジック抽出）
  - `components/Calendar/shared/{MonthGrid,DayCell,EventBadge}.tsx` 新設
  - Desktop / Mobile の各 Container は表示ラッパに縮約（推定 -800 行）

### Files

| File                                                                                | Op     | Notes                       |
| ----------------------------------------------------------------------------------- | ------ | --------------------------- |
| `src-tauri/src/db/migrations.rs`                                                    | Delete | -                           |
| `src-tauri/src/db/migrations/{mod,v1_v30,v31_v60,v61_plus}.rs`                      | Create | 段階適用                    |
| `frontend/src/services/TauriDataService.ts`                                         | Edit   | composition root 化         |
| `frontend/src/services/data/*.ts`                                                   | Create | domain bridge 7-10 ファイル |
| `frontend/src/components/Tasks/Schedule/DayFlow/{ScheduleTimeGrid,OneDaySchedule}/` | Create | サブディレクトリ化          |
| `frontend/src/components/Ideas/Connect/TagGraphView/`                               | Create | 同上                        |
| `frontend/src/components/Tasks/TaskDetail/TaskDetailPanel/`                         | Create | 同上                        |
| `frontend/src/hooks/useCalendarViewLogic.ts`                                        | Create | Calendar 共通               |
| `frontend/src/components/Calendar/shared/*.tsx`                                     | Create | Calendar 共通               |
| `frontend/src/components/Tasks/Schedule/Calendar/CalendarView.tsx`                  | Edit   | shared を消費               |
| `frontend/src/components/Mobile/MobileCalendarView.tsx`                             | Edit   | shared を消費               |

### Verification

- [ ] `sqlite3` で migration v1-v64 の段階適用確認（fresh DB から）
- [ ] `cargo test --lib db::migrations` でテスト通過
- [ ] `npm run build` の bundle 比較（pre/post で差 ±5% 以内）
- [ ] Calendar Mobile / Desktop の月グリッド表示・スワイプ・event 表示が回帰なし
- [ ] ScheduleTimeGrid / OneDaySchedule の DnD 操作が回帰なし
- [ ] TagGraphView の force layout 表示・zoom・選択が回帰なし

### Risks / Mitigations

- **migrations.rs 分割で適用順序が壊れる** → 分割前に v1-v64 の `dry_run` テストで全 migration 結果を hash 化し、分割後と一致を確認
- **Calendar 統合で Mobile-only / Desktop-only の細かい違いが消える** → 差分をプロパティ化（`mode: 'mobile' | 'desktop'`）し、shared コンポーネントが両モード対応であることを test
- **大型コンポーネント分割で Context null エラー** → 分割前後で `npm run test` の component test を maintain

---

## Phase 3: Long-haul（6-10 セッション、高リスク）

> 構造的健全化の最終段階。row_to_model 統一と Schedule 命名整理。

### Steps

- [ ] **3-1**: Rust 全 repository の row_to_model 統一
  - `db/row_converter.rs` に `RowConverter` trait を追加し、各 repository が実装
  - `*_repository.rs` 27 ファイルの個別 row*to*\* 実装を trait impl に移行
  - 推定 -1500 行
- [ ] **3-2**: 既知 Issue 012 cursor pagination の本実装
  - `cloud/src/routes/sync/changes.ts` で `nextSince: string` を返す
  - `src-tauri/src/sync/sync_client.rs` で `while has_more { fetch_changes(since=nextSince) }` ループ実装
  - LIMIT=5000 の hardcode を `config.SYNC_PAGE_SIZE` に
- [ ] **3-3**: Schedule 命名混乱の解消
  - `frontend/src/components/Schedule/` → `frontend/src/components/ScheduleList/` に rename
  - `App.tsx` / `useTaskDetailHandlers.ts` の import path を更新
- [ ] **3-4**: Mobile/Desktop Schedule View 統合（Calendar 統合の Schedule 版）
  - `hooks/useScheduleViewLogic.ts` 抽出
  - `ScheduleSection.tsx` (750) と `MobileScheduleView.tsx` (489) を shared component で
- [ ] **3-5**: 論理キー UNIQUE 制約の網羅的追加（MEMORY.md §バグの温床）
  - `tasks` / `notes` / `routines` / `dailies` の論理キー特定（PK だけで UNIQUE 不足の有無を audit）
  - 追加可能なテーブルで partial UNIQUE migration（V65, V66...）
  - `routine_tag_assignments (routine_id, tag_id)` のような複合キー relation を最優先

### Files

| File                                                    | Op     | Notes                          |
| ------------------------------------------------------- | ------ | ------------------------------ |
| `src-tauri/src/db/row_converter.rs`                     | Edit   | RowConverter trait             |
| `src-tauri/src/db/*_repository.rs` (27)                 | Edit   | trait impl 化                  |
| `cloud/src/routes/sync/changes.ts`                      | Edit   | nextSince cursor               |
| `src-tauri/src/sync/{sync_engine,sync_client}.rs`       | Edit   | pagination loop                |
| `cloud/src/config/syncTables.ts`                        | Edit   | SYNC_PAGE_SIZE                 |
| `frontend/src/components/Schedule/`                     | Move   | ScheduleList/ へ rename        |
| `frontend/src/App.tsx`                                  | Edit   | import path 更新               |
| `frontend/src/hooks/useScheduleViewLogic.ts`            | Create | Schedule 共通                  |
| `frontend/src/components/Schedule/ScheduleSection.tsx`  | Edit   | shared 消費                    |
| `frontend/src/components/Mobile/MobileScheduleView.tsx` | Edit   | shared 消費                    |
| `src-tauri/src/db/migrations/v61_plus.rs`               | Edit   | V65+ partial UNIQUE migrations |

### Verification

- [ ] `cargo test --lib` で 27 repository の trait impl が pass
- [ ] D1 + Desktop で 5000 行超のテーブル round-trip pull が完走（`hasMore=false` 確認）
- [ ] Schedule rename 後の Desktop / Mobile / TaskDetail の screen 遷移が動作
- [ ] V65+ migration 適用後、3 端末（Desktop / iOS / Cloud）で sync 通過
- [ ] `MEMORY.md §バグの温床` から 5+ 項目削除可能

### Risks / Mitigations

- **row_to_model 統一で型推論が変わる** → trait は generic を最小化、各 impl は既存シグネチャ維持
- **pagination 実装で旧 client が壊れる** → `nextSince` は backward-compatible に追加（旧 client は無視）
- **Schedule rename で外部参照（terminal claude history など）が壊れる** → rename 後 1 週間は alias re-export を残す
- **partial UNIQUE migration で既存 D1 データに違反行がある** → migration 前に audit SQL を流し、違反行は手動 cleanup

---

## 横断ルール（全 Phase 共通）

### コミット規約

- 1 Step = 1 commit（`feat:` / `fix:` / `refactor:` / `chore:`）
- Phase 完了時に `MEMORY.md` 直近の完了に追記、HISTORY.md 更新（`/task-tracker` 経由）
- Phase 完了 PR は **Phase ごと** に分ける（一括 PR 禁止）

### 検証ゲート

各 Step 完了時に最低限:

1. `cd frontend && npm run build`（`tsc -b` 含む）
2. `cd frontend && npm run test`
3. `cargo build`
4. Cloud 変更があれば `cd cloud && wrangler dev` で起動確認

Phase 1+ では `/session-verifier` を Step 完了時に必ず通す。

### 巻き戻し戦略

- 各 Phase は独立 PR、Phase 内の Step も極力独立 commit
- DB migration を伴う Step は別 commit（rollback 容易性）
- Phase 2-3 で Calendar / Schedule 統合中は **iOS 実機テスト** を Step ごとに 1 回入れる（regression を早期検出）

### Done 定義

- 当該 Phase の全 Step チェック済
- Verification 全項目 pass
- `MEMORY.md §バグの温床` 該当項目を削除
- `code-inventory.md` の対応セクションを更新（Active / Duplicate / Hotspot）

---

## 実行順の推奨

```
Phase 0 (1 セッション)
   ↓
Phase 1-1 sync.ts 分割 → 1-2 Provider tree → 1-3 row_converter → 1-4 SQL whitelist
   （Phase 1 は Step が独立、並列推進可）
   ↓
Phase 2-1 migrations 分割 → 2-2 TauriDataService 分割 → 2-3 巨大コンポーネント
   （2-3 は ScheduleTimeGrid → OneDaySchedule → TagGraphView → TaskDetailPanel の順）
   ↓
Phase 2-4 Calendar 統合（最も成果が大きい）
   ↓
Phase 3-1 row_to_model trait → 3-2 pagination → 3-3 rename → 3-4 Schedule 統合 → 3-5 UNIQUE 制約
```

**Phase 0 は本日着手可能。Phase 1 以降は別セッションで実施推奨。**

---

## 参照

- [`docs/code-inventory.md`](./docs/code-inventory.md) — 棚卸し
- [`docs/known-issues/INDEX.md`](./docs/known-issues/INDEX.md) — 既知バグ
- [`docs/vision/coding-principles.md`](./docs/vision/coding-principles.md) — 設計原則
- [`docs/vision/db-conventions.md`](./docs/vision/db-conventions.md) — DB 規約
- `MEMORY.md §バグの温床` — 構造的弱点 17 項目

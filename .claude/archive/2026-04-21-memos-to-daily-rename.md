# Plan: Memos → Daily 完全リネーム（Frontend → Rust → MCP、DB と time_memos は除外）

**Status**: COMPLETED (2026-04-22)
**Created**: 2026-04-21
**Completed**: 2026-04-22
**Project**: life-editor
**Related Vision**: [`core.md`](../core.md), [`desktop-followup.md`](../desktop-followup.md)
**Related Plans**: 並行 [`2026-04-21-ios-refactor-phase-c-d.md`](./2026-04-21-ios-refactor-phase-c-d.md)

---

## 1. Context

### 1.1 現状の非対称

Materials セクションの **Daily（日次メモ）** タブは:

- **Desktop**: Tab ID 既に `"daily"`、label `ideas.daily = "デイリー"` → **UI 層は Daily**。だが内部実装は `DailyMemoView` + `useMemoContext` + `useMemos` + `memos` テーブル → **実装層は Memo**
- **Mobile**: Tab ID `"memos"`、label `mobile.tabs.memos = "メモ"` → **UI 層も実装層も Memo**

ユーザーは **「Daily と Memo は別概念」** として定着させたい意向:

- **Daily** = 日付単位の記録（`memos` テーブル、date UNIQUE）
- **Memo** = タスクの補足メモ（`time_memos` テーブル、タスクに紐づく）、および TaskDetail の TipTap 編集領域の汎用名

現状は両者を同じ「Memo」の名前空間で混在させているため、開発者にも認知負荷が高い。

### 1.2 ゴール

**「Daily（日次メモ）関連の全コードシンボルを `daily` / `Daily` に統一。`memo` / `Memo` は task-level memo（`time_memos` / TaskDetail）にのみ残す」**

### 1.3 スコープ外（重要）

- **DB テーブル名**: `memos` / `time_memos` はそのまま。リネームしない（migration 不要、Cloud D1 スキーマ不変）
- **`time_memos` 関連**: `time_memo_commands.rs` / `useTimeMemos` / `InlineMemoInput` / `TimeMemoForm` 等すべて対象外
- **`TaskDetail/MemoEditor.tsx`**: 汎用 TipTap エディタ。対象外。将来的な time_memos 統合は [`desktop-followup.md`](../desktop-followup.md) 参照
- **`MemoActivityHeatmap.tsx` / `memoGrouping.ts` / `MemoPreviewPopup.tsx` / `MemoNodeComponent.tsx`**: 対象判定を実装時に個別確認（daily 関連か time_memo 関連か）。原則として「date 単位のコンテンツを扱うもの」= Daily、「task に紐づくもの」= Memo（残置）

### 1.4 なぜ DB は対象外か

- 既存ユーザー = 本人のみ → データ移行コストは低いが、
- Cloud Sync の D1 schema + migration + 全テーブル再同期が必要
- コードシンボルの rename だけでも認知改善の 9 割を達成できる
- DB 境界で naming flip（`daily_repository` が `SELECT * FROM memos` する）は許容

---

## 2. Steps

### Phase 1: Frontend Types と Context の rename

- [ ] **F1-1**: `frontend/src/types/memo.ts` → `frontend/src/types/daily.ts`
  - 型名: `Memo` → `Daily`、`MemoNode` → `Daily`、`MemoId` → `DailyId` 等（実装時に全シンボル棚卸し）
  - `frontend/src/types/index.ts` の re-export 更新
- [ ] **F1-2**: `frontend/src/context/MemoContextValue.ts` → `DailyContextValue.ts`
  - `MemoContextValue` interface → `DailyContextValue`
  - メソッド: `upsertMemo` → `upsertDaily`、`deleteMemo` → `deleteDaily`、`memos` → `dailyList`（または `dailies`）、`selectedDate` はそのまま
- [ ] **F1-3**: `frontend/src/context/MemoContext.tsx` → `DailyContext.tsx`
  - Provider 名: `MemoProvider` → `DailyProvider`
  - Context: `MemoContext` → `DailyContext`
- [ ] **F1-4**: `frontend/src/hooks/useMemoContext.ts` → `useDailyContext.ts`
  - Hook 名: `useMemoContext` → `useDailyContext`
  - Optional バリアント（もし存在すれば）: `useMemoContextOptional` → `useDailyContextOptional`
- [ ] **F1-5**: `frontend/src/hooks/useMemos.ts` → `useDaily.ts`
  - Hook 名: `useMemos` → `useDaily`
- [ ] **F1-6**: `frontend/src/context/index.ts` の export 更新

### Phase 2: Frontend View / Component の rename

- [ ] **F2-1**: `frontend/src/components/Ideas/DailyMemoView.tsx` → `DailyView.tsx`
  - コンポーネント名: `DailyMemoView` → `DailyView`
- [ ] **F2-2**: `frontend/src/components/Ideas/DailySidebar.tsx` — ファイル名・コンポーネント名はそのまま（既に Daily）。内部の `upsertMemo` 等 API 呼び出しを F1-2 に追従
- [ ] **F2-3**: `frontend/src/components/Mobile/MobileMemoView.tsx` → `MobileDailyView.tsx`
  - コンポーネント名: `MobileMemoView` → `MobileDailyView`
  - props: `initialSelectedDate` / `onInitialSelectionConsumed` — dateベースの props なのでそのまま
- [ ] **F2-4**: `frontend/src/components/Mobile/MobileMaterialsView.tsx` 更新
  - `MaterialsTab` 型: `"memos" | "notes"` → `"daily" | "notes"`
  - `MaterialsSelection` 型: `{ tab: "memos"; date: string }` → `{ tab: "daily"; date: string }`
  - state 変数 `pendingMemoDate` → `pendingDailyDate`
  - import: `MobileMemoView` → `MobileDailyView`
- [ ] **F2-5**: `frontend/src/components/Materials/MaterialsView.tsx` 更新
  - `useMemoContext` → `useDailyContext`、`memos` / `upsertMemo` / `deleteMemo` → F1-2 に合わせる
  - import: `DailyMemoView` → `DailyView`
- [ ] **F2-6**: `frontend/src/components/Ideas/index.ts` の re-export 更新
- [ ] **F2-7**: `frontend/src/components/Ideas/MaterialsSidebar.tsx` / `TemplateContentView.tsx` / その他 `useMemoContext` 使用者を全検索し追従

### Phase 3: DataService 層の rename

- [ ] **F3-1**: `frontend/src/services/DataService.ts` インターフェースメソッド rename
  - `fetchAllMemos` → `fetchAllDaily`
  - `fetchMemoByDate` → `fetchDailyByDate`
  - `upsertMemo` → `upsertDaily`
  - `deleteMemo` → `deleteDaily`
  - `fetchDeletedMemos` → `fetchDeletedDaily`
  - `restoreMemo` → `restoreDaily`
  - `permanentDeleteMemo` → `permanentDeleteDaily`
  - `toggleMemoPin` → `toggleDailyPin`
  - `setMemoPassword` → `setDailyPassword`
  - `removeMemoPassword` → `removeDailyPassword`
  - `verifyMemoPassword` → `verifyDailyPassword`
  - `toggleMemoEditLock` → `toggleDailyEditLock`
- [ ] **F3-2**: `frontend/src/services/TauriDataService.ts` 実装側 rename + `invoke()` コマンド名更新（Phase 6 の Rust 側と同期）
- [ ] **F3-3**: `frontend/src/test/mockDataService.ts` の mock 実装 rename

### Phase 4: Sync / UndoRedo 層の rename

- [ ] **F4-1**: `frontend/src/types/sync.ts` 内 `memos` フィールド
  - **注意**: Cloud API レスポンスの JSON key は `memos` のまま（DB 未リネームのため）。フロント型の field name は Daily 表現に rename しつつ、JSON 変換時に mapping する
  - 実装方針: sync 境界で `response.memos → dailyList` への変換層を追加 or フロント型の field を `memos` のまま（公開シンボルは Daily、内部 sync 型のみ memos 維持）
  - 採用: **後者**（境界の naming flip を最小化）。`SyncData.memos` はそのまま、使用箇所で Daily concept にマップ
- [ ] **F4-2**: `frontend/src/context/UndoRedoContext.tsx` の action type
  - `memoUpsert` → `dailyUpsert` 等、Daily 系 action type を rename

### Phase 5: i18n キーの rename

- [ ] **F5-1**: `frontend/src/i18n/locales/en.json` / `ja.json` のキー変更
  - `mobile.tabs.memos` → `mobile.tabs.daily`（label は "Daily" / "デイリー" に更新）
  - `dailyMemo` 系キー → `daily` 系に整理（既に `daily` キーがある箇所は統合、重複排除）
  - 旧 `memos` がタスク関連メモを指している箇所は残置
- [ ] **F5-2**: i18n キー参照箇所をフロントエンド全体で grep 更新

### Phase 6: Rust commands / repository の rename

- [ ] **R6-1**: `src-tauri/src/commands/memo_commands.rs` → `daily_commands.rs`
  - ファイル名変更 + `commands/mod.rs` の `pub mod memo_commands;` → `pub mod daily_commands;`
- [ ] **R6-2**: `src-tauri/src/commands/daily_commands.rs` 内の関数名
  - `db_memo_fetch_all` → `db_daily_fetch_all`
  - `db_memo_fetch_by_date` → `db_daily_fetch_by_date`
  - `db_memo_upsert` → `db_daily_upsert`
  - `db_memo_delete` → `db_daily_delete`
  - `db_memo_fetch_deleted` → `db_daily_fetch_deleted`
  - `db_memo_restore` → `db_daily_restore`
  - `db_memo_permanent_delete` → `db_daily_permanent_delete`
  - `db_memo_toggle_pin` → `db_daily_toggle_pin`
  - `db_memo_set_password` → `db_daily_set_password`
  - `db_memo_remove_password` → `db_daily_remove_password`
  - `db_memo_verify_password` → `db_daily_verify_password`
  - `db_memo_toggle_edit_lock` → `db_daily_toggle_edit_lock`
- [ ] **R6-3**: `src-tauri/src/db/memo_repository.rs` → `daily_repository.rs`
  - `db/mod.rs` の module 宣言更新
  - 関数名: `memo_repository::fetch_all` → `daily_repository::fetch_all` 等（module 名リネームで自動対応）
  - 構造体: `MemoNode` → `Daily`
  - **SQL は変更しない**: `SELECT * FROM memos` / `UPDATE memos SET ...` はそのまま（DB 未リネーム）
- [ ] **R6-4**: `src-tauri/src/lib.rs` の `generate_handler![]` エントリを R6-2 のコマンド名で更新
- [ ] **R6-5**: Tauri IPC 名の対応表を確認
  - IPC コマンド名は関数名から自動導出されるため `db_memo_*` → `db_daily_*` に変わる
  - Frontend `invoke("db_memo_*")` を `invoke("db_daily_*")` に全て追従（F3-2 と同時）
- [ ] **R6-6**: `src-tauri/src/sync/` 内 `memos` 参照
  - `VERSIONED_TABLES` 的なリストに `"memos"` が文字列で含まれる場合は**そのまま**（DB 未リネーム）
  - コード内のコメント / 変数名で `memo` → `daily` に更新（ただし `time_memos` 関連は除外）
- [ ] **R6-7**: `src-tauri/src/commands/claude_commands.rs:63` のドキュメント文字列 `get_memo / upsert_memo: Daily memos (YYYY-MM-DD key)` を `get_daily / upsert_daily: Daily entries (YYYY-MM-DD key)` に更新

### Phase 7: MCP Server の rename

- [ ] **M7-1**: `mcp-server/src/handlers/memoHandlers.ts` → `dailyHandlers.ts`
  - 関数名: `getMemo` → `getDaily`、`upsertMemo` → `upsertDaily`
  - 型名: `MemoRow` → `DailyRow`、`formatMemo` → `formatDaily`
  - SQL はそのまま（`FROM memos`）
- [ ] **M7-2**: `mcp-server/src/tools.ts` のツール名・ディスパッチ
  - ツール名: `"get_memo"` → `"get_daily"`、`"upsert_memo"` → `"upsert_daily"`
  - `import { getMemo, upsertMemo } from "./handlers/memoHandlers.js"` → `./dailyHandlers.js` + 新関数名
  - switch case 更新
- [ ] **M7-3**: `mcp-server/src/tools.ts:363` の description 文字列 `create_note/upsert_memo` → `create_note/upsert_daily`
- [ ] **M7-4**: `mcp-server/src/handlers/contentHandlers.ts` の `target: "note" | "memo" | "schedule"` 型
  - **判断**: ここの `"memo"` は Daily を指している（content = markdown、target_id = `memo-${date}`）→ `"daily"` に rename
  - `id = 'memo-${date}'` → `id = 'daily-${date}'` は **既存データとの整合性を壊す**ため据え置き（ID prefix は内部 convention）
  - ただし新規作成時の prefix は `daily-` に変更して混在容認（本人のみなので影響小）
- [ ] **M7-5**: `mcp-server/src/handlers/searchHandlers.ts` の `VALID_DOMAINS = ["tasks", "memos", "notes"]`
  - MCP の public API として `"memos"` は残す or `"daily"` に変更する? → **`"daily"` に変更**（Claude Code が指定する domain 名、ユーザー体感に直結）
  - 旧 `"memos"` は後方互換 warning を出して `"daily"` にマップ or 廃止。本人のみ利用のため**即時廃止**
- [ ] **M7-6**: `mcp-server/src/handlers/wikiTagHandlers.ts:213` の `entity_type === "memo"` 判定
  - **判断**: WikiTag の entity_type は DB 上の文字列値。`wiki_tag_assignments.entity_type = 'memo'` の既存データが存在する可能性があるため **据え置き**（`"memo"` 判定継続）
  - コメントで「ここの `"memo"` は legacy naming、Daily tab のタグを指す」と明記

### Phase 8: Cloud / D1 の rename

- [ ] **C8-1**: `cloud/src/routes/sync.ts` の `VERSIONED_TABLES`
  - `"memos"` 文字列は **DB テーブル名と一致必須**のため**そのまま**
  - 変数名・コメントで明示的に `memo` を使っている箇所は `daily` に更新（grep で洗い出し）
- [ ] **C8-2**: `cloud/db/schema.sql` / `cloud/db/migrations/0001_initial.sql`
  - DB スキーマは変更しない
- [ ] **C8-3**: Cloud API 公開 JSON の field name `memos` は**そのまま**（F4-1 の方針と整合）

### Phase 9: 検証とドキュメント

- [ ] **V9-1**: 型チェック + lint + test
- [ ] **V9-2**: iOS 実機 + Desktop で「Daily タブで書いた内容が両端末に反映」を確認
- [ ] **V9-3**: MCP ツール `upsert_daily` / `get_daily` を Claude Code から手動叩いて動作確認
- [ ] **V9-4**: CLAUDE.md §5.1 の MCP ツール一覧を更新（`get_memo` / `upsert_memo` → `get_daily` / `upsert_daily`）
- [ ] **V9-5**: `docs/requirements/tier-1-core.md` の Daily / Memo 記述更新
- [ ] **V9-6**: Known Issue 009/010 の References に memo 関連パスがあれば追記（本プラン完了日）

---

## 3. Files

### Frontend（新規 / rename）

| File                                                                                     | Operation                            | Phase       |
| ---------------------------------------------------------------------------------------- | ------------------------------------ | ----------- |
| `frontend/src/types/memo.ts` → `types/daily.ts`                                          | Rename                               | F1-1        |
| `frontend/src/types/index.ts`                                                            | Edit                                 | F1-1        |
| `frontend/src/context/MemoContextValue.ts` → `DailyContextValue.ts`                      | Rename                               | F1-2        |
| `frontend/src/context/MemoContext.tsx` → `DailyContext.tsx`                              | Rename                               | F1-3        |
| `frontend/src/hooks/useMemoContext.ts` → `useDailyContext.ts`                            | Rename                               | F1-4        |
| `frontend/src/hooks/useMemos.ts` → `useDaily.ts`                                         | Rename                               | F1-5        |
| `frontend/src/context/index.ts`                                                          | Edit                                 | F1-6        |
| `frontend/src/components/Ideas/DailyMemoView.tsx` → `Ideas/DailyView.tsx`                | Rename                               | F2-1        |
| `frontend/src/components/Ideas/DailySidebar.tsx`                                         | Edit                                 | F2-2        |
| `frontend/src/components/Mobile/MobileMemoView.tsx` → `Mobile/MobileDailyView.tsx`       | Rename                               | F2-3        |
| `frontend/src/components/Mobile/MobileMaterialsView.tsx`                                 | Edit                                 | F2-4        |
| `frontend/src/components/Materials/MaterialsView.tsx`                                    | Edit                                 | F2-5        |
| `frontend/src/components/Ideas/index.ts`                                                 | Edit                                 | F2-6        |
| `frontend/src/components/Ideas/MaterialsSidebar.tsx`                                     | Edit                                 | F2-7        |
| `frontend/src/components/Ideas/TemplateContentView.tsx`                                  | Edit                                 | F2-7        |
| `frontend/src/services/DataService.ts`                                                   | Edit                                 | F3-1        |
| `frontend/src/services/TauriDataService.ts`                                              | Edit                                 | F3-2        |
| `frontend/src/test/mockDataService.ts`                                                   | Edit                                 | F3-3        |
| `frontend/src/types/sync.ts`                                                             | Edit (comment only, field name keep) | F4-1        |
| `frontend/src/context/UndoRedoContext.tsx`                                               | Edit                                 | F4-2        |
| `frontend/src/i18n/locales/en.json`                                                      | Edit                                 | F5-1        |
| `frontend/src/i18n/locales/ja.json`                                                      | Edit                                 | F5-1        |
| `frontend/src/main.tsx`                                                                  | Edit (Provider name)                 | F1-3        |
| （他: grep で Daily tab 由来の `useMemoContext` 参照箇所を全列挙し追従、実装時に棚卸し） | Edit                                 | F2-7 / F5-2 |

### Rust

| File                                                                     | Operation                              | Phase      |
| ------------------------------------------------------------------------ | -------------------------------------- | ---------- |
| `src-tauri/src/commands/memo_commands.rs` → `commands/daily_commands.rs` | Rename                                 | R6-1, R6-2 |
| `src-tauri/src/commands/mod.rs`                                          | Edit                                   | R6-1       |
| `src-tauri/src/db/memo_repository.rs` → `db/daily_repository.rs`         | Rename                                 | R6-3       |
| `src-tauri/src/db/mod.rs`                                                | Edit                                   | R6-3       |
| `src-tauri/src/lib.rs`                                                   | Edit                                   | R6-4       |
| `src-tauri/src/sync/sync_engine.rs`                                      | Edit (コメント・変数名のみ)            | R6-6       |
| `src-tauri/src/sync/types.rs`                                            | Edit (コメント・field name は据え置き) | R6-6       |
| `src-tauri/src/commands/claude_commands.rs`                              | Edit (L63 doc string)                  | R6-7       |

### MCP Server

| File                                                                    | Operation           | Phase      |
| ----------------------------------------------------------------------- | ------------------- | ---------- |
| `mcp-server/src/handlers/memoHandlers.ts` → `handlers/dailyHandlers.ts` | Rename              | M7-1       |
| `mcp-server/src/tools.ts`                                               | Edit                | M7-2, M7-3 |
| `mcp-server/src/handlers/contentHandlers.ts`                            | Edit                | M7-4       |
| `mcp-server/src/handlers/searchHandlers.ts`                             | Edit                | M7-5       |
| `mcp-server/src/handlers/wikiTagHandlers.ts`                            | Edit (コメントのみ) | M7-6       |

### Cloud

| File                        | Operation                                               | Phase |
| --------------------------- | ------------------------------------------------------- | ----- |
| `cloud/src/routes/sync.ts`  | Edit (コメント・変数名のみ、`"memos"` 文字列は据え置き) | C8-1  |
| `cloud/db/schema.sql`       | **変更しない**                                          | C8-2  |
| `cloud/db/migrations/*.sql` | **変更しない**                                          | C8-2  |

### Docs

| File                                       | Operation                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `.claude/CLAUDE.md`                        | §5.1 MCP ツール表の `get_memo`/`upsert_memo` → `get_daily`/`upsert_daily` |
| `.claude/docs/requirements/tier-1-core.md` | Daily / Memo 記述の整理                                                   |
| `.claude/docs/known-issues/INDEX.md`       | 009/010 の Fixed 行に補足（必要なら）                                     |

---

## 4. Verification

### 静的検証

- [ ] `cd src-tauri && cargo check` — 警告なし
- [ ] `cd src-tauri && cargo test` — 既存テスト pass
- [ ] `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — 型エラー 0 件
- [ ] `cd frontend && npx vitest run` — 全テスト pass
- [ ] `cd mcp-server && npm run build` — TypeScript ビルド成功

### シンボル検証（grep 確認）

- [ ] `rg -n "useMemoContext|MemoProvider|MemoContext|DailyMemoView|MobileMemoView" frontend/src` → ヒット 0（`time_memo` 系除外のため `-g '!**/*TimeMemo*'` で）
- [ ] `rg -n "fetch_all_memos|upsert_memo|memo_repository|memo_commands" src-tauri/src` → Daily 系関数のみヒット or 0
- [ ] `rg -n "get_memo|upsert_memo" mcp-server/src` → 0（MCP public API）
- [ ] `rg -n "FROM memos|UPDATE memos|INTO memos" src-tauri/src mcp-server/src` → SQL のみヒット（DB 未リネームの意図通り）

### 機能検証（Desktop）

- [ ] Materials → Daily タブで新規記入 → リロードで保持
- [ ] Daily ゴミ箱削除 → Trash タブに表示 → 復元で戻る
- [ ] Daily ピン留め / パスワード / 編集ロックが動作
- [ ] UndoRedo で Daily の upsert を取り消せる

### 機能検証（Mobile — ユーザー側 iOS 実機）

- [ ] Mobile Materials の 1 つ目のタブ label が **"Daily" / "デイリー"**
- [ ] Mobile Daily で書いた内容が Desktop Daily に反映（Cloud Sync）
- [ ] Desktop Daily で書いた内容が Mobile Daily に反映

### MCP 検証

- [ ] Claude Code の MCP ツール一覧に `get_daily` / `upsert_daily` が表示
- [ ] 旧 `get_memo` / `upsert_memo` が **表示されない**（即時廃止の意図通り）
- [ ] `upsert_daily(date="2026-04-21", content="テスト")` → Desktop Materials > Daily で内容確認
- [ ] `search_all(query="テスト", domains=["daily"])` がヒット、`domains=["memos"]` がエラー（即時廃止の意図通り）

---

## 5. 実装順序（ユーザー指示: Frontend → Rust）

1. **F1 → F2 → F3 → F4 → F5** の順で Frontend を完結させる

- F3-2（TauriDataService）で `invoke("db_memo_*")` はこの時点では古い名前のまま維持（Rust 側未変更のため）

2. **R6**（Rust）を一気に移行。このコミットで `invoke` 側（F3-2）と Tauri `#[tauri::command]` 名を同時切替
3. **M7**（MCP）を移行
4. **C8**（Cloud）のコメント・変数名のみ微修正
5. **V9**（Verification + Docs）

**コミット粒度**: Phase 単位（F1 / F2 / F3 / F4 / F5 / R6 / M7 / C8 / V9）で最低 1 コミット。大きい Phase はサブコミット可。

**Lock-in point**: F3-2 と R6-4 の Tauri IPC 名切替は **同一コミット** で行う（切替中にアプリが起動不能になるため）。

---

## 6. Open Questions / 判断メモ

- [ ] **M7-4（MCP `target: "memo"` の扱い）**: ID prefix `memo-${date}` の扱いを実装時に再確認。既存データと新規作成の混在を許容するか、一律 `daily-${date}` に。本人のみ利用なので混在許容でも実害なし
- [ ] **M7-5（MCP `VALID_DOMAINS`）**: 即時廃止で OK か実装時に再確認。過去の Claude Code 会話で `domains=["memos"]` を投げるコードを書いたことがあれば、ごく短期の alias `"memos" → "daily"` を残す選択肢も
- [ ] **F4-1（Sync JSON field）**: `SyncData.memos` を Daily に rename せず据え置きとするが、実装時に境界変換層が必要か再評価
- [ ] **F1-2 の複数形**: `dailyList` / `dailies` / `allDaily` のどれが自然か。TypeScript エコシステムでは `dailies` が素直（Note + `notes` と対称）

---

## 7. 完了後の処理

1. 本ファイルを更新（Status = COMPLETED、完了日）
2. 本ファイルを `.claude/archive/` へ移動
3. CLAUDE.md §5.1 の MCP ツール表を反映（V9-4）
4. `desktop-followup.md` の TaskDetail ↔ time_memos 統合メモを改めて確認（Daily / Memo の住み分けが明示できたため、統合プランの着手条件が整う）
5. `.claude/MEMORY.md` / `.claude/HISTORY.md` を task-tracker 経由で更新

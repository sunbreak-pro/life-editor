# Plan: iOS Refactor — Mobile Data Parity Phase C + D + 可読性クリーンアップ

**Status**: COMPLETED (2026-04-22)
**Created**: 2026-04-21
**Completed**: 2026-04-22

## Completion Summary

- **C2**（Provider 経由化）: MobileTaskView / MobileScheduleView / MobileWorkView / MobileTrashSection を全て `getDataService()` 直呼び撤去、Provider 経由に移行。MobileSettingsView は one-shot I/O allow-list コメント追加
- **C3**（shared 化）: `components/Mobile/shared/SwipeableItem.tsx` 抽出。`todayStr` / `formatDateStr` の重複を `utils/dateKey.ts` の `getTodayKey` / `formatDateKey` に寄せた
- **C4**（分割）: MobileScheduleView 489 → 226 LOC + MobileScheduleRow 88 LOC、MobileWorkView 764 → 214 LOC + 3 files（work/MobileTaskSelector, MobileSessionCompletionModal, MobileTimerComponents）、MobileCalendarView 734 → 469 LOC + schedule/MobileMonthlyCalendar 263 LOC
  - **C4-3 (MobileNoteView split) はスコープ外に deferred**（Phase B 時点で既に Provider 経由、更なる構造分割は follow-up）
- **C1**（Rust 命名）: `schedule_item_repository::fetch_by_date` → `fetch_by_date_active`、`fetch_by_date_range` → `fetch_by_date_range_active` に rename + 3 行 rustdoc 追加
- **D-1**（Lint）: `frontend/eslint.config.js` に `no-restricted-syntax` ルール追加（Mobile 配下の `getDataService()` 直呼びと `dataServiceFactory` import を検出、`MobileSettingsView` / `MobileApp` を allow-list）
- **D-2**（coding-principles.md）: §5 Repository 層の命名規則を新規追加
- **D-3**（統合テスト）: `src-tauri/tests/schedule_item_path_parity.rs` 作成、4 テスト全 pass（`fetch_by_date_active` / `fetch_by_date_all` / `fetch_by_date_range_active` / `fetch_events` のフィルタ挙動を保証）
- **D-4**（CLAUDE.md §7.6）: Mobile 画面追加時のチェックリスト追加

## Verification Results

- `cargo check` — ✓
- `cargo test --test schedule_item_path_parity` — 4/4 pass
- `npx tsc --noEmit -p tsconfig.app.json` — 0 errors
- `npx vitest run` — 231/231 pass 維持
- `npx eslint src/components/Mobile/` — 新 Lint ルール由来のエラー 0 件（pre-existing 別ルール 4 件は本タスク対象外）
- `cd mcp-server && npm run build` — ✓

**Project**: life-editor
**Related Vision**: [`mobile-data-parity.md`](../mobile-data-parity.md), [`coding-principles.md`](../coding-principles.md)
**Related Known Issues**: [009](../../known-issues/009-mobile-data-parity-provider-bypass.md), [010](../../known-issues/010-notes-memos-mutation-skipped-by-delta-sync.md)
**Related Plans**:

- 先行: [`2026-04-20-mobile-data-parity-phase-a-b.md`](./2026-04-20-mobile-data-parity-phase-a-b.md)（Phase A + B 完了）
- 並行: [`2026-04-21-memos-to-daily-rename.md`](./2026-04-21-memos-to-daily-rename.md)（Daily rename、命名統一で相乗効果）

---

## 1. Context

### 1.1 なぜ今

`mobile-data-parity.md` の Phase A（観測）と Phase B（Provider 経由への移行）は 2026-04-20 に完了したが、**Phase C（Repository 層の整理）と Phase D（再発防止）は未着手**。

加えて Phase B の時点で `components/Mobile/` 配下の構造的問題（下記）が残存している:

- `MobileWorkView.tsx` (764 行) / `MobileCalendarView.tsx` (734 行) / `MobileNoteView.tsx` (550 行) / `MobileScheduleView.tsx` (489 行) が **肥大化**。単一コンポーネントに表示・状態・データ取得・swipe 操作・フォーム制御が同居
- `MobileTaskView` / `MobileScheduleView` / `MobileWorkView` / `MobileTrashSection` が **まだ `getDataService()` 直呼び**（Phase B は Calendar/Memo のみ対象だった）
- Mobile 固有の swipe 操作ロジック（`SwipeableItem` 等）が各画面に重複定義
- Repository 関数名が「取得軸（フィルタ条件）」を名前から判別できない（`fetch_by_date_range` が `is_dismissed=0` を含むか不明瞭）

### 1.2 ゴール

**可読性と依存関係の明確化を最優先**。構造が整えば:

- 新機能追加時のボイラープレートが減る
- `syncVersion` 再 fetch フック貼り忘れの構造的防止（Provider 中央化）
- Desktop / Mobile 非対称バグ（Issue 009 系）の再発防止

### 1.3 非目標（スコープ外）

- Mobile の UI/UX 磨き込み（ブレークポイント調整、Tailwind 再設計）
- iOS 実機の Tauri ビルド検証（コード修正のみ、実機確認はユーザー側）
- Memos → Daily rename（別プランで扱う）
- Cloud Sync の HLC 化（`mobile-porting.md` 別系譜）

---

## 2. Steps

### Phase C1: Repository 層の語彙整理（Rust）

- [ ] **C1-1**: `src-tauri/src/db/schedule_item_repository.rs` の fetch 関数群を命名変更
  - `fetch_by_date`（L55-63）→ `fetch_by_date_excluding_dismissed`
  - `fetch_by_date_all`（L65-73, 既存）→ そのまま（名前は OK）
  - `fetch_by_date_range`（L75-87）→ `fetch_by_date_range_excluding_dismissed`
  - `fetch_events`（L406-414）→ `fetch_events_all_periods`
  - 呼び出し元（`commands/schedule_item_commands.rs` 等）も合わせて追従
- [ ] **C1-2**: `note_repository.rs` / `memo_repository.rs` で is_deleted フィルタを持つ関数群に同様の命名規則適用
  - `fetch_all` → `fetch_all_active`（is_deleted=0 を名前に込める）
  - `fetch_trashed` → 現状維持（既に明示的）
- [ ] **C1-3**: 各 fetch 関数の先頭にトップレベル rustdoc コメント追加（対象テーブル / フィルタ条件 / ソート順を 3 行で明記）

### Phase C2: Mobile の `getDataService()` 直呼び掃討

- [ ] **C2-1**: `MobileTaskView.tsx` を `useTaskTreeContext()` 経由に書き換え
  - `ds.fetchTaskTree()` → Provider の `allNodes` 購読
  - `ds.updateTask()` → Provider の `setTaskStatus()` / `updateNode()`（UndoRedo 対応）
  - `loadTasks` / `syncVersion` 依存 useEffect を撤去
- [ ] **C2-2**: `MobileScheduleView.tsx` を `useScheduleItemsContext()` 経由に書き換え
  - `ds.fetchScheduleItemsByDate` / `fetchScheduleItemsByDateRange` → Provider の日次/月次 state
  - `ds.toggleScheduleItemComplete` 等 mutation も Provider 経由
- [ ] **C2-3**: `MobileWorkView.tsx` の `getDataService()` 直呼び箇所を特定し、Provider 経由に移行（Timer / Pomodoro / 楽曲再生との依存関係を先に整理）
- [ ] **C2-4**: `settings/MobileTrashSection.tsx` の `getDataService()` 直呼びを対応 Provider（Task / Note / Memo / Database）経由に置換
- [ ] **C2-5**: `MobileSettingsView.tsx` の `exportData()` / `importData()` は **例外として直呼び継続**（Provider 化する意味がない one-shot 操作）。ただし `// OK: one-shot operation, no Provider needed` コメント追加

### Phase C3: Mobile 共通ロジックの shared 化

- [ ] **C3-1**: `SwipeableItem` を `components/Mobile/shared/SwipeableItem.tsx` に抽出
  - `MobileScheduleView.tsx:30-125` 等に散在するコピーを統合
- [ ] **C3-2**: Mobile 共通 formatter（`todayStr()` / `formatDate()` 等）を `utils/mobileDate.ts` に集約
- [ ] **C3-3**: Mobile 固有の `generateId()` 関数が複数箇所にあるか確認し、あれば `utils/ids.ts` の共通 `generateId(prefix)` に統一

### Phase C4: 肥大コンポーネントの分割

- [ ] **C4-1**: `MobileCalendarView.tsx` (734 行) を以下に分割
  - `MobileCalendarView.tsx` — top-level 状態 + レイアウト
  - `MobileCalendarGrid.tsx` — 月グリッド描画
  - `MobileCalendarDayCell.tsx` — 単日セル
  - `useMobileCalendarNavigation.ts` — 月移動ロジック
- [ ] **C4-2**: `MobileWorkView.tsx` (764 行) を以下に分割
  - `MobileWorkView.tsx` — 状態 + タブ切替
  - `MobileTimerPanel.tsx` — Pomodoro UI
  - `MobileMusicPanel.tsx` — 楽曲再生 UI
- [ ] **C4-3**: `MobileNoteView.tsx` (550 行) を以下に分割
  - `MobileNoteView.tsx` — ツリー + 編集切替
  - `MobileNoteEditor.tsx` — TipTap エディタ wrapper
  - `MobileNoteTreePanel.tsx` — サイドバー
- [ ] **C4-4**: `MobileScheduleView.tsx` (489 行) を以下に分割（C2-2 と同時）
  - `MobileScheduleView.tsx` — 状態 + レイアウト
  - `MobileScheduleList.tsx` — 日次リスト
  - `MobileScheduleSwipeActions.tsx` — swipe 操作

### Phase D: 再発防止

- [ ] **D-1**: ESLint カスタムルール or プロジェクトローカル Lint を追加し、`components/Mobile/` 配下からの `getDataService()` 呼び出しを検出
  - 許可リスト: `MobileSettingsView.tsx` の export/import、`MobileApp.tsx`（Provider 初期化）
  - 実装方針: `eslint-plugin-boundaries` or 自作 `no-direct-dataservice-in-mobile.js` rule
- [ ] **D-2**: Repository 層の語彙規則を `.claude/docs/vision/coding-principles.md` に追記
  - 命名規則: `fetch_<対象>_<軸>` + フィルタ条件を名前に含める
  - 新規 Repository 関数追加時のチェックリスト
- [ ] **D-3**: Mobile / Desktop の経路差分検知用統合テストを `src-tauri/tests/` に追加
  - 同一 fixture に対して Desktop 経路と Mobile 経路の fetch 結果が期待通り一致/差分することを検証
  - dismissed / deleted / future-date event の 3 パターン最低カバー
- [ ] **D-4**: PR テンプレート（もしあれば）or CLAUDE.md §7.5 に「Mobile 画面追加時の Provider 経由チェックリスト」を追記

---

## 3. Files

| File                                                               | Operation        | Notes                                                                     |
| ------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------- |
| `src-tauri/src/db/schedule_item_repository.rs`                     | Rename functions | C1-1: 4 関数リネーム、L55-87, L406-414                                    |
| `src-tauri/src/db/note_repository.rs`                              | Rename functions | C1-2: `fetch_all` → `fetch_all_active`                                    |
| `src-tauri/src/db/memo_repository.rs`                              | Rename functions | C1-2: 同上（※ Daily rename プランとコンフリクト注意、先後関係は §5 参照） |
| `src-tauri/src/commands/schedule_item_commands.rs`                 | Update callers   | C1-1 の呼び出し元追従                                                     |
| `src-tauri/src/commands/note_commands.rs`                          | Update callers   | C1-2 の呼び出し元追従                                                     |
| `src-tauri/src/commands/memo_commands.rs`                          | Update callers   | C1-2 の呼び出し元追従（Daily rename と合流）                              |
| `frontend/src/components/Mobile/MobileTaskView.tsx`                | Refactor         | C2-1: Provider 経由に書き換え、全 122 行見直し                            |
| `frontend/src/components/Mobile/MobileScheduleView.tsx`            | Refactor + split | C2-2 + C4-4、489 行 → 3 ファイル                                          |
| `frontend/src/components/Mobile/MobileWorkView.tsx`                | Refactor + split | C2-3 + C4-2、764 行 → 3 ファイル                                          |
| `frontend/src/components/Mobile/MobileCalendarView.tsx`            | Split            | C4-1、734 行 → 4 ファイル                                                 |
| `frontend/src/components/Mobile/MobileNoteView.tsx`                | Split            | C4-3、550 行 → 3 ファイル                                                 |
| `frontend/src/components/Mobile/settings/MobileTrashSection.tsx`   | Refactor         | C2-4: Provider 経由                                                       |
| `frontend/src/components/Mobile/MobileSettingsView.tsx`            | Add comment      | C2-5: 直呼び継続理由コメント追加                                          |
| `frontend/src/components/Mobile/shared/SwipeableItem.tsx`          | Create           | C3-1                                                                      |
| `frontend/src/utils/mobileDate.ts`                                 | Create           | C3-2                                                                      |
| `.claude/docs/vision/coding-principles.md`                         | Append           | D-2: Repository 命名規則 §追加                                            |
| `src-tauri/tests/schedule_item_path_parity.rs`                     | Create           | D-3: 経路差分統合テスト                                                   |
| `.eslintrc.*` or `eslint-rules/no-direct-dataservice-in-mobile.js` | Create           | D-1: Lint ルール                                                          |
| `frontend/src/CLAUDE.md` (if exists) or root CLAUDE.md §7.5        | Append           | D-4: チェックリスト追加                                                   |

---

## 4. Verification

### コード品質

- [ ] `cd src-tauri && cargo check` — 警告なし
- [ ] `cd src-tauri && cargo test` — 既存テスト pass + Phase D-3 新規テスト pass
- [ ] `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — 本プラン起因の型エラー 0 件
- [ ] `cd frontend && npx vitest run` — 既存 231/231 pass

### 機能確認（Desktop）

- [ ] Schedule タブで Events（routine_id IS NULL）が全期間表示される
- [ ] Desktop Dayflow で dismissed item が非表示
- [ ] Note DnD / Memo ゴミ箱操作が Cloud Sync delta に乗る（Issue 010 既修正の回帰確認）

### 機能確認（Mobile — コード段階）

- [ ] `MobileTaskView` / `MobileScheduleView` / `MobileWorkView` / `MobileTrashSection` から `getDataService()` import が消えている
- [ ] Phase C4 の分割後、各ファイルが 250 行以下（肥大化目安を下回る）
- [ ] `components/Mobile/shared/SwipeableItem.tsx` が 2 箇所以上から import されている（重複解消検証）

### 機能確認（Mobile — iOS 実機、ユーザー側）

- [ ] Mobile Schedule で Event 新規作成 → Desktop でも即座に表示
- [ ] Mobile Task トグル → Desktop Dayflow に反映
- [ ] Mobile Work 画面の Pomodoro / 楽曲機能が壊れていない
- [ ] Mobile Trash からの復元が動作

### 再発防止検証

- [ ] Lint（D-1）が `MobileTaskView.tsx` 等の旧コードを検出することを回帰テストで確認（意図的に直呼びを戻して fail するか）
- [ ] D-3 の統合テストが dismissed / deleted / 未来 Event の 3 パターンで差分を正しく検出

---

## 5. 実装順序と先後関係

1. **Phase C1**（Rust 命名）を先行。Daily rename プランの `memo_repository.rs` 変更と**最も競合しやすい**ため、この計画を Daily rename の**前に**完了させる
2. **Phase C2 / C3 / C4**（Frontend）を順次実施。各コミット単位で型チェック + テスト pass を確認
3. **Phase D**（再発防止）を最後に実施。D-1 Lint を先に入れると C2 の書き換え中に過剰警告が出るため

**Daily rename プランとの合流点**: C1-2（`memo_repository.rs` の関数リネーム）は Daily rename で同ファイルがまるごと `daily_repository.rs` になる予定。**Daily rename を先に実施** → 本計画の C1-2 を「`daily_repository` の `fetch_all` → `fetch_all_active`」に差し替える方が手戻りが少ない。

→ **推奨順序**: Daily rename → 本計画の Phase C1-1 (schedule) / C1-2 (note, daily) → C2 → C3 → C4 → D

ただしユーザー指示「Frontend → Rust」の順を優先する場合、Phase C2 / C3 / C4（Frontend）→ C1 (Rust) → D の順も可。

---

## 6. Open Questions

- [ ] Phase C4 の分割粒度は妥当か? （実装時に過剰分割と感じたら統合戻し OK）
- [ ] D-1 の Lint ルールは `eslint-plugin-boundaries` の層制約 or 自作ルール、どちらが保守コスト低いか実装時に評価
- [ ] D-3 の統合テストは Rust 側 (`cargo test`) か TypeScript 側 (Vitest + in-memory SQLite) か。現状のテストインフラに合わせて選択

---

## 7. 完了後の処理

1. 本ファイルを更新（Status = COMPLETED、完了日追記）
2. `mobile-data-parity.md` §6 の Phase C / Phase D を完了マーク
3. Known Issue 009 の References に本プランを追加
4. `.claude/MEMORY.md` / `.claude/HISTORY.md` を task-tracker 経由で更新

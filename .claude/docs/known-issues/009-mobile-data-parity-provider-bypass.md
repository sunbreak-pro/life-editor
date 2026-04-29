# 009: Mobile 画面が Provider をバイパスして DataService 直呼びしているためデータ伝播が非対称

**Status**: Fixed
**Category**: Structural
**Severity**: Important
**Discovered**: 2026-04-20
**Resolved**: 2026-04-20

## Symptom

iOS 実機で以下の症状が観測されている:

- **Schedule セクション (Mobile)**: 今月以外の Event（`routine_id IS NULL` の `schedule_items`）が見えない。Desktop の Events タブでは全期間の Event が列挙されるが、Mobile カレンダーは月ナビゲートしないと該当月の Event が出ない
- **Schedule (Mobile)**: `is_dismissed = 1` にした Event がカレンダー月セルに残存表示される（Desktop の DayFlow 単日表示では非表示）
- **Materials (Memo, Mobile)**: Desktop Daily Memo 側で memo を更新した直後に Mobile Memo 一覧へ反映が遅延する（次の `syncVersion` bump か画面再マウントまで旧内容）
- **Provider 側 state の dead weight**: `ScheduleItemsProvider.events` が Mobile では空のまま（消費者不在）

## Root Cause

同一 SQLite に対して Desktop は Provider 経由、Mobile は画面コンポーネントから `getDataService()` 直呼びという **二系統化** が構造的に発生している。

### 経路差分の証拠

| ドメイン               | Desktop                                                                                                      | Mobile                                                                                                | Provider mount  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------- |
| Schedule Events 全期間 | `frontend/src/components/Schedule/EventList.tsx:28-33` → `useScheduleItemsContext().events` + `loadEvents()` | なし（画面自体が存在しない）                                                                          | ✓               |
| Schedule 月表示        | —                                                                                                            | `frontend/src/components/Mobile/MobileCalendarView.tsx:476` → `ds.fetchScheduleItemsByDateRange()`    | ✓               |
| Memos                  | `useMemoContext().memos` + `upsertMemo`                                                                      | `frontend/src/components/Mobile/MobileMemoView.tsx:53,152` → `ds.fetchAllMemos()` / `ds.upsertMemo()` | ✓ (dead weight) |
| Notes                  | `useNoteContext()`                                                                                           | `frontend/src/components/Mobile/MobileNoteView.tsx:67-80` → **既に Provider 経由済み**                | ✓               |

→ `MemoProvider` / `ScheduleItemsProvider` は `frontend/src/main.tsx:42,45` で iOS 向けにも mount されているにもかかわらず、画面側が購読していない。

### Repository SQL の差分

`src-tauri/src/db/schedule_item_repository.rs`:

```rust
// fetch_by_date (Desktop DayFlow 単日) — L55-63
WHERE date = ?1 AND is_deleted = 0 AND is_dismissed = 0

// fetch_by_date_range (Mobile カレンダー月) — L75-87
WHERE date BETWEEN ?1 AND ?2 AND is_deleted = 0
// ↑ is_dismissed = 0 が欠落

// fetch_events (Desktop Events タブ) — L406-414
WHERE routine_id IS NULL AND is_deleted = 0
```

Mobile が使う `fetch_by_date_range` は `is_dismissed` を見ないため、Desktop 単日表示と dismissed アイテム扱いが非対称。

### 構造的帰結

- Provider 側の state（`events` / `memos`）は Mobile では空／独立コピー → mutation の伝播が画面単位で切れる
- `syncVersion` による再 fetch フックは画面側に個別に貼られる（`MobileMemoView.tsx:64`, `MobileCalendarView.tsx:505-509`） → 貼り忘れリスクあり
- CREATE / UPDATE が Provider の optimistic update + UndoRedo を経由しないため、Mobile での操作は Undo/Redo 非対応

## Impact

放置すると:

- **ユーザー**: Mobile ↔ Desktop 間で「編集したのに反映されない」体感が継続、Cloud Sync の問題に誤認されやすい
- **開発者**: 新機能追加時に「Desktop は Provider、Mobile は直呼び」のボイラープレートが二系統分発生、保守コスト増
- **QA**: dismissed/未来月イベントの振る舞いがプラットフォーム非対称で再現困難

頻度は日常操作で常時。特に `MemoProvider` の mutation 経路を意図的に使う Daily Memo や Task detail から編集した際に顕著。

## Fix / Workaround

恒久対応として Phase B を `.claude/docs/vision/plans/2026-04-20-mobile-data-parity-phase-a-b.md` の計画に沿って実施（2026-04-20 同日）:

1. `MobileCalendarView` を `useScheduleItemsContext()` / `useTaskTreeContext()` 経由に書き換え
   - `monthItems` / `tasks` ローカル state 撤去、`monthlyScheduleItems` + `allNodes.filter(type=task)` を購読
   - Provider の `loadScheduleItemsForMonth`（42-day grid）を使用 → 月カレンダーのグリッド padding も正しくカバーされる副次改善
   - CRUD は `toggleComplete` / `updateScheduleItem` / `createScheduleItem` / `softDeleteScheduleItem` / `setTaskStatus` / `updateNode` に置換。await/再 fetch は Provider の optimistic update に委譲
2. `MobileMemoView` を `useMemoContext()` 経由に書き換え、`ds.fetchAllMemos` / `ds.upsertMemo` 直呼び撤去。Provider の `upsertMemo` は UndoRedo 対応済み
3. `schedule_item_repository.rs::fetch_by_date_range` に `is_dismissed = 0` フィルタを追加（`fetch_by_date` と対称化）

**MobileNoteView は対象外**（Phase A 時点で既に Provider 経由移行済み、vision/mobile-data-parity.md §2.1 の Notes 行は Phase A で訂正済み）。

### 変更ファイル

- `src-tauri/src/db/schedule_item_repository.rs:75-87`
- `frontend/src/components/Mobile/MobileCalendarView.tsx`（全体リファクタ）
- `frontend/src/components/Mobile/MobileMemoView.tsx`（全体リファクタ）

### 検証

- `npx tsc --noEmit -p tsconfig.app.json` — 本プラン起因の型エラー 0 件（既存の IdeasView.tsx TagGraphViewProps エラーは本プラン対象外）
- `npx vitest run` — 231/231 passed
- `cargo check` — 警告なしで pass
- iOS 実機確認は後続（fstprog@gmail.com 側）

## References

- 関連ファイル:
  - `frontend/src/components/Mobile/MobileCalendarView.tsx:476`
  - `frontend/src/components/Mobile/MobileMemoView.tsx:37,53,136,152`
  - `frontend/src/components/Mobile/MobileNoteView.tsx:67-80`（参考: 移行完了例）
  - `frontend/src/components/Schedule/EventList.tsx:28-33`
  - `frontend/src/hooks/useScheduleItemsEvents.ts:24-31`
  - `frontend/src/hooks/useMemos.ts:26-39`
  - `frontend/src/context/ScheduleItemsContext.tsx`
  - `frontend/src/context/MemoContext.tsx`
  - `frontend/src/main.tsx:42,65`
  - `src-tauri/src/db/schedule_item_repository.rs:55-87,406-414`
  - `frontend/src/components/Mobile/schedule/dayItem.ts:111-137`（`isDismissed` 未フィルタ）
- 関連 Vision: `.claude/docs/vision/mobile-data-parity.md`
- 関連 Plan: `.claude/docs/vision/plans/2026-04-20-mobile-data-parity-phase-a-b.md`
- 関連 Plan（並走）: `.claude/2026-04-21-mobile-materials-parity.md`（Notes の Provider 移行はこちらで完了済み）
- 関連 Plan（Phase C+D 完了）: `.claude/archive/2026-04-21-ios-refactor-phase-c-d.md`（残 Mobile 画面の Provider 化 / Repository 命名整理 / ESLint ルール / 経路差分統合テスト）

## Lessons Learned

- **Mobile 画面から `getDataService()` を見かけたら二系統化の徴候**。Provider が main.tsx で mount されていれば、画面側は `useXxxContext()` を使うのが原則
- Repository 関数名は **取得軸（filter 条件）** を名前に込める（例: `fetch_by_date_range_excluding_routines` / `fetch_by_date_range_all`）。現状は `fetch_by_date_range` が「dismissed を含むか」を名前から判別できない
- `syncVersion` による再 fetch 貼り忘れは Provider に中央化すれば構造的に防げる → Phase B での狙い
- 類似バグの再発防止キーワード: "Mobile", "Provider", "DataService", "直呼び", "syncVersion", "dead weight", "is_dismissed"

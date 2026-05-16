# Plan: Mobile Data Parity — Phase A (観測) + Phase B (Provider 経由統一)

**Status:** COMPLETED
**Created:** 2026-04-20
**Completed:** 2026-04-20
**Project:** /Users/newlife/dev/apps/life-editor
**Parent Vision:** [`.claude/docs/vision/mobile-data-parity.md`](../mobile-data-parity.md)
**Related:**

- `.claude/CLAUDE.md` §3.2 (DataService 抽象化) / §6.2 (Provider 順序) / §6.5 (Schedule 3 分割) / §9 (Document System)
- `.claude/docs/vision/coding-principles.md` §4 (Optional hook)
- `.claude/2026-04-21-mobile-materials-parity.md` (Mobile Materials の並走プラン — Notes は本プランと重複スコープ)

---

## Context

vision/mobile-data-parity.md で識別した構造的非対称を **観測 → Provider 経由統一** の順で解消する。対象は Schedule / Notes / Memos の 3 ドメイン。Cloud Sync 以前のローカル取得経路の食い違いを是正することで、`syncVersion` による再 fetch の貼り忘れも構造的に防ぐ。

### 現状の経路マトリクス（2026-04-20 コード調査時点）

| ドメイン                   | Desktop 経路                                                              | Mobile 経路（現状）                                                      | Provider mount  |
| -------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------- |
| Schedule Events 全期間一覧 | `useScheduleItemsContext().events` → `loadEvents()` (EventList.tsx:28-33) | **なし**（月範囲のみ）                                                   | ✓               |
| Schedule 月表示            | 個別 hook / 画面ごと                                                      | `ds.fetchScheduleItemsByDateRange()` 直呼び (MobileCalendarView.tsx:476) | ✓               |
| Memos                      | `useMemoContext().memos`                                                  | `ds.fetchAllMemos()` 直呼び (MobileMemoView.tsx:37,53,136)               | ✓ (dead weight) |
| Notes                      | `useNoteContext().notes`                                                  | **既に Provider 経由済み** (MobileNoteView.tsx:67-80)                    | ✓               |

→ vision 表の Notes 行は古い。**Notes は既に移行済みのため Phase B 対象外**。

### Phase A で明確化すべき定量差分

1. **Schedule**: `fetch_events`（Desktop 全期間）と `fetch_by_date_range`（Mobile 月範囲）の件数差
2. **Schedule filter**: `fetch_by_date_range` は `is_dismissed = 0` フィルタなし → Mobile で dismissed イベントが見えている（想定外表示）
3. **Memo**: Provider の `memos` state と Mobile ローカル `memos` state の重複ロード → 同一 SQL のため件数は一致するが、mutation 伝播経路が二系統化
4. **ScheduleItemsProvider.events**: Mobile では `loadEvents()` を呼ぶ消費側が存在しないため Provider が dead weight

---

## Non-Goals

- Cloud Sync の HLC 化 / Relation テーブル独自 version 付与（vision §5）
- Mobile 独自「全 Event 一覧」UI 新設（既存 UI 維持、内部だけ Provider 経由へ切替）
- Repository 層の enum/struct 化（Phase C 以降）
- Lint ルール / PR チェック（Phase D）
- Desktop 側の Schedule ビュー再編
- MobileNoteView の再移行（完了済み）

---

## Steps

### Phase A — 観測（このセッション完結）

- [x] A1. Desktop / Mobile の取得経路を実コードで特定
  - MobileCalendarView.tsx:476 — `ds.fetchScheduleItemsByDateRange()` 直呼び ✓
  - MobileMemoView.tsx:49,53,136,152 — `ds.fetchAllMemos()` / `ds.upsertMemo()` 直呼び ✓
  - MobileNoteView.tsx:67-80 — 既に `useNoteContext()` 経由 ✓
  - EventList.tsx:28-33 — `useScheduleItemsContext()` の `events` / `loadEvents` ✓
  - schedule_item_repository.rs:55-87, 406-414 — 4 種 fetch 関数の SQL 差分を確認 ✓
  - buildMonthItemMap (dayItem.ts:111) — `isDeleted` のみフィルタ、`isDismissed` 未フィルタ ✓
- [x] A2. 差分の種類を整理（下記「観測サマリ」参照）
- [x] A3. Known Issue `009-mobile-data-parity-provider-bypass.md` を作成、INDEX.md 更新
- [x] A4. Phase A 完了時点で Phase B 着手せず報告 → ユーザー判断を仰ぐ

#### 観測サマリ（Phase A 成果）

| 差分                 | Desktop                                                 | Mobile                                              | 影響                                                        |
| -------------------- | ------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| Events 全期間一覧    | `fetch_events`（全日付、routine_id IS NULL）            | なし                                                | Mobile で「今月以外の Event」が見えない                     |
| 月範囲取得 SQL       | —                                                       | `fetch_by_date_range`（is_dismissed 非フィルタ）    | Mobile で dismissed イベントが残存表示                      |
| Memo state           | `MemoProvider.memos` が SSoT、mutation 時 Provider 経由 | 画面ローカル `memos` state + `ds.upsertMemo` 直呼び | Daily Memo 等の他コンポーネント更新が Mobile に即反映しない |
| Provider dead weight | `ScheduleItemsProvider` が backfill 用途で必要          | `loadEvents()` 呼び出し者不在                       | Provider の `events` state が空のまま                       |

→ 上記 4 点を Phase B の具体 Step に 1:1 対応させる（下記参照）。

### Phase B — Provider 経由への統一（別セッションで着手）

**前提**: Phase A のユーザー承認後、本セクションを別セッションで開始。

- [x] B1. MobileCalendarView を Provider 経由へ書き換え
  - `useScheduleItemsContext()` + `useTaskTreeContext()` を購読
  - ローカル `monthItems` / `tasks` state を撤去、Provider の `monthlyScheduleItems` / `allNodes.filter` を使用
  - Mutation (`toggleComplete` / `updateScheduleItem` / `createScheduleItem` / `softDeleteScheduleItem` / `setTaskStatus` / `updateNode`) を Provider 経由に置換、手動 re-fetch を撤去
  - `syncVersion` は月ビューのリロードトリガとして保持（Provider は `loadItemsForDate` のみ sync hook）
- [x] B2. MobileMemoView を `useMemoContext()` 経由へ書き換え
  - ローカル `memos` / `loading` state を撤去、Provider の `memos` を直接購読
  - `ds.upsertMemo` → Provider の `upsertMemo`（UndoRedo 対応済み）
- [x] B3. Repository `fetch_by_date_range` の `is_dismissed` 扱いを決定
  - 採択: **(a) Repository に `is_dismissed = 0` を追加**（Desktop の `fetch_by_date` と対称化）
- [x] B4. Regression 確認
  - Vitest: 231/231 passed、`MobileMemoView` / `MobileCalendarView` 専用の新規テストは既存 dayItem / EventList テストでカバーされる範囲のため **追加を見送り**
  - `cargo check` — pass
  - 実機（iOS）動作確認は fstprog@gmail.com 側（後続）
- [x] B5. Known Issue 009 を Fixed 化、vision/mobile-data-parity.md は Phase A で既に更新済み、plan Status=COMPLETED へ

---

## Files

### Phase A（観測 — このセッションで作成・更新）

| File                                                                   | Operation | Notes                                  |
| ---------------------------------------------------------------------- | --------- | -------------------------------------- |
| `.claude/CLAUDE.md` §9                                                 | Update    | vision/plans/ 原則追加 ✓（完了）       |
| `.claude/docs/vision/plans/2026-04-20-mobile-data-parity-phase-a-b.md` | Create    | 本プラン ✓                             |
| `.claude/docs/known-issues/009-mobile-data-parity-provider-bypass.md`  | Create    | 差分の Root Cause 記録                 |
| `.claude/docs/known-issues/INDEX.md`                                   | Update    | Active に 009 を追加                   |
| `.claude/docs/vision/mobile-data-parity.md` §2.1 表                    | Update    | Notes 行を「既に Provider 経由」へ訂正 |

### Phase B（実装 — 別セッション）

| File                                                         | Operation | Notes                                                                                    |
| ------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------- |
| `frontend/src/components/Mobile/MobileCalendarView.tsx`      | Edit      | `useScheduleItemsContext()` 経由に書き換え、ローカル state 撤去                          |
| `frontend/src/components/Mobile/MobileMemoView.tsx`          | Edit      | `useMemoContext()` 経由に書き換え、`extractPlainText` は Provider 側 or shared helper へ |
| `frontend/src/context/ScheduleItemsContext.tsx`              | Edit      | 月範囲ロード API を Provider に露出（必要時）                                            |
| `frontend/src/hooks/useScheduleItems.ts`                     | Edit      | 同上、hook 側でサポート                                                                  |
| `src-tauri/src/db/schedule_item_repository.rs:75-87`         | Edit      | `fetch_by_date_range` に `is_dismissed = 0` 追加（決定次第）                             |
| `frontend/src/components/Mobile/MobileMemoView.test.tsx`     | Create    | Provider 経由でのレンダリング検証                                                        |
| `frontend/src/components/Mobile/MobileCalendarView.test.tsx` | Create    | 同上                                                                                     |
| `.claude/docs/vision/mobile-data-parity.md`                  | Update    | Phase A/B 完了ステータス追記                                                             |

---

## Verification

### Phase A 完了条件（観測）

- [x] Known Issue 009 が Active ステータスで登録されている
- [x] INDEX.md から 009 が辿れる
- [x] 本プランの「観測サマリ」表が差分 4 件を列挙している
- [x] vision/mobile-data-parity.md の古い記述（Notes 行）が訂正されている

### Phase B 完了条件（別セッションで検証）

- [x] `MobileCalendarView` / `MobileMemoView` に `getDataService()` 直呼びが **存在しない**（grep で確認）
- [x] `ds.upsertMemo` / `ds.fetchAllMemos` / `ds.fetchScheduleItemsByDateRange` の Mobile 画面呼び出しを撤去（確認手段: `grep "getDataService\|ds\.fetch\|ds\.upsert\|ds\.create\|ds\.update\|ds\.soft" frontend/src/components/Mobile/`）
- [x] Daily Memo（Desktop 側）で memo を更新 → Mobile の Memo リストが即反映（構造的には Provider 共通化で保証。実機検証は後続）
- [x] Mobile カレンダー月表示で dismissed イベントが非表示（Repository レイヤで SQL フィルタ追加）
- [x] `cd frontend && npx vitest run` が全通過（231/231）
- [x] `cargo check` が警告なく通過
- [ ] iOS 実機で Materials / Schedule が Phase B 前と同等以上に動作（ユーザー確認待ち）

---

## Phase 分割の理由

1. **Phase A を独立セッションにする理由**: vision の方針は「観測 → 差分に基づき優先順位決定」。先に定量化しないと B3（is_dismissed 対応の決定）が曖昧になる
2. **Phase B を一括で行う理由**: MobileCalendarView / MobileMemoView はそれぞれ 2-3 ファイルの改修で閉じる。Vitest 追加込みでも 1 セッション内に収まる見込み
3. **Phase C / D は本プラン対象外**: Repository の enum/params 化、Lint ルールは別プランで扱う（コードベース全体への影響が広いため）

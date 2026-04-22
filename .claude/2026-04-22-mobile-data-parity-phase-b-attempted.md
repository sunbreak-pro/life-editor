# Session Log: Mobile Data Parity Phase B 試行（中断）

**Status:** PAUSED — iOS 側の同期反映が未解決のためロールバック
**Session range:** 2026-04-20 21:20 頃 〜 2026-04-22（日付変更時点で停止）
**Parent Vision:** [`.claude/docs/vision/mobile-data-parity.md`](./docs/vision/mobile-data-parity.md)

---

## 目的

vision/mobile-data-parity.md に記載された Phase A（観測）+ Phase B（Provider 経由統一）を実装する。併せて、調査過程で発見した Cloud Sync delta 脱落バグの修正も行う。

## 実施した作業（全てロールバック済）

### 1. Phase A — 観測

- Desktop / Mobile の取得経路を実コードで特定
- 差分 4 件を整理:
  - Mobile に Event 全期間ビューが存在しない
  - `fetch_by_date_range` に `is_dismissed = 0` フィルタなし
  - MobileMemoView が Provider を経由せず DataService 直呼び
  - `ScheduleItemsProvider.events` が Mobile では dead weight
- Known Issue #009 として登録（後にロールバック時に削除）

### 2. Phase B — Provider 経由統一（コード変更）

- `MobileCalendarView` を `useScheduleItemsContext()` + `useTaskTreeContext()` 経由へリファクタ
- `MobileMemoView` を `useMemoContext()` 経由へリファクタ
- `schedule_item_repository::fetch_by_date_range` に `is_dismissed = 0` フィルタ追加
- 検証: `cargo check` pass / `vitest` 231/231 passed / `tsc --noEmit` pass

### 3. Cloud Sync delta 脱落バグの修正（Issue #010 として登録）

Phase B の動作検証中にユーザーから「Desktop の変更が iOS に 10 分経っても反映されない」と報告を受け、sync 経路を調査。以下 3 点の `updated_at` bump 漏れを発見し修正:

- `src-tauri/src/db/helpers.rs::soft_delete_by_key` — Memo 削除が delta sync から脱落
- `src-tauri/src/db/helpers.rs::restore_by_key` — Memo 復元が delta sync から脱落
- `src-tauri/src/db/note_repository.rs::sync_tree` — Note DnD 移動/並び替えが delta sync から脱落

Known Issue #010 として登録（後にロールバック時に削除）。

### 4. 並行セッションとの協調

別セッションが `schedule_items` の routine_id+date 重複（Cloud D1 に 1,181 行）を修正中だと判明。両者をまとめた V63 統合案も検討したが、最終的に別セッション側が先に V63 を commit + D1 適用し、私側は「コード修正のみ、migration なし」の方針 (A) で確定。

### 5. ドキュメント整備

- CLAUDE.md §9 に `vision/ = 方針` / `vision/plans/ = 具体実装プラン` の書き分け原則追加
- `.claude/docs/vision/plans/2026-04-20-mobile-data-parity-phase-a-b.md` を Plan として作成
- vision/mobile-data-parity.md の Notes 行を「既に Provider 経由」へ訂正 + Phase A/B 完了マーク

## 中断理由

iOS 実機で「Desktop 側の変更が反映されない」「Notes/Memos の一部が同期されない」という症状が、**コード修正後も iOS 再ビルド → 再デプロイ後も解消しなかった**。

検証の切り分けとして Issue #010 の 3 つの `updated_at` bump 漏れを修正したが、ユーザー報告では症状が継続。他にも delta sync 経路で脱落しているケースがある可能性がある。

Phase B のコード変更自体は動作していたが、**根本の sync 反映問題が未解決のまま広範囲のコード変更を commit するのはリスクが高い**と判断し、ユーザー側で一旦ロールバック。

## 現在の状態

- 私の作業は全て working tree から消えている（user 判断でロールバック）
- 別セッションの作業（Issue #011 対応 = `f8b77c5`）は commit 済 + Desktop / D1 適用済
- Known Issue #009 / #010 の Root Cause 所見は本ファイルにのみ残る

## 次回セッションへの引き継ぎ

### 未解決バグ（コード上に残る）

以下は Phase B でコード修正したが、ロールバックで元に戻っている。再着手時は再修正が必要:

1. `src-tauri/src/db/helpers.rs` L49-76 — `soft_delete_by_key` / `restore_by_key` に `version = version + 1, updated_at = datetime('now')` 追加
2. `src-tauri/src/db/note_repository.rs` L138-150 — `sync_tree` に同上追加
3. `src-tauri/src/db/schedule_item_repository.rs` L75-87 — `fetch_by_date_range` に `is_dismissed = 0` フィルタ追加

### Provider 経由統一（未適用）

- MobileCalendarView / MobileMemoView の Provider 経由リファクタも元に戻っている
- vision/mobile-data-parity.md Phase B の作業項目は再着手時に有効

### iOS 同期問題の追加調査ポイント

コード修正だけでは解決しなかった iOS 同期問題の次の調査候補:

- Cloud Sync のログ（Desktop 側 + iOS 側）で `pushed: N, pulled: N` だけでなく「どの id が skip されたか」を確認
- sync_engine の `upsert_versioned` 分岐を実データで追跡
- `last_synced_at` の粒度問題（ms 未満の更新が 2 回続くと片方 skip される可能性）
- 既存 D1 データの検査（Notes/Memos の `updated_at` 昇順ソートで「同一秒内複数更新」が複数存在しないか）

### 関連ビジョン / プラン

- [`.claude/docs/vision/mobile-data-parity.md`](./docs/vision/mobile-data-parity.md) — Phase A/B 方針
- [`.claude/docs/vision/realtime-sync.md`](./docs/vision/realtime-sync.md) — 別セッションで作成された同期高速化案（untracked 段階）
- Known Issue #011（`.claude/docs/known-issues/011-schedule-items-routine-date-duplication.md`）— 別セッションで解決済、V63 で対処

## 関連コミット（別セッション）

- `f8b77c5 fix(sync): dedup schedule_items by (routine_id, date) at DB/sync/frontend layers`
- `0aef85c chore: remove orphaned IdeasView.tsx (superseded by ConnectView)`
- `f87dcb6 chore: remove unused useEffect import in MobileNoteView`

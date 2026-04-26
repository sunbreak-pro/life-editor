---
Status: AUTOMATED COMPLETE / MANUAL PENDING
Created: 2026-04-26
Updated: 2026-04-26 (自動検証セクション S-1 / S-7 / S-8 完遂、ドキュメント反映済)
Task: MEMORY.md §直近完了（リファクタリング Phase 2-4 / 3-1 / 3-4 検証）
Project path: /Users/newlife/dev/apps/life-editor
Related: [.claude/archive/2026-04-25-refactoring-plan.md](./archive/2026-04-25-refactoring-plan.md) — 本計画書の対象となる実装プラン (archive 済み、Status: COMPLETED)
---

# Plan: Phase 2-4 / 3-1 / 3-4 リファクタリング検証

## Context

### 動機

`2026-04-25-refactoring-plan.md` で deferred とされた 3 項目を 2026-04-26 に実装した。

- **Phase 3-1**: Rust `db/row_converter.rs` に `FromRow` trait + `query_all` / `query_one` ヘルパを追加。27 repository の `fn row_to_X` を `impl FromRow for X` に移行（33+ 関数）
- **Phase 2-4**: `utils/calendarGrid.ts` 新設（`buildCalendarGrid` / `addDays` / `getMondayOf` / `getWeekDates`）。Desktop `useCalendar.ts` と Mobile `MobileCalendarView.tsx` の月グリッド計算を統一
- **Phase 3-4**: Mobile 内の duplicate 日付ユーティリティ（`MobileCalendarStrip.tsx` / `MobileScheduleView.tsx` の inline `getMonday` / `formatDateStr` / `addDays` / `todayStr`）を `calendarGrid.ts` / `dateKey.ts` の共有版に集約

### 前提

当初 plan の「Mobile/Desktop ScheduleSection 完全統合」「Calendar コンポーネント完全統合」は **アーキテクチャ差（Context vs Service 層、Popover vs BottomSheet）** により regression リスク高と判定し、純粋ロジックのみ抽出する保守的方針に変更した。これは Phase 2-3b/d の判断と同じ。

### 自動検証の到達点

- `cargo build --lib` clean
- `cargo test --lib` 25/25 pass（既存 sidebar_link_repository 5 tests + migration 11 + sync 2 + ほか）
- `npm run build` clean（Vite production build 7.9s）
- `npm run test` 332/332 pass（新規 `calendarGrid.test.ts` 8 tests を含む）
- `npx tsc -b` 警告ゼロ

### 残された手動検証

自動テストでカバーできない以下の領域を本計画で検証する:

- iOS / Desktop 両プラットフォームでの UI 回帰（Calendar / Schedule / Mobile）
- Cloud Sync round-trip（FromRow trait 移行で row 取得経路が全 repository に渡るため）
- 大量データ環境での性能（query_all helper の prepare 再利用が無いことの影響）

### Non-goals

- Phase 2-3 の追加分割（OneDaySchedule 等の JSX サブディレクトリ化）
- Mobile/Desktop の完全 UI 統合
- 構造体定義の `models/` ディレクトリへの集約

---

## Steps

### S-1: Rust 単体検証（Phase 3-1）

- [x] `cd src-tauri && cargo build --lib` warnings = 0 — 2026-04-26 確認
- [x] `cd src-tauri && cargo test --lib` 25/25 pass (1 ignored = `bench_fetch_tree`) — 2026-04-26 確認
- [~] `cd src-tauri && cargo clippy --lib -- -D warnings` — **既存警告 83 件**で fail。**内訳**: `migrations/v2_v30.rs` 29 / `v31_v60.rs` 30 / `v61_plus.rs` 9 = 68 (migrations は本リファクタの対象外、未変更) / `reminder.rs` 6 / `sync_engine.rs` 2 (`field_reassign_with_default`) / `claude_commands.rs` 1 (`manual_flatten`) / repository 系 3 (`too_many_arguments` on 11-arg `create()` シグネチャ — Phase 3-1 の FromRow 移行とは無関係)。**結論**: Phase 3-1 で導入された警告は 0、全件 pre-existing。clippy 警告ゼロ達成は別セッションで cleanup 必要 (本検証外)
- [x] `grep -rnE "fn row_to_" src-tauri/src/db/` → `row_to_json` のみ ✓
- [x] `grep -rnE "row_to_[a-z_]+\(row" src-tauri/src/` → `helpers.rs::row_to_json` (3 箇所) + `sync_engine.rs::row_to_json` (1 箇所) のみ ✓
- [ ] `target/debug/life-editor` 起動 → エラーログなし (Desktop 起動を要するため manual)

### S-2: Rust 統合検証（Phase 3-1, IPC 経由）

`src-tauri && cargo tauri dev` で起動し、以下の IPC 経由 fetch を網羅:

- [ ] **Tasks**: タスクツリー取得（`fetch_tree` → `TaskNode::from_row`）。50+ ノードでも一覧表示が崩れないこと
- [ ] **Notes**: ノート一覧 / 単一取得 / 検索（`NoteNode::from_row`）
- [ ] **Dailies**: 日付カレンダーをめくって複数日 fetch（`DailyNode::from_row`）。pin / password 状態が正しく反映
- [ ] **Schedule**: 1 日 / 期間 / routine 別 / events 別の 4 経路すべて表示できる
- [ ] **Routines**: ルーチン編集ダイアログを開く（`RoutineNode::from_row`）
- [ ] **Database (汎用)**: 既存テーブルを開いて property / row / cell が表示
- [ ] **Wiki Tags**: タグリスト + connection graph + group 表示
- [ ] **Paper Boards**: 凍結機能だが起動して board / node / edge が読める
- [ ] **Sound / Playlists**: Audio Mixer / プレイリスト一覧
- [ ] **Templates**: タスクテンプレート一覧
- [ ] **Sidebar Links**: LeftSidebar の URL / アプリリンク表示

### S-3: Cloud Sync round-trip（Phase 3-1 + 既存 sync 経路の影響確認）

- [ ] `cd cloud && npx wrangler dev --remote` で D1 staging 起動
- [ ] Desktop で **少なくとも 5 ドメインを変更**（task / schedule / note / daily / wiki tag）
- [ ] `/sync/push` でアップロード成功（HTTP 200）
- [ ] iOS / 別 Desktop で `/sync/changes` プル → 全変更が反映
- [ ] **5000 行超のテーブル** で pagination cursor が `nextSince` で進行（`hasMore=false` 到達確認）
- [ ] 双方向 sync 完走後、`SELECT COUNT(*) FROM tasks` 等で件数一致

### S-4: Calendar Mobile 検証（Phase 2-4）

iOS / Mobile レイアウト（`?mobile=1` または iOS シミュレータ）:

- [ ] **月グリッド表示**: 任意の月で 35 / 42 セル表示（前月後月の padding が正しい）
- [ ] **週初日**: Mobile = Monday 始まり（日曜が右端）
- [ ] **月遷移スワイプ**: 左右スワイプで前月 / 次月。今日ボタンで現在月へ
- [ ] **日選択**: 任意の日タップで `selectedDate` が `YYYY-MM-DD` に設定される
- [ ] **Today ハイライト**: 今日のセルが強調表示
- [ ] **Item chip 表示**: 任意の日にスケジュール item を作成 → セル内に chip 表示
- [ ] **月境界での item**: 月初日（前月の padding 行に表示される今月 1 日）が正しくハイライト

### S-5: Calendar Desktop 検証（Phase 2-4）

Desktop レイアウト:

- [ ] **月グリッド**: 任意の月で **6 行（42 セル固定）** 表示
- [ ] **週初日**: Desktop = Sunday 始まり（土曜が右端）
- [ ] **前月 / 次月遷移**: ヘッダの矢印 / `j` `k` キーボードショートカット
- [ ] **WeeklyTimeGrid（週表示）**: 週ボタンで切替 → 7 日縦並び
- [ ] **DayCell の TaskNode / ScheduleItem 描画**: 既存と同等
- [ ] **Routine ハイライト**: routine items が色分けされて表示

### S-6: Schedule View 検証（Phase 3-4）

- [ ] **MobileScheduleView**: 任意の日付で fetchScheduleItemsByDate 経由のリスト表示
- [ ] **週カウント dots**: CalendarStrip に 7 日分の item 数 dot 表示
- [ ] **週遷移**: 左右スワイプで `getMondayOf` 基準の週移動
- [ ] **MobileCalendarStrip 単体**: 月跨ぎ時の月ラベル（"Apr - May 2026"）
- [ ] **Desktop ScheduleSection**: 4 タブ（calendar / tasks / events / dayflow）すべて表示
- [ ] **DualColumn toggle**: localStorage 連携が壊れていない
- [ ] **TaskDetail からの遷移**: タスク詳細 → schedule タブで該当 item にスクロール

### S-7: Pure logic regression（calendarGrid）

`buildCalendarGrid` の境界ケースを `calendarGrid.test.ts` に追加で固定済 (2026-04-26):

- [x] 2026 年 2 月（月初 Sun, 28 日）— Sunday 始まり / 6 rows = 42 cells
- [x] 2026 年 2 月 — Monday 始まり / fixedRows なし = 28 cells（先頭 Mon = 1/26）
- [x] 2024 年 2 月（うるう年 29 日）— Sunday/Monday 両モード正常
- [x] 月初日が日曜 (2026/2) / 月初日が土曜 (2026/8) / 月初日が月曜 (2026/6) — 3 ケース
- [x] `addDays` で月跨ぎ / 年跨ぎ前進・後退
- [x] `getMondayOf(日曜日)` → 6 日前の月曜（diff = -6）+ 同曜・水曜・時刻正規化・非破壊
- [x] `getWeekDates(monday)` 7 日 sequential array

旧 8 tests + 12 新規 = **20/20 pass** (`npx vitest run src/utils/calendarGrid.test.ts`)。手動境界確認は不要に。

### S-8: 性能 spot-check

`query_all` / `query_one` ヘルパは内部で `conn.prepare()` を毎回呼ぶ。statement キャッシュは rusqlite が `prepare_cached` 経由でしか効かないため、性能劣化の可能性を確認:

- [x] `task_repository::fetch_tree` を 1000 ノードで実行 → **6.55ms avg / 10.15ms max** (基準 100ms の 6.6%) — 2026-04-26 release build 計測
  - n=500: avg 3.14ms / max 3.24ms
  - n=1000: avg 6.55ms / max 10.15ms
  - n=3000: avg 18.37ms / max 18.49ms
  - 結論: **`prepare_cached` 移行不要**。`prepare()` のオーバーヘッドはクエリ実行時間に比して微小
- [ ] Calendar 月遷移時の fetch 時間が体感で変わらない (manual UI 観察)
- [ ] Sync push 時の `collect_local_changes` が劣化していない (5000 行 push、manual)

劣化が確認された場合の対応案: `query_all` 内で `prepare_cached` に切替（後方互換）— **本検証では発動しない**。

### S-9: ドキュメント更新

- [x] `2026-04-25-refactoring-plan.md` の Phase 3-1 / 2-4 / 3-4 を `[x]` に更新、Status を COMPLETED に (前セッションで実施済み)
- [x] 完了済 plan を `.claude/archive/` に移動 (前セッションで実施済み、`.claude/archive/2026-04-25-refactoring-plan.md`)
- [x] `MEMORY.md` の §直近完了に追加 (前セッションで task-tracker 経由)
- [x] `HISTORY.md` に セッション entry 追加 (前セッションで task-tracker 経由)
- [x] 本検証 plan ファイルを自動検証結果で更新 (Status / S-1 / S-7 / S-8 反映)
- [ ] `docs/known-issues/INDEX.md` で `MEMORY.md §バグの温床` 該当項目（formatter / SQL whitelist / row_to_model 重複）を削除候補にマーク (manual UI 検証完了後に実施推奨)
- [ ] `docs/code-inventory.md` の対応セクション（Active / Duplicate）を更新 (manual UI 検証完了後に実施推奨)

---

## Files

| File                                                     | Operation | Notes                                                               |
| -------------------------------------------------------- | --------- | ------------------------------------------------------------------- |
| `src-tauri/src/db/row_converter.rs`                      | Edit      | FromRow trait + query_all/query_one helpers 追加済（Phase 3-1）     |
| `src-tauri/src/db/*_repository.rs` (24 files)            | Edit      | 33 個の `fn row_to_X` を `impl FromRow for X` に移行済              |
| `frontend/src/utils/calendarGrid.ts`                     | Create    | buildCalendarGrid / addDays / getMondayOf / getWeekDates            |
| `frontend/src/utils/calendarGrid.test.ts`                | Create    | 8 unit tests                                                        |
| `frontend/src/hooks/useCalendar.ts`                      | Edit      | calendarDays useMemo を buildCalendarGrid 呼び出しに置換            |
| `frontend/src/components/Mobile/MobileCalendarView.tsx`  | Edit      | local addDays / formatDateStr / todayStr / inline calendarDays 削除 |
| `frontend/src/components/Mobile/MobileCalendarStrip.tsx` | Edit      | local getMonday / formatDateStr / addDays / getWeekDates 削除       |
| `frontend/src/components/Mobile/MobileScheduleView.tsx`  | Edit      | local todayStr / inline week-range 計算削除                         |
| `.claude/2026-04-25-refactoring-plan.md`                 | Edit      | Status 更新                                                         |
| `.claude/MEMORY.md`                                      | Edit      | task-tracker 経由（直接編集禁止）                                   |
| `.claude/HISTORY.md`                                     | Edit      | task-tracker 経由                                                   |

---

## Verification（Done 定義）

- [~] S-1 自動部分 pass (build / test / grep)。`cargo clippy 警告ゼロ` は pre-existing 83 件で未達 (Phase 3-1 起因 0)。S-2 IPC 統合 / S-3 Cloud Sync は manual 残
- [ ] S-4〜S-6 の手動 UI 検証で UI 回帰報告ゼロ (manual 残)
- [x] S-7 の境界ケースが pass — `calendarGrid.test.ts` 20/20 (旧 8 + 新 12 で完全自動化)
- [x] S-8 で性能劣化が無いことを確認 — `bench_fetch_tree` n=1000 で 6.55ms (基準 100ms の 6.6%)、`prepare_cached` 移行不要
- [x] S-9 でドキュメント反映完了
- [ ] `MEMORY.md §バグの温床` から関連 3 項目（formatter / SQL whitelist / row_to_model）削除済 (manual UI 検証完了後)

---

## Risks / Mitigations

### R-1: FromRow trait 移行で性能劣化

- **リスク**: `query_all` / `query_one` は毎回 `prepare()` を呼ぶ。SQLite の statement compile は ~10〜50μs 程度だが、ループ内で大量に呼ぶとボトルネック化
- **検出**: S-8 の benchmark 比較
- **対応**: 劣化確認時は `query_all` / `query_one` 内部を `conn.prepare_cached(sql)` に変更。API 互換のためコールサイト変更不要

### R-2: Calendar 週初日の混乱

- **リスク**: Mobile = Monday、Desktop = Sunday の両モードがあるため、`buildCalendarGrid` の `weekStartsOn` 引数を取り違えるとレイアウト崩壊
- **検出**: S-4 / S-5 の手動 UI 検証
- **対応**: 既存挙動を保持（Mobile = 1, Desktop = 0）。test で両 mode を assert 済（calendarGrid.test.ts）

### R-3: 削除した duplicate 関数の hidden caller

- **リスク**: Mobile の local `formatDateStr` / `addDays` / `getMonday` / `todayStr` を削除したが、type が一致する別箇所からの参照を見落とす
- **検出**: TypeScript build（コンパイル時に補足）
- **対応**: tsc clean で confirm 済。実行時参照は無い

### R-4: Cloud Sync 経路の row 取得が壊れる

- **リスク**: `sync/sync_engine.rs::query_changed` は `row_to_json` を使うため FromRow 非依存だが、各 repository の Sync 関連 fetch（`fetch_all` / `fetch_by_*`）が壊れていれば二次的に Sync が壊れる
- **検出**: S-3 round-trip
- **対応**: cargo test の sync test 2 件 pass + 手動 round-trip

### R-5: Phase 3-1 で削除しなかった `tx.query_map` 等の例外

- **リスク**: transaction 内・JOIN クエリ・カスタム closure を残したため、それらが trait と非一致でも build pass する。一見良いが、将来的に repository が混在パターンを持つことになる
- **対応**: 許容する。完全統一はメンテコスト > リターン

### R-6: 検証中の手動 UI 操作で発見されない bug

- **リスク**: 月跨ぎ・年跨ぎ・タイムゾーン境界で `buildCalendarGrid` が誤動作
- **検出**: S-7 の境界ケース
- **対応**: 発見時は test を追加して固定 + 修正コミット

---

## Rollback Strategy

各 Phase は独立に巻き戻し可能。

- **Phase 3-1 のみ rollback**: `git revert <Phase3-1 commit>`。FromRow trait 削除 → 各 repository の `row_to_X` 自動復活
- **Phase 2-4 のみ rollback**: `frontend/src/utils/calendarGrid.ts` 削除 + `useCalendar.ts` / `MobileCalendarView.tsx` を git revert
- **Phase 3-4 のみ rollback**: Mobile 系ファイルの import を git revert（local 関数復活）
- 全 rollback: `git revert <merge commit>` で 1 ステップ

DB migration を伴わないため schema rollback の心配なし。

---

## Phase 完了後の波及作業（Optional）

検証完了後に着手検討:

- [ ] `query_all` / `query_one` の `prepare_cached` 化（性能向上）
- [ ] models/ ディレクトリ新設して `pub struct *Node` を集約（Phase 3-1 残スコープ）
- [ ] `ScheduleSection.tsx` の DualColumn 制御を hook 化（Phase 3-4 残スコープ）
- [ ] `MobileCalendarView.tsx` の MobileMonthlyCalendar / MobileDayflowGrid を別ファイル分離（Phase 2-4 残スコープ）

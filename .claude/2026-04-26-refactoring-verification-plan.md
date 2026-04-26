---
Status: PENDING
Created: 2026-04-26
Task: MEMORY.md §直近完了（リファクタリング Phase 2-4 / 3-1 / 3-4 検証）
Project path: /Users/newlife/dev/apps/life-editor
Related: [.claude/2026-04-25-refactoring-plan.md](./2026-04-25-refactoring-plan.md) — 本計画書の対象となる実装プラン
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

- [ ] `cd src-tauri && cargo build --lib` warnings = 0
- [ ] `cd src-tauri && cargo test --lib` 25/25 pass
- [ ] `cd src-tauri && cargo clippy --lib -- -D warnings` 警告ゼロ
- [ ] `grep -rnE "fn row_to_" src-tauri/src/db/` の出力が `row_to_json` のみ（free fn 残存無し）
- [ ] `grep -rnE "row_to_[a-z_]+\(row" src-tauri/src/` の出力が `row_to_json` 関連のみ
- [ ] `target/debug/life-editor` 起動 → エラーログなし

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

`buildCalendarGrid` の境界ケースを手動 + spec で:

- [ ] 2026 年 2 月（月初 Sun, 28 日）— Sunday 始まり / 6 rows = 42 cells
- [ ] 2026 年 2 月 — Monday 始まり / fixedRows なし = 28 cells（先頭 Mon = 1/26）
- [ ] 2024 年 2 月（うるう年 29 日）— 両モード正常
- [ ] 月初日が日曜 / 月初日が土曜 / 月初日が月曜 — 3 ケース
- [ ] `addDays` で月跨ぎ / 年跨ぎ
- [ ] `getMondayOf(日曜日)` → 6 日前の月曜（diff = -6）

`calendarGrid.test.ts` で 8 ケースを既にカバー。残りは手動。

### S-8: 性能 spot-check

`query_all` / `query_one` ヘルパは内部で `conn.prepare()` を毎回呼ぶ。statement キャッシュは rusqlite が `prepare_cached` 経由でしか効かないため、性能劣化の可能性を確認:

- [ ] `task_repository::fetch_tree` を 1000 ノードで実行 → 100ms 以内（既存 benchmark `bench_fetch_tree` を再利用）
- [ ] Calendar 月遷移時の fetch 時間が体感で変わらない
- [ ] Sync push 時の `collect_local_changes` が劣化していない（5000 行 push）

劣化が確認された場合の対応案: `query_all` 内で `prepare_cached` に切替（後方互換）。

### S-9: ドキュメント更新

- [ ] `2026-04-25-refactoring-plan.md` の Phase 3-1 / 2-4 / 3-4 を `[x]` に更新、Status を COMPLETED に
- [ ] 完了済 plan を `.claude/archive/` に移動
- [ ] `MEMORY.md` の §直近完了に追加 / §予定から削除（task-tracker 経由）
- [ ] `HISTORY.md` に セッション entry 追加
- [ ] `docs/known-issues/INDEX.md` で `MEMORY.md §バグの温床` 該当項目（formatter / SQL whitelist / row_to_model 重複）を削除候補にマーク
- [ ] `docs/code-inventory.md` の対応セクション（Active / Duplicate）を更新

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

- [ ] S-1〜S-3 の Rust / Sync チェックボックスが全 pass
- [ ] S-4〜S-6 の手動 UI 検証で UI 回帰報告ゼロ
- [ ] S-7 の境界ケースが pass（自動 + 手動）
- [ ] S-8 で性能劣化が無いことを確認、または `prepare_cached` 移行を実施
- [ ] S-9 でドキュメント反映完了
- [ ] `MEMORY.md §バグの温床` から関連 3 項目（formatter / SQL whitelist / row_to_model）削除済

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

# Mobile Data Parity

> Desktop と Mobile で「起動時に取得するデータ」が食い違う構造的原因と、是正方針。
> Cloud Sync 以前の問題として、**同一 SQLite に対するクエリ経路が二系統化している**ことを整理する。

---

## 1. 問題の定義

モバイル実機運用で以下の症状が観測されている:

- **Schedule セクション**: Events アイテム（`routine_id IS NULL` の `schedule_items`）が Mobile で取得できていない
- **Materials (Notes / Memos)**: Mobile と Desktop でわずかに表示内容が違う、編集後の反映タイミングがずれる

Cloud Sync の不調ではなく、**ローカル SQLite からの読み出し経路・フィルタ条件が Desktop と Mobile で非対称**であることに起因する。

---

## 2. 根本原因（構造的非対称）

### 2.1 Provider 経路 vs DataService 直呼びの二系統化

CLAUDE.md §3.2 は「コンポーネントから直接 `invoke()` を呼ばない、`getDataService()` 経由」と定めているが、**Provider を経由するかどうか** は現状二通りある。

| 層 | Desktop | Mobile |
| --- | --- | --- |
| Schedule Events | `useScheduleItemsContext().events` → `loadEvents()` | `ds.fetchScheduleItemsByDateRange()` 直呼び |
| Memos | `useMemoContext()` → `fetchAllMemos()` | `ds.fetchAllMemos()` 直呼び |
| Notes | `useNoteContext()` → `fetchAllNotes()` | `ds.fetchAllNotes()` 直呼び |

Mobile は `ScheduleItemsProvider` / `MemoProvider` / `NoteProvider` を main.tsx でマウントしているにもかかわらず、**画面コンポーネントが Provider を経由せず DataService を直接叩いている**。結果として:

- Provider 側の state（`events` / `memos` / `notes`）は空のまま
- 画面ローカル state に別コピーを持つ二重管理
- CREATE/UPDATE も DataService 直呼びなので、他コンポーネントに変更が伝播しない
- Cloud Sync の `syncVersion` 再 fetch フックは個別に貼られており、漏れやすい

### 2.2 クエリの語彙不一致

同じ「スケジュール表示」でも呼び分けの SQL が違う:

| 用途 | Rust 関数 | SQL |
| --- | --- | --- |
| Desktop Events タブ | `fetch_events` | `WHERE routine_id IS NULL AND is_deleted = 0`（全日付） |
| Mobile カレンダー月表示 | `fetch_by_date_range` | `WHERE date BETWEEN ?1 AND ?2 AND is_deleted = 0`（routine 生成分も混在） |

→ Mobile のカレンダー月表示は「その月に `date` が入っている schedule_items 全種」を引き、Events 専用ビューを持たない。Desktop の Events タブ（全期間 Event 一覧）に相当する UI が Mobile に存在しないため、**未来の Event や日付未設定 Event が見えない**。

### 2.3 `is_dismissed` 等のフィルタ差

`fetch_by_date_range` には `is_dismissed = 0` フィルタがない一方、Desktop 側の他経路には適用されているケースがある。表示要件が Repository 層で明文化されていないため、経路ごとに差が出る。

### 2.4 Schedule Provider 3 分割とのズレ

CLAUDE.md §6.5 で `RoutineProvider` / `ScheduleItemsProvider` / `CalendarTagsProvider` の 3 分割を定め、shared/ 配下に共通部品を置く運用になっているが、Mobile はこの shared 資産を使わず独自ロジックを MobileCalendarView に並べている。

---

## 3. 関連ファイル（現状の参照点）

- `frontend/src/components/Mobile/MobileCalendarView.tsx:476` — `ds.fetchScheduleItemsByDateRange()` 直呼び
- `frontend/src/components/Mobile/MobileMemoView.tsx:37,136` — `ds.fetchAllMemos()` / `ds.upsertMemo()` 直呼び
- `frontend/src/components/Mobile/MobileNoteView.tsx:37,53,143,163` — Notes 全操作が DataService 直呼び
- `frontend/src/components/Schedule/EventList.tsx:28-33` — Desktop は `useScheduleItemsContext()` 経由
- `frontend/src/hooks/useScheduleItemsEvents.ts:24-31` — Desktop の Events fetcher
- `src-tauri/src/db/schedule_item_repository.rs:75-87` — `fetch_by_date_range`（フィルタ最小）
- `src-tauri/src/db/schedule_item_repository.rs:406-414` — `fetch_events`（`routine_id IS NULL`）

---

## 4. 設計原則（是正の指針）

### 4.1 単一データソース原則の徹底

- Mobile でも **Provider を Single Source of Truth** とし、画面コンポーネントは `useXxxContext()` 経由で購読する
- DataService 直呼びは「Provider が未マウントな Mobile 省略 Provider 領域」に限定（§6.3 の Optional hook ルートと整合）
- Schedule / Notes / Memos は Desktop / Mobile 共に Provider 対象なので例外なし

### 4.2 クエリ語彙の集約

- Repository 層の関数名を「取得軸」で統一する（例: `fetch_events_all` / `fetch_by_date_range_excluding_routines` / `fetch_by_date_range_all`）
- 表示要件（`is_dismissed` / `is_deleted` / `routine_id IS NULL`）はコメントではなく **関数名**で明示
- フロントの Provider が目的別に呼び分けられるよう、Rust 側で経路を用意してから Frontend を揃える

### 4.3 Mobile 専用 UI は「表示だけ」

- `components/Mobile/*` はレイアウトと操作だけを担い、**データ取得は共有 hook / Provider に委譲**
- Mobile の独自ロジックは `Schedule/shared/` か `hooks/` に逃がし、両プラットフォームで共用

### 4.4 変更伝播の保証

- CREATE / UPDATE / DELETE は Provider 内の mutation 関数経由に統一（Provider が state を optimistic update → DataService → 再 fetch、の順）
- Mobile の `syncVersion` フック貼り忘れを禁止するため、**Provider 内で Cloud Sync 完了イベントを購読**する中央化を進める

### 4.5 Repository の SQL 網羅テスト

- Desktop の fetch 経路と Mobile の fetch 経路に対して、同じ fixture を入れたときの結果差分を検証する統合テストを用意
- V62 の NULL バックフィル / trigger と同様、**経路非対称はテストで検知**する運用にする

---

## 5. スコープ外（本 Vision では扱わない）

- Cloud Sync の HLC 化・Relation テーブル独自 version 付与（これらは `mobile-porting.md` と別系譜。Sync 強化の議論は別途）
- Mobile の UI/UX 磨き込み（Tailwind ブレークポイント / レイアウト）
- Desktop 側の Schedule ビュー再編

---

## 6. 是正の段階（方針のみ、実装は別プラン）

1. **Phase A — 観測**
   - Desktop / Mobile で `list_schedule` 相当を実行し、取得件数・ID セットの差分を Known Issue に記録
   - MobileCalendarView の表示対象と Provider `events` の差集合を定量化
2. **Phase B — Provider 経由への統一**
   - MobileCalendarView を `useScheduleItemsContext()` / `useRoutineContext()` 経由に書き換え
   - MobileMemoView / MobileNoteView を `useMemoContext()` / `useNoteContext()` 経由に書き換え
   - Mobile 用に「全 Event 一覧」ビューが要るなら shared hook を追加（Repository の `fetch_events` を Mobile も使える形にする）
3. **Phase C — Repository 層の整理**
   - `fetch_by_date_range` の責務明文化とフィルタ選択肢の型化（enum / params struct）
   - 経路差分検知の統合テスト追加
4. **Phase D — 再発防止**
   - Lint ルール or PR チェックで、`components/Mobile/` 配下からの `getDataService()` 直呼びを検出（Mobile 省略 Provider 領域は allowlist）

---

## 7. 関連 Vision / ドキュメント

- [`mobile-porting.md`](./mobile-porting.md) — Mobile 移植方針。Cloud Sync 連携の文脈
- [`coding-principles.md`](./coding-principles.md) — Optional hook と Mobile 省略 Provider ルート
- CLAUDE.md §3.2（DataService 抽象化）/ §6.2（Provider 順序）/ §6.5（Schedule 3 分割）

---

## 8. 個別実装プランの運用

本ファイルは **方針と原則** のみ記述する。具体的な着手は CLAUDE.md §9 に従い `plans/YYYY-MM-DD-mobile-data-parity-phaseX.md` を作成し、本ファイルから相互リンクする。

最初の実装プランは Phase A（観測）から。Phase B 以降は Phase A で定量化した差分をもとに優先順位を決める。

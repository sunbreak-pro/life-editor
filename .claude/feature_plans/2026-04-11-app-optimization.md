# Plan: Life Editor App Optimization — Feature Pruning & Performance

- **Status**: IN_PROGRESS
- **Created**: 2026-04-11
- **Project**: /Users/newlife/dev/apps/notion-timer

---

## Context

アプリの機能が成熟し、不要な機能の整理とパフォーマンス改善が必要なフェーズ。
ユーザーが体感している問題: セクション切替時の一瞬の遅れ。
データ量は小規模（タスク65、ノート30、Daily27）のため、問題はレンダリング構造に起因。

**非目標:**

- 状態管理ライブラリ（Zustand等）への移行（Context最適化を先行）
- DataService 3実装の削減（モバイル連携で必要）
- 機能セクション（Schedule/Materials/Connect/Work/Analytics）の削除

---

## Steps

### Phase 1: P0 — 即効性のある改善（今セッション）

- [x] 1. **TaskTreeContext に useMemo 追加**
  - `useTaskTreeAPI.ts` の返り値を `useMemo` でラップ
  - セクション切替時の不要な再レンダーを削減

- [x] 2. **Tips コンポーネント削除**（15ファイル, ~1,133行）
  - `frontend/src/components/Tips/` ディレクトリ全体を削除
  - `frontend/src/components/Tips/index.ts` の export 除去
  - App.tsx に Tips の import/参照がないことを確認済み
  - `useElectronMenuActions.ts` 内のコメント参照を削除

### Phase 2: P1 — 起動速度 & コード重複

- [x] 3. **React.lazy によるセクション遅延ロード**
  - 対象: ConnectView, WorkScreen, AnalyticsView, Settings
  - Schedule, Materials は静的import維持（毎日使用）
  - Suspense fallback は `null`（チャンク小さく一瞬のため）

- [~] 4. **Provider 遅延初期化** → スキップ
  - 理由: WikiTag は Materials(Notes)で毎日使用、Audio はタイマー再生でセクション横断必要
  - 遅延化は機能破壊リスクが高いため見送り

- [x] 5. **PreviewPopup 3種の統合**
  - `BasePreviewPopup` 共通コンポーネント抽出
  - 共通部分: 位置計算、click-outside、カラーバー、フッターレイアウト
  - 各Popupはchildren + footer props で差分のみ定義
  - 不要になったimport削除（useRef, useClickOutside等）

### Phase 3: P2 — リファクタリング（別セッション）

- [ ] 6. **useScheduleItems 分割**
  - `useScheduleItemsCore` — CRUD + 日付ロード（items, currentDate, create/update/delete/toggle）
  - `useScheduleItemsRoutineSync` — ルーティン同期・バックフィル・reconcile
  - `useScheduleItemsStats` — routineStats, completionRate, completionByDate
  - `useScheduleItemsEvents` — events, loadEvents, eventsVersion
  - Provider側で4つのフックを合成して value に渡す

- [ ] 7. **EditableTitle 共有コンポーネント作成**
  - 6箇所の重複 inline title 編集を統一
  - Props: value, onSubmit, placeholder, className, autoFocus

- [ ] 8. **RoutineTimeChangeDialog 統合**
  - `Routine/RoutineEditTimeChangeDialog.tsx` と `DayFlow/RoutineTimeChangeDialog.tsx` を1つに

### Phase 4: P3 — 小規模改善（任意タイミング）

- [ ] 9. TaskNode Map ルックアップ（`Map<string, TaskNode>`）
- [ ] 10. usePlaylistEngine Effect 統合（6→1）
- [ ] 11. ColorPicker / UnifiedColorPicker 統合
- [ ] 12. TaskDetailHeader breadcrumb 削除（ユーザー削除予定）

---

## Files

### Phase 1 (今セッション)

| File                                           | Operation | Notes                     |
| ---------------------------------------------- | --------- | ------------------------- |
| `frontend/src/hooks/useTaskTreeAPI.ts`         | Modify    | 返り値を useMemo でラップ |
| `frontend/src/components/Tips/` (15 files)     | Delete    | ディレクトリ全体削除      |
| `frontend/src/hooks/useElectronMenuActions.ts` | Modify    | Tips コメント参照削除     |

### Phase 2 (次セッション)

| File                                                                          | Operation | Notes                      |
| ----------------------------------------------------------------------------- | --------- | -------------------------- |
| `frontend/src/App.tsx`                                                        | Modify    | React.lazy + Suspense 導入 |
| `frontend/src/context/WikiTagContext.tsx`                                     | Modify    | 遅延fetch                  |
| `frontend/src/context/AudioContext.tsx`                                       | Modify    | 遅延fetch                  |
| `frontend/src/components/Tasks/Schedule/shared/BasePreviewPopup.tsx`          | Create    | 共通Popup基盤              |
| `frontend/src/components/Tasks/Schedule/Calendar/TaskPreviewPopup.tsx`        | Modify    | BasePreviewPopup 使用      |
| `frontend/src/components/Tasks/Schedule/DayFlow/ScheduleItemPreviewPopup.tsx` | Modify    | BasePreviewPopup 使用      |
| `frontend/src/components/Tasks/Schedule/Calendar/MemoPreviewPopup.tsx`        | Modify    | BasePreviewPopup 使用      |

### Phase 3 (別セッション)

| File                                                | Operation | Notes              |
| --------------------------------------------------- | --------- | ------------------ |
| `frontend/src/hooks/useScheduleItems.ts`            | Split     | 4ファイルに分割    |
| `frontend/src/hooks/useScheduleItemsCore.ts`        | Create    | CRUD + 日付ロード  |
| `frontend/src/hooks/useScheduleItemsRoutineSync.ts` | Create    | ルーティン同期     |
| `frontend/src/hooks/useScheduleItemsStats.ts`       | Create    | 統計計算           |
| `frontend/src/hooks/useScheduleItemsEvents.ts`      | Create    | イベント管理       |
| `frontend/src/context/ScheduleItemsContext.tsx`     | Modify    | 分割フック合成     |
| `frontend/src/components/shared/EditableTitle.tsx`  | Create    | 共有コンポーネント |

---

## Verification

- [ ] `cd frontend && npx tsc --noEmit` — 型エラーなし
- [ ] `cd frontend && npm run test` — テスト全パス
- [ ] セクション切替（Schedule → Work → Connect）がスムーズ
- [ ] Schedule の各タブ（Calendar/DayFlow/Tasks/Events）正常動作
- [ ] Tips 削除後、Help メニューにエラーなし
- [ ] Provider 遅延初期化後、Connect/Work 初回アクセス時のデータロード正常

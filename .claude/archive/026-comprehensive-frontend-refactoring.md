# 包括的フロントエンドリファクタリング

## Status: COMPLETED

## Created: 2026-04-05

## Project: /Users/newlife/dev/apps/life-editor

---

## Context

コードベースが有機的に成長し、コンポーネント247ファイル、フック80+、Context Provider 14個の規模に達した。未使用コード、不統一なパターン、肥大化したScheduleProvider（9フック合成）、バレルエクスポートの不整合が蓄積している。Mobile系・Ideas/Connect/Paper系は開発中のため除外。

各Phaseは独立したチャットセッションで実行し、それぞれ独立してrevert可能。

---

## Phase 1: Dead Code Removal（低リスク）

### 対象

#### 1A. 未使用ファイル削除

| File                                             | 理由                           |
| ------------------------------------------------ | ------------------------------ |
| `frontend/src/hooks/useClaudeStatus.ts`          | import先ゼロ                   |
| `frontend/src/hooks/useRoleNavigation.ts`        | import先ゼロ                   |
| `frontend/src/components/Work/SoundCard.tsx`     | バレルexportのみ、外部参照ゼロ |
| `frontend/src/components/Work/AddSoundCard.tsx`  | バレルexportのみ、外部参照ゼロ |
| `frontend/src/components/Ideas/MemoDateList.tsx` | バレルexportのみ、外部参照ゼロ |
| `frontend/src/components/Ideas/NoteList.tsx`     | バレルexportのみ、外部参照ゼロ |
| `frontend/src/components/MemoTree/`              | 空ディレクトリ                 |

#### 1B. バレルエクスポート整理

| File                                        | 変更                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `frontend/src/components/Work/index.ts`     | `SoundCard`, `AddSoundCard`, `TimerDisplay`, `TimerProgressBar` のexport削除（内部でのみ使用） |
| `frontend/src/components/Ideas/index.ts`    | `MemoDateList`, `NoteList` のexport削除                                                        |
| `frontend/src/components/Settings/index.ts` | `AppearanceSettings` のexport削除（内部でのみ使用）                                            |
| `frontend/src/hooks/index.ts`               | ファイル削除（import元ゼロ）                                                                   |

#### 1C. formatDateKey re-export整理

- `hooks/index.ts` 削除に伴い、直接参照を確認（全consumer が `utils/dateKey` から直接importしていることを確認済み）

### Verification

- [x] `cd frontend && npx tsc --noEmit` パス
- [ ] `npm run dev` エラーなし起動（次セッションで確認）
- [x] 削除したシンボル名のgrep結果がゼロ
- [x] `cd frontend && npx vitest run` パス（12ファイル, 123テスト全通過）

---

## Phase 2: Schedule System 構造整理（低〜中リスク）

### 背景

`Tasks/Schedule/Calendar/` 内の一部コンポーネントが5つ以上のディレクトリから参照されている。本来の「Calendar固有」ではなく「Schedule共通」コンポーネント。

### 対象

#### 2A. クロスバウンダリ・コンポーネントの移動

| 現在の場所                         | 移動先                                          | 参照元                            |
| ---------------------------------- | ----------------------------------------------- | --------------------------------- |
| `Calendar/RoleSwitcher.tsx`        | `Tasks/Schedule/shared/RoleSwitcher.tsx`        | 7ファイル（5ディレクトリ）        |
| `Calendar/TimeGridTaskBlock.tsx`   | `Tasks/Schedule/shared/TimeGridTaskBlock.tsx`   | WeeklyTimeGrid, ScheduleTimeGrid  |
| `Calendar/DateTimeRangePicker.tsx` | `Tasks/Schedule/shared/DateTimeRangePicker.tsx` | TaskDetailHeader, TaskDetailPanel |

各移動後、全import pathを更新。

#### 2B. 重複ユーティリティ関数の抽出

`formatHour(hour: number): string` が `WeeklyTimeGrid.tsx` と `ScheduleTimeGrid.tsx` に同一実装で重複。

- `frontend/src/utils/timeGridUtils.ts` に `formatHour` を追加
- 両ファイルのローカル実装を削除し、importに置換

#### 2C. `Tasks/Schedule/shared/index.ts` バレル作成

移動後のファイル群（RoleSwitcher, TimeGridTaskBlock, DateTimeRangePicker, ProgressSection）をまとめたバレルexportを作成。

#### 2D. 統合しないもの（判断記録）

- `RoutineTimeChangeDialog`（DayFlow）と `RoutineEditTimeChangeDialog`（Routine）: 視覚的に類似だがセマンティクスが異なる（「今回のみ vs テンプレート更新」vs「テンプレートのみ vs 全適用」）。統合しない
- `TaskSchedulePanel`（9ファイル）と `NoteSchedulePanel`（3ファイル）: 構造が異なるため統合しない。既に `TimeSettingsInline` を共有済み

### Verification

- [x] `cd frontend && npx tsc --noEmit` パス
- [ ] Calendar, DayFlow, Routine の各画面が正常表示（手動確認待ち）
- [ ] TaskDetail パネルが正常動作（手動確認待ち）
- [x] 旧パスのimportがgrepでゼロ
- [x] `cd frontend && npx vitest run` パス（12ファイル, 123テスト全通過）

---

## Phase 3: Context/Provider パターン標準化（中リスク）

### 背景

現在4つの異なるパターンが混在:

- **A**: Context + Provider in `.tsx`, ContextValue in separate `.ts`（Timer, Audio, WikiTag, Theme, TaskTree）
- **B**: 全てを1ファイルに（Memo, Note, Calendar）
- **C**: hooks/内にProvider定義（ShortcutConfig）
- **D**: ScheduleContext（1ファイルに9フック合成）

### ターゲットパターン: Pattern A に統一

```
context/FooContextValue.ts  → interface + createContext
context/FooContext.tsx       → Provider component
hooks/useFooContext.ts       → consumer hook（createContextHook使用、既に標準化済み）
```

### 対象

#### 3A. Pattern B → A マイグレーション（Memo, Note, Calendar）

各Contextについて:

1. `FooContextValue.ts` を作成（type定義 + createContext を移動）
2. `FooContext.tsx` からtype定義とcreateContextを削除、importに置換
3. 外部import先を更新

#### 3B. ScheduleContext の型分離

1. `ScheduleContextValue.ts` を作成（9つのReturnType合成型 + createContext を移動）
2. `ScheduleContext.tsx` をProvider実装のみに

#### 3C. ShortcutConfig の適切な配置

1. `context/ShortcutConfigContextValue.ts` にinterface + createContextを分離
2. `context/ShortcutConfigContext.tsx` にProvider移動
3. `hooks/useShortcutConfig.ts` はconsumer hookとして維持

#### 3D. context/index.ts の更新

不足しているexportを追加:

- Schedule系（ScheduleProvider, ScheduleContext, ScheduleContextValue）
- Calendar, Note, ShortcutConfig
- RightSidebarContext

### Verification

- [x] `cd frontend && npx tsc --noEmit` パス
- [ ] `npm run dev` 全画面正常動作（手動確認待ち）
- [x] `cd frontend && npx vitest run` パス（12ファイル, 123テスト全通過）
- [x] 全Contextファイルが統一パターンに準拠（RightSidebarContextのみProvider不要のため例外）

---

## Phase 4: ScheduleProvider 分解（中〜高リスク）

### 背景

ScheduleProvider は9フックの状態を1つのContextに合成。どのフックの状態変化でも全consumer（10ファイル）が再レンダリングされる。

### Consumer使用分析

| Consumer               | Routines | Tags | ScheduleItems | Groups | CalendarTags |
| ---------------------- | -------- | ---- | ------------- | ------ | ------------ |
| ScheduleSection        | ✓        | ✓    | ✓             | ✓      | ✓            |
| CalendarView           | ✓        | ✓    | ✓             | ✓      | ✓            |
| OneDaySchedule         | ✓        | ✓    | ✓             | ✓      | -            |
| DualDayFlowLayout      | ✓        | ✓    | ✓             | ✓      | -            |
| useDayFlowColumn       | ✓        | ✓    | ✓             | ✓      | -            |
| ScheduleSidebarContent | ✓        | ✓    | ✓             | ✓      | -            |
| EventDetailPanel       | -        | -    | ✓             | -      | ✓            |
| EventList              | -        | -    | ✓             | -      | ✓            |
| useRoleConversion      | ✓        | -    | ✓             | -      | -            |
| TrashView              | ✓        | -    | -             | -      | -            |

### 分割方針

3つのProviderに分割:

1. **RoutineProvider** — routines, routineTags, tagAssignments, routineGroups, groupTagAssignments, groupComputed, deleteRoutine
2. **ScheduleItemsProvider** — scheduleItems（RoutineProviderに依存: sync, backfill）
3. **CalendarTagsProvider** — calendarTags, calendarTagAssignments

### 実装ステップ

1. 各新Providerの ContextValue.ts + Context.tsx を作成
2. ScheduleContext.tsx から各ロジックを分離
3. main.tsx のProvider入れ子構造を更新:
   ```
   <RoutineProvider>
     <ScheduleItemsProvider>
       <CalendarTagsProvider>
         ...（残りのProvider）
       </CalendarTagsProvider>
     </ScheduleItemsProvider>
   </RoutineProvider>
   ```
4. **後方互換ファサード**: `useScheduleContext` を維持し、内部で3つの新hookを呼び出してspread
5. 小さいconsumer（TrashView, EventDetailPanel, EventList）から新hookへ段階的に移行

### Verification

- [x] `cd frontend && npx tsc --noEmit` パス
- [ ] Routine作成/編集/削除が正常（手動確認待ち）
- [ ] Schedule Item作成/編集/dismissが正常（手動確認待ち）
- [ ] CalendarTagの表示/フィルタが正常（手動確認待ち）
- [ ] Undo/Redo（routine削除の複合undo）が正常（手動確認待ち）
- [x] `cd frontend && npx vitest run` パス（12ファイル, 123テスト全通過）
- [ ] React DevTools Profiler で再レンダリング範囲の縮小を確認（手動確認待ち）

---

## Phase 5: 構造整理とドキュメント（低リスク）

### 5A. UndoRedo の配置変更

UndoRedoは状態管理の関心事であり、UIコンポーネントではない:

- `UndoRedoContext.tsx` + `UndoRedoContextValue.ts` → `context/` に移動
- `UndoRedoManager.ts` + `types.ts` → `utils/undoRedo/` に移動
- `UndoRedoButtons.tsx` + `useUndoRedoKeyboard.ts` → `components/shared/UndoRedo/` に残す

### 5B. ADR（Architecture Decision Record）作成

`.claude/docs/adr/` に以下を記録:

- Context/Providerパターンの標準（Pattern A）
- ScheduleProvider分解の根拠
- `Tasks/Schedule/shared/` の命名規約

### Verification

- [x] `cd frontend && npx tsc --noEmit` パス
- [ ] `npm run dev` 全画面正常動作（手動確認待ち）
- [x] 全import pathが正しく更新
- [x] `cd frontend && npx vitest run` パス（12ファイル, 123テスト全通過）
- [x] ADR 3件作成（0002, 0003, 0004）
- [x] .claude/rules 3ファイル更新（project-review-checklist, project-debug, project-patterns）
- [x] .claude/CLAUDE.md にContext/Provider パターン・Provider順序を追記

---

## 実行順序と依存関係

```
Phase 1 (Dead Code) ← 最初に実行、前提条件なし
  ├→ Phase 2 (Schedule構造) ← Phase 1完了後
  └→ Phase 3 (Context標準化) ← Phase 1完了後（Phase 2と独立）
       └→ Phase 4 (ScheduleProvider分解) ← Phase 3完了後
            └→ Phase 5 (構造整理 + ADR) ← Phase 4完了後
```

Phase 2 と Phase 3 は互いに独立しており、どちらの順序でも実行可能。

---

## 重要ファイル一覧

| ファイル                                                                  | 関連Phase |
| ------------------------------------------------------------------------- | --------- |
| `frontend/src/context/ScheduleContext.tsx`                                | 3, 4      |
| `frontend/src/main.tsx`                                                   | 4         |
| `frontend/src/context/index.ts`                                           | 3         |
| `frontend/src/context/MemoContext.tsx`                                    | 3         |
| `frontend/src/context/NoteContext.tsx`                                    | 3         |
| `frontend/src/context/CalendarContext.tsx`                                | 3         |
| `frontend/src/hooks/useShortcutConfig.ts`                                 | 3         |
| `frontend/src/components/Tasks/Schedule/Calendar/RoleSwitcher.tsx`        | 2         |
| `frontend/src/components/Tasks/Schedule/Calendar/TimeGridTaskBlock.tsx`   | 2         |
| `frontend/src/components/Tasks/Schedule/Calendar/DateTimeRangePicker.tsx` | 2         |
| `frontend/src/components/Tasks/Schedule/Calendar/WeeklyTimeGrid.tsx`      | 2         |
| `frontend/src/components/Tasks/Schedule/DayFlow/ScheduleTimeGrid.tsx`     | 2         |
| `frontend/src/components/shared/UndoRedo/UndoRedoContext.tsx`             | 5         |
| `frontend/src/hooks/useClaudeStatus.ts`                                   | 1 (削除)  |
| `frontend/src/hooks/useRoleNavigation.ts`                                 | 1 (削除)  |
| `frontend/src/hooks/index.ts`                                             | 1 (削除)  |

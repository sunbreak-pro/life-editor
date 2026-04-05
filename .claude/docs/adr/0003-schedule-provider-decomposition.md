# ADR-0003: ScheduleProvider の3分割

## Status: Accepted

## Date: 2026-04-05

## Context

旧 ScheduleProvider は9つのフックの状態を1つの Context に合成していた。いずれかのフックの状態が変わるだけで、全11 consumer が再レンダリングされるパフォーマンス問題があった。

## Decision

ScheduleProvider を3つの独立 Provider に分解:

1. **RoutineProvider** — routines, routineTags, tagAssignments, routineGroups, groupTagAssignments, groupComputed, deleteRoutine（composite undo含む）
2. **ScheduleItemsProvider** — scheduleItems + sync/backfill ロジック。RoutineProvider に依存
3. **CalendarTagsProvider** — calendarTags, calendarTagAssignments。依存なし

### Provider 入れ子順序

```
<RoutineProvider>
  <ScheduleItemsProvider>    ← useRoutineContext() で routine データを取得
    <CalendarTagsProvider>
```

### 後方互換

`useScheduleContext()` をファサードとして維持。内部で3つの新hookを呼び出してspread。既存consumerは変更なしで動作。

## Consequences

- Routine のみの変更で ScheduleItems/CalendarTags consumer は再レンダリングされない
- 新機能追加時は適切な Provider のみに依存でき、不要な coupling を避けられる
- 既存コードは `useScheduleContext` ファサードで動作し続ける（段階移行可能）

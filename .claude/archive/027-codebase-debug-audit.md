# 027: Codebase Debug Audit

**Status**: COMPLETED
**Created**: 2026-03-14

## Summary

コードベース全体の調査で発見した隠れバグ・レースコンディション・サイレント失敗・パフォーマンス問題を13件修正。

## Fixes Applied

### Phase 1: P0 — レースコンディション & データ整合性

| Fix | Description                                                                | Files                                |
| --- | -------------------------------------------------------------------------- | ------------------------------------ |
| 1   | Main Process DB に `busy_timeout = 5000` 追加                              | `electron/database/db.ts`            |
| 2   | useRoutines: setState ネスト解消 + useRef 化                               | `frontend/src/hooks/useRoutines.ts`  |
| 3   | useMemos: setState ネスト解消 (deleteMemo, restoreMemo, togglePin)         | `frontend/src/hooks/useMemos.ts`     |
| 4   | useCallback 過剰再生成修正 (notesRef, scheduleItemsRef, selectedNoteIdRef) | `useNotes.ts`, `useScheduleItems.ts` |

### Phase 2: P1 — サイレント失敗 & エラーハンドリング

| Fix | Description                                          | Files                                          |
| --- | ---------------------------------------------------- | ---------------------------------------------- |
| 5   | 空 catch に `logServiceError` / `console.debug` 追加 | `usePlaylistPlayer.ts`, `usePlaylistEngine.ts` |
| 6   | localStorage NaN ガード追加                          | `frontend/src/utils/playEffectSound.ts`        |
| 7   | AudioContext `closed` 状態ガード追加                 | `frontend/src/hooks/usePlaylistEngine.ts`      |

### Phase 3: P2 — パフォーマンス & ポーリング改善

| Fix | Description                                 | Files                                       |
| --- | ------------------------------------------- | ------------------------------------------- |
| 8   | ポーリングにエラーログ + 指数バックオフ追加 | `frontend/src/hooks/useExternalDataSync.ts` |
| 9   | computeRoutineStats の O(n²) → O(1) Map 化  | `frontend/src/hooks/useScheduleItems.ts`    |
| 10  | DB インデックス追加 (V31 migration)         | `electron/database/migrations.ts`           |

### Phase 4: P3 — コード品質

| Fix | Description                                  | Files                                           |
| --- | -------------------------------------------- | ----------------------------------------------- |
| 11  | Terminal PTY クリーンアップ順序修正          | `electron/terminal/TerminalManager.ts`          |
| 12  | isDescendantOf JSDoc 追加                    | `frontend/src/utils/getDescendantTasks.ts`      |
| 13  | CustomSoundMeta deletedAt 型を string に統一 | `electron/types.ts`, `customSoundRepository.ts` |

## Verification

- Electron TypeScript: no errors
- Frontend tests: 13 files, 127 tests passed
- Frontend TypeScript: 5 pre-existing errors (unrelated files)

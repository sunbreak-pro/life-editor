import type { NoteNode } from "../../src/types/note";
import type { TaskNode } from "../../src/types/taskTree";

/*
 * Shared node fixtures (#777).
 *
 * Only the shapes that were duplicated VERBATIM live here. That is the whole
 * selection rule, and it is worth stating because the obvious next step —
 * "fold the near-identical ones too, they only differ by a field" — is what
 * makes a shared fixture worse than a local one: every divergence becomes an
 * argument, and a suite reading `makeNote(id, { type: "folder", order: 3 })`
 * no longer shows what it is actually about.
 *
 * Folded in:
 *   - makeNote — five byte-identical copies (noteHydrationLedger,
 *     notesUnifiedCRUD, notesUnifiedHelpers, notesUnifiedLock,
 *     supabaseNotesUnifiedLock).
 *   - makeTask — two byte-identical copies (taskCalendarChips, todayTodo).
 *
 * Deliberately NOT folded in, and why:
 *   - The other seven `makeNote`s take a different second parameter — the
 *     content string (materialsSelectionPersistence), the updatedAt stamp
 *     (notesHydrateCachePerf, notesOpenNoteOwnEditHydrate), the parentId
 *     (notesUnifiedPurgeOrder) — because that is the axis their suite varies.
 *     Routing them through this signature would replace a named argument with
 *     an object literal at every call site: more typing, less meaning.
 *   - `makeItem` / `makeRoutine` in the Schedule suites (ensureRangeCleanup,
 *     reconcileRoutine, useScheduleItemsRoutineSync) differ in the fields the
 *     suite is ABOUT — frequencyType and frequencyDays decide which days a
 *     routine fires on, and each suite's default is chosen so the interesting
 *     case is the one it writes down. A shared default would have to pick one
 *     of them, silently changing what the other two suites test.
 *   - The other three `makeTask`s carry a `status` the two folded copies omit,
 *     and take the id positionally. Same reasoning as makeNote.
 */

/**
 * A plain live note. `title` defaults to the id so a failure message names the
 * row it is about.
 */
export function makeNote(
  id: string,
  overrides: Partial<NoteNode> = {},
): NoteNode {
  return {
    id,
    type: "note",
    title: id,
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * A root-level task with no status set — the shape the scheduling suites use,
 * where only id / title / dates matter.
 */
export function makeTask(over: Partial<TaskNode> = {}): TaskNode {
  return {
    id: "task-1",
    type: "task",
    title: "T",
    parentId: null,
    order: 0,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

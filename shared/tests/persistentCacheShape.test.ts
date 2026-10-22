// @vitest-environment node (no DOM — pure mappers)
import { describe, it, expect } from "vitest";
import { CACHE_SCHEMA_VERSION } from "../src/state/persistentCache";
import {
  rowsToDailyNodeLight,
  type DailiesPayloadLightRow,
  type ItemsMetaDailyRow,
} from "../src/services/dailiesUnifiedMapper";
import {
  rowsToNoteNodeLite,
  type ItemsMetaNoteRow,
  type NotesPayloadListRow,
} from "../src/services/notesUnifiedMapper";
import {
  rowsToTodoNode,
  type TasksPayloadRow,
} from "../src/services/todoMapper";
import type { ItemsMetaRow } from "../src/services/itemsMeta";
import {
  rowsToRoutineNode,
  type ItemsMetaRoutineRow,
  type RoutinesPayloadRow,
} from "../src/services/routineMapper";
import {
  rowsToScheduleItem,
  type EventsPayloadRow,
  type ItemsMetaEventRow,
} from "../src/services/scheduleItemMapper";
import {
  rowsToTagGroups,
  type TagGroupAssignmentRow,
  type TagGroupRow,
} from "../src/services/tagGroupMapper";
import { rowToWikiTag, type WikiTagRow } from "../src/services/wikiTagMapper";
import {
  rowToWikiTagAssignment,
  type WikiTagAssignmentRow,
} from "../src/services/wikiTagAssignmentMapper";
import {
  rowToWikiTagConnection,
  type WikiTagConnectionRow,
} from "../src/services/wikiTagConnectionMapper";

/*
 * #2331 — the offline cache must not hand an old device a node of a new shape.
 *
 * persistentCache.ts stores the domain nodes the list reads return (the
 * output of the mappers below) in IndexedDB, and only empties that store when
 * CACHE_SCHEMA_VERSION changes. A mapper that gains, loses or renames a key
 * would leave every device reading back nodes of the old shape until someone
 * remembered to bump the version.
 *
 * So each list's mapper is fed ONE row with every column populated (no nulls,
 * so the conditionally-set optional keys appear too), and the sorted key list
 * of its output is pinned per version. Changing a mapper's output turns this
 * red, and the fix is the version bump, not a new expected list.
 */

const USER = "00000000-0000-0000-0000-000000000000";
const CREATED = "2026-10-21T00:00:00.000Z";
const UPDATED = "2026-10-21T01:00:00.000Z";
const DELETED = "2026-10-21T02:00:00.000Z";

function dailyShape(): object {
  const meta: ItemsMetaDailyRow = {
    id: "daily-2026-10-21",
    user_id: USER,
    role: "daily",
    title: "2026-10-21",
    is_deleted: true,
    deleted_at: DELETED,
    created_at: CREATED,
    updated_at: UPDATED,
  };
  const payload: DailiesPayloadLightRow = {
    item_id: "daily-2026-10-21",
    user_id: USER,
    date: "2026-10-21",
    is_pinned: true,
    is_edit_locked: true,
    has_password: true,
    evening_published_at: UPDATED,
    evening_notes: { todo: "note" },
    morning_comment: ["paragraph"],
    b0: { type: "paragraph", content: [{ type: "text", text: "head" }] },
  };
  return rowsToDailyNodeLight(meta, payload);
}

function noteShape(): object {
  const meta: ItemsMetaNoteRow = {
    id: "note-1",
    user_id: USER,
    role: "note",
    title: "Note",
    is_deleted: true,
    deleted_at: DELETED,
    created_at: CREATED,
    updated_at: UPDATED,
  };
  const payload: NotesPayloadListRow = {
    item_id: "note-1",
    user_id: USER,
    parent_item_id: "note-0",
    parent_item_role: "note",
    note_type: "note",
    sort_order: 1,
    is_pinned: true,
    is_edit_locked: true,
    color: "#336699",
    icon: "book",
    has_password: true,
  };
  return rowsToNoteNodeLite(meta, payload);
}

function todoShape(): object {
  const meta: ItemsMetaRow = {
    id: "task-1",
    user_id: USER,
    role: "task",
    title: "Todo",
    is_deleted: true,
    deleted_at: DELETED,
    created_at: CREATED,
    updated_at: UPDATED,
  };
  const payload: TasksPayloadRow = {
    item_id: "task-1",
    user_id: USER,
    parent_item_id: "task-0",
    parent_item_role: "task",
    task_type: "task",
    folder_type: "normal",
    start_at: "2026-10-21T09:00:00.000Z",
    due_at: "2026-10-22T09:00:00.000Z",
    status: "DONE",
    is_expanded: true,
    content: "body",
    work_duration_minutes: 25,
    color: "#336699",
    icon: "check",
    time_memo: "memo",
    priority: 2,
    reminder_enabled: true,
    reminder_offset: 10,
    scheduled_at: "2026-10-21T10:00:00.000Z",
    scheduled_end_at: "2026-10-21T11:00:00.000Z",
    is_all_day: true,
    completed_at: UPDATED,
    original_parent_id: "task-0",
    sort_order: 1,
  };
  return rowsToTodoNode(meta, payload);
}

function routineShape(): object {
  const meta: ItemsMetaRoutineRow = {
    id: "routine-1",
    user_id: USER,
    role: "routine",
    title: "Routine",
    is_deleted: true,
    deleted_at: DELETED,
    created_at: CREATED,
    updated_at: UPDATED,
  };
  const payload: RoutinesPayloadRow = {
    item_id: "routine-1",
    user_id: USER,
    frequency: "weekly",
    interval: 1,
    weekdays_json: "[1,3,5]",
    start_at: "2026-10-01",
    end_at: "2026-12-31",
    template_start_time: "07:00",
    template_end_time: "08:00",
    template_memo: "memo",
    template_reminder_offset_min: 10,
    is_archived: true,
    frequency_type: "weekdays",
    frequency_days: "[1,3,5]",
    frequency_interval: 2,
    frequency_start_date: "2026-10-01",
    frequency_end_date: "2026-12-31",
    is_visible: true,
    start_time: "07:00",
    end_time: "08:00",
    reminder_enabled: true,
    reminder_offset: 10,
    sort_order: 1,
  };
  return rowsToRoutineNode(meta, payload);
}

function scheduleItemShape(): object {
  const meta: ItemsMetaEventRow = {
    id: "event-1",
    user_id: USER,
    role: "event",
    title: "Event",
    is_deleted: true,
    deleted_at: DELETED,
    created_at: CREATED,
    updated_at: UPDATED,
  };
  const payload: EventsPayloadRow = {
    item_id: "event-1",
    user_id: USER,
    start_at: "2026-10-21",
    start_time: "09:00",
    end_time: "10:00",
    is_all_day: true,
    done: true,
    completed_at: UPDATED,
    is_dismissed: true,
    reminder_at: "2026-10-21T08:50:00.000Z",
    reminder_offset_min: 10,
    memo: "memo",
    routine_item_id: "routine-1",
    routine_item_role: "routine",
    source_date: "2026-10-20",
    is_deleted_cache: true,
  };
  return rowsToScheduleItem(meta, payload);
}

function tagGroupShape(): object {
  const group: TagGroupRow = {
    id: "group-1",
    user_id: USER,
    name: "Group",
    is_deleted: false,
    deleted_at: DELETED,
    created_at: CREATED,
    updated_at: UPDATED,
  };
  const assignment: TagGroupAssignmentRow = {
    id: "group-assignment-1",
    user_id: USER,
    tag_id: "tag-1",
    group_id: "group-1",
    updated_at: UPDATED,
    is_deleted: false,
    deleted_at: DELETED,
  };
  return rowsToTagGroups([group], [assignment])[0];
}

function wikiTagShape(): object {
  const row: WikiTagRow = {
    id: "tag-1",
    user_id: USER,
    name: "Tag",
    color: "#336699",
    icon: "tag",
    is_deleted: true,
    deleted_at: DELETED,
    created_at: CREATED,
    updated_at: UPDATED,
  };
  return rowToWikiTag(row);
}

function wikiTagAssignmentShape(): object {
  const row: WikiTagAssignmentRow = {
    id: "assignment-1",
    user_id: USER,
    item_id: "note-1",
    tag_id: "tag-1",
    created_at: CREATED,
    updated_at: UPDATED,
    is_display_color: true,
    is_deleted: true,
    deleted_at: DELETED,
  };
  return rowToWikiTagAssignment(row);
}

function wikiTagConnectionShape(): object {
  const row: WikiTagConnectionRow = {
    id: "connection-1",
    user_id: USER,
    from_item_id: "note-1",
    to_item_id: "task-1",
    origin: "inline",
    updated_at: UPDATED,
    is_deleted: true,
    deleted_at: DELETED,
  };
  return rowToWikiTagConnection(row);
}

/** The sorted key list of each stored list's node, by cache slot. */
function currentShapes(): Record<string, string[]> {
  const keys = (node: object): string[] => Object.keys(node).sort();
  return {
    dailies: keys(dailyShape()),
    notes: keys(noteShape()),
    todoTree: keys(todoShape()),
    routines: keys(routineShape()),
    scheduleItems: keys(scheduleItemShape()),
    tagGroups: keys(tagGroupShape()),
    "wikiTags.tags": keys(wikiTagShape()),
    "wikiTags.assignments": keys(wikiTagAssignmentShape()),
    "wikiTags.connections": keys(wikiTagConnectionShape()),
  };
}

/*
 * One entry per CACHE_SCHEMA_VERSION. Entries are history: never edit an old
 * one — a new shape gets a new version and a new entry.
 */
const SHAPES_BY_VERSION: Record<number, Record<string, string[]>> = {
  1: {
    dailies: [
      "bodyLoaded",
      "content",
      "createdAt",
      "date",
      "deletedAt",
      "eveningNotes",
      "eveningPublishedAt",
      "hasPassword",
      "headContent",
      "id",
      "isDeleted",
      "isEditLocked",
      "isPinned",
      "morningComment",
      "updatedAt",
    ],
    notes: [
      "color",
      "content",
      "createdAt",
      "deletedAt",
      "hasPassword",
      "icon",
      "id",
      "isDeleted",
      "isEditLocked",
      "isPinned",
      "order",
      "parentId",
      "title",
      "type",
      "updatedAt",
    ],
    todoTree: [
      "color",
      "completedAt",
      "content",
      "createdAt",
      "deletedAt",
      "icon",
      "id",
      "isAllDay",
      "isDeleted",
      "isExpanded",
      "order",
      "parentId",
      "priority",
      "reminderEnabled",
      "reminderOffset",
      "scheduledAt",
      "scheduledEndAt",
      "status",
      "timeMemo",
      "title",
      "type",
      "updatedAt",
      "workDurationMinutes",
    ],
    routines: [
      "createdAt",
      "deletedAt",
      "endTime",
      "frequencyDays",
      "frequencyEndDate",
      "frequencyInterval",
      "frequencyStartDate",
      "frequencyType",
      "id",
      "isArchived",
      "isDeleted",
      "isVisible",
      "order",
      "reminderEnabled",
      "reminderOffset",
      "startTime",
      "title",
      "updatedAt",
    ],
    scheduleItems: [
      "completed",
      "completedAt",
      "content",
      "createdAt",
      "date",
      "deletedAt",
      "endTime",
      "id",
      "isAllDay",
      "isDeleted",
      "isDismissed",
      "memo",
      "noteId",
      "reminderEnabled",
      "reminderOffset",
      "routineId",
      "sourceDate",
      "startTime",
      "templateId",
      "title",
      "updatedAt",
    ],
    tagGroups: ["createdAt", "id", "name", "tagIds", "updatedAt"],
    "wikiTags.tags": [
      "color",
      "createdAt",
      "deletedAt",
      "icon",
      "id",
      "isDeleted",
      "name",
      "updatedAt",
    ],
    "wikiTags.assignments": [
      "createdAt",
      "deletedAt",
      "id",
      "isDeleted",
      "isDisplayColor",
      "itemId",
      "tagId",
      "updatedAt",
    ],
    "wikiTags.connections": [
      "deletedAt",
      "fromItemId",
      "id",
      "isDeleted",
      "origin",
      "toItemId",
      "updatedAt",
    ],
  },
};

describe("persistent cache — stored node shapes (#2331)", () => {
  it("matches the shapes recorded for CACHE_SCHEMA_VERSION", () => {
    // If this fails, the shape of a stored node moved. Bump
    // CACHE_SCHEMA_VERSION in src/state/persistentCache.ts and ADD an entry
    // for the new version above (leave the old entry as it is), so a device
    // holding the old shape empties its cache instead of reading it back.
    expect(currentShapes()).toEqual(SHAPES_BY_VERSION[CACHE_SCHEMA_VERSION]);
  });
});

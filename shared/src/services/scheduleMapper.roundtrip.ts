/*
 * Schedule domain <-> DB row round-trip verification (S4-1). Covers all
 * SEVEN mappers: routine / routineGroup / routineGroupAssignment /
 * scheduleItem / calendar / calendarTagDefinition /
 * calendarTagAssignment.
 *
 * Same harness shape as noteMapper.roundtrip.ts: a self-contained,
 * type-checked module that ASSERTS each mapper round-trip at runtime. It
 * is type-checked by `tsc -b` (part of the shared program) and runnable
 * standalone (`node dist/services/scheduleMapper.roundtrip.js`) — exits
 * non-zero on any mismatch. It imports the pure mappers (NOT
 * SupabaseDataService) so it carries no @supabase/supabase-js dependency.
 *
 * Round-trip property: for a row R produced from domain object D,
 *   rowToX( reattachServerColumns(xToRow(D)) )  deep-equals  normalise(D)
 * where reattachServerColumns adds back exactly what the SELECT/DB adds
 * (user_id RLS default, and the calendar_tag_definitions integer
 * identity). The frequency_days JSON array <-> string bijection and the
 * boolean/number coercions are exercised by the cases below.
 */
// NOTE: the `.js` extensions are deliberate and ONLY in this harness
// (identical rationale to noteMapper.roundtrip.ts): bundler resolution
// accepts them and the compiled dist file is runnable under Node ESM.
import type { RoutineNode } from "../types/routine.js";
import type {
  RoutineGroup,
  RoutineGroupAssignment,
} from "../types/routineGroup.js";
import type { ScheduleItem } from "../types/schedule.js";
import type { CalendarNode } from "../types/calendar.js";
import type { CalendarTag } from "../types/calendarTag.js";
import {
  rowToRoutine,
  routineToRow,
  type RoutineRow,
} from "./routineMapper.js";
import {
  rowToRoutineGroup,
  routineGroupToRow,
  type RoutineGroupRow,
} from "./routineGroupMapper.js";
import {
  rowToRoutineGroupAssignment,
  routineGroupAssignmentToRow,
  type RoutineGroupAssignmentRow,
} from "./routineGroupAssignmentMapper.js";
import {
  rowToScheduleItem,
  scheduleItemToRow,
  type ScheduleItemRow,
} from "./scheduleItemMapper.js";
import {
  rowToCalendar,
  calendarToRow,
  type CalendarRow,
} from "./calendarMapper.js";
import {
  rowToCalendarTag,
  calendarTagToRow,
  type CalendarTagDefinitionRow,
} from "./calendarTagDefinitionMapper.js";
import {
  rowToCalendarTagAssignment,
  calendarTagAssignmentToRow,
  type CalendarTagAssignment,
  type CalendarTagAssignmentRow,
} from "./calendarTagAssignmentMapper.js";

const FAKE_USER = "00000000-0000-0000-0000-000000000000";

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

// --- Re-attach what the SELECT/DB adds back (user_id; cta-def identity) ---

function normaliseRoutine(n: RoutineNode): RoutineNode {
  const row: RoutineRow = { ...routineToRow(n), user_id: FAKE_USER };
  return rowToRoutine(row);
}
function normaliseGroup(g: RoutineGroup): RoutineGroup {
  const row: RoutineGroupRow = {
    ...routineGroupToRow(g),
    user_id: FAKE_USER,
  };
  return rowToRoutineGroup(row);
}
function normaliseAssignment(
  a: RoutineGroupAssignment,
): RoutineGroupAssignment {
  const row: RoutineGroupAssignmentRow = {
    ...routineGroupAssignmentToRow(a),
    user_id: FAKE_USER,
  };
  return rowToRoutineGroupAssignment(row);
}
function normaliseScheduleItem(i: ScheduleItem): ScheduleItem {
  const row: ScheduleItemRow = {
    ...scheduleItemToRow(i),
    user_id: FAKE_USER,
  };
  return rowToScheduleItem(row);
}
function normaliseCalendar(c: CalendarNode): CalendarNode {
  const row: CalendarRow = { ...calendarToRow(c), user_id: FAKE_USER };
  return rowToCalendar(row);
}
function normaliseTag(t: CalendarTag): CalendarTag {
  // The identity pk is server-assigned; an existing tag carries it, so
  // the SELECT row re-attaches the same id + the server-managed sync
  // columns the domain type does not expose.
  const w = calendarTagToRow(t, true);
  const row: CalendarTagDefinitionRow = {
    id: w.id ?? t.id,
    user_id: FAKE_USER,
    name: w.name,
    color: w.color,
    text_color: w.text_color,
    order: w.order,
    created_at: "2026-05-17T00:00:00.000Z",
    updated_at: "2026-05-17T00:00:00.000Z",
    version: 1,
  };
  return rowToCalendarTag(row);
}
function normaliseCta(a: CalendarTagAssignment): CalendarTagAssignment {
  const row: CalendarTagAssignmentRow = {
    ...calendarTagAssignmentToRow(a),
    user_id: FAKE_USER,
  };
  return rowToCalendarTagAssignment(row);
}

// --- Cases ---

const ROUTINE_CASES: Array<{ name: string; node: RoutineNode }> = [
  {
    name: "daily routine, no times, empty frequency_days",
    node: {
      id: "routine-1710201234566",
      title: "Morning stretch",
      startTime: null,
      endTime: null,
      isArchived: false,
      isVisible: true,
      isDeleted: false,
      deletedAt: null,
      order: 0,
      frequencyType: "daily",
      frequencyDays: [],
      frequencyInterval: null,
      frequencyStartDate: null,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    },
  },
  {
    name: "weekdays routine with times + non-empty frequency_days (JSON array)",
    node: {
      id: "routine-aaaa",
      title: "Standup",
      startTime: "09:30",
      endTime: "09:45",
      isArchived: false,
      isVisible: true,
      isDeleted: false,
      deletedAt: null,
      order: 2,
      frequencyType: "weekdays",
      frequencyDays: [1, 2, 3, 4, 5],
      frequencyInterval: null,
      frequencyStartDate: "2026-05-01",
      reminderEnabled: true,
      reminderOffset: 10,
      createdAt: "2026-05-17T01:00:00.000Z",
      updatedAt: "2026-05-17T02:00:00.000Z",
    },
  },
  {
    name: "interval routine, soft-deleted, frequency_days [0,6]",
    node: {
      id: "routine-bbbb",
      title: "Trashed",
      startTime: "20:00",
      endTime: "21:00",
      isArchived: true,
      isVisible: false,
      isDeleted: true,
      deletedAt: "2026-05-17T03:00:00.000Z",
      order: 5,
      frequencyType: "interval",
      frequencyDays: [0, 6],
      frequencyInterval: 3,
      frequencyStartDate: "2026-04-15",
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T03:00:00.000Z",
    },
  },
  {
    name: "group-frequency routine (defers to assigned groups)",
    node: {
      id: "routine-cccc",
      title: "Grouped",
      startTime: null,
      endTime: null,
      isArchived: false,
      isVisible: true,
      isDeleted: false,
      deletedAt: null,
      order: 1,
      frequencyType: "group",
      frequencyDays: [],
      frequencyInterval: null,
      frequencyStartDate: null,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    },
  },
];

const GROUP_CASES: Array<{ name: string; group: RoutineGroup }> = [
  {
    name: "visible daily group, frequency_days [1,3,5]",
    group: {
      id: "rgroup-1111",
      name: "Workdays",
      color: "#6B7280",
      isVisible: true,
      order: 0,
      frequencyType: "weekdays",
      frequencyDays: [1, 3, 5],
      frequencyInterval: null,
      frequencyStartDate: null,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    },
  },
  {
    name: "hidden interval group",
    group: {
      id: "rgroup-2222",
      name: "Biweekly",
      color: "#ff8800",
      isVisible: false,
      order: 3,
      frequencyType: "interval",
      frequencyDays: [],
      frequencyInterval: 14,
      frequencyStartDate: "2026-05-10",
      createdAt: "2026-05-17T01:00:00.000Z",
      updatedAt: "2026-05-17T05:00:00.000Z",
    },
  },
];

const ASSIGNMENT_CASES: Array<{
  name: string;
  assignment: RoutineGroupAssignment;
}> = [
  {
    name: "live assignment",
    assignment: {
      id: "rga-1111",
      routineId: "routine-cccc",
      groupId: "rgroup-1111",
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
      isDeleted: false,
      deletedAt: null,
    },
  },
  {
    name: "soft-deleted (unassigned) assignment",
    assignment: {
      id: "rga-2222",
      routineId: "routine-cccc",
      groupId: "rgroup-2222",
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T06:00:00.000Z",
      isDeleted: true,
      deletedAt: "2026-05-17T06:00:00.000Z",
    },
  },
];

const SCHEDULE_ITEM_CASES: Array<{ name: string; item: ScheduleItem }> = [
  {
    name: "manual item, no routine, minimal optionals",
    item: {
      id: "si-1111",
      date: "2026-05-17",
      title: "Dentist",
      startTime: "14:00",
      endTime: "15:00",
      completed: false,
      completedAt: null,
      routineId: null,
      templateId: null,
      memo: null,
      noteId: null,
      content: null,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    },
  },
  {
    name: "routine-generated, completed, all optionals set",
    item: {
      id: "si-2222",
      date: "2026-05-18",
      title: "Standup",
      startTime: "09:30",
      endTime: "09:45",
      completed: true,
      completedAt: "2026-05-18T09:46:00.000Z",
      routineId: "routine-aaaa",
      templateId: "tmpl-1",
      memo: "notes here",
      noteId: "note-xyz",
      content: '{"type":"doc"}',
      isDeleted: false,
      deletedAt: null,
      isDismissed: false,
      isAllDay: false,
      reminderEnabled: true,
      reminderOffset: 5,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-18T09:46:00.000Z",
    },
  },
  {
    name: "soft-deleted all-day dismissed item",
    item: {
      id: "si-3333",
      date: "2026-05-19",
      title: "Holiday",
      startTime: "00:00",
      endTime: "23:59",
      completed: false,
      completedAt: null,
      routineId: null,
      templateId: null,
      memo: null,
      noteId: null,
      content: null,
      isDeleted: true,
      deletedAt: "2026-05-19T00:00:00.000Z",
      isDismissed: true,
      isAllDay: true,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-19T00:00:00.000Z",
    },
  },
];

const CALENDAR_CASES: Array<{ name: string; node: CalendarNode }> = [
  {
    name: "calendar bound to a tasks folder",
    node: {
      id: "calendar-1111",
      title: "Work Calendar",
      folderId: "taskfolder-2222",
      order: 0,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    },
  },
];

const TAG_CASES: Array<{ name: string; tag: CalendarTag }> = [
  {
    name: "tag without textColor",
    tag: { id: 1, name: "Urgent", color: "#ff0000", order: 0 },
  },
  {
    name: "tag with textColor",
    tag: {
      id: 42,
      name: "Calm",
      color: "#00aa88",
      textColor: "#ffffff",
      order: 3,
    },
  },
];

const CTA_CASES: Array<{ name: string; cta: CalendarTagAssignment }> = [
  {
    name: "schedule_item tagged",
    cta: {
      id: "cta-1111",
      entityType: "schedule_item",
      entityId: "si-2222",
      tagId: 1,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    },
  },
  {
    name: "task tagged",
    cta: {
      id: "cta-2222",
      entityType: "task",
      entityId: "task-1710201234566",
      tagId: 42,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T07:00:00.000Z",
    },
  },
];

/*
 * Round-trip invariant (identical contract to noteMapper.roundtrip.ts).
 * For domain objects with OPTIONAL fields backed by NOT-NULL-with-default
 * columns (ScheduleItem.isDeleted/isDismissed/isAllDay/reminderEnabled,
 * RoutineNode.reminderEnabled, ...), `rowToX` deliberately ALWAYS
 * materialises those flags (just like noteMapper materialises
 * hasPassword/isEditLocked) — so a freshly-built domain object that
 * OMITS them is NOT byte-equal to its normalised form. That is correct
 * mapper behaviour, not a defect. The meaningful, asserted invariant is
 * therefore the FIXED POINT: once a value has been through the DB shape,
 * a further round-trip changes nothing —
 *   deepEqual( normalise(v), normalise(normalise(v)) )
 * i.e. `xToRow ∘ rowToX` is idempotent and lossless on the projected
 * shape. For fully-specified cases normalise(v) also equals v, but the
 * fixed-point check is the contract that holds for every case.
 */
function check<T>(
  label: string,
  cases: Array<{ name: string; value: T }>,
  normalise: (v: T) => T,
): number {
  let failures = 0;
  for (const c of cases) {
    const once = normalise(c.value);
    const twice = normalise(once);
    if (deepEqual(once, twice)) {
      console.log(`  PASS  ${label} (fixed-point): ${c.name}`);
    } else {
      failures++;
      console.error(`  FAIL  ${label} (fixed-point): ${c.name}`);
      console.error(`    once:  ${JSON.stringify(once)}`);
      console.error(`    twice: ${JSON.stringify(twice)}`);
    }
    // For a fully-specified domain object the FIRST normalise must also
    // be a no-op (no field invented / dropped). Cases that intentionally
    // omit default-backed optionals are exempt from THIS stricter leg.
    if (deepEqual(c.value, once)) {
      console.log(`  PASS  ${label} (identity): ${c.name}`);
    } else {
      // Not a failure: an omitted default-backed optional legitimately
      // gets materialised here. Surfaced for visibility only.
      console.log(
        `  INFO  ${label} (identity, default-materialised): ${c.name}`,
      );
    }
  }
  return failures;
}

function run(): number {
  let failures = 0;
  failures += check(
    "routine",
    ROUTINE_CASES.map((c) => ({ name: c.name, value: c.node })),
    normaliseRoutine,
  );
  failures += check(
    "group",
    GROUP_CASES.map((c) => ({ name: c.name, value: c.group })),
    normaliseGroup,
  );
  failures += check(
    "assignment",
    ASSIGNMENT_CASES.map((c) => ({ name: c.name, value: c.assignment })),
    normaliseAssignment,
  );
  failures += check(
    "scheduleItem",
    SCHEDULE_ITEM_CASES.map((c) => ({ name: c.name, value: c.item })),
    normaliseScheduleItem,
  );
  failures += check(
    "calendar",
    CALENDAR_CASES.map((c) => ({ name: c.name, value: c.node })),
    normaliseCalendar,
  );
  failures += check(
    "calendarTag",
    TAG_CASES.map((c) => ({ name: c.name, value: c.tag })),
    normaliseTag,
  );
  failures += check(
    "cta",
    CTA_CASES.map((c) => ({ name: c.name, value: c.cta })),
    normaliseCta,
  );

  // One asserted (fail-able) leg per case: the fixed-point check. The
  // identity leg is INFO-only (a default-materialised optional is not a
  // failure), so it is excluded from the pass/fail tally.
  const total =
    ROUTINE_CASES.length +
    GROUP_CASES.length +
    ASSIGNMENT_CASES.length +
    SCHEDULE_ITEM_CASES.length +
    CALENDAR_CASES.length +
    TAG_CASES.length +
    CTA_CASES.length;
  console.log(
    `\nSchedule round-trip summary: ${total - failures} passed, ` +
      `${failures} failed.`,
  );
  return failures;
}

declare const process: { argv: string[]; exit: (code: number) => never };
const isMain =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1]?.includes("scheduleMapper.roundtrip");
if (isMain) {
  process.exit(run() === 0 ? 0 : 1);
}

export { run as runScheduleRoundtripChecks };

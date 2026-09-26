import { vi } from "vitest";
import type { ReactNode } from "react";
import type { TodoNode } from "@life-editor/shared";
import type { ScheduleSidebarProps } from "../../src/schedule/ScheduleSidebar";
import type { ScheduleOverlayHostProps } from "../../src/schedule/ScheduleOverlayHost";
import type { CalendarNarrowLayoutProps } from "../../src/schedule/CalendarNarrowLayout";
import type { CalendarDesktopLayoutProps } from "../../src/schedule/CalendarDesktopLayout";

/*
 * #1642 P1 — mounts CalendarTab under jsdom, so its wiring is asserted by
 * calling what it hands its parts instead of reading its source text. Faked:
 * the Context hooks it (and its hooks) import from `@life-editor/shared` (the
 * rest of that package is real), `useScheduleMutations`' writers (spies), the
 * range fetch, and optionally each of the four children (a recorder of its
 * last props). Nothing reads a coordinate. Suites load the factories through
 * `vi.hoisted` (see scheduleTourHost.test.tsx); no runtime import from
 * `@life-editor/shared` here, as the factories run while it is being mocked.
 */

type Fn = ReturnType<typeof vi.fn>;

/** `base`, plus a spy (made once, on first read) for every field it lacks. */
function withSpies<T extends object>(base: T): T & Record<string, Fn> {
  const made: Record<string, Fn> = {};
  return new Proxy(base, {
    get: (target, key) =>
      key in target
        ? target[key as keyof T]
        : typeof key === "string" && key !== "then"
          ? (made[key] ??= vi.fn())
          : undefined,
  }) as T & Record<string, Fn>;
}

export interface RecordedProps {
  sidebar: ScheduleSidebarProps | null;
  overlays: ScheduleOverlayHostProps | null;
  narrow: CalendarNarrowLayoutProps | null;
  desktop: CalendarDesktopLayoutProps | null;
  todoDialog: {
    open: boolean;
    onSubmit: (input: { title: string }) => void;
  } | null;
}

const EMPTY: never[] = [];

function makeHarness() {
  let created = 0;
  return {
    /** What `useMediaQuery` answers. */
    isWide: true,
    /** The tour reporter the host gets from `useTourAction`. */
    notify: vi.fn() as Fn,
    props: {
      sidebar: null,
      overlays: null,
      narrow: null,
      desktop: null,
      todoDialog: null,
    } as RecordedProps,
    todoTree: withSpies({
      nodes: [] as TodoNode[],
      // The host reads only the new node's id.
      addNode: vi.fn((_type: string, _parent: unknown, title: string) => ({
        id: `task-new-${++created}`,
        title,
      })),
    }),
    scheduleItems: withSpies({
      date: "2026-09-26",
      items: EMPTY,
      isLoading: false,
      error: null,
      registerViewMirror: () => () => {},
    }),
    routine: withSpies({ routines: EMPTY }),
    /** The writers the host routes to (`handleUpdate` and the rest are spies). */
    mutations: withSpies({ scopeRequest: null, repeatConverting: false }),
    range: withSpies({ rangeItems: EMPTY, viewMirror: {}, rangeError: null }),
  };
}

/** Swapped field by field in `resetHarness`, so the factories read fresh values. */
export const harness = makeHarness();

/** Fresh spies and an empty record. Call from `beforeEach`. */
export function resetHarness(): void {
  Object.assign(harness, makeHarness());
}

// Stable identities: a value that changed every render would re-run every
// effect and memo downstream of it, which the real Providers never do.
const translation = { t: (key: string) => key, i18n: { language: "en" } };
const toast = withSpies({});
const routineSync = withSpies({});
const tagGroups = withSpies({ tagGroups: EMPTY });
const wikiTags = withSpies({
  allTags: EMPTY,
  allAssignments: EMPTY,
  loading: false,
});
const linking = {};
const panelNotes = withSpies({ notes: EMPTY, notesError: null });

/** The `@life-editor/shared` factory: every Context seam, the rest real. */
export function mockShared<T extends object>(actual: T): T {
  return {
    ...actual,
    useTranslation: () => translation,
    useMediaQuery: () => harness.isWide,
    useSyncDomains: () => 0,
    useTourAction: () => harness.notify,
    useToast: () => toast,
    useScheduleItemsRoutineSync: () => routineSync,
    useScheduleItemsContext: () => harness.scheduleItems,
    useRoutineContext: () => harness.routine,
    useTodoTreeContext: () => harness.todoTree,
    useTagGroupContext: () => tagGroups,
    useWikiTagsUnifiedContext: () => wikiTags,
    // The real portal renders nothing without a RightSidebar Provider.
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
    TodoAddDialog: (p: NonNullable<RecordedProps["todoDialog"]>) => {
      harness.props.todoDialog = p;
      return null;
    },
  };
}

function recorder<P>(key: keyof RecordedProps) {
  return (p: P) => {
    Object.assign(harness.props, { [key]: p });
    return null;
  };
}

/** The module factories a suite hands `vi.mock`, by name. */
export const modules = {
  mutations: { useScheduleMutations: () => harness.mutations },
  range: { useVisibleRangeItems: () => harness.range },
  todoLinking: { useTodoLinking: () => linking },
  panelNotes: { useCreatePanelNotes: () => panelNotes },
  sidebar: { ScheduleSidebar: recorder<ScheduleSidebarProps>("sidebar") },
  overlays: {
    ScheduleOverlayHost: recorder<ScheduleOverlayHostProps>("overlays"),
  },
  narrow: {
    CalendarNarrowLayout: recorder<CalendarNarrowLayoutProps>("narrow"),
  },
  desktop: {
    CalendarDesktopLayout: recorder<CalendarDesktopLayoutProps>("desktop"),
  },
};

/** Every function reachable through plain objects and arrays (not elements). */
export function functionsIn(value: unknown, seen = new Set<unknown>()): Fn[] {
  if (value === null || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  if ("$$typeof" in value) return [];
  return Object.values(value).flatMap((v) =>
    typeof v === "function" ? [v as Fn] : functionsIn(v, seen),
  );
}

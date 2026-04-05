import { render, act, waitFor } from "@testing-library/react";
import { ScheduleSidebarContent } from "./ScheduleSidebarContent";
import type { ScheduleItem } from "../../types/schedule";
import type { RoutineNode } from "../../types/routine";
import type { ComponentProps } from "react";

// --- Capture MiniTodayFlow props ---
let capturedMiniFlowProps: Record<string, unknown> = {};

vi.mock("./MiniTodayFlow", () => ({
  MiniTodayFlow: (props: Record<string, unknown>) => {
    capturedMiniFlowProps = props;
    return <div data-testid="mini-today-flow" />;
  },
}));

vi.mock("./ScheduleItemEditPopup", () => ({
  ScheduleItemEditPopup: () => null,
}));

vi.mock("../Tasks/Schedule/Routine/AchievementPanel", () => ({
  AchievementPanel: () => null,
}));

vi.mock("../Tasks/Schedule/Routine/AchievementDetailsOverlay", () => ({
  AchievementDetailsOverlay: () => null,
}));

vi.mock("../Tasks/Schedule/Routine/RoutineManagementOverlay", () => ({
  RoutineManagementOverlay: () => null,
}));

vi.mock("../Tasks/Folder/FolderDropdown", () => ({
  FolderDropdown: () => null,
}));

// --- Mock context hooks ---
const mockDismissScheduleItem = vi.fn();
const mockUndismissScheduleItem = vi.fn();
const mockToggleComplete = vi.fn();

const routineA: RoutineNode = {
  id: "routine-a",
  title: "Routine A",
  startTime: "09:00",
  endTime: "10:00",
  isArchived: false,
  order: 0,
  createdAt: "2026-04-05T00:00:00Z",
  updatedAt: "2026-04-05T00:00:00Z",
};

const routineB: RoutineNode = {
  id: "routine-b",
  title: "Routine B",
  startTime: "10:00",
  endTime: "11:00",
  isArchived: false,
  order: 1,
  createdAt: "2026-04-05T00:00:00Z",
  updatedAt: "2026-04-05T00:00:00Z",
};

const mockRoutinesByGroup = new Map<string, RoutineNode[]>([
  ["group-1", [routineA, routineB]],
]);

vi.mock("../../hooks/useScheduleContext", () => ({
  useScheduleContext: () => ({
    routines: [routineA, routineB],
    toggleComplete: mockToggleComplete,
    dismissScheduleItem: mockDismissScheduleItem,
    undismissScheduleItem: mockUndismissScheduleItem,
    routineTags: [],
    tagAssignments: [],
    createRoutine: vi.fn(),
    updateRoutine: vi.fn(),
    deleteRoutine: vi.fn(),
    setTagsForRoutine: vi.fn(),
    getRoutineCompletionRate: vi.fn().mockReturnValue(0),
    createRoutineTag: vi.fn(),
    updateRoutineTag: vi.fn(),
    deleteRoutineTag: vi.fn(),
    routineGroups: [
      {
        id: "group-1",
        title: "Morning",
        order: 0,
        createdAt: "",
        updatedAt: "",
      },
    ],
    groupTagAssignments: [],
    routinesByGroup: mockRoutinesByGroup,
    groupTimeRange: vi.fn().mockReturnValue(null),
    createRoutineGroup: vi.fn(),
    updateRoutineGroup: vi.fn(),
    deleteRoutineGroup: vi.fn(),
    setTagsForGroup: vi.fn(),
    scheduleItemsVersion: 0,
    reconcileRoutineScheduleItems: vi.fn(),
    groupForRoutine: vi.fn(),
  }),
}));

vi.mock("../../hooks/useTaskTreeContext", () => ({
  useTaskTreeContext: () => ({
    nodes: [],
    updateNode: vi.fn(),
    setTaskStatus: vi.fn(),
  }),
}));

vi.mock("../../hooks/useNoteContext", () => ({
  useNoteContext: () => ({ notes: [] }),
}));

vi.mock("../../hooks/useMemoContext", () => ({
  useMemoContext: () => ({ memos: [] }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback,
  }),
}));

const mockScheduleItems: ScheduleItem[] = [
  {
    id: "si-1",
    date: "2026-04-05",
    title: "Routine A Item",
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId: "routine-a",
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    isDismissed: false,
    isAllDay: false,
    createdAt: "2026-04-05T00:00:00Z",
    updatedAt: "2026-04-05T00:00:00Z",
  },
  {
    id: "si-2",
    date: "2026-04-05",
    title: "Routine B Item",
    startTime: "10:00",
    endTime: "11:00",
    completed: false,
    completedAt: null,
    routineId: "routine-b",
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    isDismissed: false,
    isAllDay: false,
    createdAt: "2026-04-05T00:00:00Z",
    updatedAt: "2026-04-05T00:00:00Z",
  },
  {
    id: "si-3",
    date: "2026-04-05",
    title: "Unrelated Item",
    startTime: "12:00",
    endTime: "13:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    isDismissed: false,
    isAllDay: false,
    createdAt: "2026-04-05T00:00:00Z",
    updatedAt: "2026-04-05T00:00:00Z",
  },
];

vi.mock("../../services/dataServiceFactory", () => ({
  getDataService: () => ({
    fetchScheduleItemsByDateAll: vi.fn().mockResolvedValue(mockScheduleItems),
  }),
}));

describe("ScheduleSidebarContent", () => {
  const defaultProps: ComponentProps<typeof ScheduleSidebarContent> = {
    routineStats: null,
    children: <div data-testid="children" />,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedMiniFlowProps = {};
  });

  async function renderAndWaitForLoad(
    props?: Partial<ComponentProps<typeof ScheduleSidebarContent>>,
  ) {
    const result = render(
      <ScheduleSidebarContent {...defaultProps} {...props} />,
    );
    // Wait for useEffect to load schedule items
    await waitFor(() => {
      expect(capturedMiniFlowProps.scheduleItems).toBeDefined();
      expect(
        (capturedMiniFlowProps.scheduleItems as ScheduleItem[]).length,
      ).toBeGreaterThan(0);
    });
    return result;
  }

  describe("handleDismissGroup", () => {
    it("does not trigger console.error about setState during render", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await renderAndWaitForLoad();

      const onDismissGroup = capturedMiniFlowProps.onDismissGroup as (
        groupId: string,
      ) => void;
      act(() => {
        onDismissGroup("group-1");
      });

      const setStateError = consoleErrorSpy.mock.calls.find((call) =>
        String(call[0]).includes("Cannot update a component"),
      );
      expect(setStateError).toBeUndefined();

      consoleErrorSpy.mockRestore();
    });

    it("calls dismissScheduleItem for each matching item in the group", async () => {
      await renderAndWaitForLoad();

      const onDismissGroup = capturedMiniFlowProps.onDismissGroup as (
        groupId: string,
      ) => void;
      act(() => {
        onDismissGroup("group-1");
      });

      expect(mockDismissScheduleItem).toHaveBeenCalledWith("si-1");
      expect(mockDismissScheduleItem).toHaveBeenCalledWith("si-2");
      expect(mockDismissScheduleItem).toHaveBeenCalledTimes(2);
    });

    it("does not dismiss items without a matching routineId", async () => {
      await renderAndWaitForLoad();

      const onDismissGroup = capturedMiniFlowProps.onDismissGroup as (
        groupId: string,
      ) => void;
      act(() => {
        onDismissGroup("group-1");
      });

      expect(mockDismissScheduleItem).not.toHaveBeenCalledWith("si-3");
    });

    it("updates sidebar items to isDismissed=true", async () => {
      await renderAndWaitForLoad();

      const onDismissGroup = capturedMiniFlowProps.onDismissGroup as (
        groupId: string,
      ) => void;
      act(() => {
        onDismissGroup("group-1");
      });

      const updatedItems =
        capturedMiniFlowProps.scheduleItems as ScheduleItem[];
      const item1 = updatedItems.find((i) => i.id === "si-1");
      const item2 = updatedItems.find((i) => i.id === "si-2");
      const item3 = updatedItems.find((i) => i.id === "si-3");

      expect(item1?.isDismissed).toBe(true);
      expect(item2?.isDismissed).toBe(true);
      expect(item3?.isDismissed).toBe(false);
    });
  });

  describe("handleUndismissGroup", () => {
    it("does not trigger console.error about setState during render", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await renderAndWaitForLoad();

      const onUndismissGroup = capturedMiniFlowProps.onUndismissGroup as (
        groupId: string,
      ) => void;
      act(() => {
        onUndismissGroup("group-1");
      });

      const setStateError = consoleErrorSpy.mock.calls.find((call) =>
        String(call[0]).includes("Cannot update a component"),
      );
      expect(setStateError).toBeUndefined();

      consoleErrorSpy.mockRestore();
    });

    it("calls undismissScheduleItem for each matching item in the group", async () => {
      await renderAndWaitForLoad();

      const onUndismissGroup = capturedMiniFlowProps.onUndismissGroup as (
        groupId: string,
      ) => void;
      act(() => {
        onUndismissGroup("group-1");
      });

      expect(mockUndismissScheduleItem).toHaveBeenCalledWith("si-1");
      expect(mockUndismissScheduleItem).toHaveBeenCalledWith("si-2");
      expect(mockUndismissScheduleItem).toHaveBeenCalledTimes(2);
    });

    it("does not undismiss items without a matching routineId", async () => {
      await renderAndWaitForLoad();

      const onUndismissGroup = capturedMiniFlowProps.onUndismissGroup as (
        groupId: string,
      ) => void;
      act(() => {
        onUndismissGroup("group-1");
      });

      expect(mockUndismissScheduleItem).not.toHaveBeenCalledWith("si-3");
    });

    it("updates sidebar items to isDismissed=false", async () => {
      await renderAndWaitForLoad();

      // First dismiss, then undismiss to test the transition
      const onDismissGroup = capturedMiniFlowProps.onDismissGroup as (
        groupId: string,
      ) => void;
      act(() => {
        onDismissGroup("group-1");
      });

      const onUndismissGroup = capturedMiniFlowProps.onUndismissGroup as (
        groupId: string,
      ) => void;
      act(() => {
        onUndismissGroup("group-1");
      });

      const updatedItems =
        capturedMiniFlowProps.scheduleItems as ScheduleItem[];
      const item1 = updatedItems.find((i) => i.id === "si-1");
      const item2 = updatedItems.find((i) => i.id === "si-2");

      expect(item1?.isDismissed).toBe(false);
      expect(item2?.isDismissed).toBe(false);
    });
  });

  describe("handleDismissItem", () => {
    it("calls dismissScheduleItem and updates the single item", async () => {
      await renderAndWaitForLoad();

      const onDismissItem = capturedMiniFlowProps.onDismissItem as (
        id: string,
      ) => void;
      act(() => {
        onDismissItem("si-1");
      });

      expect(mockDismissScheduleItem).toHaveBeenCalledWith("si-1");
      expect(mockDismissScheduleItem).toHaveBeenCalledTimes(1);

      const updatedItems =
        capturedMiniFlowProps.scheduleItems as ScheduleItem[];
      expect(updatedItems.find((i) => i.id === "si-1")?.isDismissed).toBe(true);
      expect(updatedItems.find((i) => i.id === "si-2")?.isDismissed).toBe(
        false,
      );
    });
  });

  describe("handleUndismissItem", () => {
    it("calls undismissScheduleItem and updates the single item", async () => {
      await renderAndWaitForLoad();

      // Dismiss first
      const onDismissItem = capturedMiniFlowProps.onDismissItem as (
        id: string,
      ) => void;
      act(() => {
        onDismissItem("si-1");
      });

      const onUndismissItem = capturedMiniFlowProps.onUndismissItem as (
        id: string,
      ) => void;
      act(() => {
        onUndismissItem("si-1");
      });

      expect(mockUndismissScheduleItem).toHaveBeenCalledWith("si-1");

      const updatedItems =
        capturedMiniFlowProps.scheduleItems as ScheduleItem[];
      expect(updatedItems.find((i) => i.id === "si-1")?.isDismissed).toBe(
        false,
      );
    });
  });
});

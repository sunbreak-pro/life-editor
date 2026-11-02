import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, type ReactNode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  ItemPanelProvider,
  useItemPanelContext,
  type ItemPanelOptions,
  type ScheduleItem,
} from "@life-editor/shared";
import { ItemPanelHost } from "../src/schedule/ItemPanelHost";
import { CalendarTab } from "../src/schedule/CalendarTab";
import { makeTodo, stubDataService } from "./helpers";
import { harness, resetHarness } from "./helpers/calendarTabHarness";

/*
 * #2218 — the Schedule's editor and creation panel, opened from a screen that
 * is not the Schedule.
 *
 * Mounted through the same harness the CalendarTab suites use (the Context
 * hooks and the mutation layer are spies, <ScheduleOverlayHost> is a recorder
 * of its last props). That is what makes "the same panel, the same writes" a
 * checkable claim: the writer an action reaches from here is compared with
 * the writer the same action reaches from CalendarTab, call for call.
 *
 * The five section Providers ItemPanelHost mounts are passthroughs here — the
 * harness already answers every Context they would provide.
 */

const { load } = vi.hoisted(() => ({
  load: async (
    key: keyof typeof import("./helpers/calendarTabHarness").modules,
  ) => (await import("./helpers/calendarTabHarness")).modules[key],
}));
vi.mock("@life-editor/shared", async (orig) => {
  const passthrough = ({ children }: { children: ReactNode }) => (
    <>{children}</>
  );
  return {
    ...(await import("./helpers/calendarTabHarness")).mockShared(
      await orig<object>(),
    ),
    TodoTreeProvider: passthrough,
    WikiTagsUnifiedProvider: passthrough,
    TagGroupProvider: passthrough,
    RoutineProvider: passthrough,
    ScheduleItemsProvider: passthrough,
  };
});
vi.mock("../src/schedule/useScheduleMutations", () => load("mutations"));
vi.mock("../src/schedule/useVisibleRangeItems", () => load("range"));
vi.mock("../src/schedule/useTodoLinking", () => load("todoLinking"));
vi.mock("../src/schedule/useCreatePanelNotes", () => load("panelNotes"));
vi.mock("../src/schedule/ScheduleSidebar", () => load("sidebar"));
vi.mock("../src/schedule/ScheduleOverlayHost", () => load("overlays"));
vi.mock("../src/schedule/CalendarNarrowLayout", () => load("narrow"));
vi.mock("../src/schedule/CalendarDesktopLayout", () => load("desktop"));

const EVENT: ScheduleItem = {
  id: "event-1",
  date: "2026-10-14",
  title: "打ち合わせ",
  startTime: "10:00",
  endTime: "11:00",
  completed: false,
  completedAt: null,
  routineId: null,
  templateId: null,
  memo: null,
  noteId: null,
  content: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

/**
 * A stand-in for Briefing / Connect: a screen with no Schedule Provider of its
 * own, which only knows the context. It names the open request so a case can
 * see the request end.
 */
let panel: ReturnType<typeof useItemPanelContext> | null = null;
function CallerScreen() {
  const ctx = useItemPanelContext();
  // Handed out from an effect, not from render (react-hooks/globals).
  useEffect(() => {
    panel = ctx;
  });
  return (
    <p data-testid="caller">
      {ctx.request ? `open:${ctx.request.mode}` : "closed"}
    </p>
  );
}

function mountPanel() {
  render(
    <ItemPanelProvider>
      <CallerScreen />
      <ItemPanelHost dataService={stubDataService()} />
    </ItemPanelProvider>,
  );
}

function overlays() {
  const props = harness.props.overlays;
  if (!props) throw new Error("no panel was drawn");
  return props;
}

const callerSays = () => screen.getByTestId("caller").textContent;

function openEvent(options?: ItemPanelOptions) {
  act(() =>
    panel!.openEdit({ role: "event", id: EVENT.id, date: EVENT.date }, options),
  );
}

beforeEach(() => {
  resetHarness();
  Object.assign(harness.range, { rangeItems: [EVENT] });
  panel = null;
});

describe("ItemPanelHost — opening the editor over the calling screen", () => {
  it("draws nothing until a screen asks", () => {
    mountPanel();
    expect(harness.props.overlays).toBeNull();
    expect(callerSays()).toBe("closed");
  });

  it("opens the event's editor without leaving the calling screen", () => {
    mountPanel();
    openEvent();
    const { editor } = overlays();
    expect(editor.item?.id).toBe(EVENT.id);
    // Desktop's frame needs the flag as well as the row (selectionSurface).
    expect(editor.overlayOpen).toBe(true);
    // The caller is still the screen on display.
    expect(screen.getByTestId("caller")).toBeTruthy();
    expect(callerSays()).toBe("open:edit");
  });

  it("opens a todo's detail", () => {
    harness.todoTree.nodes = [makeTodo({ id: "task-7", title: "資料" })];
    mountPanel();
    act(() => panel!.openEdit({ role: "task", id: "task-7" }));
    expect(overlays().todoDetail.todoId).toBe("task-7");
  });

  it("opens the creation panel on the seeded day and times", () => {
    mountPanel();
    act(() =>
      panel!.openCreate({ date: "2026-10-20", start: "13:00", end: "14:30" }),
    );
    expect(overlays().create.panel).toEqual({
      date: "2026-10-20",
      start: "13:00",
      end: "14:30",
    });
  });

  it("ends the request once the editor is closed", () => {
    mountPanel();
    openEvent();
    act(() => overlays().editor.onCloseOverlay());
    expect(callerSays()).toBe("closed");
  });
});

describe("ItemPanelHost — the same writes as the Schedule screen", () => {
  /** What one press reaches, from a freshly mounted host. */
  function pressFrom(
    mount: () => void,
    press: (p: ReturnType<typeof overlays>) => void,
  ) {
    // One host at a time: the recorder keeps the LAST props it was given.
    cleanup();
    resetHarness();
    Object.assign(harness.range, { rangeItems: [EVENT] });
    mount();
    act(() => press(overlays()));
    return {
      update: harness.mutations.handleUpdate.mock.calls,
      remove: harness.mutations.handleDelete.mock.calls,
    };
  }
  const fromSchedule = (press: (p: ReturnType<typeof overlays>) => void) =>
    pressFrom(
      () => render(<CalendarTab dataService={stubDataService()} />),
      press,
    );
  const fromPanel = (press: (p: ReturnType<typeof overlays>) => void) =>
    pressFrom(() => {
      mountPanel();
      openEvent();
    }, press);

  it("saves through the writer the Schedule's editor saves through", () => {
    const save = (p: ReturnType<typeof overlays>) =>
      p.editor.handlers.onSave(EVENT.id, { title: "改名", startTime: "10:30" });
    const schedule = fromSchedule(save);
    const here = fromPanel(save);
    expect(here.update).toEqual([
      [EVENT.id, { title: "改名", startTime: "10:30" }],
    ]);
    expect(here.update).toEqual(schedule.update);
  });

  it("deletes through the writer the Schedule's editor deletes through", () => {
    const remove = (p: ReturnType<typeof overlays>) =>
      p.editor.handlers.onDelete?.(EVENT.id);
    const schedule = fromSchedule(remove);
    const here = fromPanel(remove);
    expect(here.remove).toEqual([[EVENT.id]]);
    expect(here.remove).toEqual(schedule.remove);
  });
});

describe("ItemPanelHost — 「予定の画面で開く」", () => {
  it("is offered only when the caller asks for it", () => {
    mountPanel();
    openEvent();
    expect(overlays().editor.onOpenInSchedule).toBeUndefined();
    expect(overlays().todoDetail.onOpenInSchedule).toBeUndefined();
  });

  it("closes the panel and hands the caller the event and its day", () => {
    const onOpenInSchedule = vi.fn();
    mountPanel();
    openEvent({ onOpenInSchedule });
    act(() => overlays().editor.onOpenInSchedule?.());
    expect(onOpenInSchedule).toHaveBeenCalledWith({
      id: EVENT.id,
      role: "event",
      date: EVENT.date,
    });
    expect(callerSays()).toBe("closed");
  });

  it("hands over a todo with the day it is set for", () => {
    const onOpenInSchedule = vi.fn();
    harness.todoTree.nodes = [
      makeTodo({
        id: "task-7",
        scheduledAt: new Date(2026, 9, 16, 9, 0).toISOString(),
      }),
    ];
    mountPanel();
    act(() =>
      panel!.openEdit({ role: "task", id: "task-7" }, { onOpenInSchedule }),
    );
    act(() => overlays().todoDetail.onOpenInSchedule?.("task-7"));
    expect(onOpenInSchedule).toHaveBeenCalledWith({
      id: "task-7",
      role: "task",
      date: "2026-10-16",
    });
    expect(callerSays()).toBe("closed");
  });

  it("hands over a todo set for no day with a null day", () => {
    const onOpenInSchedule = vi.fn();
    harness.todoTree.nodes = [makeTodo({ id: "task-8" })];
    mountPanel();
    act(() =>
      panel!.openEdit({ role: "task", id: "task-8" }, { onOpenInSchedule }),
    );
    act(() => overlays().todoDetail.onOpenInSchedule?.("task-8"));
    expect(onOpenInSchedule).toHaveBeenCalledWith({
      id: "task-8",
      role: "task",
      date: null,
    });
  });
});

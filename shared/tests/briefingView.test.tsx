import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  BriefingView,
  EveningView,
  type BriefingData,
  type BriefingLabels,
  type EveningLabels,
} from "../src/components";

/*
 * BriefingView — pure morning-paper view. Every row (schedule / todo /
 * carryover) exposes a title button (toggles completion) plus an icon-only
 * jump button (navigates to the owning section). The circle on schedule rows
 * still toggles too. This suite guards the click routing and the no-nested-
 * button a11y invariant.
 */

const LABELS: BriefingLabels = {
  masthead: "BRIEFING",
  focusLabel: "FOCUS",
  aiTitle: "AI",
  aiSource: "Claude",
  noBriefing: "No briefing",
  intentionTitle: "INTENTION",
  intentionCaption: "Saved",
  intentionPlaceholder: "Declare today…",
  scheduleTitle: "PROMISES",
  addScheduleItem: "Add to today's schedule",
  noSchedule: "Nothing scheduled",
  routineTag: "Routine",
  allDay: "All day",
  todosTitle: "TODOS",
  noTodos: "No todos",
  vizTitle: "VIZ",
  carryoverTitle: "CARRYOVER",
  toggleComplete: "Toggle complete",
  edit: "Edit",
  delete: "Delete",
  deleteScheduleHint: "Delete this event",
  deleteTodoHint: "Delete this todo",
  jumpToSchedule: "Open in Schedule",
  jumpToTodos: "Open in Todos",
};

const STREAK_LABELS = {
  title: "Streak",
  current: "Current",
  longest: "Longest",
  days: "days",
  noStreak: "No streak",
};
const TREND_LABELS = { title: "Trend", completedCount: "Completed" };
const BALANCE_LABELS = {
  title: "Balance",
  work: "Work",
  break: "Break",
  longBreak: "Long break",
};

const DATA: BriefingData = {
  dateLine: "2026-07-16",
  briefing: null,
  schedule: [
    {
      id: "s1",
      title: "Morning standup",
      startTime: "09:00",
      completed: false,
      isRoutine: false,
      isAllDay: false,
    },
    {
      id: "s2",
      title: "Done meeting",
      startTime: "10:00",
      completed: true,
      isRoutine: false,
      isAllDay: false,
    },
  ],
  todos: [
    { id: "t1", title: "Write report", status: "NOT_STARTED", purposes: [] },
    { id: "t2", title: "Ship feature", status: "DONE", purposes: [] },
  ],
  carryover: [
    { id: "c1", title: "Old todo", daysLabel: "day 3", completed: false },
    {
      id: "c2",
      title: "Finished carryover",
      daysLabel: "day 2",
      completed: true,
    },
  ],
  sessions: [],
  todoNodes: [],
};

function renderView(props?: Partial<Parameters<typeof BriefingView>[0]>) {
  const onToggleScheduleItem = vi.fn();
  const onToggleTodo = vi.fn();
  const onDeleteScheduleItem = vi.fn();
  const onDeleteTodo = vi.fn();
  const onAddScheduleItem = vi.fn();
  const onJumpToSchedule = vi.fn();
  const onJumpToTodos = vi.fn();
  const onIntentionChange = vi.fn();
  const onIntentionBlur = vi.fn();
  const result = render(
    <BriefingView
      loading={false}
      data={DATA}
      labels={LABELS}
      streakLabels={STREAK_LABELS}
      trendLabels={TREND_LABELS}
      balanceLabels={BALANCE_LABELS}
      intentionText=""
      onIntentionChange={onIntentionChange}
      onIntentionBlur={onIntentionBlur}
      onToggleScheduleItem={onToggleScheduleItem}
      onToggleTodo={onToggleTodo}
      onDeleteScheduleItem={onDeleteScheduleItem}
      onDeleteTodo={onDeleteTodo}
      onAddScheduleItem={onAddScheduleItem}
      onJumpToSchedule={onJumpToSchedule}
      onJumpToTodos={onJumpToTodos}
      {...props}
    />,
  );
  return {
    ...result,
    onToggleScheduleItem,
    onToggleTodo,
    onDeleteScheduleItem,
    onDeleteTodo,
    onAddScheduleItem,
    onJumpToSchedule,
    onJumpToTodos,
    onIntentionChange,
    onIntentionBlur,
  };
}

describe("BriefingView row actions", () => {
  it("toggles a schedule item from its title button (no nav)", () => {
    const { onToggleScheduleItem, onJumpToSchedule } = renderView();
    fireEvent.click(screen.getByRole("button", { name: "Morning standup" }));
    expect(onToggleScheduleItem).toHaveBeenCalledWith("s1");
    expect(onJumpToSchedule).not.toHaveBeenCalled();
  });

  it("toggles a schedule item from its completion circle", () => {
    const { onToggleScheduleItem } = renderView();
    const circles = screen.getAllByRole("button", { name: "Toggle complete" });
    fireEvent.click(circles[0]);
    expect(onToggleScheduleItem).toHaveBeenCalledWith("s1");
  });

  it("jumps to Schedule from the schedule move button (no toggle)", () => {
    const { onJumpToSchedule, onToggleScheduleItem } = renderView();
    const jumps = screen.getAllByTitle("Open in Schedule");
    fireEvent.click(jumps[0]);
    expect(onJumpToSchedule).toHaveBeenCalledTimes(1);
    expect(onToggleScheduleItem).not.toHaveBeenCalled();
  });

  it("strikes through a completed schedule row title", () => {
    renderView();
    expect(
      screen.getByRole("button", { name: "Done meeting" }).className,
    ).toContain("line-through");
  });

  it("toggles a todo from its title button (no nav)", () => {
    const { onToggleTodo, onJumpToTodos } = renderView();
    fireEvent.click(screen.getByRole("button", { name: /Write report/ }));
    expect(onToggleTodo).toHaveBeenCalledWith("t1");
    expect(onJumpToTodos).not.toHaveBeenCalled();
  });

  it("jumps to Todos from a todo move button (no toggle)", () => {
    const { onJumpToTodos, onToggleTodo } = renderView();
    // Move buttons for todos and carryover share the label; the first two are
    // the two todo rows.
    const jumps = screen.getAllByTitle("Open in Todos");
    fireEvent.click(jumps[0]);
    expect(onJumpToTodos).toHaveBeenCalledTimes(1);
    expect(onToggleTodo).not.toHaveBeenCalled();
  });

  it("strikes through a DONE todo title", () => {
    renderView();
    expect(screen.getByText("Ship feature").className).toContain(
      "line-through",
    );
  });

  it("toggles + jumps from a carryover row and strikes completed ones", () => {
    const { onToggleTodo, onJumpToTodos } = renderView();
    fireEvent.click(screen.getByRole("button", { name: /Old todo/ }));
    expect(onToggleTodo).toHaveBeenCalledWith("c1");

    const jumps = screen.getAllByTitle("Open in Todos");
    // todo rows (2) then carryover rows (2): the third jump button is c1.
    fireEvent.click(jumps[2]);
    expect(onJumpToTodos).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Finished carryover").className).toContain(
      "line-through",
    );
  });

  it("opens the host's creation panel from the schedule heading + (#623)", () => {
    const { onAddScheduleItem, onJumpToSchedule, onToggleScheduleItem } =
      renderView();
    const add = screen.getByRole("button", {
      name: "Add to today's schedule",
    });
    fireEvent.click(add);
    expect(onAddScheduleItem).toHaveBeenCalledTimes(1);
    expect(onJumpToSchedule).not.toHaveBeenCalled();
    expect(onToggleScheduleItem).not.toHaveBeenCalled();
  });

  it("keeps the + reachable when the day has nothing scheduled (#623)", () => {
    const { onAddScheduleItem } = renderView({
      data: { ...DATA, schedule: [] },
    });
    // The empty state is exactly when the button matters most — it must not
    // ride along with the row list.
    expect(screen.getByText("Nothing scheduled")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Add to today's schedule" }),
    );
    expect(onAddScheduleItem).toHaveBeenCalledTimes(1);
  });

  it("deletes a schedule row without toggling or navigating (#585)", () => {
    const { onDeleteScheduleItem, onToggleScheduleItem, onJumpToSchedule } =
      renderView();
    const deletes = screen.getAllByTitle("Delete this event");
    expect(deletes).toHaveLength(2);
    fireEvent.click(deletes[0]);
    expect(onDeleteScheduleItem).toHaveBeenCalledWith("s1");
    expect(onToggleScheduleItem).not.toHaveBeenCalled();
    expect(onJumpToSchedule).not.toHaveBeenCalled();
  });

  it("deletes a todo row without toggling or navigating (#585)", () => {
    const { onDeleteTodo, onToggleTodo, onJumpToTodos } = renderView();
    const deletes = screen.getAllByTitle("Delete this todo");
    // Todo rows only — carryover keeps the jump alone.
    expect(deletes).toHaveLength(2);
    fireEvent.click(deletes[1]);
    expect(onDeleteTodo).toHaveBeenCalledWith("t2");
    expect(onToggleTodo).not.toHaveBeenCalled();
    expect(onJumpToTodos).not.toHaveBeenCalled();
  });

  it("names every delete button by its visible label first (WCAG 2.5.3)", () => {
    renderView();
    // The visible text is「削除」/ "Delete"; the accessible name leads with it
    // and only then says which row it acts on.
    const byName = screen.getAllByRole("button", {
      name: "Delete: Delete this event",
    });
    expect(byName).toHaveLength(2);
    expect(byName[0].textContent).toContain("Delete");
  });

  it("never nests a button inside another button", () => {
    const { container } = renderView();
    expect(container.querySelectorAll("button button").length).toBe(0);
  });
});

describe("BriefingView intention field (宣言 — Step 4)", () => {
  it("shows the stored declaration and reports edits + blur to the host", () => {
    const { onIntentionChange, onIntentionBlur } = renderView({
      intentionText: "Ship the report",
    });
    const field = screen.getByPlaceholderText("Declare today…");
    expect((field as HTMLTextAreaElement).value).toBe("Ship the report");
    fireEvent.change(field, { target: { value: "Ship the report\nRun" } });
    expect(onIntentionChange).toHaveBeenCalledWith("Ship the report\nRun");
    fireEvent.blur(field);
    expect(onIntentionBlur).toHaveBeenCalledTimes(1);
  });
});

/*
 * #391 — the 宣言 block on the evening paper. Wide keeps the original reading
 * (a morning artifact read back, hidden on a blank day); below 768px 夕刊 is a
 * Quick capture surface (mobile-scope #3), so the block becomes the live input
 * — otherwise a phone user who lands on 夕刊 cannot declare at all.
 */
describe("EveningView intention block (#391)", () => {
  it("reads the declaration back with no save caption on the wide layout", () => {
    renderEvening({ intentionText: "Ship the report" });
    expect(screen.getByText("Ship the report")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Declare today…")).toBeNull();
    // Nothing to save while read-only — the caption must not contradict it.
    expect(screen.queryByText("Unsaved")).toBeNull();
  });

  it("hides the whole block on the wide layout when nothing is declared", () => {
    renderEvening();
    expect(screen.queryByText("INTENTION")).toBeNull();
  });

  it("reports edits + blur to the host on the narrow layout", () => {
    const { onIntentionChange, onIntentionBlur } = renderEvening({
      intentionEditable: true,
      intentionText: "Ship the report",
    });
    const field = screen.getByPlaceholderText("Declare today…");
    expect((field as HTMLTextAreaElement).value).toBe("Ship the report");
    fireEvent.change(field, { target: { value: "Ship the report\nRun" } });
    expect(onIntentionChange).toHaveBeenCalledWith("Ship the report\nRun");
    fireEvent.blur(field);
    expect(onIntentionBlur).toHaveBeenCalledTimes(1);
  });

  // Only the presence of the caption row is a view concern — WHICH caption is
  // host-computed (BriefingScreen), and web has no test runner, so the copy
  // itself is out of reach here.
  it("keeps an empty field reachable on the narrow layout and shows a caption", () => {
    renderEvening({ intentionEditable: true });
    expect(screen.getByPlaceholderText("Declare today…")).toBeTruthy();
    expect(screen.getByText("Unsaved")).toBeTruthy();
  });
});

/*
 * #318 — below 768px the shell drops its header slot, so the SectionHeader
 * 朝刊/夕刊 band disappears and 夕刊 becomes unreachable. Both paper views take
 * an optional in-body `tabSwitcher` the narrow host fills; the wide host leaves
 * it undefined so the header keeps owning the tabs.
 */
const EVENING_LABELS: EveningLabels = {
  masthead: "EVENING",
  moodTitle: "MOOD",
  moodStars: [1, 2, 3, 4, 5].map((n) => `Mood ${n}/5`),
  intentionTitle: "INTENTION",
  intentionCaption: "Unsaved",
  intentionPlaceholder: "Declare today…",
  reflectionTitle: "CLOSING",
  savedCaption: "Saved",
  todosTitle: "REMAINING",
  noTodos: "No todos",
  todoStatus: "Status",
  statusNotStarted: "Not started",
  statusInProgress: "In progress",
  statusDone: "Done",
  upcomingTitle: "UPCOMING",
  noUpcoming: "Nothing upcoming",
  tomorrowTag: "Tomorrow",
  allDay: "All day",
};

function renderEvening(props?: Partial<Parameters<typeof EveningView>[0]>) {
  const onIntentionChange = vi.fn();
  const onIntentionBlur = vi.fn();
  const onSetTodoStatus = vi.fn();
  const result = render(
    <EveningView
      loading={false}
      dateLine="2026-07-25"
      mood={null}
      onSelectMood={vi.fn()}
      editorSlot={<div>editor</div>}
      intentionText=""
      intentionEditable={false}
      onIntentionChange={onIntentionChange}
      onIntentionBlur={onIntentionBlur}
      todos={[]}
      onSetTodoStatus={onSetTodoStatus}
      schedule={[]}
      labels={EVENING_LABELS}
      {...props}
    />,
  );
  return { ...result, onIntentionChange, onIntentionBlur, onSetTodoStatus };
}

/**
 * Counts the in-body switcher band. Mirrors the wrapper markup in both views —
 * the only `py-3` ruled divider on a paper otherwise built from `py-5`/`py-6`
 * sections — so an empty band (slot guard letting `null` through) is caught.
 */
function bandCount(container: HTMLElement): number {
  return container.querySelectorAll(
    "div.border-b.border-lumen-border.px-2.py-3",
  ).length;
}

describe("Briefing narrow-width tab switcher (#318)", () => {
  const switcher = <button type="button">夕刊</button>;

  it("renders the host switcher in the morning paper", () => {
    const { container } = renderView({ tabSwitcher: switcher });
    expect(screen.getByRole("button", { name: "夕刊" })).toBeTruthy();
    expect(bandCount(container)).toBe(1);
  });

  it("keeps the switcher reachable while the morning paper loads", () => {
    renderView({ loading: true, tabSwitcher: switcher });
    expect(screen.getByRole("button", { name: "夕刊" })).toBeTruthy();
  });

  it("renders the host switcher in the evening paper", () => {
    const { container } = renderEvening({ tabSwitcher: switcher });
    expect(screen.getByRole("button", { name: "夕刊" })).toBeTruthy();
    expect(bandCount(container)).toBe(1);
  });

  it("keeps the switcher reachable while the evening paper loads", () => {
    renderEvening({ loading: true, tabSwitcher: switcher });
    expect(screen.getByRole("button", { name: "夕刊" })).toBeTruthy();
  });

  it("renders no band in the morning paper on the wide layout", () => {
    const { container } = renderView();
    expect(screen.queryByRole("button", { name: "夕刊" })).toBeNull();
    expect(bandCount(container)).toBe(0);
  });

  it("renders no band in the evening paper on the wide layout", () => {
    const { container } = renderEvening();
    expect(screen.queryByRole("button", { name: "夕刊" })).toBeNull();
    expect(bandCount(container)).toBe(0);
  });

  // A host writing `cond ? <X/> : null` must not leave an empty ruled band
  // behind — the slot guard rejects null, not just undefined.
  it("renders no band when the host passes null", () => {
    expect(bandCount(renderView({ tabSwitcher: null }).container)).toBe(0);
    expect(bandCount(renderEvening({ tabSwitcher: null }).container)).toBe(0);
  });
});

/*
 * #410 — the jump action used to be a bare 13px ↗ sitting right after the
 * title, so it was both hard to hit and never in the same place twice (the
 * title length moved it). It now carries a visible「編集」label and is pinned
 * to the row's right edge.
 */
describe("Row edit action (#410)", () => {
  it("labels every jump button with the visible edit text", () => {
    renderView();
    // 2 schedule rows + 2 todo rows + 2 carryover rows.
    expect(screen.getAllByRole("button", { name: /Edit/ }).length).toBe(6);
  });

  // WCAG 2.5.3: the accessible name must START with the visible label, or
  // voice control ("click 編集") misses the button. It must also keep saying
  // where the jump lands — six buttons all named「編集」would be
  // indistinguishable in a screen reader's button list, and `title` alone
  // does not carry on touch.
  it("names each jump button with the visible label first, destination after", () => {
    renderView();
    const jump = screen.getAllByTitle("Open in Schedule")[0];
    expect(jump.textContent).toContain("Edit");
    expect(jump.getAttribute("aria-label")).toBe("Edit: Open in Schedule");
    expect(screen.getAllByLabelText("Edit: Open in Todos").length).toBe(4);
  });

  it("pins every row's action cluster to the right edge with padded hit targets", () => {
    renderView();
    const actions = screen.getAllByRole("button", { name: /^Edit: / });
    expect(actions.length).toBe(6);
    for (const action of actions) {
      // #585: the cluster owns the right-edge pin and the negative margins
      // now that two actions share it — the button keeps the padding that
      // buys its 24x24 target (WCAG 2.5.8), and the row height and right
      // edge stay exactly where they were with one action.
      expect(action.className).toContain("py-1");
      const cluster = action.parentElement!;
      expect(cluster.className).toContain("ml-auto");
      expect(cluster.className).toContain("-my-1");
      expect(cluster.className).toContain("-mr-1.5");
    }
  });

  it("gives the delete button the same hit target as its jump neighbour", () => {
    renderView();
    const deletes = screen.getAllByRole("button", { name: /^Delete: / });
    expect(deletes.length).toBe(4);
    for (const del of deletes) {
      expect(del.className).toContain("py-1");
      expect(del.className).toContain("px-1.5");
      expect(del.className).toContain("text-xs");
    }
  });

  it("keeps the routine tag beside the title, ahead of the edit button", () => {
    const { container } = renderView({
      data: {
        ...DATA,
        schedule: [{ ...DATA.schedule[0], isRoutine: true }],
      },
    });
    const row = container.querySelector("li")!;
    const kids = Array.from(row.children).map((el) => el.textContent ?? "");
    expect(kids.indexOf("Routine")).toBeGreaterThan(-1);
    expect(kids.indexOf("Routine")).toBeLessThan(
      kids.findIndex((s) => s.includes("Edit")),
    );
  });
});

/*
 * #427 — a day with no declaration at all has nothing to report a save state
 * for. The host omits `intentionCaption` then; both papers must render the
 * 宣言 heading without any caption beside it.
 */
describe("Intention caption omission (#427)", () => {
  it("renders no caption when the host omits intentionCaption (morning)", () => {
    const { container } = renderView({
      labels: { ...LABELS, intentionCaption: undefined },
    });
    expect(screen.getByText("INTENTION")).toBeTruthy();
    expect(screen.queryByText("Saved")).toBeNull();
    expect(container.textContent).not.toContain("Unsaved");
  });

  it("renders no caption when the host omits intentionCaption (evening)", () => {
    const { container } = renderEvening({
      intentionEditable: true,
      labels: { ...EVENING_LABELS, intentionCaption: undefined },
    });
    expect(screen.getByText("INTENTION")).toBeTruthy();
    expect(container.textContent).not.toContain("Unsaved");
  });

  it("still renders the caption once the host supplies one", () => {
    renderView({ labels: { ...LABELS, intentionCaption: "Saved" } });
    expect(screen.getByText("Saved")).toBeTruthy();
  });
});

/*
 * #796 — the REMAINING TODOS rows speak the Todo's real three statuses.
 *
 * The block drew a checkbox-shaped <span> with nothing listening to it, which
 * both flattened Not started / In progress / Done into two values and left the
 * row unpressable. It is one button now, cycling in the same order the Todos
 * side has always used, and a row moved to Done stays listed struck through so
 * the press is visible and reversible.
 */
describe("EveningView remaining todos, three statuses (#796)", () => {
  const TODOS = [
    { id: "t1", title: "Write the report", status: "NOT_STARTED" as const },
    { id: "t2", title: "Book the room", status: "IN_PROGRESS" as const },
    { id: "t3", title: "Send the invite", status: "DONE" as const },
  ];

  it("names each row's current status", () => {
    renderEvening({ todos: TODOS });
    expect(screen.getByLabelText("Status: Not started")).toBeTruthy();
    expect(screen.getByLabelText("Status: In progress")).toBeTruthy();
    expect(screen.getByLabelText("Status: Done")).toBeTruthy();
  });

  it("advances one step per press, wrapping at Done", () => {
    const { onSetTodoStatus } = renderEvening({ todos: TODOS });
    fireEvent.click(screen.getByLabelText("Status: Not started"));
    expect(onSetTodoStatus).toHaveBeenLastCalledWith("t1", "IN_PROGRESS");
    fireEvent.click(screen.getByLabelText("Status: In progress"));
    expect(onSetTodoStatus).toHaveBeenLastCalledWith("t2", "DONE");
    fireEvent.click(screen.getByLabelText("Status: Done"));
    expect(onSetTodoStatus).toHaveBeenLastCalledWith("t3", "NOT_STARTED");
  });

  it("keeps a Done row listed, struck through", () => {
    renderEvening({ todos: TODOS });
    expect(screen.getByText("Send the invite").className).toContain(
      "line-through",
    );
    expect(screen.getByText("Book the room").className).not.toContain(
      "line-through",
    );
  });

  it("gives every control the phone minimum touch target", () => {
    renderEvening({ todos: TODOS });
    for (const label of ["Not started", "In progress", "Done"]) {
      // mobile-scope.md: 44px is the floor, and a 16px box cannot meet it.
      expect(screen.getByLabelText(`Status: ${label}`).className).toContain(
        "min-h-11",
      );
    }
  });
});

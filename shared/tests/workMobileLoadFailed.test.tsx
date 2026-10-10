import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PomodoroTodoSheet } from "../src/components/PomodoroTodoSheet";
import { WorkHistoryList } from "../src/components/WorkHistoryList";
import {
  PomodoroSettings,
  type PomodoroSettingsDrawer,
  type PomodoroSettingsProps,
} from "../src/components/PomodoroSettings";

/*
 * #2054 — what the Mobile Work screen still lacked after plan A landed: a
 * failed read used to fall through to the empty state ("nothing to link" /
 * "no sessions yet"), the drawer's settings card sat under the Desktop
 * panel's title instead of the plan's 「時間」, and the drawer's save button
 * carried a fourth motion. jsdom has no layout, so sizes and motion are read
 * as classes.
 */

const ICON_STEP = /(^|\s)size-lumen-icon-(sm|md|lg)(\s|$)/;
function iconsOffTheSteps(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll("svg.lucide")).filter(
    (icon) => !ICON_STEP.test(icon.getAttribute("class") ?? ""),
  );
}

const failure = {
  loadFailedTitle: "Couldn't load what you can link",
  loadFailedBody: "Check your connection and try again.",
  retry: "Try again",
};

describe("PomodoroTodoSheet failed read (#2054)", () => {
  const labels = {
    title: "Link your work",
    close: "Close",
    clearSelection: "Clear selection",
    emptyHint: "Type a name above to start a free session.",
    emptyTitle: "Nothing to link yet",
    todoHeading: "Todo",
    eventHeading: "Events",
    nameLabel: "Free session name",
    namePlaceholder: "Free session",
    nameSubmit: "Work under this name",
    ...failure,
  };

  it("says the read failed instead of claiming there is nothing to link", () => {
    const onRetry = vi.fn();
    render(
      <PomodoroTodoSheet
        open
        onClose={vi.fn()}
        items={[]}
        selectedId={null}
        labels={labels}
        onSelect={vi.fn()}
        loadFailed
        onRetry={onRetry}
        freeSessionName=""
        onNameSubmit={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Couldn't load what you can link",
    );
    expect(screen.queryByText("Nothing to link yet")).not.toBeInTheDocument();
    // A free session needs no list, so the name field stays.
    expect(screen.getByLabelText("Free session name")).toBeInTheDocument();
    const retry = within(dialog).getByRole("button", { name: "Try again" });
    expect(retry).toHaveClass("min-h-11");
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    const close = within(dialog).getByRole("button", { name: "Close" });
    expect(
      iconsOffTheSteps(dialog).filter((icon) => !close.contains(icon)),
    ).toEqual([]);
  });

  it("keeps the rows it has when a refetch fails", () => {
    render(
      <PomodoroTodoSheet
        open
        onClose={vi.fn()}
        items={[{ id: "t1", title: "Weekly review", kind: "todo" }]}
        selectedId={null}
        labels={labels}
        onSelect={vi.fn()}
        loadFailed
        onRetry={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Weekly review" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("work-load-failed")).not.toBeInTheDocument();
  });

  it("falls back to the empty state when the host offers no retry", () => {
    render(
      <PomodoroTodoSheet
        open
        onClose={vi.fn()}
        items={[]}
        selectedId={null}
        labels={labels}
        onSelect={vi.fn()}
        loadFailed
      />,
    );
    expect(screen.getByText("Nothing to link yet")).toBeInTheDocument();
    expect(screen.queryByTestId("work-load-failed")).not.toBeInTheDocument();
  });
});

describe("WorkHistoryList failed read (#2054)", () => {
  const labels = {
    heading: "Today",
    empty: "Finish one session and it shows up here.",
    emptyTitle: "No sessions yet",
    noTarget: "Free session",
    listLabel: "History",
    ...failure,
  };

  it("says the read failed on the rows variant, with a retry", () => {
    const onRetry = vi.fn();
    render(
      <WorkHistoryList
        variant="rows"
        entries={[]}
        labels={labels}
        loadFailed
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Check your connection and try again.",
    );
    expect(screen.queryByText("No sessions yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(iconsOffTheSteps(document.body)).toEqual([]);
  });

  it("leaves the Desktop card variant as it was", () => {
    render(
      <WorkHistoryList
        entries={[]}
        labels={labels}
        loadFailed
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("work-load-failed")).not.toBeInTheDocument();
    expect(
      screen.getByText("Finish one session and it shows up here."),
    ).toBeInTheDocument();
  });

  it("disables the retry and says it is loading while a retry runs", () => {
    render(
      <WorkHistoryList
        variant="rows"
        entries={[]}
        labels={{ ...labels, retrying: "Loading…" }}
        loadFailed
        onRetry={vi.fn()}
        retrying
      />,
    );
    const button = screen.getByRole("button", { name: "Loading…" });
    expect(button).toBeDisabled();
    // The live region carries the two lines, not the button's name.
    expect(screen.getByRole("status")).not.toHaveTextContent("Loading…");
  });

  it("keeps no transition on the retry button (plan A's three motions)", () => {
    render(
      <WorkHistoryList
        variant="rows"
        entries={[]}
        labels={labels}
        loadFailed
        onRetry={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Try again" }).className,
    ).not.toMatch(/transition/);
  });
});

describe("PomodoroSettings drawer heading and save button (#2054)", () => {
  const drawer: PomodoroSettingsDrawer = {
    short: {
      workDuration: "Work",
      breakDuration: "Break",
      longBreakDuration: "Long break",
      sessionsBeforeLongBreak: "Until long break",
      targetSessions: "Daily goal",
    },
    formatValue: (_key, value) => `${value}`,
    decrease: (label) => `Decrease ${label}`,
    increase: (label) => `Increase ${label}`,
    applied: "Applied",
    presetSummary: (p) => `${p.workDuration}/${p.breakDuration}`,
    timeHeading: "Time",
  };

  function renderSettings(overrides?: Partial<PomodoroSettingsProps>) {
    const props: PomodoroSettingsProps = {
      workDurationMinutes: 25,
      breakDurationMinutes: 5,
      longBreakDurationMinutes: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      targetSessions: 4,
      presets: [],
      labels: {
        settingsHeading: "Pomodoro settings",
        workDuration: "Work duration",
        breakDuration: "Break duration",
        longBreakDuration: "Long break duration",
        sessionsPerSet: "Sessions per set",
        targetSessions: "Target",
        autoStartBreaks: "Start breaks automatically",
        presets: "Presets",
        presetsEmpty: "No presets",
        presetNamePlaceholder: "Preset name",
        saveAsPreset: "Save",
        apply: "Apply",
        deletePreset: "Delete preset",
        emptyValueConfirm: "OK",
        save: "Save settings",
        saved: "Saved",
        unsaved: "Unsaved",
      },
      onSaveSettings: vi.fn(),
      onAutoStartBreaksChange: vi.fn(),
      onApplyPreset: vi.fn(),
      onCreatePreset: vi.fn(),
      onDeletePreset: vi.fn(),
      formatEmptyValueMessage: (f) => f,
      ...overrides,
    };
    render(<PomodoroSettings {...props} />);
  }

  it("heads the stepper card with the plan's 「時間」", () => {
    renderSettings({ drawer });
    expect(screen.getByRole("heading", { name: "Time" })).toBeInTheDocument();
    expect(screen.queryByText("Pomodoro settings")).not.toBeInTheDocument();
  });

  it("falls back to the panel title when the host gives no time heading", () => {
    renderSettings({ drawer: { ...drawer, timeHeading: undefined } });
    expect(
      screen.getByRole("heading", { name: "Pomodoro settings" }),
    ).toBeInTheDocument();
  });

  it("drops the save button's transition in the drawer only", () => {
    renderSettings({ drawer });
    const save = screen.getByRole("button", { name: "Save settings" });
    expect(save.className).not.toMatch(/transition/);
    expect(save).toHaveClass("min-h-11");
  });

  it("keeps the Desktop save button's transition", () => {
    renderSettings();
    expect(screen.getByRole("button", { name: "Save settings" })).toHaveClass(
      "transition-colors",
    );
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  PomodoroTimer,
  type PomodoroTimerProps,
} from "../src/components/PomodoroTimer";
import { SessionCompletionModal } from "../src/components/SessionCompletionModal";
import { PomodoroTodoSheet } from "../src/components/PomodoroTodoSheet";
import {
  PomodoroSettings,
  type PomodoroSettingsDrawer,
  type PomodoroSettingsProps,
} from "../src/components/PomodoroSettings";
import { WorkHistoryList } from "../src/components/WorkHistoryList";
import { WorkTagSelector } from "../src/components/WorkTagSelector";

/*
 * #2054 — the Mobile Work screen rebuilt after Claude Design plan A. Each
 * shared part grew a mobile shape behind a prop (`variant` / `drawer` /
 * `sheet`), so what this pins is the states the plan draws: the timer face's
 * paused readout and labelled transport, the completion modal's chip and
 * break fill, the picker's groups / skeleton / empty state, the drawer's
 * steppers and "applied" preset, and the history's flat rows. The Desktop
 * shapes are pinned by their own suites, which this change left untouched.
 *
 * jsdom has no layout (rules/frontend.md), so sizes are read as classes.
 */

const TIMER_LABELS: PomodoroTimerProps["labels"] = {
  phase: { WORK: "Work", BREAK: "Break", LONG_BREAK: "Long Break" },
  start: "Start",
  pause: "Pause",
  resume: "Resume",
  reset: "Reset",
  skip: "Skip",
  paused: "Paused",
  subtractFive: "-5 min",
  addFive: "+5 min",
  sessionsProgress: "Today 2 / 4 sessions",
};

function renderFace(overrides?: Partial<PomodoroTimerProps>) {
  const props: PomodoroTimerProps = {
    variant: "fullscreen",
    phase: "WORK",
    isRunning: true,
    formatted: "17:42",
    totalFormatted: "25:00",
    progress: 30,
    sessions: { total: 4, filled: 2 },
    labels: TIMER_LABELS,
    onStart: vi.fn(),
    onPause: vi.fn(),
    onReset: vi.fn(),
    onSkip: vi.fn(),
    onAdjust: vi.fn(),
    ...overrides,
  };
  return { ...render(<PomodoroTimer {...props} />), props };
}

describe("PomodoroTimer fullscreen face (#2054)", () => {
  it("shows '/ 25:00' under the readout while running", () => {
    renderFace();
    expect(screen.getByText("/ 25:00")).toBeInTheDocument();
    expect(screen.queryByText("Paused")).not.toBeInTheDocument();
    // One line for the dots and the count.
    expect(screen.getByText("Today 2 / 4 sessions")).toBeInTheDocument();
  });

  it("swaps the total for the paused mark, and keeps the ±5 pills at 44px", () => {
    renderFace({ isRunning: false });
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.queryByText("/ 25:00")).not.toBeInTheDocument();
    for (const name of ["-5 min", "+5 min"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("min-h-11");
    }
    expect(screen.getByRole("button", { name: "Resume" })).toHaveTextContent(
      "Resume",
    );
  });

  it("draws the readout one span per character, and speaks it whole", () => {
    renderFace();
    const readout = screen.getByTestId("pomodoro-readout");
    expect(readout).toHaveAttribute("aria-hidden", "true");
    expect(Array.from(readout.children).map((c) => c.textContent)).toEqual([
      "1",
      "7",
      ":",
      "4",
      "2",
    ]);
    // The digit fade is a CSS animation, so reduced motion lands it at once.
    expect(readout.children[0]).toHaveClass("lumen-digit-in");
    expect(screen.getByText("17:42")).toHaveAttribute("aria-live", "polite");
  });

  it("puts the phase glyph in the badge instead of a second paused chip", () => {
    const { container } = renderFace({ isRunning: false });
    // Only one pill on the face — the phase; "paused" lives on the readout.
    expect(container.querySelectorAll(".rounded-full.px-3").length).toBe(1);
  });

  it("fires the transport handlers from the labelled columns", () => {
    const { props } = renderFace();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(props.onPause).toHaveBeenCalledOnce();
    expect(props.onReset).toHaveBeenCalledOnce();
    expect(props.onSkip).toHaveBeenCalledOnce();
  });
});

describe("SessionCompletionModal mobile variant (#2054)", () => {
  function renderModal(breakPhase: "BREAK" | "LONG_BREAK" = "BREAK") {
    const onStartBreak = vi.fn();
    render(
      <SessionCompletionModal
        open
        variant="mobile"
        onClose={vi.fn()}
        sessions={{ total: 4, filled: 3 }}
        labels={{
          title: "Session 3 complete",
          body: "unused on mobile",
          startBreak: "Start a 5-min break",
          oneMore: "One more session",
          close: "Close",
          logged: "Logged 25 min",
        }}
        target={{ kind: "todo", title: "Collect the tax papers" }}
        breakPhase={breakPhase}
        onStartBreak={onStartBreak}
        onOneMore={vi.fn()}
      />,
    );
    return onStartBreak;
  }

  it("shows the minutes on their own line and the target as a chip", () => {
    renderModal();
    expect(screen.getByText("Logged 25 min")).toBeInTheDocument();
    expect(screen.getByText("Collect the tax papers")).toBeInTheDocument();
    expect(screen.queryByText("unused on mobile")).not.toBeInTheDocument();
  });

  it("fills the break button with the colour of the break it starts", () => {
    const onStartBreak = renderModal();
    const button = screen.getByRole("button", { name: "Start a 5-min break" });
    expect(button).toHaveClass(
      "bg-lumen-accent-secondary",
      "text-lumen-on-vivid",
    );
    fireEvent.click(button);
    expect(onStartBreak).toHaveBeenCalledOnce();
  });

  it("uses the long-break amber after a set", () => {
    renderModal("LONG_BREAK");
    expect(
      screen.getByRole("button", { name: "Start a 5-min break" }),
    ).toHaveClass("bg-lumen-phase-long-break");
  });
});

describe("PomodoroTodoSheet plan A states (#2054)", () => {
  const labels = {
    title: "Link your work",
    close: "Close",
    clearSelection: "Clear selection",
    emptyHint: "Type a name above to start a free session.",
    emptyTitle: "Nothing to link yet",
    todoHeading: "Todo",
    eventHeading: "Events",
  };

  it("groups todos and events under their own headings, clear row last", () => {
    render(
      <PomodoroTodoSheet
        open
        onClose={vi.fn()}
        items={[
          { id: "t1", title: "Weekly review", kind: "todo" },
          {
            id: "e1",
            title: "Read aloud",
            kind: "event",
            subtitle: "Today 19:30",
          },
        ]}
        selectedId="t1"
        labels={labels}
        onSelect={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    const headings = within(dialog)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Todo", "Events"]);
    const buttons = within(dialog).getAllByRole("button");
    expect(buttons.at(-1)).toHaveTextContent("Clear selection");
    expect(
      within(dialog).getByRole("button", { name: "Weekly review" }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("shows skeleton rows while loading", () => {
    render(
      <PomodoroTodoSheet
        open
        loading
        onClose={vi.fn()}
        items={[]}
        selectedId={null}
        labels={labels}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("work-target-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Nothing to link yet")).not.toBeInTheDocument();
  });

  it("shows the icon, heading and line when there is nothing to link", () => {
    render(
      <PomodoroTodoSheet
        open
        onClose={vi.fn()}
        items={[]}
        selectedId={null}
        labels={labels}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Nothing to link yet")).toBeInTheDocument();
    expect(
      screen.getByText("Type a name above to start a free session."),
    ).toBeInTheDocument();
  });
});

describe("PomodoroSettings drawer layout (#2054)", () => {
  const drawer: PomodoroSettingsDrawer = {
    short: {
      workDuration: "Work",
      breakDuration: "Break",
      longBreakDuration: "Long break",
      sessionsBeforeLongBreak: "Until long break",
      targetSessions: "Daily goal",
    },
    formatValue: (key, value) =>
      key === "sessionsBeforeLongBreak" || key === "targetSessions"
        ? `${value}x`
        : `${value} min`,
    decrease: (label) => `Decrease ${label}`,
    increase: (label) => `Increase ${label}`,
    applied: "Applied",
    presetSummary: (p) => `${p.workDuration}/${p.breakDuration}`,
  };

  function renderDrawer(overrides?: Partial<PomodoroSettingsProps>) {
    const props: PomodoroSettingsProps = {
      workDurationMinutes: 25,
      breakDurationMinutes: 5,
      longBreakDurationMinutes: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      targetSessions: 4,
      presets: [
        {
          id: 1,
          name: "Standard",
          workDuration: 25,
          breakDuration: 5,
          longBreakDuration: 15,
          sessionsBeforeLongBreak: 4,
        },
        {
          id: 2,
          name: "Deep",
          workDuration: 50,
          breakDuration: 10,
          longBreakDuration: 20,
          sessionsBeforeLongBreak: 3,
        },
      ],
      labels: {
        settingsHeading: "Timer",
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
      drawer,
      ...overrides,
    };
    render(<PomodoroSettings {...props} />);
    return props;
  }

  it("steps a value into the draft and saves it once, with the save button", () => {
    const props = renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Increase Work" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Break" }));
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(props.onSaveSettings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(props.onSaveSettings).toHaveBeenCalledTimes(1);
    expect(props.onSaveSettings).toHaveBeenCalledWith({
      workDuration: 30,
      breakDuration: 6,
    });
  });

  it("disables the − at the minimum", () => {
    renderDrawer({ breakDurationMinutes: 1 });
    expect(
      screen.getByRole("button", { name: "Decrease Break" }),
    ).toBeDisabled();
  });

  it("gives every stepper a 44px target", () => {
    renderDrawer();
    for (const name of ["Decrease Work", "Increase Daily goal"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("h-11", "w-11");
    }
  });

  it("marks the preset that matches the saved values as applied", () => {
    const props = renderDrawer();
    expect(screen.getByText("Applied")).toBeInTheDocument();
    // Only the other preset offers Apply.
    const apply = screen.getAllByRole("button", { name: "Apply" });
    expect(apply).toHaveLength(1);
    fireEvent.click(apply[0]);
    expect(props.onApplyPreset).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
    );
  });

  it("makes the whole auto-start row the switch", () => {
    const props = renderDrawer();
    const sw = screen.getByRole("switch", {
      name: "Start breaks automatically",
    });
    expect(sw).toHaveClass("min-h-13");
    fireEvent.click(sw);
    expect(props.onAutoStartBreaksChange).toHaveBeenCalledWith(true);
  });
});

describe("WorkHistoryList rows variant (#2054)", () => {
  const labels = {
    heading: "Today",
    empty: "Finish one session and it shows up here.",
    emptyTitle: "No sessions yet",
    noTarget: "Free session",
    listLabel: "History",
  };

  it("draws one flat row per session with duration · time", () => {
    render(
      <WorkHistoryList
        variant="rows"
        labels={labels}
        entries={[
          {
            id: "1",
            timeRange: "09:10–09:35",
            durationLabel: "25 min",
            target: { kind: "todo", title: "Collect the tax papers" },
            tags: [],
          },
          {
            id: "2",
            timeRange: "21:40–22:05",
            durationLabel: "25 min",
            target: null,
            tags: [],
          },
        ]}
      />,
    );
    const rows = screen.getAllByTestId("work-history-row");
    expect(rows[0]).toHaveTextContent("Collect the tax papers");
    expect(rows[0]).toHaveTextContent("25 min · 09:10–09:35");
    expect(rows[1]).toHaveTextContent("Free session");
  });

  it("shows the icon empty state", () => {
    render(<WorkHistoryList variant="rows" labels={labels} entries={[]} />);
    const empty = screen.getByTestId("work-history-empty");
    expect(empty).toHaveTextContent("No sessions yet");
    expect(empty).toHaveTextContent("Finish one session and it shows up here.");
  });
});

describe("WorkTagSelector sheet row (#2054)", () => {
  const labels = {
    heading: "Tags",
    add: "Add a tag",
    addShort: "Tag",
    search: "Search",
    create: (n: string) => `Create ${n}`,
    remove: (n: string) => `Remove ${n}`,
    noCandidates: "No tags",
    dialog: "Free session tags",
    disabledHint: "Clear the work name to use tags.",
    addRow: "Add tags",
    disabledRow: "Tags are off while work is linked",
  };

  it("says why it is off, in words, while a target is linked", () => {
    render(
      <WorkTagSelector
        tags={[]}
        selectedIds={[]}
        onChange={vi.fn()}
        onCreate={vi.fn()}
        labels={labels}
        sheet={{ closeLabel: "Close" }}
        disabled
      />,
    );
    const button = screen.getByRole("button", { name: "Add a tag" });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Tags are off while work is linked");
    expect(button).toHaveAccessibleDescription(
      "Tags are off while work is linked",
    );
  });

  it("is a full-width 44px row while live", () => {
    render(
      <WorkTagSelector
        tags={[]}
        selectedIds={[]}
        onChange={vi.fn()}
        onCreate={vi.fn()}
        labels={labels}
        sheet={{ closeLabel: "Close" }}
      />,
    );
    expect(screen.getByTestId("work-tag-selector")).toHaveClass(
      "w-full",
      "min-h-11",
    );
    // The visible text is the name (WCAG 2.5.3), so a voice command that
    // reads the row out reaches it.
    expect(screen.getByRole("button", { name: "Add tags" })).toBeEnabled();
  });

  it("gives a chosen pill's remove X a 44px square", () => {
    render(
      <WorkTagSelector
        tags={[{ id: "t1", name: "writing", color: null }]}
        selectedIds={["t1"]}
        onChange={vi.fn()}
        onCreate={vi.fn()}
        labels={labels}
        sheet={{ closeLabel: "Close" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Remove writing" })).toHaveClass(
      "min-h-11",
      "min-w-11",
    );
    expect(screen.getByRole("button", { name: "Add tags" })).toHaveClass(
      "min-w-24",
    );
  });
});

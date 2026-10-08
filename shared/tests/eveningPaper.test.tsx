import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { EveningView, type EveningViewProps } from "../src/components";
import { EVENING_LABELS, emptyEveningBlocks } from "./helpers/eveningFixtures";

/*
 * The rebuilt evening paper (#2107, plan Step 8) — the pure view's half.
 * The host half (what is read, what is written, and that opening writes
 * nothing) is web/tests/briefingEveningRebuild.test.tsx.
 */

function renderPaper(props: Partial<EveningViewProps> = {}) {
  return render(
    <EveningView
      loading={false}
      dateLine="2026-07-25"
      mood={null}
      onSelectMood={vi.fn()}
      editorSlot={<div>editor</div>}
      focusText=""
      onFocusChange={vi.fn()}
      onFocusBlur={vi.fn()}
      todos={[]}
      onSetTodoStatus={vi.fn()}
      schedule={[]}
      labels={EVENING_LABELS}
      {...emptyEveningBlocks()}
      {...props}
    />,
  );
}

const progress = (done: number, total: number, achieved = false) => ({
  done,
  total,
  achieved,
  connected: true,
});

const region = (name: string) => screen.getByRole("region", { name });

describe("the evening paper with nothing in it (#2107)", () => {
  it("draws no empty frame — every block says what it is and that it is empty", () => {
    const { container } = renderPaper();
    for (const el of container.querySelectorAll("section, ul, header, p")) {
      const hasText = (el.textContent ?? "").trim() !== "";
      const hasControl = el.querySelector("input, textarea, button") !== null;
      expect(hasText || hasControl).toBe(true);
    }
    expect(container.querySelectorAll("ul")).toHaveLength(0);
    // No issue line on a day before the first issue.
    expect(screen.queryByText(/No\./)).toBeNull();
    for (const empty of [
      EVENING_LABELS.noGoals,
      EVENING_LABELS.noEvents,
      EVENING_LABELS.noTomorrow,
      EVENING_LABELS.noTodos,
      EVENING_LABELS.noUpcoming,
    ]) {
      expect(screen.getByText(empty)).toBeTruthy();
    }
  });

  it("orders the blocks as the plan does, with 明日の自分へ last", () => {
    const { container } = renderPaper();
    const names = [...container.querySelectorAll("section")].map(
      (s) =>
        container.ownerDocument.getElementById(
          s.getAttribute("aria-labelledby") ?? "",
        )?.textContent,
    );
    expect(names).toEqual([
      EVENING_LABELS.moodTitle,
      EVENING_LABELS.goalsTitle,
      EVENING_LABELS.eventsTitle,
      EVENING_LABELS.reflectionTitle,
      EVENING_LABELS.tomorrowTitle,
      EVENING_LABELS.todosTitle,
      EVENING_LABELS.upcomingTitle,
      EVENING_LABELS.focusTitle,
    ]);
  });
});

describe("masthead issue line", () => {
  it("prints the host's line under the nameplate without renaming it", () => {
    renderPaper({ issueLine: "Evening No. 42 · 5-day streak" });
    const header = screen.getByRole("banner");
    expect(
      within(header).getByText("Evening No. 42 · 5-day streak"),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: EVENING_LABELS.masthead }),
    ).toBeTruthy();
  });
});

describe("goals moved today", () => {
  it("prints before (tertiary) → after, and a worded chip for each state", () => {
    renderPaper({
      goalMoves: [
        {
          goalId: "w-plan",
          title: "企画書を通す",
          periodKind: "week",
          before: progress(2, 4),
          after: progress(3, 4),
        },
        {
          goalId: "w-book",
          title: "本を読み切る",
          periodKind: "week",
          before: progress(1, 2),
          after: progress(2, 2, true),
        },
      ],
    });
    const goals = region(EVENING_LABELS.goalsTitle);
    expect(within(goals).getByText("2/4").className).toContain(
      "text-lumen-text-tertiary",
    );
    expect(within(goals).getByText("3/4")).toBeTruthy();
    const remaining = within(goals).getByText("1 to go");
    expect(remaining.className).toContain("bg-lumen-briefing-shu-subtle");
    expect(remaining.className).toContain("text-lumen-briefing-shu");
    const achieved = within(goals).getByText("Achieved");
    expect(achieved.className).toContain("bg-lumen-chip-mint-bg");
    expect(achieved.className).toContain("text-lumen-chip-mint-fg");
    expect(achieved.querySelector("svg")?.getAttribute("class")).toContain(
      "text-lumen-accent-secondary",
    );
  });

  it("is left out while the goals load, rather than saying「none」", () => {
    renderPaper({ goalMoves: null });
    expect(
      screen.queryByRole("region", { name: EVENING_LABELS.goalsTitle }),
    ).toBeNull();
    expect(screen.queryByText(EVENING_LABELS.noGoals)).toBeNull();
  });
});

describe("what happened today — one-line notes", () => {
  const events: EveningViewProps["events"] = [
    {
      key: "todo:t1",
      kind: "todo",
      title: "企画書の初稿",
      startTime: "11:28",
      endTime: null,
      note: null,
    },
    {
      key: "session:7",
      kind: "session",
      title: null,
      startTime: "09:30",
      endTime: "11:20",
      note: "集中できた",
    },
  ];

  it("prints the time, the kind and the title of each row, and the summary", () => {
    renderPaper({
      events,
      eventsSummary: "3 events · Todos 2/4 · 1 hr worked",
    });
    const block = region(EVENING_LABELS.eventsTitle);
    expect(within(block).getByText("11:28")).toBeTruthy();
    expect(within(block).getByText("09:30–11:20")).toBeTruthy();
    expect(within(block).getByText("企画書の初稿")).toBeTruthy();
    expect(
      within(block).getByText("3 events · Todos 2/4 · 1 hr worked"),
    ).toBeTruthy();
    // A nameless session reads「Work」once and its note is its edit button.
    expect(
      within(block).getByRole("button", {
        name: "集中できた",
        description: "Edit the note: 09:30–11:20 Work",
      }).textContent,
    ).toBe("集中できた");
  });

  it("saves on Enter, not on the IME's confirming Enter, not on Esc", () => {
    const onSaveEventNote = vi.fn();
    renderPaper({ events, onSaveEventNote });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Add a note: 11:28 Done 企画書の初稿",
      }),
    );
    const field = screen.getByRole("textbox", {
      name: "Add a note: 11:28 Done 企画書の初稿",
    });
    fireEvent.change(field, { target: { value: "思ったより早い" } });
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(onSaveEventNote).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSaveEventNote).toHaveBeenCalledWith("todo:t1", "思ったより早い");
    expect(onSaveEventNote).toHaveBeenCalledTimes(1);
  });

  it("throws the draft away on Esc", () => {
    const onSaveEventNote = vi.fn();
    renderPaper({ events, onSaveEventNote });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Add a note: 11:28 Done 企画書の初稿",
      }),
    );
    const field = screen.getByRole("textbox", {
      name: "Add a note: 11:28 Done 企画書の初稿",
    });
    fireEvent.change(field, { target: { value: "やめた" } });
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.blur(field);
    expect(onSaveEventNote).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: /Add a note/ })).toBeNull();
  });

  it("writes nothing when a field is opened and left unchanged", () => {
    const onSaveEventNote = vi.fn();
    renderPaper({ events, onSaveEventNote });
    fireEvent.click(
      screen.getByRole("button", {
        description: "Edit the note: 09:30–11:20 Work",
      }),
    );
    fireEvent.blur(
      screen.getByRole("textbox", { name: "Edit the note: 09:30–11:20 Work" }),
    );
    expect(onSaveEventNote).not.toHaveBeenCalled();
  });
});

describe("put on tomorrow", () => {
  const candidate = {
    id: "t-plan",
    title: "企画書を直す",
    goalTitle: "企画書を通す",
    placed: null,
  };

  it("puts a todo on tomorrow all-day, or at the time given", () => {
    const onPlaceTomorrow = vi.fn();
    renderPaper({ tomorrowTodos: [candidate], onPlaceTomorrow });
    expect(screen.getByText("企画書を通す").className).toContain(
      "text-lumen-text-tertiary",
    );
    const put = screen.getByRole("button", {
      name: "Put on tomorrow: 企画書を直す 企画書を通す",
    });
    fireEvent.click(put);
    expect(onPlaceTomorrow).toHaveBeenLastCalledWith("t-plan", null);
    fireEvent.change(
      screen.getByLabelText("Time (optional): 企画書を直す 企画書を通す"),
      {
        target: { value: "09:00" },
      },
    );
    fireEvent.click(put);
    expect(onPlaceTomorrow).toHaveBeenLastCalledWith("t-plan", "09:00");
  });

  it("names two rows with the same title apart by the goal they serve", () => {
    renderPaper({
      tomorrowTodos: [
        candidate,
        { ...candidate, id: "t-plan-2", goalTitle: "予算を通す" },
      ],
    });
    expect(
      screen.getByRole("button", {
        name: "Put on tomorrow: 企画書を直す 予算を通す",
      }),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Time (optional): 企画書を直す 予算を通す"),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /^Put on tomorrow: / }),
    ).toHaveLength(2);
  });

  it("shows where a placed row went instead of its button", () => {
    renderPaper({
      tomorrowTodos: [{ ...candidate, placed: { time: "09:00" } }],
    });
    expect(screen.getByText("Tomorrow 09:00")).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "Put on tomorrow: 企画書を直す 企画書を通す",
      }),
    ).toBeNull();
  });
});

describe("Daily に移動", () => {
  it("opens the day's Daily", () => {
    const onOpenDaily = vi.fn();
    renderPaper({ onOpenDaily });
    fireEvent.click(
      screen.getByRole("button", { name: EVENING_LABELS.openDailyLabel }),
    );
    expect(onOpenDaily).toHaveBeenCalledTimes(1);
  });

  it("is not drawn on a host that cannot navigate", () => {
    renderPaper();
    expect(screen.queryByText(EVENING_LABELS.openDaily)).toBeNull();
  });
});

describe("the reflection frame (#2107)", () => {
  it("is opaque, height-capped and scrolls inside", () => {
    renderPaper({ editorSlot: <div>editor body</div> });
    const frame = screen.getByText("editor body").parentElement!;
    expect(frame.className).toContain("bg-lumen-bg");
    expect(frame.className).toContain("overflow-y-auto");
    expect(frame.className).toContain("max-h-[60vh]");
    // Not a token: it fell through to a transparent frame.
    expect(frame.className).not.toContain("bg-lumen-surface");
  });
});

describe("the new controls meet the 44px floor below md only", () => {
  it("floors every button and field the #2107 blocks add", () => {
    renderPaper({
      events: [
        {
          key: "event:e1",
          kind: "event",
          title: "歯科検診",
          startTime: "14:00",
          endTime: null,
          note: "混んでいた",
        },
        {
          key: "todo:t1",
          kind: "todo",
          title: "初稿",
          startTime: "11:28",
          endTime: null,
          note: null,
        },
      ],
      tomorrowTodos: [
        { id: "t", title: "直す", goalTitle: null, placed: null },
      ],
      onOpenDaily: vi.fn(),
    });
    const controls = [
      screen.getByRole("button", {
        description: "Edit the note: 14:00 歯科検診",
      }),
      screen.getByRole("button", { name: "Add a note: 11:28 Done 初稿" }),
      screen.getByRole("button", { name: "Put on tomorrow: 直す" }),
      screen.getByLabelText("Time (optional): 直す"),
      screen.getByRole("button", { name: EVENING_LABELS.openDailyLabel }),
    ];
    for (const el of controls) {
      expect(el.className).toContain("max-md:min-h-11");
      expect(el.className.split(/\s+/)).not.toContain("min-h-11");
    }
    // The saved note is its own edit button and is as wide as its text, so a
    // one-character note needs the width floor too.
    for (const el of controls.slice(0, 3)) {
      expect(el.className).toContain("max-md:min-w-11");
    }
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GoalPickerField } from "../src/components/briefing/GoalPickerField";
import { goalsForTodoPicker } from "../src/components/briefing/goalLinkPreview";
import { TodoDetailPanel } from "../src/components/TodoDetailPanel";
import {
  ItemCreatePanel,
  type ItemCreatePanelPools,
} from "../src/components/schedule/ItemCreatePanel";
import { SAMPLE_GOALS, sampleState } from "./fixtures/goalLinkState";

/*
 * #2109 — the goal field on the todo's side (design L3 / L4), and the two
 * places the plan put it instead of a stand-alone "edit Todo" screen: the
 * Schedule detail panel (TodoDetailPanel's goals slot) and the create panel.
 */

const LABELS = {
  listLabel: "この Todo がつながる目標",
  periods: { week: "今週", month: "今月", year: "今年" },
  unconnected: "未接続",
  achieved: "達成",
  becomesAchieved: "達成になります",
  losesAchievement: "達成が外れます",
  achievementLost: "達成が外れました",
  previewHeading: "保存すると変わる数字",
  saveFailed: "保存できませんでした",
};

const OFFERED = goalsForTodoPicker(SAMPLE_GOALS, "2026-09-30", []);
const FREE = { id: "t-free", done: false, isDeleted: false };

const goalRow = (name: string) =>
  screen.getByRole("checkbox", { name: new RegExp(`^${name}`) });

describe("GoalPickerField", () => {
  it("groups the goals by period and says each one's progress", () => {
    render(
      <GoalPickerField
        goals={OFFERED}
        snapshot={sampleState()}
        todo={FREE}
        baselineIds={[]}
        selectedIds={[]}
        onChange={() => {}}
        labels={LABELS}
      />,
    );
    expect(screen.getByRole("group", { name: "今週" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "今月" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "今年" })).toBeInTheDocument();
    expect(goalRow("企画書を通す")).toHaveTextContent("2/4");
    expect(goalRow("3 回走る")).toHaveTextContent(LABELS.achieved);
    expect(goalRow("本を 1 冊読み切る")).toHaveTextContent(LABELS.unconnected);
    // Nothing picked yet → no preview frame.
    expect(screen.queryByText(LABELS.previewHeading)).toBeNull();
  });

  it("reports the toggled selection", () => {
    const onChange = vi.fn();
    render(
      <GoalPickerField
        goals={OFFERED}
        snapshot={sampleState()}
        todo={FREE}
        baselineIds={[]}
        selectedIds={["w-book"]}
        onChange={onChange}
        labels={LABELS}
      />,
    );
    fireEvent.click(goalRow("企画書を通す"));
    expect(onChange).toHaveBeenLastCalledWith(["w-book", "w-plan"]);
    fireEvent.click(goalRow("本を 1 冊読み切る"));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("shows, before the save, what a pick does to the goal and its parents", () => {
    render(
      <GoalPickerField
        goals={OFFERED}
        snapshot={sampleState()}
        todo={FREE}
        baselineIds={[]}
        selectedIds={["w-run"]}
        onChange={() => {}}
        labels={LABELS}
      />,
    );
    expect(screen.getByText(LABELS.previewHeading)).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getAllByText(LABELS.losesAchievement)).toHaveLength(3);
  });

  it("carries the S1 / S2 chip and the save failure the host hands it", () => {
    render(
      <GoalPickerField
        goals={OFFERED}
        snapshot={sampleState()}
        todo={FREE}
        baselineIds={[]}
        selectedIds={[]}
        onChange={() => {}}
        lostTitles={["3 回走る"]}
        failed
        labels={LABELS}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      `${LABELS.achievementLost}3 回走る`,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(LABELS.saveFailed);
  });
});

const PANEL_LABELS = {
  titleLabel: "Title",
  statusLabel: "Status",
  saveLabel: "Save",
  savedLabel: "Saved",
  unsavedLabel: "Unsaved",
};

describe("TodoDetailPanel — the goal row (#2109)", () => {
  it("draws no goal caption when the host has nothing to offer", () => {
    render(
      <TodoDetailPanel
        todoId="t-free"
        title="住民票を取りに行く"
        onSave={() => {}}
        goalsLabel="目標"
        {...PANEL_LABELS}
      />,
    );
    expect(screen.queryByText("目標")).toBeNull();
  });

  it("lets the goal draft alone light the save button, and commits on it", () => {
    const onSave = vi.fn();
    render(
      <TodoDetailPanel
        todoId="t-free"
        title="住民票を取りに行く"
        onSave={onSave}
        goalsLabel="目標"
        goalsSlot={<div>goal field</div>}
        goalsDirty
        {...PANEL_LABELS}
      />,
    );
    expect(screen.getByText("目標")).toBeInTheDocument();
    expect(screen.getByText("goal field")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("t-free", {});
  });
});

const CREATE_LABELS = {
  typeLabel: "Item type",
  typeEvent: "Event",
  typeTodo: "Todo",
  title: "Title",
  eventPlaceholder: "Event title",
  todoPlaceholder: "Todo title",
  date: "Date",
  allDay: "All day",
  startTime: "Start",
  endTime: "End",
  addEvent: "Add",
  addEventAndOpen: "Add and edit",
  addTodo: "Add todo",
  placeTodo: "Place",
  sourceLabel: "How to add",
  sourceNew: "New",
  sourceExisting: "From existing",
  searchTodos: "Search todos",
  todoPickerEmpty: "No unscheduled todos",
  todoPickerNoMatch: "No matching todos",
  attachNote: "Attach a note",
  noteSourceLabel: "Note to link",
  noteSourceNew: "New note",
  noteSourceExisting: "Existing note",
  noteTitleLabel: "Note title",
  notePlaceholder: "Note title placeholder",
  searchNotes: "Search notes",
  notePickerEmpty: "No notes yet",
  notePickerNoMatch: "No matching notes",
  noteLinkHint: "Linked to the item you add below.",
  attachedNote: "Linked note",
  clearNote: "Remove the note",
};

function renderCreate(goals: ItemCreatePanelPools["goals"]) {
  render(
    <ItemCreatePanel
      initial={{ date: "2026-09-30" }}
      pools={{ todos: [{ id: "t-free", title: "住民票" }], notes: [], goals }}
      handlers={{
        onSubmitEvent: () => {},
        onSubmitEventAndOpen: () => {},
        onCreateTodo: () => {},
        onPlaceTodo: () => {},
      }}
      labels={CREATE_LABELS}
    />,
  );
}

function goalPool(onStagedChange = vi.fn()) {
  return {
    pool: {
      goals: OFFERED,
      state: sampleState(),
      onStagedChange,
      labels: { ...LABELS, attach: "目標につなぐ", attached: "つなぐ目標" },
    },
    onStagedChange,
  };
}

describe("ItemCreatePanel — the goal section (#2109)", () => {
  it("is offered on the new-todo tab only, folded up", () => {
    const { pool } = goalPool();
    renderCreate(pool);
    expect(screen.queryByRole("button", { name: "目標につなぐ" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Todo" }));
    const trigger = screen.getByRole("button", { name: "目標につなぐ" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "From existing" }));
    expect(screen.queryByRole("button", { name: "目標につなぐ" })).toBeNull();
  });

  it("stages the picked goals, with the preview, and unstages them off the todo tab", () => {
    const { pool, onStagedChange } = goalPool();
    renderCreate(pool);
    fireEvent.click(screen.getByRole("tab", { name: "Todo" }));
    fireEvent.click(screen.getByRole("button", { name: "目標につなぐ" }));
    fireEvent.click(goalRow("企画書を通す"));
    expect(onStagedChange).toHaveBeenLastCalledWith(["w-plan"]);
    // A new, open todo: 2/4 → 2/5.
    expect(screen.getByText("2/5")).toBeInTheDocument();

    // Folded up, the pick is echoed rather than dropped.
    fireEvent.click(screen.getByRole("button", { name: "目標につなぐ" }));
    expect(screen.getByText("つなぐ目標")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Event" }));
    expect(onStagedChange).toHaveBeenLastCalledWith([]);
  });

  it("draws no section without goals to offer", () => {
    renderCreate(undefined);
    fireEvent.click(screen.getByRole("tab", { name: "Todo" }));
    expect(screen.queryByRole("button", { name: "目標につなぐ" })).toBeNull();
    const { pool } = goalPool();
    renderCreate({ ...pool, goals: [] });
    expect(screen.queryByRole("button", { name: "目標につなぐ" })).toBeNull();
  });
});

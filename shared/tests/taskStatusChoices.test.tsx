import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskDetailPanel, TaskStatusChoices } from "../src/components";

/*
 * #470 — the Mobile touch status row, plus TaskDetailPanel's statusControl slot
 * it plugs into. The slot is additive: Desktop (no statusControl) must keep the
 * cycle button, which the last two cases pin down.
 */

const LABELS = {
  statusNotStarted: "Not started",
  statusInProgress: "In progress",
  statusDone: "Done",
};

describe("TaskStatusChoices (#470)", () => {
  it("renders one choice per status inside a labelled group", () => {
    render(
      <TaskStatusChoices
        value="NOT_STARTED"
        onChange={() => {}}
        labels={LABELS}
        label="Change status"
      />,
    );
    const group = screen.getByRole("group", { name: "Change status" });
    expect(group).toBeInTheDocument();
    for (const label of Object.values(LABELS)) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("marks only the current status as pressed", () => {
    render(
      <TaskStatusChoices
        value="IN_PROGRESS"
        onChange={() => {}}
        labels={LABELS}
        label="Change status"
      />,
    );
    expect(screen.getByRole("button", { name: "In progress" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Not started" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("sets the tapped status in one tap (no cycling)", () => {
    const onChange = vi.fn();
    render(
      <TaskStatusChoices
        value="NOT_STARTED"
        onChange={onChange}
        labels={LABELS}
        label="Change status"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("DONE");
  });

  it("leaves every choice unpressed when the status is unknown", () => {
    render(
      <TaskStatusChoices
        value={null}
        onChange={() => {}}
        labels={LABELS}
        label="Change status"
      />,
    );
    for (const label of Object.values(LABELS)) {
      expect(screen.getByRole("button", { name: label })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
  });
});

describe("TaskDetailPanel statusControl slot (#470)", () => {
  const PANEL_LABELS = {
    titleLabel: "Task title",
    statusLabel: "Status",
    statusText: "Not started",
  };

  it("replaces the cycle button with the injected control", () => {
    const onToggleStatus = vi.fn();
    render(
      <TaskDetailPanel
        taskId="task-a"
        title="Write the plan"
        status="NOT_STARTED"
        onTitleCommit={() => {}}
        onToggleStatus={onToggleStatus}
        statusControl={<button type="button">status slot</button>}
        {...PANEL_LABELS}
      />,
    );
    expect(screen.getByText("status slot")).toBeInTheDocument();
    // The cycle button is gone — it was the only element carrying the status
    // caption as its accessible name.
    expect(
      screen.queryByRole("button", { name: "Status" }),
    ).not.toBeInTheDocument();
    expect(onToggleStatus).not.toHaveBeenCalled();
  });

  it("keeps the cycle button when no control is injected (Desktop)", () => {
    render(
      <TaskDetailPanel
        taskId="task-a"
        title="Write the plan"
        status="NOT_STARTED"
        onTitleCommit={() => {}}
        onToggleStatus={() => {}}
        {...PANEL_LABELS}
      />,
    );
    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScheduleStatusTag } from "../src/components";

/*
 * ScheduleStatusTag (#222) — the derived-status pill. Read-only <span> by
 * default; a <button> (toggle) when onClick is supplied.
 */

describe("ScheduleStatusTag", () => {
  it("renders the label as a read-only span when no onClick", () => {
    render(<ScheduleStatusTag status="notStarted" label="Not started" />);
    expect(screen.getByText("Not started")).toBeInTheDocument();
    // No interactive element without onClick.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders a button and fires onClick in interactive mode", () => {
    const onClick = vi.fn();
    render(
      <ScheduleStatusTag
        status="inProgress"
        label="In progress"
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "In progress" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("uses ariaLabel as the accessible name when provided", () => {
    render(
      <ScheduleStatusTag
        status="done"
        label="Done"
        ariaLabel="Toggle complete"
        onClick={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Toggle complete" }),
    ).toBeInTheDocument();
  });
});

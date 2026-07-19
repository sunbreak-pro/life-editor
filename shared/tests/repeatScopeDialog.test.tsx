import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  RepeatScopeDialog,
  type RepeatScopeDialogLabels,
} from "../src/components";

/*
 * RepeatScopeDialog (#279) — the this/future/all chooser for editing or
 * deleting a routine-derived occurrence. Pure presentation: labels injected,
 * one callback per choice, centered Modal underneath.
 */

const LABELS: RepeatScopeDialogLabels = {
  title: "Edit recurring event",
  thisOnly: "This event only",
  thisAndFuture: "This and following events",
  all: "All events (including past)",
  cancel: "Cancel",
};

function renderDialog(
  props?: Partial<Parameters<typeof RepeatScopeDialog>[0]>,
) {
  const onChoose = vi.fn();
  const onClose = vi.fn();
  render(
    <RepeatScopeDialog
      open
      mode="edit"
      labels={LABELS}
      onChoose={onChoose}
      onClose={onClose}
      {...props}
    />,
  );
  return { onChoose, onClose };
}

describe("RepeatScopeDialog", () => {
  it("renders nothing when closed", () => {
    renderDialog({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the title and all three scope options", () => {
    renderDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Edit recurring event")).toBeInTheDocument();
    expect(screen.getByText("This event only")).toBeInTheDocument();
    expect(screen.getByText("This and following events")).toBeInTheDocument();
    expect(screen.getByText("All events (including past)")).toBeInTheDocument();
  });

  it("fires onChoose with the picked scope", () => {
    const { onChoose, onClose } = renderDialog();
    fireEvent.click(screen.getByText("This event only"));
    expect(onChoose).toHaveBeenCalledWith("this");
    fireEvent.click(screen.getByText("This and following events"));
    expect(onChoose).toHaveBeenCalledWith("future");
    fireEvent.click(screen.getByText("All events (including past)"));
    expect(onChoose).toHaveBeenCalledWith("all");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("fires onClose (not onChoose) on cancel", () => {
    const { onChoose, onClose } = renderDialog();
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("puts Cancel first in DOM so initial focus lands on the safe choice", () => {
    renderDialog({ mode: "delete" });
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Cancel");
  });
});

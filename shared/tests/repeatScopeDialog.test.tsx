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

  /*
   * #1801: the price of "this and following" in delete mode. The split hands
   * the series' tags to the survivors and an undo does not take them back, so
   * the dialog says it before the press. Attached to that one choice — the
   * other two reverse cleanly and a dialog-wide note would misdescribe them.
   */
  describe("the tag note on 'this and following' (#1801)", () => {
    const NOTE = "Undo brings the repeat back, but not the tags it carried.";

    it("renders nothing extra when the host passes no note", () => {
      renderDialog();
      expect(screen.queryByText(NOTE)).toBeNull();
      expect(screen.getByText("This and following events")).not.toHaveAttribute(
        "aria-describedby",
      );
    });

    it("shows the note and reads it out with that button", () => {
      renderDialog({
        mode: "delete",
        labels: { ...LABELS, thisAndFutureNote: NOTE },
      });

      const option = screen.getByText("This and following events");
      const describedBy = option.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      // The id has to resolve, or a screen reader announces the button alone.
      expect(document.getElementById(describedBy as string)).toHaveTextContent(
        NOTE,
      );
    });

    it("leaves the other two choices undescribed", () => {
      renderDialog({
        mode: "delete",
        labels: { ...LABELS, thisAndFutureNote: NOTE },
      });

      expect(screen.getByText("This event only")).not.toHaveAttribute(
        "aria-describedby",
      );
      expect(
        screen.getByText("All events (including past)"),
      ).not.toHaveAttribute("aria-describedby");
    });

    it("keeps Cancel first in DOM with the note present", () => {
      renderDialog({
        mode: "delete",
        labels: { ...LABELS, thisAndFutureNote: NOTE },
      });
      expect(screen.getAllByRole("button")[0]).toHaveTextContent("Cancel");
    });
  });
});

import { describe, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  RepeatScopeDialog,
  type RepeatScopeDialogLabels,
} from "../src/components";

/*
 * RepeatScopeDialog (#279) — the this/future/all chooser for editing or
 * deleting a routine-derived occurrence. Pure presentation: labels injected,
 * one callback for the confirmed scope, centered Modal underneath.
 *
 * #2567: the scopes are radios and only the confirm button runs anything.
 */

const LABELS: RepeatScopeDialogLabels = {
  title: "Edit recurring event",
  description: "Which events should this apply to?",
  thisOnly: "This event only",
  thisAndFuture: "This and following events",
  all: "All events (including past)",
  cancel: "Cancel",
  confirm: "Save",
};

const THIS = "This event only";
const FUTURE = "This and following events";
const ALL = "All events (including past)";

const radio = (name: string): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>("radio", { name });
const confirmButton = (name = "Save"): HTMLElement =>
  screen.getByRole("button", { name });

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
    const group = screen.getByRole("radiogroup", {
      name: "Which events should this apply to?",
    });
    expect(
      within(group)
        .getAllByRole<HTMLInputElement>("radio")
        .map((r) => r.value),
    ).toEqual(["this", "future", "all"]);
    expect(radio(THIS)).toBeInTheDocument();
    expect(radio(FUTURE)).toBeInTheDocument();
    expect(radio(ALL)).toBeInTheDocument();
  });

  it("starts on 'this event only'", () => {
    renderDialog();
    expect(radio(THIS)).toBeChecked();
    expect(radio(FUTURE)).not.toBeChecked();
    expect(radio(ALL)).not.toBeChecked();
  });

  it("runs nothing when a scope is merely picked", () => {
    const { onChoose, onClose } = renderDialog();
    for (const name of [FUTURE, ALL, THIS]) {
      fireEvent.click(radio(name));
      expect(radio(name)).toBeChecked();
    }
    expect(onChoose).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    [THIS, "this"],
    [FUTURE, "future"],
    [ALL, "all"],
  ] as const)("fires onChoose once for '%s' on confirm", (name, scope) => {
    const { onChoose, onClose } = renderDialog();
    fireEvent.click(radio(name));
    fireEvent.click(confirmButton());
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(scope);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("confirms 'this event only' when no radio was touched", () => {
    const { onChoose } = renderDialog();
    fireEvent.click(confirmButton());
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith("this");
  });

  it("starts back on 'this event only' on the next opening", () => {
    const props = {
      mode: "edit",
      labels: LABELS,
      onChoose: vi.fn(),
      onClose: vi.fn(),
    } as const;
    const { rerender } = render(<RepeatScopeDialog open {...props} />);
    fireEvent.click(radio(ALL));
    rerender(<RepeatScopeDialog open={false} {...props} />);
    rerender(<RepeatScopeDialog open {...props} />);
    expect(radio(THIS)).toBeChecked();
  });

  it("paints the confirm button by mode", () => {
    renderDialog();
    expect(confirmButton()).toHaveClass("bg-lumen-accent");
    cleanup();
    renderDialog({ mode: "delete", labels: { ...LABELS, confirm: "Delete" } });
    expect(confirmButton("Delete")).toHaveClass("bg-lumen-danger");
  });

  it("fires onClose (not onChoose) on cancel", () => {
    const { onChoose, onClose } = renderDialog();
    fireEvent.click(radio(ALL));
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
  });

  // With the corner × present, as the Schedule renders it: that button is
  // first in the panel and would otherwise be what the Modal focuses.
  it("opens with the focus on the safe radio, not on Delete", async () => {
    renderDialog({
      mode: "delete",
      labels: { ...LABELS, confirm: "Delete" },
      closeLabel: "Close",
    });
    expect(radio(THIS)).toHaveFocus();
    // The Modal places its own initial focus a frame later; it must not win.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(radio(THIS)).toHaveFocus();
  });

  // A form around the radios would submit on Enter, and the focus opens on
  // one: the delete would be a single keypress away.
  it("keeps the radios out of any form, so Enter cannot confirm", () => {
    renderDialog({ mode: "delete" });
    expect(radio(THIS).form).toBeNull();
  });

  /*
   * #1801: the price of "this and following" in delete mode. The split hands
   * the series' tags to the survivors and an undo does not take them back, so
   * the dialog says it before the confirm. Attached to that one choice — the
   * other two reverse cleanly and a dialog-wide note would misdescribe them.
   */
  describe("the tag note on 'this and following' (#1801)", () => {
    const NOTE = "Undo brings the repeat back, but not the tags it carried.";

    it("renders nothing extra when the host passes no note", () => {
      renderDialog();
      expect(screen.queryByText(NOTE)).toBeNull();
      expect(radio(FUTURE)).not.toHaveAttribute("aria-describedby");
    });

    it("shows the note and reads it out with that radio", () => {
      renderDialog({
        mode: "delete",
        labels: { ...LABELS, thisAndFutureNote: NOTE },
      });

      // Found by its bare name: the note must not have joined it.
      const describedBy = radio(FUTURE).getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      // The id has to resolve, or a screen reader announces the radio alone.
      expect(document.getElementById(describedBy as string)).toHaveTextContent(
        NOTE,
      );
    });

    it("leaves the other two choices undescribed", () => {
      renderDialog({
        mode: "delete",
        labels: { ...LABELS, thisAndFutureNote: NOTE },
      });

      expect(radio(THIS)).not.toHaveAttribute("aria-describedby");
      expect(radio(ALL)).not.toHaveAttribute("aria-describedby");
    });
  });
});

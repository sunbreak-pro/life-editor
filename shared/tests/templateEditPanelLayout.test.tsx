import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TemplateEditPanel } from "../src/components";
import type { TemplateEditPanelLabels } from "../src/components";

/*
 * #1363 — the template editor was a 512px dialog with a 320px body, opened to
 * write the same kind of prose the note behind it gets a reading column and a
 * 420px floor for. #1180's brief was "a normal note with two differences", and
 * width was not supposed to be one of them.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so none of this measures a pixel. What
 * it pins is the structure the sizing rests on: which width token the panel
 * asks for, which floor the body carries, and — the part a later edit is most
 * likely to undo by accident — that the commit row sits OUTSIDE the scroller
 * rather than at the bottom of a document that can scroll away.
 */

const LABELS: TemplateEditPanelLabels = {
  panelTitle: "Edit template",
  nameLabel: "Name",
  namePlaceholder: "Template name",
  cancel: "Cancel",
  save: "Save",
};

function renderPanel(overrides: Partial<Parameters<typeof TemplateEditPanel>[0]> = {}) {
  const props = {
    open: true,
    name: "Weekly review",
    onNameChange: vi.fn(),
    onCancel: vi.fn(),
    onSave: vi.fn(),
    bodyEditor: (
      <div data-testid="body">
        <div className="note-editor">body</div>
      </div>
    ),
    labels: LABELS,
    ...overrides,
  };
  render(<TemplateEditPanel {...props} />);
  return props;
}

const panel = () => screen.getByRole("dialog");
const scroller = () => screen.getByTestId("body").closest(".overflow-y-auto");

describe("TemplateEditPanel is sized like the note it edits (#1363)", () => {
  it("opens at the reading column, not at a dialog width", () => {
    renderPanel();

    // The same token PageContainer width="reading" hands the page body, so a
    // line of template is as long as a line of note.
    expect(panel()).toHaveClass("max-w-lumen-reading");
    expect(panel()).not.toHaveClass("max-w-lg");
  });

  it("opens at the note column it was measured over (#1471)", () => {
    renderPanel({ columnWidth: 642 });

    /*
     * The token alone was never "the same width as a note": it is what
     * PageContainer hands a width="reading" page, and Materials is
     * width="wide", so a note is as wide as whatever the section column has
     * left — 642px at 1280x800 against this dialog's 818. The measurement
     * closes that, and the token stays on through min() as the ceiling so a
     * wide screen still gets a readable line rather than a 1100px one.
     */
    expect(panel().style.maxWidth).toBe(
      "min(var(--container-lumen-reading), 642px)",
    );
    expect(panel()).toHaveClass("max-w-lumen-reading");
  });

  it("keeps the token alone when there is nothing to measure", () => {
    renderPanel();

    // A host with no column to measure — and jsdom, which has no layout at all
    // — must leave the panel at its class width rather than collapse it.
    expect(panel().style.maxWidth).toBe("");
    expect(panel()).toHaveClass("max-w-lumen-reading");
  });

  it("bounds the panel at the window and lets the body run past it", () => {
    renderPanel();

    // A column capped at the backdrop's box: the height comes from the draft
    // up to that ceiling, and everything over it scrolls inside.
    expect(panel()).toHaveClass("flex", "max-h-full", "flex-col");
    expect(scroller()).toBeTruthy();
  });

  it("gives the body the note detail's 420px floor", () => {
    renderPanel();

    const body = screen.getByTestId("body").parentElement;
    expect(body?.className).toContain("[&_.note-editor]:min-h-[420px]");
  });

  it("keeps Cancel and Save out of the scrolling document", () => {
    renderPanel();

    // The one thing a note does not have is a commit row, so it is the one
    // thing that must stay put while the draft scrolls under it.
    for (const name of ["Cancel", "Save"]) {
      const button = screen.getByRole("button", { name });
      expect(button.closest(".overflow-y-auto")).toBeNull();
      expect(panel().contains(button)).toBe(true);
    }
  });

  it("still commits and discards through the same two buttons", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onSave).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  it("still edits the name through the labelled field", () => {
    const props = renderPanel();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Monthly review" },
    });
    expect(props.onNameChange).toHaveBeenCalledExactlyOnceWith(
      "Monthly review",
    );
  });
});

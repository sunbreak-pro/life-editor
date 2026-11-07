import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TemplateListPanel } from "../src/components";

/*
 * #2032 — the saved-templates list in the Notes drawer. A hold on a row used
 * to select the template's name and raise iOS's callout. The rows keep their
 * pencil + bin (#1180), which the note rows now mirror on narrow; the hold
 * itself answers nothing, on narrow widths and on any pointer that cannot
 * hover.
 */

const LABELS = {
  heading: "Templates",
  empty: "No templates yet",
  untitled: "(untitled template)",
  edit: "Edit template",
  delete: "Delete template",
  loading: "Loading",
};

function renderOpen() {
  render(
    <TemplateListPanel
      templates={[{ id: "tpl-a", title: "Weekly review" }]}
      open
      onToggle={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      labels={LABELS}
    />,
  );
}

describe("TemplateListPanel rows (#2032)", () => {
  it("keeps a hold from selecting the name or raising the callout", () => {
    renderOpen();
    const row = screen.getByText("Weekly review").closest("li")!;
    for (const cls of [
      "max-md:select-none",
      "max-md:[-webkit-touch-callout:none]",
      "[@media(hover:none)]:select-none",
      "[@media(hover:none)]:[-webkit-touch-callout:none]",
    ]) {
      expect(row.classList.contains(cls)).toBe(true);
    }
    // Desktop mouse users can still select the name.
    expect(row.classList.contains("select-none")).toBe(false);
  });

  it("keeps the pencil immediately left of the bin", () => {
    renderOpen();
    const edit = screen.getByRole("button", {
      name: "Edit template: Weekly review",
    });
    const bin = screen.getByRole("button", {
      name: "Delete template: Weekly review",
    });
    expect(edit.nextElementSibling).toBe(bin);
  });
});

describe("TemplateListPanel pinned footer (#2580)", () => {
  it("sticks to the bottom of the sidebar on an opaque fill", () => {
    renderOpen();
    const panel = screen.getByTestId("template-list-panel");
    for (const cls of ["sticky", "bottom-0", "bg-lumen-bg-subsidebar"]) {
      expect(panel.classList.contains(cls)).toBe(true);
    }
  });

  it("marks the heading and every row with the template glyph", () => {
    renderOpen();
    const heading = screen.getByRole("button", { expanded: true });
    expect(
      heading.querySelector('[data-testid="template-heading-icon"]'),
    ).not.toBeNull();
    expect(heading.querySelector("svg.lucide-layout-template")).not.toBeNull();
    const row = screen.getByText("Weekly review").closest("li")!;
    expect(
      row.querySelector('[data-testid="template-row-icon"]'),
    ).not.toBeNull();
  });

  it("opens the rows above the heading", () => {
    renderOpen();
    const heading = screen.getByRole("button", { expanded: true });
    const row = screen.getByText("Weekly review").closest("li")!;
    // DOCUMENT_POSITION_FOLLOWING: the heading comes after the row.
    expect(
      row.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("points the chevron up while closed", () => {
    render(
      <TemplateListPanel
        templates={[{ id: "tpl-a", title: "Weekly review" }]}
        open={false}
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        labels={LABELS}
      />,
    );
    const heading = screen.getByRole("button", { expanded: false });
    expect(heading.querySelector("svg.lucide-chevron-up")).not.toBeNull();
    expect(screen.queryByText("Weekly review")).toBeNull();
  });
});

/*
 * #2625 — a press on the row applies that template to the open note; the
 * pencil and the bin keep their own callbacks.
 */
describe("TemplateListPanel row press (#2625)", () => {
  function renderWithApply(applyDisabledReason?: string) {
    const handlers = { onEdit: vi.fn(), onDelete: vi.fn(), onApply: vi.fn() };
    render(
      <TemplateListPanel
        templates={[{ id: "tpl-a", title: "Weekly review" }]}
        open
        onToggle={vi.fn()}
        {...handlers}
        applyDisabledReason={applyDisabledReason}
        labels={{ ...LABELS, apply: "Apply to the open note" }}
      />,
    );
    return handlers;
  }

  it("calls onApply with the row's id, and the pencil and bin call theirs", () => {
    const { onEdit, onDelete, onApply } = renderWithApply();
    const row = screen.getByRole("button", {
      name: "Apply to the open note: Weekly review",
    });
    expect(row.getAttribute("title")).toBe("Apply to the open note");
    fireEvent.click(row);
    expect(onApply).toHaveBeenCalledExactlyOnceWith("tpl-a");
    expect(onEdit).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Edit template: Weekly review" }),
    );
    expect(onEdit).toHaveBeenCalledExactlyOnceWith("tpl-a");
    fireEvent.click(
      screen.getByRole("button", { name: "Delete template: Weekly review" }),
    );
    expect(onDelete).toHaveBeenCalledExactlyOnceWith("tpl-a");
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("turns the rows off and says why when there is no note to apply to", () => {
    const { onApply } = renderWithApply("Open a note first");
    const row = screen.getByRole("button", {
      name: "Apply to the open note: Weekly review",
    }) as HTMLButtonElement;
    expect(row.disabled).toBe(true);
    expect(screen.getByTestId("template-apply-reason").textContent).toBe(
      "Open a note first",
    );
    fireEvent.click(row);
    expect(onApply).not.toHaveBeenCalled();
    // Editing a template does not need a note.
    expect(
      (
        screen.getByRole("button", {
          name: "Edit template: Weekly review",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});

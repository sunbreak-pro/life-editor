import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  EventEditorPane,
  Modal,
  ResponsiveDetailFrame,
  TodoDetailPanel,
  type EventEditorItem,
  type EventEditorLabels,
} from "../src/components";

/*
 * #2660 — the event and todo editors are one light panel with one outline.
 *
 * The editors drew their own card (border + bg-lumen-bg-secondary) inside the
 * frame's darker, outlined panel, so the dialog showed two nested outlines and
 * a dark band that held only the corner ×. Now a body that has its own Cancel
 * claims the frame: the frame takes the card's colour and draws no ×, and the
 * body drops its card. A body WITHOUT a Cancel (the Briefing goal panel) keeps
 * the × — on a phone a full-height sheet has no Escape and no backdrop to tap.
 *
 * Asserted on classes and roles: jsdom has no layout (CLAUDE.md §7.1), so the
 * look itself is the real-browser step in the DoD.
 */

const EDITOR_LABELS: EventEditorLabels = {
  title: "Title",
  date: "Date",
  allDay: "All-day",
  startTime: "Start",
  endTime: "End",
  memo: "Memo",
  save: "Save",
  originRoutine: "Generated from routine",
  skipThisDay: "Skip this day",
  delete: "Delete",
};

const ITEM: EventEditorItem = {
  id: "m1",
  title: "Dentist",
  date: "2026-11-08",
  isAllDay: false,
  startTime: "09:00",
  endTime: "10:00",
  memo: "",
  isRoutine: false,
};

const TODO_LABELS = {
  titleLabel: "Todo title",
  statusLabel: "Status",
  statusText: "Not started",
  contentLabel: "Notes",
  saveLabel: "Save",
};

type Kind = "event" | "todo";

function editorBody(kind: Kind, onCancel?: () => void) {
  if (kind === "event") {
    return (
      <EventEditorPane
        item={ITEM}
        labels={EDITOR_LABELS}
        handlers={{ onSave: () => {} }}
        cancel={onCancel ? { label: "Cancel", onCancel } : undefined}
        stickyFooter
      />
    );
  }
  return (
    <TodoDetailPanel
      todoId="task-a"
      title="Write the plan"
      status="NOT_STARTED"
      onSave={() => {}}
      onCancel={onCancel}
      cancelLabel={onCancel ? "Cancel" : undefined}
      stickyFooter
      {...TODO_LABELS}
    />
  );
}

function renderFrame(wide: boolean, kind: Kind, withCancel = true) {
  const onClose = vi.fn();
  render(
    <ResponsiveDetailFrame
      wide={wide}
      open
      title="Details"
      closeLabel="Close"
      onClose={onClose}
    >
      {editorBody(kind, withCancel ? onClose : undefined)}
    </ResponsiveDetailFrame>,
  );
  return { onClose, dialog: screen.getByRole("dialog", { name: "Details" }) };
}

const hasClass = (el: Element, cls: string) => el.classList.contains(cls);

/** Every element strictly between the Save button and its dialog. */
function between(dialog: HTMLElement): HTMLElement[] {
  const chain: HTMLElement[] = [];
  const save = screen.getByRole("button", { name: "Save" });
  for (let node = save.parentElement; node && node !== dialog;) {
    chain.push(node);
    node = node.parentElement;
  }
  return chain;
}

const WIDTHS: Array<[string, boolean]> = [
  ["Desktop", true],
  ["Mobile", false],
];
const KINDS: Kind[] = ["event", "todo"];

describe("detail editor in one frame (#2660)", () => {
  describe.each(WIDTHS)("%s", (_name, wide) => {
    it.each(KINDS)("paints the panel itself light (%s)", (kind) => {
      const { dialog } = renderFrame(wide, kind);
      expect(hasClass(dialog, "bg-lumen-bg-secondary")).toBe(true);
      expect(hasClass(dialog, "bg-lumen-bg")).toBe(false);
    });

    it.each(KINDS)("draws no second outline inside it (%s)", (kind) => {
      const { dialog } = renderFrame(wide, kind);
      // The footer keeps its own `border-t` divider; what must be gone is
      // the all-round `border` of the body's card.
      for (const el of between(dialog)) {
        expect(hasClass(el, "border")).toBe(false);
        expect(
          hasClass(el, "bg-lumen-bg-secondary") && hasClass(el, "rounded-md"),
        ).toBe(false);
      }
    });

    it.each(KINDS)("has no corner close button (%s)", (kind) => {
      renderFrame(wide, kind);
      expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    });

    it.each(KINDS)("closes from the footer Cancel (%s)", (kind) => {
      const { onClose } = renderFrame(wide, kind);
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it.each(KINDS)("leaves no band above the body on Desktop (%s)", (kind) => {
    // `pt-6` cleared the corner ×; without the button it would be an empty
    // strip at the top of the panel.
    const { dialog } = renderFrame(true, kind);
    expect(dialog.querySelector(".pt-6")).toBeNull();
  });

  it.each(KINDS)("still closes on Escape on Desktop (%s)", (kind) => {
    const { onClose } = renderFrame(true, kind);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each(WIDTHS)(
    "keeps the × and the dark panel for an editor with no Cancel on %s",
    (_name, wide) => {
      // Without its own exit the body cannot stand in for the ×: a phone's
      // full-height sheet would have no way out at all.
      const { dialog } = renderFrame(wide, "todo", false);
      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
      expect(hasClass(dialog, "bg-lumen-bg")).toBe(true);
    },
  );

  it.each(WIDTHS)(
    "keeps the × for a body that is not an editor on %s",
    (_name, wide) => {
      // The Briefing goal panel's shape: plain content, no Cancel.
      render(
        <ResponsiveDetailFrame
          wide={wide}
          open
          title="Goals"
          closeLabel="Close"
          onClose={() => {}}
        >
          <p>goal list</p>
        </ResponsiveDetailFrame>,
      );
      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
      const dialog = screen.getByRole("dialog", { name: "Goals" });
      expect(hasClass(dialog, "bg-lumen-bg")).toBe(true);
    },
  );

  it.each(KINDS)("keeps its own card outside a frame (%s)", (kind) => {
    const { container } = render(editorBody(kind, () => {}));
    const root = container.firstElementChild as HTMLElement;
    expect(hasClass(root, "border")).toBe(true);
    expect(hasClass(root, "bg-lumen-bg-secondary")).toBe(true);
  });
});

describe("Modal surface (#2660)", () => {
  it("keeps every other Modal on the base colour by default", () => {
    render(
      <Modal open onClose={() => {}} title="Confirm">
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Confirm" });
    expect(hasClass(dialog, "bg-lumen-bg")).toBe(true);
    expect(hasClass(dialog, "bg-lumen-bg-secondary")).toBe(false);
  });

  it("paints the secondary colour only when asked, never both", () => {
    render(
      <Modal open onClose={() => {}} title="Edit" surface="secondary">
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Edit" });
    expect(hasClass(dialog, "bg-lumen-bg-secondary")).toBe(true);
    expect(hasClass(dialog, "bg-lumen-bg")).toBe(false);
    // One outline: the panel's own.
    expect(hasClass(dialog, "border")).toBe(true);
  });
});

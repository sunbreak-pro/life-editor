import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  EventEditorPane,
  TodoDetailPanel,
  type EventEditorItem,
  type EventEditorLabels,
} from "../src/components";

/*
 * #995 — the save footer stays reachable on a narrow sheet.
 *
 * #628 put a save button at the end of both schedule detail bodies. On narrow
 * those bodies are handed to `ResponsiveDetailFrame`, which renders a
 * `fullScreen` BottomSheet whose only scroller wraps the whole child — so a
 * long memo pushed the button below the fold and the user had to scroll to
 * commit an edit they had just finished typing.
 *
 * The fix is one opt-in prop per pane rather than a footer slot on BottomSheet:
 * the sheet's child is the pane's own card, so the row that has to stick is
 * already inside it, and a slot on the sheet would need a matching one on
 * ResponsiveDetailFrame and a reconciliation with ItemDetailOverlay's unrelated
 * `actions` footer.
 *
 * Asserted on the class, not on geometry: jsdom has no layout (CLAUDE.md §7.1),
 * so every element here measures 0 and nothing can prove the row is actually
 * pinned — that is the DoD's separate browser step. What a class assertion CAN
 * catch is the regression that would actually happen: the utility silently not
 * written (`cn` is plain concatenation — rules/frontend.md §Gotchas), or the
 * prop wired the wrong way round so DESKTOP goes sticky, which is the half the
 * Issue explicitly forbids changing.
 */

const EDITOR_LABELS: EventEditorLabels = {
  complete: "Mark complete",
  statusLabels: {
    notStarted: "Not started",
    inProgress: "In progress",
    done: "Done",
  },
  title: "Title",
  date: "Date",
  allDay: "All-day",
  startTime: "Start",
  endTime: "End",
  memo: "Memo",
  save: "Save",
  saved: "Saved",
  unsaved: "Unsaved",
  originRoutine: "Generated from routine",
  originEvent: "Event",
  skipThisDay: "Skip this day",
  delete: "Delete",
};

const ITEM: EventEditorItem = {
  id: "m1",
  title: "Dentist",
  date: "2026-08-17",
  isAllDay: false,
  startTime: "09:00",
  endTime: "10:00",
  completed: false,
  status: "notStarted",
  memo: "",
  isRoutine: false,
};

const TODO_LABELS = {
  titleLabel: "Todo title",
  statusLabel: "Status",
  statusText: "Not started",
  contentLabel: "Notes",
  saveLabel: "Save",
  savedLabel: "Saved",
  unsavedLabel: "Unsaved",
};

/** The row the save button sits in — the thing that does or does not stick. */
const footerOf = (save: HTMLElement) => save.parentElement as HTMLElement;

function renderEditor(stickyFooter?: boolean) {
  render(
    <EventEditorPane
      item={ITEM}
      labels={EDITOR_LABELS}
      handlers={{ onSave: () => {}, onToggleComplete: () => {} }}
      stickyFooter={stickyFooter}
    />,
  );
  return footerOf(screen.getByRole("button", { name: "Save" }));
}

function renderTodo(stickyFooter?: boolean) {
  render(
    <TodoDetailPanel
      todoId="task-a"
      title="Write the plan"
      status="NOT_STARTED"
      onSave={() => {}}
      stickyFooter={stickyFooter}
      {...TODO_LABELS}
    />,
  );
  return footerOf(screen.getByRole("button", { name: "Save" }));
}

describe("detail save footer (#995)", () => {
  it("pins the event editor's footer when the host asks for it", () => {
    const footer = renderEditor(true);
    expect(footer.className).toContain("sticky");
    expect(footer.className).toContain("bottom-0");
  });

  it("pins the todo panel's footer when the host asks for it", () => {
    const footer = renderTodo(true);
    expect(footer.className).toContain("sticky");
    expect(footer.className).toContain("bottom-0");
  });

  it.each([
    ["event editor", renderEditor],
    ["todo panel", renderTodo],
  ])("leaves the %s alone by default (Desktop unchanged)", (_name, mount) => {
    // Desktop's frame is <Modal>, which has NO scroller of its own — a sticky
    // row there resolves against the viewport and would lift off the card once
    // the dialog outgrew the window. Default-off is what makes "Desktop is
    // untouched" true by construction rather than by review.
    const footer = mount(undefined);
    expect(footer.className).not.toContain("sticky");
    expect(footer.className).toContain("border-t");
  });

  it.each([
    ["event editor", renderEditor],
    ["todo panel", renderTodo],
  ])("keeps the %s footer opaque, from a token", (_name, mount) => {
    // Fields scroll UNDER the pinned row, so a see-through footer would show
    // text sliding behind the Save button. §5 bans transparency on a primary
    // surface anyway, and the token has to be the CARD's own or the row reads
    // as a separate strip.
    const footer = mount(true);
    expect(footer.className).toContain("bg-lumen-bg-secondary");
    expect(footer.className).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|\/\d{1,2}\b/);
  });

  it("does not stack the pinned footer above the pane's popovers", () => {
    // TagPicker's popover and TimeRangeField's listbox are `absolute z-20`.
    // Last-in-DOM already paints the footer over ordinary flow content, so a
    // z-index here would buy nothing and bury an open dropdown.
    const footer = renderEditor(true);
    expect(footer.className).not.toMatch(/\bz-\d+\b/);
  });
});

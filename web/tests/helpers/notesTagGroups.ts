import { fireEvent, screen, within } from "@testing-library/react";

const FILTER_BUTTON = /^materials\.notes\.tagFilter(Label|Selected)/;

/*
 * #2061 made the Notes sidebar open on a flat list; the tag-grouped list —
 * headings, collapse, right-click / long-press on a heading, drag to retag —
 * now shows only while a tag is selected in the #2059 filter. Suites about
 * those headings call this after rendering NotesView to get every group on
 * screen: it selects every option, which shows every heading (OR).
 *
 * On wide the options sit behind a button, so it opens the panel first and
 * shuts it again after, so its option buttons do not share the screen with the
 * headings they name. On narrow (#2578) the chips are an always-on row with no
 * button, so there is nothing to open or shut, and the row's "All" chip is
 * left alone because pressing it would clear what was just selected.
 *
 * Written against the key-echo `t` the Notes suites use, so the copy is the
 * catalog key.
 */
export function showAllTagGroups(): void {
  const button = screen.queryByRole("button", { name: FILTER_BUTTON });
  if (button && button.getAttribute("aria-expanded") !== "true") {
    fireEvent.click(button);
  }
  const panel = screen.getByRole("group", {
    name: "materials.notes.tagFilterPanel",
  });
  for (const option of within(panel).getAllByRole("button")) {
    if (!option.hasAttribute("aria-pressed")) continue;
    if (option.textContent === "materials.notes.tagFilterAll") continue;
    if (option.getAttribute("aria-pressed") !== "true") fireEvent.click(option);
  }
  if (button) {
    fireEvent.click(screen.getByRole("button", { name: FILTER_BUTTON }));
  }
}

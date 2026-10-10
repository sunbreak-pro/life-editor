import { fireEvent, screen, within } from "@testing-library/react";

/*
 * #2061 made the Notes sidebar open on a flat list; the tag-grouped list —
 * headings, collapse, right-click / long-press on a heading, drag to retag —
 * now shows only while a tag is selected in the #2059 filter. Suites about
 * those headings call this after rendering NotesView to get every group on
 * screen: it opens the filter panel and selects every option, which shows
 * every heading (OR), then shuts the panel again so its option buttons do not
 * share the screen with the headings they name.
 *
 * Written against the key-echo `t` the Notes suites use, so the copy is the
 * catalog key.
 */
export function showAllTagGroups(): void {
  const button = screen.getByRole("button", {
    name: /^materials\.notes\.tagFilter(Label|Selected)/,
  });
  if (button.getAttribute("aria-expanded") !== "true") fireEvent.click(button);
  const panel = screen.getByRole("group", {
    name: "materials.notes.tagFilterPanel",
  });
  for (const option of within(panel).getAllByRole("button")) {
    if (option.getAttribute("aria-pressed") !== "true") fireEvent.click(option);
  }
  fireEvent.click(
    screen.getByRole("button", {
      name: /^materials\.notes\.tagFilter(Label|Selected)/,
    }),
  );
}

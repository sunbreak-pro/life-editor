import { screen, fireEvent } from "@testing-library/react";
import type { TagEditModalLabels } from "../src/components";

/*
 * Shared fixtures for the TagEditModal suites (#740).
 *
 * The panel takes every string as a prop (§6.4), so each of its four test files
 * used to carry its own copy of the same label block — and #740 added seven
 * keys to it. One copy here keeps a future label from being added to three
 * files and forgotten in the fourth.
 */

export const TAG_ROLE_LABELS = {
  task: "Todo",
  event: "Event",
  note: "Note",
  daily: "Daily",
  unknown: "Other",
};

export const TAG_LABELS: TagEditModalLabels = {
  title: "Edit tags",
  closeLabel: "Close",
  addPlaceholder: "Enter a tag name",
  addButton: "Add",
  empty: "No tags yet",
  filterPlaceholder: "Filter tags…",
  filterLabel: "Filter tags by name",
  filterEmpty: "No tags match",
  listLabel: "Tags",
  renameLabel: "Rename tag",
  saveLabel: "Save",
  savedLabel: "Saved",
  unsavedLabel: "Unsaved",
  deleteLabel: "Delete tag",
  iconLabel: "Icon",
  clearIconLabel: "Default icon",
  colorLabel: "Color",
  colorClearLabel: "Default color",
  colorCustomLabel: "Custom",
  detailEmpty: "Pick a tag to edit it",
  backLabel: "All tags",
  itemsHeading: "Tagged items",
  itemsEmpty: "Nothing carries this tag",
  unassignLabel: "Remove this tag",
  switchConfirm: "Discard the unsaved changes to this tag?",
  discardLabel: "Discard",
  cancelLabel: "Cancel",
  roles: TAG_ROLE_LABELS,
};

/**
 * A row in the master list. Its accessible name is `<name>: <count text>`, so
 * matching on the name plus the colon tells "home" from "homework" without
 * pinning the count into every query.
 */
export const tagRowButton = (name: string): HTMLElement =>
  screen.getByRole("button", { name: new RegExp(`^${name}: `) });

/** Open a tag in the editor pane (#740 — editing starts with a selection). */
export const selectTagRow = (name: string): void => {
  fireEvent.click(tagRowButton(name));
};

/** The editor pane's name field. Only the selected tag has one. */
export const nameField = (): HTMLInputElement =>
  screen.getByLabelText("Rename tag") as HTMLInputElement;

/** The one save button (#740): always present, enabled only when dirty. */
export const saveButton = (): HTMLButtonElement =>
  screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

export const typeName = (value: string): void => {
  fireEvent.change(nameField(), { target: { value } });
};

/** Names shown in the master list, in order. */
export const listedTagNames = (): string[] =>
  Array.from(
    screen.getByRole("list", { name: "Tags" }).querySelectorAll("li > button"),
  ).map((row) => row.querySelector("span")?.textContent ?? "");

/** Minimal jsdom MediaQueryList so a suite can render the narrow layout. */
export function mockMatchMedia(matches: boolean): void {
  // @ts-expect-error — minimal stub, only `matches` is read.
  window.matchMedia = () => ({
    matches,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

export function restoreMatchMedia(): void {
  // @ts-expect-error — removing the stub restores the wide fallback.
  delete window.matchMedia;
}

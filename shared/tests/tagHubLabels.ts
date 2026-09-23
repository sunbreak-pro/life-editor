import type { TagHubLabels } from "../src/components";

/*
 * One TagHubLabels bag for every suite that renders the hub (#1643).
 *
 * The hub takes ~25 strings, all injected (§6.4), and a per-file literal meant
 * each new label was pasted five times and each removal chased through five
 * files. The values are deliberately PLAIN — they are what the assertions query
 * by, so they read as the English a user would see rather than as key paths.
 *
 * It replaces tagEditLabels.ts, which did the same job for the tag edit modal
 * this screen absorbed.
 */
export const TAG_HUB_LABELS: TagHubLabels = {
  tagsHeading: "Tags",
  filterPlaceholder: "Filter tags",
  filterLabel: "Filter tags by name",
  listLabel: "Tags",
  empty: "No tags or items yet.",
  filterEmpty: "No matching tag",
  tagEmpty: "Nothing is filed under this tag yet.",
  selectHint: "Pick a tag.",
  back: "Back to tags",
  unusedTagsHeading: "Unused tags",
  addPlaceholder: "Enter a tag name",
  addButton: "Add",
  duplicateName: "A tag with this name already exists.",
  createFailed: "Couldn't create the tag.",
  emptyAction: "Add a tag",
  loading: "Loading tags",
  rowMenu: "Tag actions",
  sheetClose: "Close",
  editTagMenu: "Edit tag",
  deleteTag: "Delete tag",
  editTag: "Edit this tag",
  edit: {
    nameLabel: "Name",
    iconLabel: "Icon",
    colorLabel: "Color",
    iconChange: "Change",
    iconClear: "Default icon",
    iconSearch: "Search icons",
    iconNoMatch: "No icon matches that.",
    colorDefault: "Default",
    colorCustom: "Custom",
    deleteTag: "Delete tag",
    saved: "Saved",
    unsaved: "Unsaved",
    save: "Save",
    duplicateName: "A tag with this name already exists.",
    saveFailed: "Couldn't save the tag.",
  },
  roles: {
    task: "Todo",
    event: "Event",
    note: "Note",
    daily: "Daily",
    unknown: "Other",
  },
};

/** "3 items" — the shape the real catalog interpolates. */
export const formatCount = (count: number) => `${count} items`;

/** "Unused tags (3)" — same. */
export const formatUnusedTags = (count: number) => `Unused tags (${count})`;

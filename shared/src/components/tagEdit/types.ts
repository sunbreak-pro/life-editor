import { type ItemRoleLabels } from "../items/itemRole";

/*
 * The tag edit panel's public shape (#310 / #409 / #368 / #740 / #715).
 *
 * Split out of the single TagEditModal.tsx in #896 so the props every host
 * writes against sit in one small file instead of at the top of a 1,000-line
 * component. Nothing here changed in that move — the barrel
 * (shared/src/components/index.ts) exports the same four names it always did.
 */

/** One item carrying a tag, as listed in the editor pane (#409). */
export interface TagEditItem {
  /** wiki_tag_assignments.id — what `onUnassign` removes. */
  assignmentId: string;
  /** items_meta.id of the tagged item. */
  itemId: string;
  /** Raw `items_meta.role`; unknown values render the neutral fallback badge. */
  role: string;
  /** Already-resolved display title (host supplies an untitled fallback). */
  title: string;
}

export interface TagEditRow {
  id: string;
  name: string;
  color: string | null;
  /** lucide icon name, or null for the default icon. */
  icon: string | null;
  /** Active items carrying this tag (role-agnostic). */
  count: number;
  /**
   * The items behind `count`, listed in the editor pane (#409). Omit to keep
   * the tag count-only (no membership section) — the pre-#409 behavior.
   */
  items?: readonly TagEditItem[];
}

export interface TagEditModalLabels {
  title: string;
  /**
   * #1526 aria-label for the header's close button. Required, not optional:
   * the button is unconditional, and an optional label would leave "a panel
   * whose exit no screen reader can announce" constructible (the same reason
   * BottomSheet's `closeLabel` is required).
   */
  closeLabel: string;
  addPlaceholder: string;
  addButton: string;
  empty: string;
  /** #368 name filter: placeholder for the filter input. */
  filterPlaceholder: string;
  /** #368 name filter: aria-label for the filter input. */
  filterLabel: string;
  /** #368 name filter: copy shown when the query matches no tag. */
  filterEmpty: string;
  /** #740 aria-label for the master list of tags. */
  listLabel: string;
  /** aria-label for the name input in the editor pane. */
  renameLabel: string;
  /**
   * #715 save button: the only thing that commits the selected tag's pending
   * name / icon / color. One per panel since #740, parked in the footer.
   */
  saveLabel: string;
  /** #740 footer state, mirroring #681: nothing pending. */
  savedLabel: string;
  /** #740 footer state, mirroring #681: something pending. */
  unsavedLabel: string;
  /** aria-label for the delete button in the editor pane. */
  deleteLabel: string;
  /** Trigger + group label for the icon picker. */
  iconLabel: string;
  /** "Default / no icon" option in the icon picker. */
  clearIconLabel: string;
  /** ColorPicker labels. */
  colorLabel: string;
  colorClearLabel: string;
  colorCustomLabel: string;
  /** #740 copy filling the editor pane while no tag is selected. */
  detailEmpty: string;
  /** #740 narrow layout: back from the editor to the list. */
  backLabel: string;
  /** #409 item list: heading over the items carrying the selected tag. */
  itemsHeading: string;
  /** #409 item list: copy shown when the selected tag carries nothing. */
  itemsEmpty: string;
  /** #409 item list: aria-label for a row's "remove this tag" button. */
  unassignLabel: string;
  /** #740 in-app confirm shown when switching tags with unsaved edits. */
  switchConfirm: string;
  /** #740 affirmative of that confirm ("discard"). */
  discardLabel: string;
  /** #740 refusal of that confirm ("cancel"). */
  cancelLabel: string;
  /** #409 item list: already-translated item-kind names for the role badge. */
  roles: ItemRoleLabels;
}

export interface TagEditModalProps {
  open: boolean;
  onClose: () => void;
  tags: readonly TagEditRow[];
  onCreate: (name: string) => void;
  /**
   * Rename a tag (#715: fires from the save button, never from a blur). The
   * name arrives trimmed and different from the stored one — a blank or
   * unchanged draft is not a rename, so the propagation the host does around
   * `renameTag` is reached exactly when it was before.
   */
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  /** Set a tag's color (#715: from the save button, not the swatch click). */
  onSetColor: (id: string, color: string | null) => void;
  /** Set a tag's icon (#715: from the save button, not the icon click). */
  onSetIcon: (id: string, icon: string | null) => void;
  /**
   * Remove one item↔tag assignment (#409). Required whenever any tag supplies
   * `items`; a tag without `items` shows no membership section, so it is never
   * called for one.
   */
  onUnassign?: (assignmentId: string) => void;
  /**
   * Report whether ANY tag is holding unsaved edits (#715, mirroring #628's
   * `onDirtyChange`). The host owns the close affordances — Esc, the backdrop,
   * whatever opened the panel — so it is the only place that can ask "discard?"
   * before one of them throws the drafts away. Fires with `false` on unmount so
   * a host parking this in a ref cannot go on guarding a panel that is gone.
   */
  onDirtyChange?: (dirty: boolean) => void;
  /** Already-interpolated usage count text, e.g. "3 items". */
  formatCount: (count: number) => string;
  /** matchMedia query for the two-column layout. Overridable for tests. */
  wideQuery?: string;
  labels: TagEditModalLabels;
}

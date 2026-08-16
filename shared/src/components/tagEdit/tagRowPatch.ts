import { type TagEditRow } from "./types";

/*
 * The draft model behind the tag panel's save button (#715).
 *
 * Each tag's draft is an OVERLAY on the live tag (the #628 rule): only the
 * fields actually typed against are held, so a rename landing from Realtime or
 * MCP still reaches an untouched tag instead of being reverted by a stale draft
 * the user never edited.
 */

/**
 * What the user has typed / picked against one tag but not yet saved. Absent
 * fields keep following the live tag (see the overlay note above).
 */
export interface TagRowEdits {
  name?: string;
  color?: string | null;
  icon?: string | null;
}

/**
 * What one press of the save button would write — and, by being empty, whether
 * the selected tag has anything to write at all. Dirty state and the payload
 * come from this ONE function on purpose: derive them separately and the button
 * eventually enables for a change it then declines to send.
 */
export type TagRowPatch = TagRowEdits;

export function tagRowPatch(
  tag: TagEditRow,
  edits: TagRowEdits = {},
): TagRowPatch {
  const patch: TagRowPatch = {};
  if (edits.name !== undefined) {
    const next = edits.name.trim();
    // A blank field is not a name. Mid-typing it is a normal state, so the
    // editor also puts the stored name back on blur rather than leaving the
    // screen and the state disagreeing.
    if (next && next !== tag.name) patch.name = next;
  }
  if (edits.color !== undefined && edits.color !== tag.color)
    patch.color = edits.color;
  if (edits.icon !== undefined && edits.icon !== tag.icon)
    patch.icon = edits.icon;
  return patch;
}

/** Stable identity for "this tag has nothing pending" — a fresh {} per render
 *  would defeat the equality checks downstream for no benefit. */
export const NO_EDITS: TagRowEdits = {};

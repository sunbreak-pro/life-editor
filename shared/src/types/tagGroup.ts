/**
 * A named set of life-tags (`wiki_tag_groups` + `wiki_tag_group_assignments`).
 *
 * #1173 replaced the Schedule `calendars` ledger with this. A calendar was a
 * saved view over exactly ONE tag, which is why "create a calendar" never read
 * as anything but "save a tag filter with a name" — the concept carried a
 * second noun for no extra power. A group is the same saved filter with the
 * arity the user actually wanted: many tags, matched as a union.
 *
 * NOT the same thing as `NoteTagGroup` (components/notes/buildTagGroups.ts),
 * which is a transient bucket of NOTES under one tag heading. This one is a
 * stored row the user names and re-applies.
 *
 * Sync class: the group row is VERSIONED + soft-delete; its memberships are a
 * RELATION + soft-delete with no version (the same shape as
 * `wiki_tag_assignments`, and for the same reason — a membership has nothing
 * to LWW-merge). Both tables live in the `tags` sync domain.
 */
export interface TagGroupNode {
  id: string;
  /** User-facing name, e.g. "Work". */
  name: string;
  /**
   * `wiki_tags(id)` this group collects, in membership-row order.
   *
   * May contain ids of tags that have since been SOFT-deleted: the FK is
   * `on delete cascade`, but a soft delete never fires it (the row survives).
   * Consumers resolve against the active tag list and drop the misses — see
   * `pickGroupTagIds`.
   */
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

/*
 * Tag hub display contract (#1171).
 *
 * The vocabulary the hub speaks in, kept away from both the derivation
 * (buildTagHubModel) and the components so the two cannot disagree about what
 * a row is. Everything here is plain data: no React, no DataService, no
 * useTranslation (§3.1 / §6.4).
 *
 * The item KIND is deliberately `ItemRole` from ../items/itemRole rather than a
 * fresh union of the same four strings. That module already owns the icon, the
 * tint and the grouping order for "task / event / note / daily", and the whole
 * point of the hub is to look like the surfaces it links to.
 */
import type { ItemRole, ItemRoleLabels } from "../items/itemRole";

/**
 * The id of the pseudo-tag holding every item that carries no reachable tag.
 *
 * Prefixed so it can never collide with a real `wiki_tags.id` (those are
 * generated ids), because the hub keys its selection state by tag id and an
 * item bucket keyed by a colliding string would silently merge the two.
 *
 * Required by the Issue, not a nicety: the hub is the TAG-first entrance to
 * the records, so without this bucket an untagged item has no route in at all.
 */
export const UNTAGGED_TAG_ID = "taghub:untagged";

/** One item as the hub lists it — the host resolves these from its 4 reads. */
export interface TagHubItem {
  /** `items_meta.id`, and what the shell's item-nav route is given. */
  readonly id: string;
  readonly role: ItemRole;
  /** Already-resolved display title (the host substitutes its own fallback
   *  for an untitled row, so this is never empty). */
  readonly title: string;
  /**
   * The secondary line, shown at the right of the row. An event's date lives
   * here, which is also why it travels: the Calendar shows one window at a
   * time and cannot select a row outside it, so `date` below carries the same
   * value into the navigation intent (#503).
   */
  readonly detail?: string;
  /**
   * Event rows only — the date the shell needs to move the Calendar to before
   * the selection means anything. Absent for the other three kinds, whose
   * destinations show one list of everything.
   */
  readonly date?: string;
  /**
   * ISO datetime used to order a kind's rows, newest first. Absent sorts last:
   * the hub answers "what moved recently in this topic", and a row that cannot
   * say when it moved is the least likely answer to that question.
   */
  readonly updatedAt?: string;
}

/** A tag as the rail lists it, counts derived from the rows behind it. */
export interface TagHubTagSummary {
  /** `wiki_tags.id`, or UNTAGGED_TAG_ID for the pseudo-tag. */
  readonly id: string;
  /** Tag name — already-translated copy for the untagged bucket (§6.4). */
  readonly name: string;
  /** `wiki_tags.color` — the tint TagHeadingIcon paints the glyph with. */
  readonly color: string | null;
  /** `wiki_tags.icon` — a curated lucide name, resolved by TagHeadingIcon. */
  readonly icon: string | null;
  /**
   * How many items this tag holds IN THE HUB. Derived from the grouped rows
   * rather than taken from the context's `countsByTag`, which counts every
   * assignment including roles the hub does not list (a routine) — a rail
   * saying 5 above a list of 4 is the drift this avoids.
   */
  readonly count: number;
  /** The untagged pseudo-tag, which the rail draws apart from the real ones. */
  readonly isUntagged: boolean;
}

/** One kind's rows under a tag, in ITEM_ROLE_ORDER. Never empty. */
export interface TagHubGroup {
  readonly role: ItemRole;
  readonly items: readonly TagHubItem[];
}

/** What the view renders: the rail's tags, plus each tag's grouped rows. */
export interface TagHubModel {
  /** Live tags by name, with the untagged bucket pinned last (when non-empty). */
  readonly tags: readonly TagHubTagSummary[];
  /** tagId → its groups. A tag with no items is absent, not an empty array. */
  readonly groupsByTag: ReadonlyMap<string, readonly TagHubGroup[]>;
}

/** Every string the hub draws, already translated by the host (§6.4). */
export interface TagHubLabels {
  /** Rail heading. */
  tagsHeading: string;
  filterPlaceholder: string;
  filterLabel: string;
  /** aria-label for the tag list itself. */
  listLabel: string;
  /** No tags AND no items at all — the app is empty, not the filter. */
  empty: string;
  /** The filter matched no tag. */
  filterEmpty: string;
  /** The selected tag holds no items the hub can list. */
  tagEmpty: string;
  /** Wide layout, nothing selected yet. */
  selectHint: string;
  /** Narrow layout — back from a tag's items to the tag list. */
  back: string;
  /** Kind names for the group headings (shared with the tag editor). */
  roles: ItemRoleLabels;
}

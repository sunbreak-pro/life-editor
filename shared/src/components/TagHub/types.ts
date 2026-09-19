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
  /*
   * The two fields below are the repeat-series pair (#1631). A repeating item's
   * tags are written to the SERIES (the `routine` items_meta row), not to the
   * occurrences, because the generator rebuilds occurrences — see the comment
   * at web/src/schedule/ScheduleEventEditor.tsx (#468). The hub therefore has
   * to list the series where it lists items, or the tag matches nothing at all.
   */
  /**
   * This row IS the series — a `routine` row, shown as an Event because that
   * is how the UI presents a repeat (§4 / #185). Such a row is listed ONLY
   * under the tags it carries: an untagged series says nothing its own
   * occurrences do not already say, so it stays out of the untagged bucket.
   */
  readonly isSeries?: boolean;
  /**
   * Occurrence rows only — the id of the series that generated this row. When
   * that series carries a tag, the series row stands in for the whole run (one
   * line, not one per day) and this row is left out of the hub entirely.
   */
  readonly seriesId?: string;
  /**
   * The items_meta id the shell should open, when it differs from `id`. A
   * series row is FILED under the routine id (that is where the tag lives) but
   * OPENS its next occurrence, which is the row the Calendar can actually
   * select — a routine id would highlight nothing.
   */
  readonly navigateId?: string;
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
   * assignment including ones the hub cannot list (an item since trashed, a
   * dismissed event) — a rail saying 5 above a list of 4 is the drift this
   * avoids.
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
  /**
   * Tags holding at least one item, by name, with the untagged bucket pinned
   * last (when non-empty).
   */
  readonly tags: readonly TagHubTagSummary[];
  /**
   * Live tags nothing is filed under (#1643 / D4), by name. Split out rather
   * than mixed into `tags`: a tag that has never been used is a topic the user
   * declared and then left, and a rail that files it alphabetically between
   * two working topics makes the working ones harder to scan. The rail folds
   * these behind one disclosure — they are still reachable, because editing or
   * deleting one is exactly why you would go looking.
   */
  readonly unusedTags: readonly TagHubTagSummary[];
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
  /** Rail disclosure over the tags nothing is filed under (D4). */
  unusedTagsHeading: string;
  /** Rail's pinned creation row (D5): field placeholder and its button. */
  addPlaceholder: string;
  addButton: string;
  /** D15 — the primary action under the "nothing here yet" copy. */
  emptyAction: string;
  /** D16 — what a screen reader is told while the hub is still reading. */
  loading: string;
  /**
   * D2 — the per-row "…" trigger. Composed with the tag's own name at the call
   * site (`"Work: Tag actions"`), the same way the row's count is, so a rail of
   * fourteen tags does not present fourteen identically-named buttons.
   */
  rowMenu: string;
  /** D2 menu items. Rename / icon / color open the edit block on that field. */
  renameTag: string;
  changeIcon: string;
  changeColor: string;
  deleteTag: string;
  /** #1644 — the row menu's merge item (drawn only with `onMergeTag`). */
  mergeTag?: string;
  /** #1646 — the narrow sheets' close button and the item row's "…". */
  sheetClose: string;
  /** D6 — the header's pencil, which opens the edit block (#1643). */
  editTag: string;
  /** Everything the edit block itself draws (D7). */
  edit: TagHubEditLabels;
}

/** The edit block's own copy (D7), already translated (§6.4). */
export interface TagHubEditLabels {
  /** Field captions down the block's left column. */
  nameLabel: string;
  iconLabel: string;
  colorLabel: string;
  /** The button beside the current glyph that opens the icon grid. */
  iconChange: string;
  /** "Default / no icon" inside that grid. */
  iconClear: string;
  /** The two buttons beside the swatch grid. */
  colorDefault: string;
  colorCustom: string;
  /** Footer: the destructive link at the left, then the save pair. */
  deleteTag: string;
  saved: string;
  unsaved: string;
  save: string;
}

/*
 * Calendar-grid filters (#466 Step 5-b). Pure array narrowing — no React, no
 * Intl, no DataService.
 *
 * The grid draws the standing scaffolding (routine-generated occurrences) and
 * the one-off events in the same columns, so on a day whose routines fill it
 * there is no room left to SEE where a new event could go. This filter folds
 * the repeat-generated rows away so the remaining gaps are the real ones.
 *
 * Two rules make it safe to build a UI on:
 *   1. The count of what was folded away travels WITH the survivors. A grid
 *      that silently drops rows turns its empty slots into a lie — the caller
 *      needs the number to say "N hidden" in the same breath.
 *   2. Filtering is a VIEW concern. The host keeps its unfiltered store for
 *      selection / mutation and passes the result of this function only to the
 *      grid layer, so hiding a row never changes what an edit writes.
 */

/** The minimum an item must expose to be filtered: its source routine. */
export interface RepeatFilterable {
  /** Set when the row was generated from a Routine template. */
  routineId?: string | null;
}

export interface RepeatFilterResult<T> {
  visible: T[];
  /** How many rows were folded away (0 when the filter is off). */
  hiddenCount: number;
}

/**
 * Fold repeat-generated rows out of a grid list.
 *
 * `hideRepeats === false` is the identity case and returns the SAME array
 * reference, so a host memo downstream of this does not invalidate while the
 * filter is off.
 */
export function applyRepeatFilter<T extends RepeatFilterable>(
  items: T[],
  hideRepeats: boolean,
): RepeatFilterResult<T> {
  if (!hideRepeats) return { visible: items, hiddenCount: 0 };
  const visible = items.filter((i) => i.routineId == null);
  return { visible, hiddenCount: items.length - visible.length };
}

/* ── Calendar lens (#468) ─────────────────────────────────────────────────────
 *
 * A `calendars` row is not a container — it is a saved view over ONE life tag,
 * so "is this row in that calendar?" is really "does this row carry that tag?".
 * The membership set is built once per (assignments, tag) pair and handed to
 * the narrowing function, which keeps the per-row test to a Set lookup.
 *
 * The two filters compose as an independent AND (repeat → calendar), and each
 * reports its OWN hidden count. Chaining the counts instead would double-count
 * a repeat-generated row that the calendar filter would also have dropped, and
 * "N hidden" that overshoots the missing rows is worse than no number at all.
 */

/** The minimum an item must expose to be tested for calendar membership. */
export interface CalendarFilterable extends RepeatFilterable {
  /** `items_meta.id` of this row. */
  id: string;
}

/** The shape of a `wiki_tag_assignments` row this module needs. */
export interface CalendarMemberAssignment {
  itemId: string;
  tagId: string;
}

export interface CalendarFilterResult<T> {
  visible: T[];
  /** How many rows the calendar lens folded away (0 when it is off). */
  hiddenCount: number;
}

/**
 * Collect the item ids carrying `tagId` — the membership set of one calendar.
 *
 * Pass the ALREADY active-only assignment list (the service filters both the
 * assignment and its item on `is_deleted`); this helper does no such filtering
 * of its own. A null/empty `tagId` yields an empty set rather than "everything",
 * because a calendar bound to nothing owns nothing.
 */
export function buildCalendarMemberIds(
  assignments: readonly CalendarMemberAssignment[],
  tagId: string | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!tagId) return ids;
  for (const a of assignments) {
    if (a.tagId === tagId) ids.add(a.itemId);
  }
  return ids;
}

/**
 * Narrow a grid list to one calendar's members.
 *
 * `memberIds == null` is the identity case and returns the SAME array
 * reference, matching `applyRepeatFilter`'s contract — a host memo downstream
 * must not invalidate while the lens is off. An EMPTY set is NOT the same
 * thing: that is a chosen calendar that happens to own nothing, and it
 * correctly empties the grid.
 *
 * Routine inheritance: occurrences generated from a Routine carry their own
 * ids, so tagging the series (the routine row) would otherwise match none of
 * them. A row belongs to the calendar if its own id OR its source routine's id
 * is in the set — which is also the only way a repeat can be filed at all,
 * since #185 hides Routine behind "an Event with a repeat".
 */
export function applyCalendarFilter<T extends CalendarFilterable>(
  items: T[],
  memberIds: ReadonlySet<string> | null | undefined,
): CalendarFilterResult<T> {
  if (!memberIds) return { visible: items, hiddenCount: 0 };
  const visible = items.filter(
    (i) =>
      memberIds.has(i.id) ||
      (i.routineId != null && memberIds.has(i.routineId)),
  );
  return { visible, hiddenCount: items.length - visible.length };
}

/** The minimum a `calendars` row must expose to be offered as a lens. */
export interface SelectableCalendar {
  /** `wiki_tags(id)` this calendar is a saved view over. */
  tagId: string;
}

/**
 * Drop calendars whose tag no longer exists.
 *
 * `calendars.tag_id` FKs `wiki_tags(id)` ON DELETE CASCADE, but a tag is
 * SOFT-deleted — the row survives, the cascade never fires, and the calendar is
 * left pointing at a tag no active list returns. Such a calendar matches zero
 * rows forever, and a chip that always empties the grid reads as a bug, so it
 * is never offered as a lens. Pass the ACTIVE tag ids (`allTags` is already
 * `is_deleted=false` filtered by the service).
 */
export function pickSelectableCalendars<C extends SelectableCalendar>(
  calendars: readonly C[],
  activeTagIds: ReadonlySet<string>,
): C[] {
  return calendars.filter((c) => activeTagIds.has(c.tagId));
}

export interface CalendarLensResult<E, T> {
  /** Schedule rows the lens leaves on the grid. */
  events: E[];
  /** Todo chips the lens leaves on the grid. */
  todoChips: T[];
  /** Rows the lens folded away across BOTH layers (0 when it is off). */
  hiddenCount: number;
  /**
   * Rows the lens leaves on screen across both layers — the number a chip
   * shows. Deriving it here, from the same call the grid uses, is what makes
   * "the number on the chip is what clicking it leaves" true by construction
   * rather than by two call sites happening to agree.
   */
  visibleCount: number;
}

/**
 * Apply the lens to every layer the grid draws.
 *
 * The grid stacks two independent sources — schedule rows and scheduled-todo
 * chips — and both can carry life tags (`KanbanView` tags todos with the same
 * `wiki_tags`, and a chip's id IS the todo's `items_meta.id`). Narrowing only
 * the schedule rows would hide the events of the other calendars while leaving
 * every todo on screen, i.e. a lens that is not a lens.
 *
 * Identity (`memberIds == null`) returns the SAME array references, matching
 * `applyCalendarFilter`'s contract so host memos downstream stay stable.
 */
export function applyCalendarLens<
  E extends CalendarFilterable,
  T extends CalendarFilterable,
>(
  events: E[],
  todoChips: T[],
  memberIds: ReadonlySet<string> | null | undefined,
): CalendarLensResult<E, T> {
  const e = applyCalendarFilter(events, memberIds);
  const t = applyCalendarFilter(todoChips, memberIds);
  return {
    events: e.visible,
    todoChips: t.visible,
    hiddenCount: e.hiddenCount + t.hiddenCount,
    visibleCount: e.visible.length + t.visible.length,
  };
}

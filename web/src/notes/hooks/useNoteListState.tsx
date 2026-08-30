import { useCallback, useMemo, useState } from "react";
import {
  useNotesUnifiedContext,
  useWikiTagsUnifiedContext,
  useTranslation,
  buildTagGroups,
  tagGroupKey as groupKey,
  filterTagGroups,
  sortNotesForList,
  useFrozenNoteSortKey,
  cn,
} from "@life-editor/shared";

/*
 * List half of the Notes host (extracted from NotesView.tsx — hooks split,
 * zero behavior change). Owns the persisted collapse state for tag-group
 * headings and the derived side-list pipeline both breakpoints render from
 * (search → tag groups → sort → tag filter), plus the sort/filter control
 * plumbing (mode picker entries, direction label, tag-filter chips).
 */

// Collapse state for tag-group headings. Persisted so a folded group stays
// folded across reloads. The group key (incl. the untagged sentinel) comes from
// shared — the #369 tag filter keys off the same identity.
// #718: renamed from the bare `note-tag-groups-collapsed`, which "reset
// settings" could not see (it sweeps the `life-editor` namespace by prefix).
// Values saved under the old name are carried over at startup by
// `migrateLegacyPreferenceKeys` — see shared/src/utils/.
const LS_TAG_GROUPS_COLLAPSED = "life-editor:note-tag-groups-collapsed";

/**
 * Rows drawn per tag group while no tag filter is on (#1288). Small enough that
 * a dozen headings still fit on one screen, large enough that most groups are
 * shown whole and the expander never appears.
 */
const GROUP_ROW_CAP = 5;

function loadCollapsedGroups(): Set<string> {
  try {
    const saved = localStorage.getItem(LS_TAG_GROUPS_COLLAPSED);
    if (saved) return new Set(JSON.parse(saved) as string[]);
  } catch {
    // ignore malformed / unavailable storage
  }
  return new Set();
}

function saveCollapsedGroups(keys: Set<string>): void {
  try {
    localStorage.setItem(LS_TAG_GROUPS_COLLAPSED, JSON.stringify([...keys]));
  } catch {
    // ignore storage write failures (private mode / quota)
  }
}

export function useNoteListState() {
  const notes = useNotesUnifiedContext();
  const { allTags, getTagsForItem } = useWikiTagsUnifiedContext();
  const { t } = useTranslation();

  const [collapsedGroups, setCollapsedGroups] =
    useState<Set<string>>(loadCollapsedGroups);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveCollapsedGroups(next);
      return next;
    });
  }, []);

  // Search filter (title-only — the list is body-free under M1). Applied
  // before grouping so a query narrows every tag heading at once.
  const searchedNotes = useMemo(() => {
    const q = notes.searchQuery.trim().toLowerCase();
    if (!q) return notes.notes;
    return notes.notes.filter((n) => (n.title || "").toLowerCase().includes(q));
  }, [notes.notes, notes.searchQuery]);

  // Flat assignment pool for the notes in view. getTagsForItem reads the
  // Provider's bulk cache synchronously (no N+1); buildTagGroups drops
  // deleted assignments / deleted-tag assignments itself.
  const assignments = useMemo(
    () => searchedNotes.flatMap((n) => getTagsForItem(n.id)),
    [searchedNotes, getTagsForItem],
  );

  const groups = useMemo(
    () =>
      buildTagGroups({
        notes: searchedNotes,
        tags: allTags,
        assignments,
        untaggedLabel: t("materials.notes.untagged"),
      }),
    [searchedNotes, allTags, assignments, t],
  );

  // #283 sort controls (desktop sidebar). Mode ids map 1:1 to NoteSortMode.
  // The date labels live in materials.sidebar (shared with the Daily picker
  // since #369); "title" stays under materials.notes — a daily has no title.
  const sortModes = useMemo(
    () => [
      { id: "updatedAt", label: t("materials.sidebar.sortUpdated") },
      { id: "createdAt", label: t("materials.sidebar.sortCreated") },
      { id: "title", label: t("materials.notes.sortTitle") },
    ],
    [t],
  );

  // The note being edited holds the slot it had when it was selected (#366) —
  // otherwise each debounced save bumps updatedAt and yanks the row to the top
  // of its group mid-sentence under the default newest-first order.
  const frozenSortKey = useFrozenNoteSortKey(
    notes.selectedNote?.id ?? null,
    notes.notes,
  );

  // buildTagGroups re-sorts each group internally (pinned-first then title), so
  // the user's chosen sort is applied AFTER grouping — within each tag group,
  // preserving pinned-first. Group ORDER (by tag name) is left unchanged.
  const sortedGroups = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        notes: sortNotesForList(
          group.notes,
          notes.sortMode,
          notes.sortDirection,
          frozenSortKey,
        ),
      })),
    [groups, notes.sortMode, notes.sortDirection, frozenSortKey],
  );

  // Direction label must describe the REAL rendered order. For the date modes
  // the comparator's "asc" reads as newest-first (compareNotes quirk), so date
  // modes use newest/oldest; title uses ascending/descending.
  const isTitleSort = notes.sortMode === "title";
  const directionLabel = isTitleSort
    ? notes.sortDirection === "asc"
      ? t("materials.sidebar.ascending")
      : t("materials.sidebar.descending")
    : notes.sortDirection === "asc"
      ? t("materials.sidebar.newest")
      : t("materials.sidebar.oldest");

  /*
   * #369 tag filter, widened to MULTI-select in #1288. The grouped list already
   * shows every tag, but with a dozen tags you scroll past all of them to reach
   * one — collapsing the rest by hand is the only narrowing that existed. A
   * chip means "show this heading", which is the whole filter semantics under a
   * many-to-many tag model: "show notes carrying tag X" IS "show group X". Two
   * chips therefore show two headings (OR) — see filterTagGroups for why the
   * intersection is not the useful reading here.
   *
   * Deliberately NOT persisted (matching the Daily filter query, #283): a
   * filter that survives a reload hides notes with no visible cause.
   */
  const [tagFilters, setTagFilters] = useState<readonly string[]>([]);

  const toggleTagFilter = useCallback((key: string) => {
    setTagFilters((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  const clearTagFilters = useCallback(() => setTagFilters([]), []);

  const tagFilterChips = useMemo(
    () =>
      sortedGroups.map((group) => ({
        id: groupKey(group),
        label: group.tagName,
        count: group.notes.length,
        icon: (
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
              group.tagColor ? "" : "bg-lumen-border-strong",
            )}
            style={
              group.tagColor ? { backgroundColor: group.tagColor } : undefined
            }
          />
        ),
      })),
    [sortedGroups],
  );

  // filterTagGroups falls back to the full list when every selection goes stale
  // — see its doc for why (a stale chip is unclickable, so it must not strand).
  const visibleGroups = useMemo(
    () => filterTagGroups(sortedGroups, tagFilters),
    [sortedGroups, tagFilters],
  );

  /*
   * #1288 — the second half of the Issue: the list with NO filter on.
   *
   * Every tag is a heading and a note appears under every tag it carries, so an
   * unfiltered vault of any size is a wall of rows in a ~240px column. Capping
   * each group and letting the user open the ones they want turns it back into
   * something scannable — headings first, contents on request.
   *
   * Only while nothing is selected: once a tag IS picked, that group is the
   * thing the user asked to see, and hiding part of it would answer a narrower
   * question than the one they asked.
   */
  const rowCap = tagFilters.length > 0 ? null : GROUP_ROW_CAP;

  // Only worth showing when there is more than one bucket to choose between.
  const showTagFilter = tagFilterChips.length > 1;

  /*
   * Typing in the search box drops the tag filter. The two are alternative ways
   * to narrow the same list, and leaving both on makes the filter come back by
   * itself: a query that empties the soloed group removes its heading
   * (buildTagGroups drops empty ones), soloTagGroup falls back to everything —
   * and then clearing the query re-collapses the list to a tag the user never
   * re-selected. Resetting here keeps that visible (the chip un-presses as you
   * type) instead of leaving dead state behind. Cleared on the CHANGE, not in
   * an effect watching the derived groups (web lint bans setState in effects).
   */
  const setSearchQuery = notes.setSearchQuery;
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setTagFilters([]);
    },
    [setSearchQuery],
  );

  const hasNotes = groups.length > 0;
  // `hasNotes` is post-search, so a query that matches nothing empties it. The
  // mobile header must survive that or the box that caused it becomes
  // unreachable (desktop renders its search unconditionally, so it is safe).
  const searchActive = notes.searchQuery.trim() !== "";

  return {
    collapsedGroups,
    toggleGroup,
    sortModes,
    directionLabel,
    tagFilters,
    toggleTagFilter,
    clearTagFilters,
    tagFilterChips,
    visibleGroups,
    rowCap,
    showTagFilter,
    handleSearchChange,
    hasNotes,
    searchActive,
  };
}

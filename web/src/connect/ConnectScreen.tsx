import { useCallback, useMemo, useState } from "react";
import {
  buildTagHubModel,
  RightSidebarPortal,
  selectRecentTaggedItems,
  TagHubDetailPanel,
  TagHubView,
  useDomainLoad,
  useMediaQuery,
  useSyncDomains,
  useTranslation,
  useWikiTagsUnifiedContext,
  getConnectTagSelection,
  setConnectTagSelection,
  todayCalendarKey,
  WIDE_QUERY,
  type DailyNode,
  type DataService,
  type NoteNode,
  type RoutineNode,
  type ScheduleItem,
  type TagHubDetailLabels,
  type TagHubItem,
  type TagHubLabels,
  type TodoNode,
} from "@life-editor/shared";

/*
 * Connect host shell (#1171) — the tag hub.
 *
 * The section is back, but it is not the one #1152 retired. That one drew
 * every item and every link at once and asked you to find the thing you meant
 * in the picture; this one asks for the TOPIC first — pick a tag, read what is
 * filed under it, grouped by kind. Same data (wiki_tags + assignments), the
 * opposite direction of travel.
 *
 * The host's job, as everywhere else (§6.4): fetch, resolve copy, inject. The
 * derivation is the pure `buildTagHubModel` and the drawing is the pure
 * `TagHubView`; nothing below this file's boundary knows what a DataService or
 * an i18n catalog is.
 *
 * NO PER-DOMAIN PROVIDER, on purpose. The hub reads across the item domains
 * and writes to none, which is the same shape as Briefing and Trash — those
 * call the injected DataService directly rather than mounting a Provider per
 * read-only list. The one Provider it does sit inside is
 * WikiTagsUnifiedProvider (mounted by its descriptor row), because the tag and
 * assignment caches it holds are already loaded and already Realtime-tracked.
 *
 * THE SHARED DETAIL PANEL (#1472). While a tag is open, the selected tag's
 * breakdown and its recently-filed rows go into the shell's right panel
 * through RightSidebarPortal — the same slot the note list, the todo fields
 * and the Settings categories use. Nothing is portalled while nothing is
 * selected, so the panel's own empty copy stays the honest one. The panel's
 * open / closed state is the shell's and is left alone here.
 */

interface ConnectScreenProps {
  dataService: DataService;
  /** The shell's item-nav route — the same one a "[[" link click takes. */
  onNavigateToItem: (target: {
    id: string;
    role: string;
    date?: string;
  }) => void;
}

/** The reads, kept raw so the labelling below can depend on `t`. */
interface ConnectSources {
  todos: TodoNode[];
  events: ScheduleItem[];
  notes: NoteNode[];
  dailies: DailyNode[];
  /** Repeat series (#1631) — where a repeating item's tags actually live. */
  routines: RoutineNode[];
}

const EMPTY_SOURCES: ConnectSources = {
  todos: [],
  events: [],
  notes: [],
  dailies: [],
  routines: [],
};

/**
 * The occurrence a repeat's row opens (#1631): the next one from today, or —
 * for a repeat that has stopped firing — the most recent past one. Returns
 * undefined for a series with no materialised occurrence at all, which is a
 * routine that has never fired inside the generated window; the row still
 * lists, it just sends the shell to Schedule without a day to land on.
 */
function pickSeriesOccurrence(
  occurrences: readonly ScheduleItem[] | undefined,
  today: string,
): ScheduleItem | undefined {
  if (!occurrences) return undefined;
  let next: ScheduleItem | undefined;
  let previous: ScheduleItem | undefined;
  for (const item of occurrences) {
    if (item.date >= today) {
      if (!next || item.date < next.date) next = item;
    } else if (!previous || item.date > previous.date) {
      previous = item;
    }
  }
  return next ?? previous;
}

export function ConnectScreen({
  dataService,
  onNavigateToItem,
}: ConnectScreenProps) {
  const { t } = useTranslation();
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const wiki = useWikiTagsUnifiedContext();

  // Every domain this screen reads. Under-declaring here is a silent stale the
  // user has no way to fix (rules/frontend.md §Sync). Routines ride along on
  // `schedule` (syncDomains.ts — a routine IS an Event template). Tags are NOT
  // listed: the Provider above already tracks that domain and re-renders us
  // with the new assignments, so declaring it here would just re-run these
  // reads for a change that cannot affect them.
  const syncVersion = useSyncDomains("todos", "schedule", "notes", "dailies");

  const [sources, setSources] = useState<ConnectSources>(EMPTY_SOURCES);

  const { isLoading: sourcesLoading } = useDomainLoad<ConnectSources>({
    domain: "Connect tag hub",
    dataService,
    version: syncVersion,
    // Editing an item elsewhere must not blank the hub back to its skeleton;
    // the rows are already on screen and a refetch only corrects them.
    refetchReportsLoading: false,
    load: async (service) => {
      const [todos, events, notes, dailies, routines] = await Promise.all([
        service.fetchTodoTree(),
        service.fetchEvents(),
        service.listNotesUnified(),
        service.listDailiesUnified(),
        service.fetchAllRoutines(),
      ]);
      return { todos, events, notes, dailies, routines };
    },
    apply: setSources,
    fallbackMessage: "Failed to load the tag hub",
  });

  /*
   * The lists flattened into one row shape. The conventions here are the
   * command palette's (usePaletteItemSearch), deliberately: an event carries
   * its DATE because the Calendar cannot select a row outside the window it is
   * showing (#503), and a daily has no title of its own — its date IS its
   * name. `updatedAt` is what orders each kind, newest first.
   *
   * Repeats take one extra step (#1631). Their tags are written to the SERIES
   * (the routine row), so the series is what joins with the assignments — the
   * occurrences carry ids the tag never mentions. Each series therefore gets
   * ONE row, standing in for the whole run, while every occurrence carries its
   * `seriesId` so the model can drop it once the series has spoken for it.
   */
  const items = useMemo<TagHubItem[]>(() => {
    const untitled = t("common.untitled");
    const today = todayCalendarKey();
    const occurrencesBySeries = new Map<string, ScheduleItem[]>();
    for (const event of sources.events) {
      if (event.isDeleted) continue;
      if (event.routineId === null || event.routineId === undefined) continue;
      const bucket = occurrencesBySeries.get(event.routineId);
      if (bucket) bucket.push(event);
      else occurrencesBySeries.set(event.routineId, [event]);
    }
    const out: TagHubItem[] = [];
    for (const todo of sources.todos) {
      if (todo.isDeleted) continue;
      out.push({
        id: todo.id,
        role: "task",
        title: todo.title || untitled,
        updatedAt: todo.updatedAt,
      });
    }
    for (const event of sources.events) {
      if (event.isDeleted) continue;
      out.push({
        id: event.id,
        role: "event",
        title: event.title || untitled,
        detail: event.date,
        date: event.date,
        updatedAt: event.updatedAt,
        seriesId: event.routineId ?? undefined,
      });
    }
    for (const routine of sources.routines) {
      if (routine.isDeleted) continue;
      const occurrence = pickSeriesOccurrence(
        occurrencesBySeries.get(routine.id),
        today,
      );
      out.push({
        id: routine.id,
        role: "event",
        title: routine.title || untitled,
        detail: occurrence?.date,
        date: occurrence?.date,
        // Filed under the routine id, opened at the occurrence — see the
        // field's note in TagHub/types.ts.
        navigateId: occurrence?.id,
        isSeries: true,
        updatedAt: routine.updatedAt,
      });
    }
    for (const note of sources.notes) {
      if (note.isDeleted) continue;
      out.push({
        id: note.id,
        role: "note",
        title: note.title || untitled,
        updatedAt: note.updatedAt,
      });
    }
    for (const daily of sources.dailies) {
      if (daily.isDeleted) continue;
      out.push({
        id: daily.id,
        role: "daily",
        title: daily.date,
        updatedAt: daily.updatedAt,
      });
    }
    return out;
  }, [sources, t]);

  const model = useMemo(
    () =>
      buildTagHubModel({
        tags: wiki.allTags,
        assignments: wiki.allAssignments,
        items,
        untaggedName: t("connect.untagged"),
      }),
    [wiki.allTags, wiki.allAssignments, items, t],
  );

  const labels = useMemo<TagHubLabels>(
    () => ({
      tagsHeading: t("connect.tagsHeading"),
      filterPlaceholder: t("connect.filterPlaceholder"),
      filterLabel: t("connect.filterLabel"),
      listLabel: t("connect.listLabel"),
      empty: t("connect.empty"),
      filterEmpty: t("connect.filterEmpty"),
      tagEmpty: t("connect.tagEmpty"),
      selectHint: t("connect.selectHint"),
      back: t("connect.back"),
      roles: {
        task: t("itemRole.task"),
        event: t("itemRole.event"),
        note: t("itemRole.note"),
        daily: t("itemRole.daily"),
        unknown: t("itemRole.unknown"),
      },
    }),
    [t],
  );

  /*
   * Which tag is open (#1473). Seeded from — and written through to — the
   * module-level store rather than plain component state, because this screen
   * is unmounted by every section switch (sectionDescriptors mounts it inside
   * the switch) and the other sections all come back showing what the user
   * had open. The store is the same idiom Materials uses for its note / daily
   * / todo selection (#282); the view already tolerates a stored id whose tag
   * has since gone (it resolves to "nothing selected"), so no validation here.
   */
  const [selectedTagId, setSelectedTagIdState] = useState<string | null>(() =>
    getConnectTagSelection(),
  );
  const setSelectedTagId = useCallback((tagId: string | null) => {
    setConnectTagSelection(tagId);
    setSelectedTagIdState(tagId);
  }, []);
  const [query, setQuery] = useState("");

  const formatCount = useCallback(
    (count: number) => t("connect.itemCount", { count }),
    [t],
  );

  // The selected tag, resolved once here for the panel; the view resolves it
  // again for the main pane, which is cheap and keeps the view prop-driven.
  const selectedTag = useMemo(
    () =>
      selectedTagId
        ? (model.tags.find((tag) => tag.id === selectedTagId) ?? null)
        : null,
    [model.tags, selectedTagId],
  );
  const selectedGroups = useMemo(
    () => (selectedTag ? (model.groupsByTag.get(selectedTag.id) ?? []) : []),
    [model.groupsByTag, selectedTag],
  );
  const recent = useMemo(
    () =>
      selectedTag
        ? selectRecentTaggedItems({
            tagId: selectedTag.id,
            assignments: wiki.allAssignments,
            groups: selectedGroups,
          })
        : [],
    [selectedTag, selectedGroups, wiki.allAssignments],
  );

  const detailLabels = useMemo<TagHubDetailLabels>(
    () => ({
      breakdownHeading: t("connect.detail.breakdownHeading"),
      recentHeading: t("connect.detail.recentHeading"),
      recentUntaggedHeading: t("connect.detail.recentUntaggedHeading"),
      recentEmpty: t("connect.detail.recentEmpty"),
      roles: labels.roles,
    }),
    [t, labels.roles],
  );

  const handleOpenItem = useCallback(
    (item: TagHubItem) => {
      // `navigateId` when the row is filed under an id the destination cannot
      // select — today only a repeat series (#1631), which opens at the
      // occurrence its `date` already points the Calendar at.
      onNavigateToItem({
        id: item.navigateId ?? item.id,
        role: item.role,
        date: item.date,
      });
    },
    [onNavigateToItem],
  );

  return (
    <>
      {selectedTag && (
        <RightSidebarPortal>
          <TagHubDetailPanel
            tag={selectedTag}
            groups={selectedGroups}
            recent={recent}
            onOpenItem={handleOpenItem}
            formatCount={formatCount}
            labels={detailLabels}
          />
        </RightSidebarPortal>
      )}
      <TagHubView
        model={model}
        selectedTagId={selectedTagId}
        onSelectTag={setSelectedTagId}
        query={query}
        onQueryChange={setQuery}
        onOpenItem={handleOpenItem}
        formatCount={formatCount}
        wide={isWide}
        // The tags come from the Provider and the items from the load above;
        // either still in flight means the hub cannot yet tell "empty" from
        // "not read yet", which is the flash this prevents.
        isLoading={sourcesLoading || wiki.loading}
        labels={labels}
      />
    </>
  );
}

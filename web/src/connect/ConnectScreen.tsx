import { useCallback, useMemo, useState } from "react";
import {
  buildTagHubModel,
  TagHubView,
  useDomainLoad,
  useMediaQuery,
  useSyncDomains,
  useTranslation,
  useWikiTagsUnifiedContext,
  WIDE_QUERY,
  type DailyNode,
  type DataService,
  type NoteNode,
  type ScheduleItem,
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
 * NO PER-DOMAIN PROVIDER, on purpose. The hub reads across four domains and
 * writes to none, which is the same shape as Briefing and Trash — those call
 * the injected DataService directly rather than mounting four Providers for
 * four read-only lists. The one Provider it does sit inside is
 * WikiTagsUnifiedProvider (mounted by its descriptor row), because the tag and
 * assignment caches it holds are already loaded and already Realtime-tracked.
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

/** The four reads, kept raw so the labelling below can depend on `t`. */
interface ConnectSources {
  todos: TodoNode[];
  events: ScheduleItem[];
  notes: NoteNode[];
  dailies: DailyNode[];
}

const EMPTY_SOURCES: ConnectSources = {
  todos: [],
  events: [],
  notes: [],
  dailies: [],
};

export function ConnectScreen({
  dataService,
  onNavigateToItem,
}: ConnectScreenProps) {
  const { t } = useTranslation();
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const wiki = useWikiTagsUnifiedContext();

  // Every domain this screen reads. Under-declaring here is a silent stale the
  // user has no way to fix (rules/frontend.md §Sync). Tags are NOT listed: the
  // Provider above already tracks that domain and re-renders us with the new
  // assignments, so declaring it here would just re-run these four reads for a
  // change that cannot affect them.
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
      const [todos, events, notes, dailies] = await Promise.all([
        service.fetchTodoTree(),
        service.fetchEvents(),
        service.listNotesUnified(),
        service.listDailiesUnified(),
      ]);
      return { todos, events, notes, dailies };
    },
    apply: setSources,
    fallbackMessage: "Failed to load the tag hub",
  });

  /*
   * The four lists flattened into one row shape. The conventions here are the
   * command palette's (usePaletteItemSearch), deliberately: an event carries
   * its DATE because the Calendar cannot select a row outside the window it is
   * showing (#503), and a daily has no title of its own — its date IS its
   * name. `updatedAt` is what orders each kind, newest first.
   */
  const items = useMemo<TagHubItem[]>(() => {
    const untitled = t("common.untitled");
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

  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const formatCount = useCallback(
    (count: number) => t("connect.itemCount", { count }),
    [t],
  );

  const handleOpenItem = useCallback(
    (item: TagHubItem) => {
      onNavigateToItem({ id: item.id, role: item.role, date: item.date });
    },
    [onNavigateToItem],
  );

  return (
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
  );
}

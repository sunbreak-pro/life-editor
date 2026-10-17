import { useCallback, useMemo, useRef, useState } from "react";
import {
  buildTagHubModel,
  ConfirmDialog,
  buildItemRelations,
  BottomSheet,
  RelationPanel,
  RightSidebarPortal,
  selectRecentTaggedItems,
  TagHubDetailPanel,
  TagHubActionSheet,
  TagHubEditBlock,
  TagHubSelectionBar,
  TagHubView,
  useConfirmDialog,
  useDomainLoad,
  useItemPanelOptional,
  useMediaQuery,
  useRightSidebarOptional,
  useSyncDomains,
  useTagEditDrafts,
  useToastOptional,
  useTranslation,
  useWikiTagsUnifiedContext,
  getConnectItemSelection,
  logServiceError,
  getConnectTagSelection,
  setConnectItemSelection,
  setConnectTagSelection,
  todayCalendarKey,
  todoScheduleSlot,
  dateKeyOfInstant,
  WIDE_QUERY,
  type DailyNode,
  type DataService,
  type ItemPanelOptions,
  type NoteExcerpt,
  type NoteNode,
  type NoteTable,
  type RoutineNode,
  type ScheduleItem,
  type TagHubDetailLabels,
  type TagHubItem,
  type TagHubLabels,
  type BulkTagResult,
  type TagHubSelectionBarLabels,
  type TagHubTagSummary,
  type RelationPanelLabels,
  type TagRowEdits,
  type TodoNode,
  type TodoStatus,
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
 * and writes to none of them, which is the same shape as Briefing and Trash —
 * those call the injected DataService directly rather than mounting a Provider
 * per read-only list. The one Provider it does sit inside is
 * WikiTagsUnifiedProvider (mounted by its descriptor row), because the tag and
 * assignment caches it holds are already loaded and already Realtime-tracked —
 * and, since #1643, because that Provider is where the tag WRITES live too.
 *
 * TAG EDITING (#1643, D-20260912-main-1 Q1-A). The retired modal's host is
 * gone and this screen is the tag master. Three things live here that used to
 * live over there: the unsaved drafts behind the save button (#715), the
 * discard question asked when a draft would be unmounted by a change of
 * selection (#740), and the delete confirmation. All three are HOST state because the
 * view is pure and because the rail's filter and the selection both unmount the
 * block that would otherwise hold them.
 *
 * What did NOT come across is the modal's per-item unassign: on this screen
 * removing a tag from rows is a multi-select action in the selection bar
 * (#1644), which works on one checked row as well as on many.
 *
 * BULK SELECTION (#1644; both widths since #2224). The squares hide behind
 * the header's "Select" button: selection mode, and which rows are checked,
 * are host state, and both are dropped whenever the open tag changes — a
 * checked row under one tag means nothing under the next. The bar sits in the
 * tag rail on Desktop and over the list's bottom edge on a phone (the view
 * places it). The writes are the Provider's bulk methods,
 * which go row by row and report a count; a partial failure keeps what landed
 * and says how many did not (plan assumption 5).
 *
 * RELATIONS (#1645, D-20260912-main-1 Q2-A). Clicking an item row no longer
 * leaves the hub: it SELECTS the row, and the right panel switches from the
 * tag's breakdown to that item's neighbourhood — its links, what shares a tag
 * with it, its day's daily — where links can be added and removed for any
 * kind of item, not just a note. Leaving is the row's chevron or a double
 * click (plan assumption 1), and the panel is opened if it was closed
 * (assumption 2). The derivation is the shared `buildItemRelations`, which the
 * note header's "related" popover reads too.
 *
 * MOBILE (#1646). The narrow layout is the same three things one screen at a
 * time: the tag list, a tag's items, and the relations — which have no side
 * panel to live in, so they come up as a bottom sheet. Every row menu is a
 * sheet too (the rail's four actions, an item's two), and the one-action
 * sheets show the edit block cut down to the field they named.
 *
 * EDITING IN PLACE (#2224). A right-click (a long press on a phone) on a todo
 * or an event opens the Schedule's own editor over this screen, through the
 * item panel #2218 built; a note, a table or a daily opens on its own screen,
 * which is where those are edited. A todo's round checkbox writes its status
 * right here — the one-tap update the Mobile brief keeps on every surface.
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
  /** Note tables that were tagged (#2094) — their notes are live. */
  tables: NoteTable[];
  /** Each note's first line (#2224) — read without loading any body. */
  noteExcerpts: NoteExcerpt[];
}

/** Stable identity for "nothing checked" (#1644). */
const NO_CHECKS: ReadonlySet<string> = new Set();

const EMPTY_SOURCES: ConnectSources = {
  todos: [],
  events: [],
  notes: [],
  dailies: [],
  routines: [],
  tables: [],
  noteExcerpts: [],
};

/** Local day and HH:MM of a stored instant, for a row's left edge (#2224). */
function localDayAndTime(iso: string | undefined): {
  dayKey?: string;
  time?: string;
} {
  const dayKey = dateKeyOfInstant(iso);
  if (dayKey === null || iso === undefined) return {};
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
  return { dayKey, time };
}

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
  const { t, i18n } = useTranslation();
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
      const [todos, events, notes, dailies, routines, tables, noteExcerpts] =
        await Promise.all([
          service.fetchTodoTree(),
          service.fetchEvents(),
          service.listNotesUnified(),
          service.listDailiesUnified(),
          service.fetchAllRoutines(),
          service.fetchNoteTables(),
          // An excerpt is a second line under a title (#2224): a failed read
          // leaves the notes without one instead of the hub without rows.
          service.listNoteExcerptsUnified().catch((error: unknown) => {
            logServiceError(
              "Connect tag hub",
              "listNoteExcerptsUnified",
              error,
            );
            return [];
          }),
        ]);
      return {
        todos,
        events,
        notes,
        dailies,
        routines,
        tables,
        noteExcerpts,
      };
    },
    apply: setSources,
    fallbackMessage: "Failed to load the tag hub",
  });

  /*
   * Todo ticks still being written (#2224), painted over every read until
   * their write settles. `updateTodo` is several requests in a row, so the
   * refetch its own Realtime echo starts can land before the status does and
   * would un-tick the box for a moment (the goal tree's pendingTicks, #2108).
   */
  const [pendingStatus, setPendingStatus] = useState<
    ReadonlyMap<string, TodoStatus>
  >(() => new Map());

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
    /*
     * The left edge (#2224): a todo's scheduled day (local, the grid's own
     * rule — todoScheduleSlot) and its start unless it is all-day; an event's
     * day and start, or "All day"; a note's or a table's last update; a
     * daily's own date. The same pair orders each kind (buildTagHubModel).
     */
    for (const todo of sources.todos) {
      if (todo.isDeleted) continue;
      const slot = todoScheduleSlot(todo);
      out.push({
        id: todo.id,
        role: "task",
        title: todo.title || untitled,
        dayKey: slot?.date,
        time: slot && !slot.isAllDay ? slot.startTime : undefined,
        status: pendingStatus.get(todo.id) ?? todo.status ?? "NOT_STARTED",
        updatedAt: todo.updatedAt,
      });
    }
    for (const event of sources.events) {
      if (event.isDeleted) continue;
      out.push({
        id: event.id,
        role: "event",
        title: event.title || untitled,
        date: event.date,
        dayKey: event.date,
        time: event.isAllDay ? undefined : event.startTime,
        allDay: event.isAllDay === true,
        repeats: event.routineId !== null && event.routineId !== undefined,
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
        date: occurrence?.date,
        dayKey: occurrence?.date,
        time:
          occurrence && !occurrence.isAllDay ? occurrence.startTime : undefined,
        allDay: occurrence?.isAllDay === true,
        repeats: true,
        // Filed under the routine id, opened at the occurrence — see the
        // field's note in TagHub/types.ts.
        navigateId: occurrence?.id,
        isSeries: true,
        updatedAt: routine.updatedAt,
      });
    }
    const excerptById = new Map(
      sources.noteExcerpts.map((row) => [row.id, row.excerpt]),
    );
    for (const note of sources.notes) {
      if (note.isDeleted) continue;
      out.push({
        id: note.id,
        role: "note",
        title: note.title || untitled,
        // #2224 — the first line, read on its own (listNoteExcerptsUnified):
        // the note list never carries a body.
        detail: excerptById.get(note.id),
        ...localDayAndTime(note.updatedAt),
        updatedAt: note.updatedAt,
      });
    }
    /*
     * Note tables (#2094). A table opens the note it sits in — it has no
     * screen of its own — so the row is navigated as that note. The note's
     * title is the row's second line, which also tells two tables of the same
     * name apart. fetchNoteTables already drops tables of trashed notes; the
     * note list is checked again so the two reads cannot disagree on screen.
     */
    const noteTitleById = new Map<string, string>();
    for (const note of sources.notes) {
      if (!note.isDeleted) noteTitleById.set(note.id, note.title || untitled);
    }
    for (const table of sources.tables) {
      if (table.isDeleted) continue;
      const noteTitle = noteTitleById.get(table.parentNoteId);
      if (noteTitle === undefined) continue;
      out.push({
        id: table.id,
        role: "table",
        title: table.title || t("connect.untitledTable"),
        detail: noteTitle,
        navigateId: table.parentNoteId,
        navigateRole: "note",
        taggedOnly: true,
        // Not in the prototype (it predates #2094): dated like a note, by
        // its last update.
        ...localDayAndTime(table.updatedAt),
        updatedAt: table.updatedAt,
      });
    }
    for (const daily of sources.dailies) {
      if (daily.isDeleted) continue;
      out.push({
        id: daily.id,
        role: "daily",
        title: daily.date,
        dayKey: daily.date,
        updatedAt: daily.updatedAt,
      });
    }
    return out;
  }, [sources, t, pendingStatus]);

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

  const isLoading = sourcesLoading || wiki.loading;

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
      unusedTagsHeading: t("connect.unusedTagsHeading"),
      addPlaceholder: t("connect.addPlaceholder"),
      addButton: t("connect.addButton"),
      duplicateName: t("connect.duplicateName"),
      createFailed: t("connect.createFailed"),
      emptyAction: t("connect.emptyAction"),
      loading: t("connect.loading"),
      rowMenu: t("connect.rowMenu"),
      sheetClose: t("connect.sheetClose"),
      editTagMenu: t("connect.editTagMenu"),
      deleteTag: t("connect.deleteTag"),
      editTag: t("connect.editTag"),
      edit: {
        nameLabel: t("connect.edit.nameLabel"),
        iconLabel: t("connect.edit.iconLabel"),
        colorLabel: t("connect.edit.colorLabel"),
        iconChange: t("connect.edit.iconChange"),
        iconClear: t("connect.edit.iconClear"),
        iconSearch: t("connect.edit.iconSearch"),
        iconNoMatch: t("connect.edit.iconNoMatch"),
        colorDefault: t("connect.edit.colorDefault"),
        colorCustom: t("connect.edit.colorCustom"),
        deleteTag: t("connect.deleteTag"),
        saved: t("connect.edit.saved"),
        unsaved: t("connect.edit.unsaved"),
        save: t("connect.edit.save"),
        duplicateName: t("connect.edit.duplicateName"),
        saveFailed: t("connect.edit.saveFailed"),
      },
      noDate: t("connect.row.noDate"),
      allDay: t("connect.row.allDay"),
      repeats: t("connect.row.repeats"),
      done: t("connect.row.done"),
      todoStatus: t("todoDetail.status"),
      todoStatusLabels: {
        statusNotStarted: t("todoDetail.statusNotStarted"),
        statusDone: t("todoDetail.statusDone"),
      },
      select: t("connect.selection.start"),
      selectEnd: t("connect.selection.end"),
      roles: {
        task: t("itemRole.task"),
        event: t("itemRole.event"),
        note: t("itemRole.note"),
        table: t("itemRole.table"),
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
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(NO_CHECKS);
  // Selection mode (#2224) — the squares are drawn only while it is on.
  const [selecting, setSelecting] = useState(false);
  /*
   * The item whose relations the panel is showing (#1645). Stored beside the
   * tag for the same reason (#1473): the section switch unmounts this screen,
   * and coming back to a panel that has forgotten what it was reading is the
   * thing that store exists to prevent.
   */
  const [selectedItemId, setSelectedItemIdState] = useState<string | null>(() =>
    getConnectItemSelection(),
  );
  const selectItem = useCallback((itemId: string | null) => {
    setConnectItemSelection(itemId);
    setSelectedItemIdState(itemId);
  }, []);
  const commitSelection = useCallback(
    (tagId: string | null) => {
      setConnectTagSelection(tagId);
      setSelectedTagIdState(tagId);
      setCheckedIds(NO_CHECKS);
      setSelecting(false);
      // A row picked under the old tag says nothing about the new one.
      selectItem(null);
    },
    [selectItem],
  );
  const [query, setQuery] = useState("");

  /*
   * The editing state (#1643, carried over from the retired modal). The drafts
   * themselves live in `useTagEditDrafts` (#1676) — an overlay per tag, kept
   * for every tag so the rail's filter cannot drop one — and this host adds the
   * part that is about THIS screen: which tag is open, and the discard question.
   *
   * `pendingSelectId` is where the user asked to go while a draft is pending,
   * held until the discard question is answered; the current selection stays
   * put, because refusing has to leave the screen exactly as it was.
   */
  const drafts = useTagEditDrafts(wiki.allTags, wiki);
  const [editOpen, setEditOpen] = useState(false);
  // "Edit tag" asks for the caret in the name field; one-shot (see below).
  const [editFocusName, setEditFocusName] = useState(false);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);
  /*
   * Whether the narrow edit sheet is up (#1646; one "Edit tag" sheet since
   * #1886). Separate from `editFocusName`, which is a one-shot focus request
   * the first interaction with the block consumes — driving the sheet from it
   * would close the sheet on the first keystroke.
   */
  const [sheetOpen, setSheetOpen] = useState(false);

  const selectTag = useCallback(
    (tagId: string | null) => {
      if (tagId === selectedTagId) return;
      // Selecting elsewhere unmounts the edit block, so a pending draft has to
      // be asked about before it goes (#740). Leaving the SECTION does not ask:
      // there is no close affordance to hang the question on, and the drafts
      // are discarded silently (plan assumption 3).
      if (selectedTagId && drafts.isDirty(selectedTagId)) {
        setPendingSelectId(tagId);
        return;
      }
      commitSelection(tagId);
      setEditFocusName(false);
    },
    [selectedTagId, drafts, commitSelection],
  );

  const confirmSwitch = useCallback(() => {
    // Discard means discard: the draft the user chose to abandon must not be
    // waiting for them when they come back to the tag.
    if (selectedTagId) drafts.discard(selectedTagId);
    commitSelection(pendingSelectId);
    setEditFocusName(false);
    setPendingSelectId(null);
  }, [selectedTagId, pendingSelectId, commitSelection, drafts]);

  const editSelected = useCallback(
    (patch: TagRowEdits) => {
      if (!selectedTagId) return;
      drafts.edit(selectedTagId, patch);
      // The focus request is consumed by the first interaction with the block,
      // so a re-render does not steal the caret back to the menu's field.
      setEditFocusName(false);
    },
    [selectedTagId, drafts],
  );

  const dropEdit = useCallback(
    (field: keyof TagRowEdits) => {
      if (selectedTagId) drafts.drop(selectedTagId, field);
    },
    [selectedTagId, drafts],
  );

  // Resolves false when the save was refused or failed (#1847), so the narrow
  // sheet stays open on the reason instead of closing over it.
  const saveSelected = useCallback(
    (): Promise<boolean> =>
      selectedTagId ? drafts.save(selectedTagId) : Promise.resolve(true),
    [selectedTagId, drafts],
  );
  const editErrorFor = useCallback(
    (tagId: string | null): string | null => {
      const error = tagId ? drafts.errorFor(tagId) : null;
      if (error === "duplicate") return t("connect.edit.duplicateName");
      if (error === "failed") return t("connect.edit.saveFailed");
      return null;
    },
    [drafts, t],
  );

  const openEditOn = useCallback(
    (tagId: string) => {
      // The rail's "…" can name a tag that is not the open one, so this both
      // selects and opens — and goes through `selectTag`, which is what asks
      // about a draft on the tag being left.
      if (tagId !== selectedTagId) selectTag(tagId);
      setEditFocusName(true);
      // Narrow opens the editor in a sheet of its own and leaves the inline
      // block shut — opening both drew the Name field and Save twice, one
      // over the other (#1851). The wide layout opens the block inline and
      // only moves the caret.
      if (isWide) setEditOpen(true);
      else setSheetOpen(true);
    },
    [selectedTagId, selectTag, isWide],
  );

  /*
   * Deleting a tag asks first — the modal's delete button did not, and this
   * one sits in a row menu where the pointer is already moving. The question
   * is the in-app <ConfirmDialog> (#707 / #729), never the browser's own:
   * that lands outside the theme and freezes the page hard enough to stall
   * Playwright.
   */
  const {
    request: confirmRequest,
    ask: askConfirm,
    resolve: resolveConfirm,
  } = useConfirmDialog();
  const requestDelete = useCallback(
    (tagId: string) => {
      const tag = wiki.allTags.find((row) => row.id === tagId);
      void (async () => {
        const ok = await askConfirm({
          message: t("connect.deleteConfirm", { name: tag?.name ?? "" }),
          confirmLabel: t("connect.deleteTag"),
          cancelLabel: t("common.cancel"),
          danger: true,
        });
        if (!ok) return;
        void wiki.deleteTag(tagId);
        if (tagId === selectedTagId) {
          // The rail row is about to vanish; leaving the pane pointed at it
          // would keep an editor open over a tag that no longer exists.
          drafts.discard(tagId);
          commitSelection(null);
          setEditOpen(false);
        }
      })();
    },
    [wiki, askConfirm, t, selectedTagId, commitSelection, drafts],
  );

  /*
   * Bulk writes (#1644). Held off while one runs (the bar's buttons disable),
   * and the checked rows are cleared once it finishes: the rows a "remove" or
   * "move" acted on have left this tag, and keeping the rest checked after an
   * "add" would invite the same write twice.
   */
  const toast = useToastOptional();
  const [bulkBusy, setBulkBusy] = useState(false);
  const reportFailure = useCallback(
    (failed: number) => {
      const message = t("connect.selection.failed", { count: failed });
      if (toast) toast.showToast("danger", message);
      else console.error(message);
    },
    [t, toast],
  );
  const runBulk = useCallback(
    async (write: (itemIds: string[]) => Promise<BulkTagResult>) => {
      const itemIds = [...checkedIds];
      if (itemIds.length === 0) return;
      setBulkBusy(true);
      try {
        const result = await write(itemIds);
        if (result.failed > 0) reportFailure(result.failed);
      } catch {
        reportFailure(itemIds.length);
      } finally {
        setBulkBusy(false);
        setCheckedIds(NO_CHECKS);
      }
    },
    [checkedIds, reportFailure],
  );
  const toggleChecked = useCallback((itemId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);
  const clearChecked = useCallback(() => setCheckedIds(NO_CHECKS), []);
  // Ending the mode drops the selection too — "Done selecting" means done.
  const toggleSelecting = useCallback(() => {
    setSelecting((on) => !on);
    setCheckedIds(NO_CHECKS);
  }, []);

  // The promise goes back to the rail, which keeps the typed name and shows
  // why when the create fails (#1847). Once the tag exists it is selected
  // (#1848), so the rail shows it — opening "Unused tags" if that is where it
  // sorts — and the pane reads it.
  const createTag = useCallback(
    (name: string) =>
      wiki.createTag(name).then((created) => {
        selectTag(created.id);
        return created;
      }),
    [wiki, selectTag],
  );

  const formatCount = useCallback(
    (count: number) => t("connect.itemCount", { count }),
    [t],
  );
  const formatUnusedTags = useCallback(
    (count: number) => t("connect.unusedTags", { count }),
    [t],
  );

  // The selected tag, resolved once here for the panel; the view resolves it
  // again for the main pane, which is cheap and keeps the view prop-driven.
  // Across both runs, because an unused tag is selectable too (#1643).
  const selectedTag = useMemo<TagHubTagSummary | null>(
    () =>
      selectedTagId
        ? ([...model.tags, ...model.unusedTags].find(
            (tag) => tag.id === selectedTagId,
          ) ?? null)
        : null,
    [model.tags, model.unusedTags, selectedTagId],
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

  // Every live tag, for the bulk choosers — unused ones
  // included, since filing items under a fresh tag is how it stops being one.
  const pickableTags = useMemo(
    () => [...model.tags.filter((tag) => !tag.isUntagged), ...model.unusedTags],
    [model.tags, model.unusedTags],
  );

  const selectionLabels = useMemo<TagHubSelectionBarLabels>(
    () => ({
      region: t("connect.selection.region"),
      assign: t("connect.selection.assign"),
      remove: t("connect.selection.remove"),
      move: t("connect.selection.move"),
      clear: t("connect.selection.clear"),
      assignTitle: t("connect.selection.assignTitle"),
      moveTitle: t("connect.selection.moveTitle"),
      picker: {
        search: t("connect.selection.search"),
        formatCreate: (name) => t("connect.selection.create", { name }),
        empty: t("connect.selection.pickerEmpty"),
      },
    }),
    [t],
  );

  /*
   * The relations of the selected row (#1645). `itemsById` is the hub's own
   * item list keyed by id, which doubles as the pool that NAMES a relation:
   * an id it cannot name is left out, the same rule LinkPanel follows.
   */
  const itemsById = useMemo(() => {
    const map = new Map<
      string,
      TagHubItem & { label: string; isDeleted?: boolean }
    >();
    for (const item of items) map.set(item.id, { ...item, label: item.title });
    return map;
  }, [items]);

  const selectedItem = selectedItemId
    ? (itemsById.get(selectedItemId) ?? null)
    : null;

  const relations = useMemo(
    () =>
      selectedItem
        ? buildItemRelations({
            itemId: selectedItem.id,
            assignments: wiki.allAssignments,
            links: wiki.getLinksForItem(selectedItem.id),
            itemsById,
            // Only a dated row has a day of its own; a daily IS its day, so
            // pointing it at itself would list the row under its own panel.
            dailyDate:
              selectedItem.role === "daily" ? undefined : selectedItem.date,
          })
        : null,
    [selectedItem, wiki, itemsById],
  );

  const linkedRelations = useMemo(
    () =>
      (relations?.linked ?? []).flatMap((entry) => {
        const item = itemsById.get(entry.targetId);
        return item ? [{ item, linkIds: entry.linkIds }] : [];
      }),
    [relations, itemsById],
  );

  /** What a new link may point at: everything but this row and its links. */
  const linkCandidates = useMemo(() => {
    if (!selectedItem) return [];
    const taken = new Set((relations?.linked ?? []).map((l) => l.targetId));
    return items.filter(
      (item) => item.id !== selectedItem.id && !taken.has(item.id),
    );
  }, [items, relations, selectedItem]);

  const relationLabels = useMemo<RelationPanelLabels>(
    () => ({
      back: t("connect.relations.back"),
      openItem: t("connect.relations.openItem"),
      links: t("connect.relations.links"),
      sharedTags: t("connect.relations.sharedTags"),
      sameDayDaily: t("connect.relations.sameDayDaily"),
      formatSection: (label, count) =>
        t("connect.relations.section", { label, count }),
      sectionEmpty: t("connect.relations.sectionEmpty"),
      formatRemoveLink: (title) => t("connect.relations.removeLink", { title }),
      addLink: t("connect.relations.addLink"),
      addLinkDialog: t("connect.relations.addLinkDialog"),
      searchPlaceholder: t("connect.relations.searchPlaceholder"),
      candidates: t("connect.relations.candidates"),
      noCandidates: t("connect.relations.noCandidates"),
      roles: labels.roles,
    }),
    [t, labels.roles],
  );

  // Picking a row with the panel shut would look like nothing happened
  // (assumption 2). Optional: a host with no panel (a test, a standalone
  // render) keeps working.
  const rightSidebar = useRightSidebarOptional();
  const handleSelectItem = useCallback(
    (item: TagHubItem) => {
      selectItem(item.id === selectedItemId ? null : item.id);
      if (!rightSidebar?.isOpen) rightSidebar?.open();
    },
    [selectItem, selectedItemId, rightSidebar],
  );

  const removeLink = useCallback(
    (linkIds: readonly string[]) => {
      void (async () => {
        // Sequential: the Context mutator rewrites the same bulk cache each
        // time, and two writes landing together can drop one update.
        for (const linkId of linkIds) {
          try {
            await wiki.deleteItemLink(linkId);
          } catch {
            toast?.showToast("danger", t("connect.relations.writeFailed"));
            return;
          }
        }
      })();
    },
    [wiki, toast, t],
  );

  const addLink = useCallback(
    (target: TagHubItem) => {
      if (!selectedItemId) return;
      void wiki.createItemLink(selectedItemId, target.id).catch(() => {
        toast?.showToast("danger", t("connect.relations.writeFailed"));
      });
    },
    [wiki, selectedItemId, toast, t],
  );

  /*
   * The narrow row menus (#1646). Which item's sheet is open is host state,
   * because its two actions both write (unassign) or move the selection.
   */
  const [sheetItem, setSheetItem] = useState<TagHubItem | null>(null);
  const removeTagFromItem = useCallback(
    (item: TagHubItem) => {
      if (!selectedTagId || selectedTag?.isUntagged) return;
      void (async () => {
        const result = await wiki.bulkUnassign([item.id], selectedTagId);
        if (result.failed > 0) reportFailure(result.failed);
      })();
    },
    [wiki, selectedTagId, selectedTag, reportFailure],
  );

  const handleOpenItem = useCallback(
    (item: TagHubItem) => {
      // `navigateId` when the row is filed under an id the destination cannot
      // select — a repeat series (#1631), which opens at the occurrence its
      // `date` already points the Calendar at, and a note table (#2094), which
      // opens its note (`navigateRole`).
      onNavigateToItem({
        id: item.navigateId ?? item.id,
        role: item.navigateRole ?? item.role,
        date: item.date,
      });
    },
    [onNavigateToItem],
  );

  /*
   * The round checkbox (#2224): painted at once through `pendingStatus`, held
   * over every read until the write settles, and taken back with a toast if
   * the write fails.
   */
  // Per todo (#2224 review): the latest press on each row, and the chain its
  // writes run on. One counter for the whole screen let a second row's press
  // strand the first row's overlay; parallel writes to one row could land out
  // of order (`updateTodo` is several requests).
  const statusTokens = useRef(new Map<string, number>());
  const statusChains = useRef(new Map<string, Promise<void>>());
  const setTodoStatus = useCallback(
    (item: TagHubItem, next: TodoStatus) => {
      const token = (statusTokens.current.get(item.id) ?? 0) + 1;
      statusTokens.current.set(item.id, token);
      const isLatest = () => statusTokens.current.get(item.id) === token;
      // Drops the overlay only for the latest press: an earlier write settling
      // must not repaint over what the user pressed since.
      const settle = () => {
        if (!isLatest()) return;
        setPendingStatus((prev) => {
          if (!prev.has(item.id)) return prev;
          const rest = new Map(prev);
          rest.delete(item.id);
          return rest;
        });
      };
      setPendingStatus((prev) => new Map(prev).set(item.id, next));
      const previous = statusChains.current.get(item.id) ?? Promise.resolve();
      const run = previous.then(() =>
        dataService
          .updateTodo(item.id, {
            status: next,
            completedAt: next === "DONE" ? new Date().toISOString() : undefined,
          })
          .then(
            () => {
              // What was written stays on screen until the next read lands.
              setSources((prev) => ({
                ...prev,
                todos: prev.todos.map((todo) =>
                  todo.id === item.id ? { ...todo, status: next } : todo,
                ),
              }));
              settle();
            },
            () => {
              // The overlay goes, so the box shows the last status that WAS
              // written — the tick is taken back, not left lying.
              settle();
              toast?.showToast("danger", t("connect.row.statusFailed"));
            },
          ),
      );
      statusChains.current.set(item.id, run);
      void run.finally(() => {
        if (statusChains.current.get(item.id) === run) {
          statusChains.current.delete(item.id);
        }
      });
    },
    [dataService, toast, t],
  );

  /*
   * Right-click / long press (#2224). A todo or an event opens the Schedule's
   * editor over this screen (#2218); the panel's "Open in Schedule" hands the
   * item to the same item-nav a chevron uses. An event row with no day to
   * load (a repeat that has never fired) and every other kind open where they
   * live instead — and so does everything when no ItemPanel Provider is
   * mounted (a standalone render).
   */
  const itemPanel = useItemPanelOptional();
  const panelOptions = useMemo<ItemPanelOptions>(
    () => ({
      onOpenInSchedule: (target) =>
        onNavigateToItem(
          target.date === null
            ? { id: target.id, role: target.role }
            : { id: target.id, role: target.role, date: target.date },
        ),
      onNavigateToItem,
    }),
    [onNavigateToItem],
  );
  const editItem = useCallback(
    (item: TagHubItem) => {
      if (itemPanel && item.role === "task") {
        itemPanel.openEdit({ role: "task", id: item.id }, panelOptions);
        return;
      }
      if (itemPanel && item.role === "event" && item.date) {
        itemPanel.openEdit(
          { role: "event", id: item.navigateId ?? item.id, date: item.date },
          panelOptions,
        );
        return;
      }
      handleOpenItem(item);
    },
    [itemPanel, panelOptions, handleOpenItem],
  );

  const formatDay = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const short = new Intl.DateTimeFormat(i18n.language, {
      month: "numeric",
      day: "numeric",
      weekday: "short",
    });
    const long = new Intl.DateTimeFormat(i18n.language, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    return (dayKey: string): string => {
      const [y, m, d] = dayKey.split("-").map(Number);
      if (!y || !m || !d) return dayKey;
      // Another year's day says which year, or "3/4" is ambiguous.
      return (y === thisYear ? short : long).format(new Date(y, m - 1, d));
    };
  }, [i18n.language]);

  return (
    <>
      {selectedItem && relations ? (
        <RightSidebarPortal>
          <RelationPanel
            item={selectedItem}
            linked={linkedRelations}
            sharedTagItems={relations.sharedTagItems}
            sameDayDaily={relations.sameDayDaily}
            candidates={linkCandidates}
            onBack={() => selectItem(null)}
            onOpenItem={handleOpenItem}
            onRemoveLink={removeLink}
            onAddLink={addLink}
            labels={relationLabels}
          />
        </RightSidebarPortal>
      ) : selectedTag ? (
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
      ) : null}
      <TagHubView
        model={model}
        selectedTagId={selectedTagId}
        onSelectTag={selectTag}
        query={query}
        onQueryChange={setQuery}
        onOpenItem={handleOpenItem}
        formatCount={formatCount}
        formatUnusedTags={formatUnusedTags}
        wide={isWide}
        // The tags come from the Provider and the items from the load above;
        // either still in flight means the hub cannot yet tell "empty" from
        // "not read yet", which is the flash this prevents.
        isLoading={isLoading}
        labels={labels}
        editOpen={editOpen}
        onToggleEdit={() => {
          setEditOpen((v) => !v);
          setEditFocusName(false);
        }}
        onEditTag={openEditOn}
        editFocusName={editFocusName}
        edits={drafts.editsFor(selectedTagId ?? "")}
        editDirty={selectedTagId ? drafts.isDirty(selectedTagId) : false}
        onEditChange={editSelected}
        onEditDrop={dropEdit}
        onEditSave={() => void saveSelected()}
        editError={editErrorFor(selectedTagId)}
        onDeleteTag={requestDelete}
        onCreateTag={createTag}
        // Bulk selection, behind the header's "Select" (#2224).
        selecting={selecting}
        onToggleSelecting={toggleSelecting}
        checkedItemIds={checkedIds}
        onToggleItemChecked={toggleChecked}
        formatDay={formatDay}
        onToggleTodoStatus={setTodoStatus}
        onItemContextMenu={editItem}
        formatSelectItem={(title) =>
          t("connect.selection.selectItem", { title })
        }
        // Row click = select, chevron / double click = leave — Desktop only.
        // A phone screen has one pane, so a tap still opens the item (M3).
        activeItemId={isWide ? selectedItemId : null}
        onSelectItem={isWide ? handleSelectItem : undefined}
        formatOpenItem={(title) => t("connect.relations.openRow", { title })}
        // M3 — the narrow row's own actions button.
        onItemMenu={isWide ? undefined : setSheetItem}
        formatItemMenu={(title) => t("connect.mobile.itemMenu", { title })}
        selectionBar={
          selecting && selectedTag && checkedIds.size > 0 ? (
            <TagHubSelectionBar
              layout={isWide ? "rail" : "row"}
              count={checkedIds.size}
              formatSelected={(count) =>
                t("connect.selection.selected", { count })
              }
              tags={pickableTags}
              currentTagId={selectedTag.id}
              canRemove={!selectedTag.isUntagged}
              busy={bulkBusy}
              onAssign={(tagId) =>
                void runBulk((ids) => wiki.bulkAssign(ids, tagId))
              }
              onCreateAndAssign={(name) =>
                void runBulk(async (ids) => {
                  const created = await wiki.createTag(name);
                  return wiki.bulkAssign(ids, created.id);
                })
              }
              onRemove={() =>
                void runBulk((ids) => wiki.bulkUnassign(ids, selectedTag.id))
              }
              onMove={(tagId) =>
                void runBulk((ids) =>
                  wiki.moveItemsToTag(ids, selectedTag.id, tagId),
                )
              }
              onClear={clearChecked}
              labels={selectionLabels}
            />
          ) : null
        }
      />

      {/* The narrow row's "…" (M3): read what it relates to, or take this
          tag off it. Neither is destructive enough for the danger tint — the
          brief says so for the second one explicitly. */}
      <TagHubActionSheet
        open={!isWide && sheetItem !== null}
        onClose={() => setSheetItem(null)}
        title={t("connect.mobile.itemMenu", { title: sheetItem?.title ?? "" })}
        closeLabel={t("connect.sheetClose")}
        actions={
          sheetItem
            ? [
                {
                  label: t("connect.mobile.seeRelations"),
                  onSelect: () => selectItem(sheetItem.id),
                },
                ...(selectedTag && !selectedTag.isUntagged
                  ? [
                      {
                        label: t("connect.mobile.removeThisTag"),
                        onSelect: () => removeTagFromItem(sheetItem),
                      },
                    ]
                  : []),
              ]
            : []
        }
      />

      {/* The relations, which on a phone have no panel to sit in (M4). */}
      {!isWide && selectedItem && relations && (
        <BottomSheet
          open
          onClose={() => selectItem(null)}
          title={t("connect.mobile.relationsSheet", {
            title: selectedItem.title,
          })}
          closeLabel={t("connect.sheetClose")}
        >
          <RelationPanel
            item={selectedItem}
            linked={linkedRelations}
            sharedTagItems={relations.sharedTagItems}
            sameDayDaily={relations.sameDayDaily}
            candidates={linkCandidates}
            onBack={() => selectItem(null)}
            onOpenItem={handleOpenItem}
            onRemoveLink={removeLink}
            onAddLink={addLink}
            addLinkOpensDown
            labels={relationLabels}
          />
        </BottomSheet>
      )}

      {/* The narrow editor (M1): the rail's "Edit tag" opens the whole block
          in a sheet (#1886 — it used to be one sheet per field). */}
      {!isWide && selectedTag && sheetOpen && (
        <BottomSheet
          open
          onClose={() => setSheetOpen(false)}
          title={`${selectedTag.name}: ${labels.editTag}`}
          closeLabel={t("connect.sheetClose")}
        >
          <TagHubEditBlock
            tag={selectedTag}
            edits={drafts.editsFor(selectedTag.id)}
            dirty={drafts.isDirty(selectedTag.id)}
            onEdit={editSelected}
            onDropEdit={dropEdit}
            onSave={() => {
              void saveSelected().then((ok) => {
                if (ok) setSheetOpen(false);
              });
            }}
            error={editErrorFor(selectedTag.id)}
            onDelete={() => requestDelete(selectedTag.id)}
            labels={labels.edit}
          />
        </BottomSheet>
      )}

      {/* The discard question, asked when another tag is picked while this one
          holds a draft (#740). Mounted beside the view so it portals above it. */}
      {pendingSelectId !== null && (
        <ConfirmDialog
          open
          message={t("connect.unsavedSwitchConfirm")}
          confirmLabel={t("common.discard")}
          cancelLabel={t("common.cancel")}
          // Throwing away typed-in work is the destructive answer here, even
          // though nothing is deleted from the database.
          danger
          onConfirm={confirmSwitch}
          onCancel={() => setPendingSelectId(null)}
        />
      )}

      {confirmRequest && (
        <ConfirmDialog
          open
          message={confirmRequest.message}
          confirmLabel={confirmRequest.confirmLabel}
          cancelLabel={confirmRequest.cancelLabel}
          danger={confirmRequest.danger}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
      )}
    </>
  );
}

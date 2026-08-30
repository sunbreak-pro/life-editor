import { useCallback, useMemo, useState } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import {
  Button,
  Card,
  NoticePanel,
  TrashView,
  isScheduleRestoreConflict,
  useDomainLoad,
  useSyncDomains,
  useTranslation,
  type DataService,
  type TrashBusy,
  type TrashCategory,
  type TrashGroup,
  type DailyNode,
  type NoteNode,
  type RoutineNode,
  type ScheduleItem,
  type TodoNode,
} from "@life-editor/shared";

/*
 * Web Trash host (W2 / target IA 2026-07-05). The web build mounts Providers
 * per-section, so the five soft-delete categories never share one context
 * tree. Instead this host calls the injected DataService directly (allowed
 * for hosts — CLAUDE.md §6.4 forbids it only inside shared hooks/primitives),
 * fetches every category's deleted rows in parallel, resolves i18n with t(),
 * and feeds the pure shared <TrashView> with grouped data + restore/delete
 * callbacks. After a restore/permanentDelete it re-fetches so the list
 * reflects the new state. The shell SectionHeader owns the page title
 * (Layout Standard v2), so loading renders only a pulsing skeleton
 * (design 1e), errors render a retryable card (1f), and the in-flight
 * action is passed down as a row-level TrashBusy marker (1g).
 *
 * The five reads run through `useDomainLoad` (#1157): the rows survive the
 * section unmount in the `trashLists` slot, so returning to Trash draws the
 * list it had instead of the skeleton (#1038 3.1), and the screen finally
 * declares its Sync domains — a restore made anywhere else used to leave this
 * list stale until it was remounted.
 *
 * FETCH AND LABELLING ARE SPLIT. `load` returns the raw rows and knows nothing
 * about `t`; the memo below turns them into `TrashGroup[]`. Folding the
 * grouping into the fetch (as it was) made `t` an input of the fetch, so a
 * language switch re-read all five lists — and, worse, `useDomainLoad` reads
 * `load` through a ref, which would have frozen the group titles at whatever
 * language was in force when the read fired.
 */

interface TrashScreenProps {
  dataService: DataService;
}

/** Bar widths cycled per skeleton row so the placeholder list looks organic. */
const SKELETON_LABEL_WIDTHS = ["w-2/5", "w-1/4", "w-1/3"];

/** The five soft-delete lists, exactly as the DataService hands them over. */
interface DeletedRows {
  todos: TodoNode[];
  notes: NoteNode[];
  dailies: DailyNode[];
  routines: RoutineNode[];
  events: ScheduleItem[];
}

const NO_ROWS: DeletedRows = {
  todos: [],
  notes: [],
  dailies: [],
  routines: [],
  events: [],
};

/*
 * The screen renders a retry card rather than a message, so this text never
 * reaches the user — but `useDomainLoad` keys "is there an error" on a string,
 * and one constant keeps the two failure paths (the hook's own read, and the
 * imperative `reload`) indistinguishable to the render below.
 */
const TRASH_FETCH_FAILED = "trash-fetch-failed";

export function TrashScreen({ dataService: ds }: TrashScreenProps) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<DeletedRows>(NO_ROWS);
  // Only the error-card retry raises the skeleton by hand; the mount load has
  // useDomainLoad's derived `isLoading` for that.
  const [retrying, setRetrying] = useState(false);
  const [busy, setBusy] = useState<TrashBusy | null>(null);
  /**
   * Why a restore did not happen (#932). Separate from `error`, which swaps
   * the whole screen for a retry card — the list is fine here, one row just
   * declined to come back and the user needs to be told which way.
   */
  const [restoreNotice, setRestoreNotice] = useState<
    "conflict" | "failed" | null
  >(null);

  const untitled = t("common.untitled", { defaultValue: "Untitled" });

  const categoryTitle = useCallback(
    (category: TrashCategory): string => {
      switch (category) {
        case "todos":
          return t("trash.todos");
        case "notes":
          return t("trash.notes");
        case "dailies":
          return t("trash.dailies");
        case "routines":
          return t("trash.routines");
        case "events":
          return t("trash.events");
      }
    },
    [t],
  );

  // Every table this screen lists (rules/frontend.md Sync). routines and
  // events both ride the `schedule` counter (syncDomains.ts).
  const syncVersion = useSyncDomains("todos", "notes", "dailies", "schedule");

  /** The five reads, DataService only — no `t`, no React state. */
  const readAll = useCallback(
    async (service: DataService): Promise<DeletedRows> => {
      const [todos, notes, dailies, routines, events] = await Promise.all([
        service.fetchDeletedTodos(),
        service.fetchDeletedNotesUnified(),
        service.fetchDeletedDailiesUnified(),
        service.fetchDeletedRoutines(),
        service.fetchDeletedScheduleItems(),
      ]);
      return { todos, notes, dailies, routines, events };
    },
    [],
  );

  const { isLoading, error, setError } = useDomainLoad<DeletedRows>({
    domain: "Trash",
    dataService: ds,
    version: syncVersion,
    snapshotKey: "trashLists",
    // A Realtime bump is usually this screen's own restore echoing back, so
    // swapping the list for the skeleton would flash on every action taken
    // here.
    refetchReportsLoading: false,
    load: readAll,
    apply: setRows,
    fallbackMessage: TRASH_FETCH_FAILED,
  });

  const groups = useMemo<TrashGroup[]>(
    () => [
      {
        category: "todos",
        title: categoryTitle("todos"),
        items: rows.todos.map((x) => ({
          id: x.id,
          label: x.title || untitled,
        })),
      },
      {
        category: "notes",
        title: categoryTitle("notes"),
        items: rows.notes.map((x) => ({
          id: x.id,
          label: x.title || untitled,
        })),
      },
      {
        category: "dailies",
        title: categoryTitle("dailies"),
        items: rows.dailies.map((x) => ({
          id: x.id,
          label: x.date || untitled,
        })),
      },
      {
        category: "routines",
        title: categoryTitle("routines"),
        items: rows.routines.map((x) => ({
          id: x.id,
          label: x.title || untitled,
        })),
      },
      {
        category: "events",
        title: categoryTitle("events"),
        items: rows.events.map((x) => ({
          id: x.id,
          label: x.title || untitled,
        })),
      },
    ],
    [rows, categoryTitle, untitled],
  );

  /*
   * The imperative refresh after a restore / permanent delete. It writes state
   * directly instead of going through `useDomainLoad`, the same shape as
   * useScheduleItemsAPI's `loadDate` and useWikiTagsUnifiedAPI's `refresh` —
   * the hook only stores a snapshot for the reads IT fires. So the stored rows
   * are one action stale for a moment; then the Realtime echo of that same
   * write bumps `syncVersion`, the hook re-reads, and the snapshot catches up
   * on its own.
   */
  const reload = useCallback(async () => {
    try {
      setRows(await readAll(ds));
      setError(null);
    } catch {
      setError(TRASH_FETCH_FAILED);
    }
  }, [ds, readAll, setError]);

  // Full retry from the error card: back to the skeleton, then re-fetch.
  // `isLoading` is derived inside useDomainLoad and cannot be raised from out
  // here, so this one path carries its own flag.
  const retry = useCallback(() => {
    setRetrying(true);
    void reload().finally(() => setRetrying(false));
  }, [reload]);

  const handleRestore = useCallback(
    async (category: TrashCategory, id: string) => {
      setBusy({ category, id, action: "restore" });
      setRestoreNotice(null);
      try {
        await restoreByCategory(ds, category, id);
        await reload();
      } catch (e) {
        // A refused restore used to leave via an unhandled rejection: the
        // row stayed in the trash after the reload and nothing said why.
        setRestoreNotice(isScheduleRestoreConflict(e) ? "conflict" : "failed");
        await reload();
      } finally {
        setBusy(null);
      }
    },
    [ds, reload],
  );

  const handlePermanentDelete = useCallback(
    async (category: TrashCategory, id: string) => {
      setBusy({ category, id, action: "delete" });
      try {
        await permanentDeleteByCategory(ds, category, id);
        await reload();
      } finally {
        setBusy(null);
      }
    },
    [ds, reload],
  );

  // Layout Standard v2: the shell's SectionHeader owns the page title, so
  // the loading / error frames render only their state content (1e / 1f).
  if (isLoading || retrying) {
    return (
      <div className="flex flex-col gap-6">
        <div
          role="status"
          aria-label={t("trash.loading")}
          className="flex animate-pulse flex-col gap-6"
        >
          {[3, 2].map((rows, groupIndex) => (
            <div key={groupIndex} className="flex flex-col gap-2">
              <div className="h-3 w-16 rounded-lumen-sm bg-lumen-surface-sunken" />
              <div className="divide-y divide-lumen-border overflow-hidden rounded-lumen-lg border border-lumen-border bg-lumen-bg shadow-lumen-sm">
                {Array.from({ length: rows }, (_, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="flex items-center gap-3 py-3 pl-4 pr-3"
                  >
                    <div
                      className={`h-3.5 ${SKELETON_LABEL_WIDTHS[(groupIndex + rowIndex) % SKELETON_LABEL_WIDTHS.length]} rounded-lumen-sm bg-lumen-surface-sunken`}
                    />
                    <div className="ml-auto h-7 w-20 rounded-lumen-md bg-lumen-surface-sunken" />
                    <div className="h-7 w-7 rounded-lumen-md bg-lumen-surface-sunken" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex justify-center py-10">
          <Card
            padding="lg"
            className="flex w-full max-w-sm flex-col items-center gap-3 text-center"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-lumen-full bg-lumen-bg-secondary">
              <AlertCircle
                size={22}
                aria-hidden="true"
                className="text-lumen-danger"
              />
            </span>
            <p className="text-base font-semibold text-lumen-text">
              {t("trash.errorTitle")}
            </p>
            <p className="text-sm leading-relaxed text-lumen-text-secondary">
              {t("trash.errorDescription")}
            </p>
            <Button
              variant="ghost"
              leadingIcon={<RotateCcw size={14} aria-hidden="true" />}
              onClick={retry}
            >
              {t("trash.reload")}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {restoreNotice !== null && (
        // tone="warning", not danger: a restore that was refused or simply
        // broke is something that did not go through, and the list is still
        // the list — `danger` stays with the error card 30 lines up that
        // replaces the whole screen. role="status" is kept from the markup
        // this replaces (it overrides warning's assertive default): the notice
        // sits above a list the user keeps working in.
        <NoticePanel
          tone="warning"
          role="status"
          message={t(
            restoreNotice === "conflict"
              ? "trash.restoreConflict"
              : "trash.restoreFailed",
          )}
        />
      )}
      <TrashView
        groups={groups}
        onRestore={(c, id) => void handleRestore(c, id)}
        onPermanentDelete={(c, id) => void handlePermanentDelete(c, id)}
        busy={busy}
        labels={{
          empty: t("trash.empty"),
          emptyDescription: t("trash.emptyDescription"),
          restore: t("trash.restore"),
          restoring: t("trash.restoring"),
          deleting: t("trash.deleting"),
          deletePermanently: t("trash.deletePermanently"),
          confirmMessage: t("trash.permanentDeleteConfirm", { name: "{name}" }),
          cascadeWarning: t("trash.cascadeWarning"),
          cancel: t("common.cancel"),
          close: t("common.close"),
        }}
      />
    </div>
  );
}

function restoreByCategory(
  ds: DataService,
  category: TrashCategory,
  id: string,
): Promise<void> {
  switch (category) {
    case "todos":
      return ds.restoreTodo(id);
    case "notes":
      return ds.restoreNoteUnified(id);
    case "dailies":
      return ds.restoreDailyUnified(id);
    case "routines":
      return ds.restoreRoutine(id);
    case "events":
      return ds.restoreScheduleItem(id);
  }
}

function permanentDeleteByCategory(
  ds: DataService,
  category: TrashCategory,
  id: string,
): Promise<void> {
  switch (category) {
    case "todos":
      return ds.permanentDeleteTodo(id);
    case "notes":
      return ds.permanentDeleteNoteUnified(id);
    case "dailies":
      return ds.permanentDeleteDailyUnified(id);
    case "routines":
      return ds.permanentDeleteRoutine(id);
    case "events":
      return ds.permanentDeleteScheduleItem(id);
  }
}

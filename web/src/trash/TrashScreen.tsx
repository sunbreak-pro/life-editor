import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import {
  Button,
  Card,
  TrashView,
  useTranslation,
  type DataService,
  type TrashBusy,
  type TrashCategory,
  type TrashGroup,
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
 */

interface TrashScreenProps {
  dataService: DataService;
}

/** Bar widths cycled per skeleton row so the placeholder list looks organic. */
const SKELETON_LABEL_WIDTHS = ["w-2/5", "w-1/4", "w-1/3"];

export function TrashScreen({ dataService: ds }: TrashScreenProps) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<TrashGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<TrashBusy | null>(null);

  const untitled = t("common.untitled", { defaultValue: "Untitled" });

  const categoryTitle = useCallback(
    (category: TrashCategory): string => {
      switch (category) {
        case "tasks":
          return t("trash.tasks");
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

  // Pure fetch: returns grouped data, NEVER touches React state. Keeping
  // setState out of this callback lets the effect + action handlers update
  // state only AFTER an await (react-hooks/set-state-in-effect).
  const fetchGroups = useCallback(async (): Promise<TrashGroup[]> => {
    const [tasks, notes, dailies, routines, events] = await Promise.all([
      ds.fetchDeletedTasks(),
      ds.fetchDeletedNotesUnified(),
      ds.fetchDeletedDailiesUnified(),
      ds.fetchDeletedRoutines(),
      ds.fetchDeletedScheduleItems(),
    ]);
    return [
      {
        category: "tasks",
        title: categoryTitle("tasks"),
        items: tasks.map((x) => ({ id: x.id, label: x.title || untitled })),
      },
      {
        category: "notes",
        title: categoryTitle("notes"),
        items: notes.map((x) => ({ id: x.id, label: x.title || untitled })),
      },
      {
        category: "dailies",
        title: categoryTitle("dailies"),
        items: dailies.map((x) => ({ id: x.id, label: x.date || untitled })),
      },
      {
        category: "routines",
        title: categoryTitle("routines"),
        items: routines.map((x) => ({ id: x.id, label: x.title || untitled })),
      },
      {
        category: "events",
        title: categoryTitle("events"),
        items: events.map((x) => ({ id: x.id, label: x.title || untitled })),
      },
    ];
  }, [ds, categoryTitle, untitled]);

  useEffect(() => {
    let cancelled = false;
    fetchGroups()
      .then((next) => {
        if (cancelled) return;
        setGroups(next);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchGroups]);

  const reload = useCallback(async () => {
    try {
      const next = await fetchGroups();
      setGroups(next);
      setError(false);
    } catch {
      setError(true);
    }
  }, [fetchGroups]);

  // Full retry from the error card: back to the skeleton, then re-fetch.
  const retry = useCallback(() => {
    setLoading(true);
    setError(false);
    void fetchGroups()
      .then((next) => {
        setGroups(next);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [fetchGroups]);

  const handleRestore = useCallback(
    async (category: TrashCategory, id: string) => {
      setBusy({ category, id, action: "restore" });
      try {
        await restoreByCategory(ds, category, id);
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
  if (loading) {
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

  if (error) {
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
      }}
    />
  );
}

function restoreByCategory(
  ds: DataService,
  category: TrashCategory,
  id: string,
): Promise<void> {
  switch (category) {
    case "tasks":
      return ds.restoreTask(id);
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
    case "tasks":
      return ds.permanentDeleteTask(id);
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

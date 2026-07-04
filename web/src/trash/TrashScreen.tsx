import { useCallback, useEffect, useState } from "react";
import {
  TrashView,
  useTranslation,
  type DataService,
  type TrashCategory,
  type TrashGroup,
} from "@life-editor/shared";

/*
 * Web Trash host (W2). The web build mounts Providers per-section, so the
 * five soft-delete categories never share one context tree. Instead this
 * host calls the injected DataService directly (allowed for hosts —
 * CLAUDE.md §6.4 forbids it only inside shared hooks/primitives), fetches
 * every category's deleted rows in parallel, resolves i18n with t(), and
 * feeds the pure shared <TrashView> with grouped data + restore/delete
 * callbacks. After a restore/permanentDelete it re-fetches so the list
 * reflects the new state (immediate section reflection is left to normal
 * navigation re-fetch / Sync — not required by the plan).
 */

interface TrashScreenProps {
  dataService: DataService;
}

export function TrashScreen({ dataService: ds }: TrashScreenProps) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<TrashGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const handleRestore = useCallback(
    async (category: TrashCategory, id: string) => {
      setBusy(true);
      try {
        await restoreByCategory(ds, category, id);
        await reload();
      } finally {
        setBusy(false);
      }
    },
    [ds, reload],
  );

  const handlePermanentDelete = useCallback(
    async (category: TrashCategory, id: string) => {
      setBusy(true);
      try {
        await permanentDeleteByCategory(ds, category, id);
        await reload();
      } finally {
        setBusy(false);
      }
    },
    [ds, reload],
  );

  if (loading) {
    return <p className="text-lumen-text-secondary">{t("trash.loading")}</p>;
  }
  if (error) {
    return <p className="text-lumen-danger">{t("trash.error")}</p>;
  }

  return (
    <TrashView
      groups={groups}
      onRestore={(c, id) => void handleRestore(c, id)}
      onPermanentDelete={(c, id) => void handlePermanentDelete(c, id)}
      busy={busy}
      labels={{
        title: t("trash.title"),
        empty: t("trash.empty"),
        emptyCategory: t("trash.emptyCategoryLine"),
        restore: t("trash.restore"),
        deletePermanently: t("trash.deletePermanently"),
        confirmMessage: t("trash.permanentDeleteConfirm", { name: "{name}" }),
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

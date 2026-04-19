import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, Trash2 } from "lucide-react";
import { getDataService } from "../../../services";
import type { ScheduleItem } from "../../../types/schedule";
import type { TaskNode } from "../../../types/taskTree";
import { SettingsSection } from "./MobileSettingsPrimitives";

const MAX_ITEMS = 100;

type TrashRow =
  | { kind: "schedule"; id: string; title: string; deletedAt: string | null }
  | { kind: "task"; id: string; title: string; deletedAt: string | null };

export function MobileTrashSection() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<TrashRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ds = getDataService();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [schedules, tasks] = await Promise.all([
        ds.fetchDeletedScheduleItems(),
        ds.fetchDeletedTasks(),
      ]);
      const schedRows: TrashRow[] = schedules.map((s: ScheduleItem) => ({
        kind: "schedule",
        id: s.id,
        title: s.title,
        deletedAt: s.deletedAt ?? null,
      }));
      const taskRows: TrashRow[] = tasks.map((t: TaskNode) => ({
        kind: "task",
        id: t.id,
        title: t.title,
        deletedAt: t.deletedAt ?? null,
      }));
      const merged = [...schedRows, ...taskRows]
        .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""))
        .slice(0, MAX_ITEMS);
      setRows(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [ds]);

  useEffect(() => {
    load();
  }, [load]);

  const restore = useCallback(
    async (row: TrashRow) => {
      try {
        if (row.kind === "schedule") await ds.restoreScheduleItem(row.id);
        else await ds.restoreTask(row.id);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [ds, load],
  );

  const permanent = useCallback(
    async (row: TrashRow) => {
      try {
        if (row.kind === "schedule")
          await ds.permanentDeleteScheduleItem(row.id);
        else await ds.permanentDeleteTask(row.id);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [ds, load],
  );

  const isEmpty = useMemo(() => rows.length === 0, [rows]);

  return (
    <SettingsSection title={t("mobile.settings.trash.title", "Trash")}>
      <div className="space-y-1 px-4 py-2.5">
        {loading && (
          <p className="text-[11px] text-notion-text-secondary">
            {t("common.loading", "Loading...")}
          </p>
        )}
        {error && <p className="text-[11px] text-notion-danger">{error}</p>}
        {!loading && isEmpty && (
          <p className="text-[11px] text-notion-text-secondary/70">
            {t("mobile.settings.trash.empty", "Nothing in trash")}
          </p>
        )}
        {rows.map((row) => (
          <div
            key={`${row.kind}-${row.id}`}
            className="flex items-center gap-2 border-b border-notion-border/60 py-1.5 last:border-b-0"
          >
            <span
              className="rounded bg-notion-bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-notion-text-secondary"
              aria-hidden
            >
              {row.kind}
            </span>
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-notion-text">
              {row.title}
            </span>
            <button
              onClick={() => restore(row)}
              aria-label={t("mobile.settings.trash.restore", "Restore")}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-notion-border text-notion-text-secondary active:bg-notion-hover"
            >
              <RotateCcw size={12} />
            </button>
            <button
              onClick={() => permanent(row)}
              aria-label={t(
                "mobile.settings.trash.permanentDelete",
                "Delete permanently",
              )}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-notion-danger text-notion-danger active:bg-notion-danger/10"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {rows.length >= MAX_ITEMS && (
          <p className="pt-1 text-[10px] text-notion-text-secondary/70">
            {t(
              "mobile.settings.trash.truncatedNote",
              "Showing latest 100 — manage more on desktop.",
            )}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}

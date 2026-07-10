import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  useRoutineContext,
  useRightSidebarOptional,
  useTranslation,
  RightSidebarPortal,
  RoutineEditorForm,
  ScheduleSidebarTabs,
  type RoutineEditorRoutine,
  type RoutineEditorGroup,
} from "@life-editor/shared";
import {
  buildWeekdayLabels,
  frequencyLabel,
  type FrequencyLabelCopy,
} from "./scheduleLabels";

/*
 * Routines tab (target-IA, Desktop only — brief §3). The list stays in the main
 * area; editing the selected routine happens in the shared rightSidebar "詳細"
 * tab (RightSidebarPortal → ScheduleSidebarTabs), matching the Calendar tab's
 * chrome. The routine list shows title + time + frequency summary; the pure
 * <RoutineEditorForm> edits the selection.
 *
 * DataService is reached ONLY through useRoutineContext (§3.1). i18n is
 * resolved here and injected into the pure form (§6.4). Group membership rides
 * the form's `groupIds` patch, which we split off to setGroupsForRoutine (the
 * routine row itself has no groupIds column — the assignment table owns it).
 */
export function RoutinesTab() {
  const { t } = useTranslation();
  const {
    routines,
    routineGroups,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    setGroupsForRoutine,
    getGroupIdsForRoutine,
  } = useRoutineContext();
  // Null-safe (tests / standalone). `open` surfaces the panel on selection.
  const rightSidebar = useRightSidebarOptional();
  const openSidebar = rightSidebar?.open;

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Selecting (or creating) a routine surfaces the rightSidebar. Done at the
  // event, not in an effect, so re-selecting the same routine after manually
  // closing the panel reopens it (matches CalendarTab's handleSelectItem).
  const handleSelect = (id: string) => {
    setSelectedId(id);
    openSidebar?.();
  };

  const weekdayLabels = useMemo(() => buildWeekdayLabels(t), [t]);
  const freqCopy = useMemo<FrequencyLabelCopy>(
    () => ({
      daily: t("scheduleScreen.frequencyDaily"),
      weekdaysFallback: t("scheduleScreen.frequencyWeekdays"),
      group: t("scheduleScreen.frequencyGroup"),
      intervalEvery: t("scheduleScreen.intervalEvery"),
      intervalDays: t("scheduleScreen.intervalDays"),
    }),
    [t],
  );

  const sortedRoutines = useMemo(
    () => routines.slice().sort((a, b) => a.order - b.order),
    [routines],
  );

  const selectedRoutine = useMemo(
    () => routines.find((r) => r.id === selectedId) ?? null,
    [routines, selectedId],
  );

  const editorRoutine = useMemo<RoutineEditorRoutine | null>(() => {
    if (!selectedRoutine) return null;
    return {
      ...selectedRoutine,
      groupIds: getGroupIdsForRoutine(selectedRoutine.id),
    };
  }, [selectedRoutine, getGroupIdsForRoutine]);

  const groups = useMemo<RoutineEditorGroup[]>(
    () =>
      routineGroups.map((g) => ({ id: g.id, name: g.name, color: g.color })),
    [routineGroups],
  );

  const formLabels = useMemo(
    () => ({
      title: t("scheduleScreen.title"),
      startTime: t("scheduleScreen.startTime"),
      endTime: t("scheduleScreen.endTime"),
      frequency: t("scheduleScreen.frequency"),
      frequencyDaily: t("scheduleScreen.frequencyDaily"),
      frequencyWeekdays: t("scheduleScreen.frequencyWeekdays"),
      frequencyInterval: t("scheduleScreen.frequencyInterval"),
      frequencyGroup: t("scheduleScreen.frequencyGroup"),
      intervalEvery: t("scheduleScreen.intervalEvery"),
      intervalDays: t("scheduleScreen.intervalDays"),
      startDate: t("scheduleScreen.startDate"),
      groups: t("scheduleScreen.groupsLabel"),
      delete: t("scheduleScreen.deleteRoutine"),
    }),
    [t],
  );

  const handleCreate = () => {
    const id = createRoutine(t("scheduleScreen.newRoutine"));
    handleSelect(id);
  };

  const handlePatch = (id: string, patch: Partial<RoutineEditorRoutine>) => {
    // Group membership is not a routine column — it rides the assignment table
    // (setGroupsForRoutine). Everything else is a plain routine field update.
    const { groupIds, ...rest } = patch;
    if (groupIds !== undefined) setGroupsForRoutine(id, groupIds);
    if (Object.keys(rest).length > 0) {
      updateRoutine(id, rest as Parameters<typeof updateRoutine>[1]);
    }
  };

  const handleDelete = (id: string) => {
    void deleteRoutine(id);
    setSelectedId(null);
  };

  const master = (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleCreate}
        className="flex items-center gap-1.5 self-start rounded-lumen-md bg-lumen-accent px-3 py-1.5 text-[13px] font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lumen-bg"
      >
        <Plus aria-hidden className="size-4" />
        {t("scheduleScreen.newRoutine")}
      </button>
      <ul role="list" className="flex flex-col gap-1.5">
        {sortedRoutines.map((r) => {
          const selected = r.id === selectedId;
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => handleSelect(r.id)}
                className={
                  selected
                    ? "flex w-full flex-col gap-0.5 rounded-lumen-md border border-lumen-accent bg-lumen-accent-subtle px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
                    : "flex w-full flex-col gap-0.5 rounded-lumen-md border border-lumen-border bg-lumen-bg px-3 py-2 text-left transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
                }
              >
                <span className="truncate text-sm font-medium text-lumen-text">
                  {r.title || t("scheduleScreen.newRoutine")}
                </span>
                <span className="truncate text-xs text-lumen-text-secondary">
                  {r.startTime ? `${r.startTime} · ` : ""}
                  {frequencyLabel(r, freqCopy, weekdayLabels)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      <RightSidebarPortal>
        <ScheduleSidebarTabs
          tabs={[{ id: "detail", label: t("scheduleScreen.tabDetail") }]}
          value="detail"
          onChange={() => {}}
          label={t("scheduleScreen.detailPanelLabel")}
        >
          {editorRoutine ? (
            <RoutineEditorForm
              routine={editorRoutine}
              groups={groups}
              onPatch={handlePatch}
              onDelete={handleDelete}
              weekdayLabels={weekdayLabels}
              labels={formLabels}
            />
          ) : (
            <p className="rounded-md border border-lumen-border bg-lumen-bg-secondary px-4 py-6 text-center text-sm text-lumen-text-secondary">
              {t("scheduleScreen.selectHint")}
            </p>
          )}
        </ScheduleSidebarTabs>
      </RightSidebarPortal>
      {master}
    </>
  );
}

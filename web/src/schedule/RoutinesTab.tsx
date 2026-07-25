import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  useRoutineContext,
  useRightSidebarOptional,
  useTranslation,
  useScheduleItemsRoutineSync,
  RightSidebarPortal,
  RoutineEditorForm,
  ScheduleSidebarTabs,
  buildWeekdayLabels,
  frequencyLabel,
  seedFrequencyPatch,
  todayDateKey,
  addDaysKey,
  type DataService,
  type FrequencyLabelCopy,
  type RoutineEditorRoutine,
} from "@life-editor/shared";

/*
 * Routines tab (target-IA, Desktop only — brief §3). The list stays in the main
 * area; editing the selected routine happens in the shared rightSidebar "詳細"
 * tab (RightSidebarPortal → ScheduleSidebarTabs), matching the Calendar tab's
 * chrome. The routine list shows title + time + frequency summary; the pure
 * <RoutineEditorForm> edits the selection.
 *
 * DataService reaches the domain through useRoutineContext (§3.1); the prop
 * exists only to feed the shared generator hook, exactly as the Calendar host
 * does (§6.4 — injected, never a module singleton).
 * i18n is resolved here and injected into the pure form (§6.4).
 */

/** Frequency fields — a patch touching any of these needs a reconcile pass. */
const FREQUENCY_KEYS = [
  "frequencyType",
  "frequencyDays",
  "frequencyInterval",
  "frequencyStartDate",
] as const;

/**
 * Reconcile window for this tab (#352). Unlike the Calendar host there is no
 * visible range here, so we take the widest window the calendar itself ever
 * materialises in one go — a 6-week month grid — anchored on today. Days past
 * it are reconciled by `ensureRoutineItemsForDateRange` when the user
 * navigates the calendar onto them.
 */
const RECONCILE_WINDOW_DAYS = 41;

export function RoutinesTab({ dataService }: { dataService: DataService }) {
  const { t } = useTranslation();
  const { routines, createRoutine, updateRoutine, deleteRoutine } =
    useRoutineContext();
  const { reconcileRoutineScheduleItems } = useScheduleItemsRoutineSync({
    dataService,
  });
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

  const formLabels = useMemo(
    () => ({
      title: t("scheduleScreen.title"),
      startTime: t("scheduleScreen.startTime"),
      endTime: t("scheduleScreen.endTime"),
      frequency: t("scheduleScreen.frequency"),
      frequencyDaily: t("scheduleScreen.frequencyDaily"),
      frequencyWeekdays: t("scheduleScreen.frequencyWeekdays"),
      frequencyInterval: t("scheduleScreen.frequencyInterval"),
      intervalEvery: t("scheduleScreen.intervalEvery"),
      intervalDays: t("scheduleScreen.intervalDays"),
      startDate: t("scheduleScreen.startDate"),
      delete: t("scheduleScreen.deleteRoutine"),
    }),
    [t],
  );

  const handleCreate = () => {
    const id = createRoutine(t("scheduleScreen.newRoutine"));
    handleSelect(id);
  };

  const handlePatch = (id: string, patch: Partial<RoutineEditorRoutine>) => {
    if (Object.keys(patch).length === 0) return;
    const routine = routines.find((r) => r.id === id);
    if (!routine) {
      void updateRoutine(id, patch as Parameters<typeof updateRoutine>[1]);
      return;
    }
    // A bare frequency-TYPE switch carries none of the new type's own
    // fields; left as-is it reads as "fires never" / "fires daily" and the
    // reconcile below would act on that transient (#352).
    const today = todayDateKey();
    const seeded = seedFrequencyPatch(patch, routine, today);
    const touchesFrequency = FREQUENCY_KEYS.some((k) => k in seeded);
    void (async () => {
      const landed = await updateRoutine(
        id,
        seeded as Parameters<typeof updateRoutine>[1],
      );
      // Title / time edits need no reconcile (this tab has no series-scope
      // dialog — that propagation is the Calendar host's #279 path), and a
      // failed template write must not leave the series reshaped to a
      // frequency the routine never took.
      if (!landed || !touchesFrequency) return;
      await reconcileRoutineScheduleItems(
        { ...routine, ...seeded },
        {
          startDate: today,
          endDate: addDaysKey(today, RECONCILE_WINDOW_DAYS),
        },
        {
          title: routine.title,
          startTime: routine.startTime,
          endTime: routine.endTime,
        },
      );
    })();
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
          {selectedRoutine ? (
            <RoutineEditorForm
              routine={selectedRoutine}
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

import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import {
  BriefingView,
  EveningView,
  ItemCreatePanel,
  ItemDetailOverlay,
  RepeatScopeDialog,
  RightSidebarPortal,
  TodayTodoTray,
  hasIntentionToReport,
  todayDateKey,
  useMediaQuery,
  useTranslation,
  type BriefingTab,
  type DataService,
  type ItemCreateNoteDraft,
  WIDE_QUERY,
} from "@life-editor/shared";
import type { NavDestination } from "../hooks/useShellNavigation";
import { RichTextEditor } from "../notes/RichTextEditor";
import { useBriefingData } from "./hooks/useBriefingData";
import { useDailySections } from "./hooks/useDailySections";

/*
 * Briefing host shell (Briefing plan Step 1). Owns data fetching (it may
 * call the injected DataService — §6.4) and i18n `t`, then injects the
 * aggregated BriefingData + labels into the pure shared <BriefingView>.
 *
 * The data/aggregation half lives in useBriefingData and the 夕刊 / 宣言
 * editing state in useDailySections (hooks split — zero behavior change);
 * this component resolves the i18n labels and assembles the views.
 *
 * The rightSidebar detail panel is fed from here too (#413): the SHARED
 * <TodayTodoTray> — Schedule's tray component (#298), not a copy — pushed
 * through RightSidebarPortal. See the tray block below for the wiring.
 */

interface BriefingScreenProps {
  dataService: DataService;
  onNavigate: (dest: NavDestination) => void;
  /** Active header tab (朝刊 / 夕刊, #263 F-6) — lifted to MainScreen. */
  tab: BriefingTab;
  /**
   * Narrow-layout tab band, passed straight through to the paper views (#318).
   * MainScreen builds it (it owns `tab` + the i18n copy) and leaves it
   * undefined on the wide layout, where the SectionHeader renders the tabs.
   */
  tabSwitcher?: ReactNode;
}

export function BriefingScreen({
  dataService: ds,
  onNavigate,
  tab,
  tabSwitcher,
}: BriefingScreenProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  // 宣言 editability on the EVENING paper (#391). Wide is unchanged — there the
  // declaration is a morning artifact read back, and the SectionHeader tab band
  // puts the editable 朝刊 one click away. Below 768px 夕刊 is a Quick capture
  // surface (mobile-scope #3), so the same block becomes the live input; the
  // morning paper stays editable at every width. Own matchMedia read, like
  // MainScreen's and AppShell's (same 768px query — §W5 app shell).
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const intentionEditableOnEvening = !isWide;

  const todayKey = todayDateKey();

  const {
    loading,
    data,
    dateLine,
    dailyContent,
    setDailyContent,
    remainingTodos,
    upcoming,
    handleToggleScheduleItem,
    handleToggleTask,
    handleDeleteScheduleItem,
    handleDeleteTask,
    deleteScopeItem,
    handleDeleteScopeChoose,
    closeDeleteScope,
    noteOptions,
    handleCreateEvent,
    handleCreateTask,
    handlePlaceTask,
    todoPlaced,
    todoUnplaced,
    todoAddable,
    handleAddTodoCandidate,
  } = useBriefingData(ds, todayKey);

  const {
    eveningStored,
    eveningGen,
    eveningMood,
    eveningSaved,
    handleEveningUpdate,
    handleSelectMood,
    intentionStored,
    intentionDraft,
    intentionText,
    intentionSaved,
    handleIntentionChange,
    flushIntention,
  } = useDailySections(ds, todayKey, dailyContent, setDailyContent);

  // Nothing stored AND nothing typed = the day has no declaration yet, so
  // there is no save state to report. Reporting「保存済み」over an untouched
  // empty field reads as "already done" (#427) — omit the caption entirely
  // until the first character exists somewhere.
  const intentionCaption = !hasIntentionToReport(
    intentionStored.text,
    intentionDraft,
  )
    ? undefined
    : intentionSaved
      ? t("materials.daily.saved")
      : t("materials.daily.unsaved");

  // ── Labels (§6.4 — resolved here, injected as props) ─────────────────
  const labels = useMemo(
    () => ({
      masthead: t("briefing.masthead"),
      focusLabel: t("briefing.focusLabel"),
      aiTitle: t("briefing.aiTitle"),
      aiSource: t("briefing.aiSource"),
      noBriefing: t("briefing.noBriefing"),
      intentionTitle: t("briefing.intentionTitle"),
      intentionCaption,
      intentionPlaceholder: t("briefing.intentionPlaceholder"),
      scheduleTitle: t("briefing.scheduleTitle"),
      addScheduleItem: t("briefing.addScheduleItem"),
      noSchedule: t("briefing.noSchedule"),
      routineTag: t("briefing.routineTag"),
      allDay: t("briefing.allDay"),
      tasksTitle: t("briefing.tasksTitle"),
      noTasks: t("briefing.noTasks"),
      vizTitle: t("briefing.vizTitle"),
      carryoverTitle: t("briefing.carryoverTitle"),
      toggleComplete: t("briefing.toggleComplete"),
      edit: t("briefing.edit"),
      delete: t("briefing.delete"),
      deleteScheduleHint: t("briefing.deleteScheduleHint"),
      deleteTaskHint: t("briefing.deleteTaskHint"),
      jumpToSchedule: t("briefing.jumpToSchedule"),
      jumpToTasks: t("briefing.jumpToTasks"),
    }),
    [t, intentionCaption],
  );
  // Widget copy re-uses the EXISTING analytics.* keys (Analytics shrink:
  // the three widgets moved in here — their labels come along unduplicated).
  const streakLabels = useMemo(
    () => ({
      title: t("analytics.streak.title"),
      current: t("analytics.streak.current"),
      longest: t("analytics.streak.longest"),
      days: t("analytics.streak.days"),
      noStreak: t("analytics.streak.noStreak"),
    }),
    [t],
  );
  const trendLabels = useMemo(
    () => ({
      title: t("analytics.taskTrend.title"),
      completedCount: t("analytics.taskTrend.completedCount"),
    }),
    [t],
  );
  const balanceLabels = useMemo(
    () => ({
      title: t("analytics.workBreak.title"),
      work: t("analytics.workBreak.work"),
      break: t("analytics.workBreak.break"),
      longBreak: t("analytics.workBreak.longBreak"),
    }),
    [t],
  );

  const eveningLabels = useMemo(
    () => ({
      masthead: t("briefing.evening.masthead"),
      moodTitle: t("briefing.evening.moodTitle"),
      moodStars: [1, 2, 3, 4, 5].map((n) =>
        t("briefing.evening.moodStar", { value: n }),
      ),
      // Editable → it is today's declaration you are writing, not this
      // morning's read back, so the heading follows the mode (#391).
      intentionTitle: intentionEditableOnEvening
        ? t("briefing.intentionTitle")
        : t("briefing.evening.intentionTitle"),
      intentionCaption,
      intentionPlaceholder: t("briefing.evening.intentionPlaceholder"),
      reflectionTitle: t("briefing.evening.reflectionTitle"),
      savedCaption: eveningSaved
        ? t("materials.daily.saved")
        : t("materials.daily.unsaved"),
      todosTitle: t("briefing.evening.todosTitle"),
      noTodos: t("briefing.evening.noTodos"),
      upcomingTitle: t("briefing.evening.upcomingTitle"),
      noUpcoming: t("briefing.evening.noUpcoming"),
      tomorrowTag: t("briefing.evening.tomorrowTag"),
      allDay: t("briefing.allDay"),
    }),
    [t, eveningSaved, intentionCaption, intentionEditableOnEvening],
  );

  // ── Creation panel (#623) ────────────────────────────────────────────
  // Schedule's shared <ItemCreatePanel>, reached from the paper's「+」and the
  // rightSidebar's. No briefing-specific creation form: the same act would
  // otherwise exist in two implementations that drift apart.
  //
  // No date picker — the target day is the day the paper is showing. That is
  // the whole gesture ("add this to today"), and offering a different day here
  // would contradict the「+」the user pressed.
  const [createOpen, setCreateOpen] = useState(false);
  const openCreatePanel = useCallback(() => setCreateOpen(true), []);
  const closeCreatePanel = useCallback(() => setCreateOpen(false), []);

  const createDateLabel = useMemo(() => {
    const locale = i18n.language.startsWith("ja") ? "ja-JP" : "en-US";
    return new Date(`${todayKey}T00:00:00`).toLocaleDateString(locale, {
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  }, [todayKey, i18n.language]);

  const formatDuration = useCallback(
    (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      if (h === 0) return t("scheduleScreen.durationMin", { m });
      if (m === 0) return t("scheduleScreen.durationHour", { h });
      return t("scheduleScreen.durationHourMin", { h, m });
    },
    [t],
  );

  // The panel's copy comes from the EXISTING scheduleScreen.* keys, not a
  // briefing.* copy of them: it is literally Schedule's panel, and a second
  // catalogue of the same sentences is a divergence waiting to happen.
  const createPanelLabels = useMemo(
    () => ({
      typeLabel: t("scheduleScreen.itemTypeLabel"),
      typeEvent: t("scheduleScreen.typeEvent"),
      typeTask: t("scheduleScreen.typeTask"),
      typeNote: t("scheduleScreen.typeNote"),
      title: t("scheduleScreen.title"),
      eventPlaceholder: t("scheduleScreen.quickAddPlaceholder"),
      taskPlaceholder: t("scheduleScreen.taskPlaceholder"),
      date: t("scheduleScreen.date"),
      startTime: t("scheduleScreen.startTime"),
      endTime: t("scheduleScreen.endTime"),
      addEvent: t("scheduleScreen.addEvent"),
      addEventAndOpen: t("scheduleScreen.addEventAndOpen"),
      sourceLabel: t("scheduleScreen.sourceLabel"),
      sourceNew: t("scheduleScreen.sourceNew"),
      sourceExisting: t("scheduleScreen.sourceExisting"),
      addTask: t("scheduleScreen.addTask"),
      placeTask: t("scheduleScreen.placeTask"),
      searchTasks: t("scheduleScreen.searchTasks"),
      taskPickerEmpty: t("scheduleScreen.todoEmptyAddable"),
      taskPickerNoMatch: t("scheduleScreen.taskPickerNoMatch"),
      noteTitleLabel: t("scheduleScreen.noteTitleLabel"),
      notePlaceholder: t("scheduleScreen.notePlaceholder"),
      searchNotes: t("scheduleScreen.searchNotes"),
      notePickerEmpty: t("scheduleScreen.notePickerEmpty"),
      notePickerNoMatch: t("scheduleScreen.notePickerNoMatch"),
      noteLinkHint: t("scheduleScreen.noteLinkHint"),
      attachedNote: t("scheduleScreen.attachedNote"),
      clearNote: t("scheduleScreen.clearNote"),
    }),
    [t],
  );

  const submitEvent = useCallback(
    (
      title: string,
      start: string,
      end: string,
      note: ItemCreateNoteDraft | null,
    ) => {
      handleCreateEvent(title, start, end, note);
      closeCreatePanel();
    },
    [handleCreateEvent, closeCreatePanel],
  );

  // The panel's second event button means "create, then open its editor".
  // The paper has no event editor of its own, so the honest reading here is
  // to create and then go to Schedule, where that editor lives.
  const submitEventAndOpen = useCallback(
    (
      title: string,
      start: string,
      end: string,
      note: ItemCreateNoteDraft | null,
    ) => {
      handleCreateEvent(title, start, end, note);
      closeCreatePanel();
      onNavigate({ section: "schedule", tab: "calendar" });
    },
    [handleCreateEvent, closeCreatePanel, onNavigate],
  );

  const submitTask = useCallback(
    (
      title: string,
      start: string,
      end: string,
      note: ItemCreateNoteDraft | null,
    ) => {
      handleCreateTask(title, start, end, note);
      closeCreatePanel();
    },
    [handleCreateTask, closeCreatePanel],
  );

  const submitPlaceTask = useCallback(
    (
      taskId: string,
      start: string,
      end: string,
      note: ItemCreateNoteDraft | null,
    ) => {
      handlePlaceTask(taskId, start, end, note);
      closeCreatePanel();
    },
    [handlePlaceTask, closeCreatePanel],
  );

  const todoTrayLabels = useMemo(
    () => ({
      placedHeading: t("briefing.todo.placedHeading"),
      unplacedHeading: t("briefing.todo.unplacedHeading"),
      emptyPlaced: t("briefing.todo.emptyPlaced"),
      emptyUnplaced: t("briefing.todo.emptyUnplaced"),
      addHeading: t("briefing.todo.addHeading"),
      addAction: t("briefing.todo.addAction"),
      emptyAddable: t("briefing.todo.emptyAddable"),
      // Same action, same words as the paper's own rows — no near-duplicate
      // keys inside one namespace.
      complete: t("briefing.toggleComplete"),
      openInTasks: t("briefing.jumpToTasks"),
    }),
    [t],
  );

  // Every width (#609). This used to be wide-only, and for a real reason:
  // below 768px the detail panel is a MobileDrawer, and Briefing had no opener
  // for it at all — the wide SectionHeader toggle is gone at that width and
  // the standalone hamburger row (MOBILE_HAMBURGER_SECTIONS) belongs to
  // sections whose body is a list — so a tray mounted here was unreachable UI.
  // MainScreen now puts the hamburger at the left edge of Briefing's narrow
  // 朝刊/夕刊 band, which is the opener that was missing; `docs/requirements/
  // mobile-scope.md` #1 moved with it.
  //
  // No `isWide` guard of its own: <RightSidebarPortal> renders nothing while
  // the panel is closed and only registers that content exists, so mounting it
  // at every width costs a subscription, not a surface.
  //
  // Mounted on BOTH papers (朝刊 / 夕刊): the panel is section-level, and the
  // tray is as useful when closing the day as when starting it.
  const todoTrayPortal = (
    <RightSidebarPortal>
      <div className="flex flex-col gap-3">
        {/* #623: the panel's own「+」. Same target as the paper's — the two
            are one action reached from two places, so they open the same
            creation panel on the same day. 朝刊 only: the tray is mounted on
            both papers, but 夕刊 is explicitly outside this Issue's scope, and
            a「+」there would read as "add to tomorrow". */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-lumen-text">
            {t("briefing.todo.title")}
          </h3>
          {tab === "morning" && (
            <button
              type="button"
              onClick={openCreatePanel}
              aria-label={t("briefing.addScheduleItem")}
              title={t("briefing.addScheduleItem")}
              className="-my-1 -mr-1.5 flex flex-shrink-0 items-center rounded-lumen-sm p-1.5 text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-briefing-shu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <TodayTodoTray
          placed={todoPlaced}
          unplaced={todoUnplaced}
          addable={todoAddable}
          onToggleComplete={handleToggleTask}
          onOpenTask={() => onNavigate({ section: "schedule", tab: "todo" })}
          onAddCandidate={handleAddTodoCandidate}
          labels={todoTrayLabels}
        />
      </div>
    </RightSidebarPortal>
  );

  // Keyed on the day so a paper that crosses midnight (or the day-start hour)
  // re-seeds the fields rather than keeping a draft aimed at yesterday.
  const createPanelOverlay = (
    <ItemDetailOverlay
      open={createOpen}
      title={t("scheduleScreen.addItem")}
      onClose={closeCreatePanel}
    >
      <ItemCreatePanel
        key={todayKey}
        dateLabel={createDateLabel}
        existingTasks={todoAddable}
        existingNotes={noteOptions}
        onSubmitEvent={submitEvent}
        onSubmitEventAndOpen={submitEventAndOpen}
        onCreateTask={submitTask}
        onPlaceTask={submitPlaceTask}
        formatDuration={formatDuration}
        labels={createPanelLabels}
      />
    </ItemDetailOverlay>
  );

  // #585: deleting a routine-derived row asks which occurrences first — the
  // SAME <RepeatScopeDialog> Schedule uses (#279), with the same copy. The
  // component is imported read-only; the delete semantics behind each choice
  // live in useBriefingData.
  const deleteScopeDialog = (
    <RepeatScopeDialog
      open={deleteScopeItem !== null}
      mode="delete"
      labels={{
        title: t("scheduleScreen.deleteScopeTitle"),
        thisOnly: t("scheduleScreen.scopeThisOnly"),
        thisAndFuture: t("scheduleScreen.scopeThisAndFuture"),
        all: t("scheduleScreen.scopeAll"),
        cancel: t("scheduleScreen.scopeCancel"),
      }}
      onChoose={handleDeleteScopeChoose}
      onClose={closeDeleteScope}
    />
  );

  if (tab === "evening") {
    return (
      <>
        {todoTrayPortal}
        <EveningView
          loading={loading}
          dateLine={dateLine}
          mood={eveningMood}
          onSelectMood={handleSelectMood}
          editorSlot={
            <RichTextEditor
              key={`evening:${todayKey}:${eveningGen}`}
              noteId={`evening-${todayKey}`}
              initialContent={eveningStored.bodyDocJson ?? undefined}
              onUpdate={handleEveningUpdate}
              placeholder={t("briefing.evening.placeholder")}
              className="min-h-[180px] px-4 py-3"
            />
          }
          // Editable → the live draft (the field must echo every keystroke).
          // Read-only → the STORED text, never the draft: the read-back is
          // "what is saved as this morning's declaration", and a draft is both
          // un-normalized (raw blank lines / indent the merge would strip) and
          // possibly unsaved (persistIntention swallows failures) — with no
          // caption on that branch, showing it would silently overstate.
          intentionText={
            intentionEditableOnEvening
              ? intentionText
              : (intentionStored.text ?? "")
          }
          intentionEditable={intentionEditableOnEvening}
          onIntentionChange={handleIntentionChange}
          onIntentionBlur={flushIntention}
          todos={remainingTodos}
          schedule={upcoming}
          labels={eveningLabels}
          tabSwitcher={tabSwitcher}
        />
      </>
    );
  }

  return (
    <>
      {todoTrayPortal}
      <BriefingView
        loading={loading}
        data={data}
        labels={labels}
        streakLabels={streakLabels}
        trendLabels={trendLabels}
        balanceLabels={balanceLabels}
        intentionText={intentionText}
        onIntentionChange={handleIntentionChange}
        onIntentionBlur={flushIntention}
        onToggleScheduleItem={handleToggleScheduleItem}
        onToggleTask={handleToggleTask}
        onDeleteScheduleItem={handleDeleteScheduleItem}
        onDeleteTask={handleDeleteTask}
        onAddScheduleItem={openCreatePanel}
        onJumpToSchedule={() => onNavigate({ section: "schedule", tab: "calendar" })}
        onJumpToTasks={() => onNavigate({ section: "schedule", tab: "todo" })}
        tabSwitcher={tabSwitcher}
      />
      {deleteScopeDialog}
      {createPanelOverlay}
    </>
  );
}

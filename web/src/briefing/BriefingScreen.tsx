import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  BriefingView,
  EveningView,
  RepeatScopeDialog,
  RightSidebarPortal,
  TodayTodoTray,
  hasIntentionToReport,
  todayDateKey,
  useMediaQuery,
  useTranslation,
  type BriefingTab,
  type DataService,
  type NavSection,
} from "@life-editor/shared";
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
  onNavigate: (nav: NavSection) => void;
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
  const { t } = useTranslation();
  // 宣言 editability on the EVENING paper (#391). Wide is unchanged — there the
  // declaration is a morning artifact read back, and the SectionHeader tab band
  // puts the editable 朝刊 one click away. Below 768px 夕刊 is a Quick capture
  // surface (mobile-scope #3), so the same block becomes the live input; the
  // morning paper stays editable at every width. Own matchMedia read, like
  // MainScreen's and AppShell's (same 768px query — §W5 app shell).
  const isWide = useMediaQuery("(min-width: 768px)", true);
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
        <h3 className="text-sm font-semibold text-lumen-text">
          {t("briefing.todo.title")}
        </h3>
        <TodayTodoTray
          placed={todoPlaced}
          unplaced={todoUnplaced}
          addable={todoAddable}
          onToggleComplete={handleToggleTask}
          onOpenTask={() => onNavigate("tasks")}
          onAddCandidate={handleAddTodoCandidate}
          labels={todoTrayLabels}
        />
      </div>
    </RightSidebarPortal>
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
        onJumpToSchedule={() => onNavigate("schedule")}
        onJumpToTasks={() => onNavigate("tasks")}
        tabSwitcher={tabSwitcher}
      />
      {deleteScopeDialog}
    </>
  );
}

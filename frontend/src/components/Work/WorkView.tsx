import { useState, useEffect, useMemo, useContext } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Zap } from "lucide-react";
import { useTimerContext } from "../../hooks/useTimerContext";
import { useSessionCompletionToast } from "../../hooks/useSessionCompletionToast";
import { getDataService } from "../../services/dataServiceFactory";
import type { TaskNode } from "../../types/taskTree";
import type { SessionType } from "../../types/timer";
import { LAYOUT } from "../../constants/layout";
import { RightSidebarContext } from "../../context/RightSidebarContext";
import {
  SessionTabs,
  ActiveTaskChip,
  TimerArc,
  SessionDots,
  ControlDock,
} from "./view/TimerComponents";
import { buildFolderPath } from "./view/folderPath";
import { WorkTaskSelector } from "./view/WorkTaskSelector";
import { SessionCompletionSheet } from "./view/SessionCompletionSheet";
import { TaskSelector } from "./TaskSelector";
import { WorkSidebarInfo } from "./WorkSidebarInfo";

export type WorkViewVariant = "mobile" | "desktop";

interface WorkViewProps {
  /**
   * `mobile` reproduces the previous MobileWorkView verbatim (in-view bottom
   * sheets, no right sidebar). `desktop` reuses the same timer column, centered
   * with a max width, swaps the picker for the legacy dropdown {@link TaskSelector}
   * and portals {@link WorkSidebarInfo} into the right sidebar. The desktop
   * completion modal stays in App (global {@link SessionCompletionModal}) so the
   * in-view {@link SessionCompletionSheet} is mobile-only (no double modal).
   */
  variant: WorkViewVariant;
}

export function WorkView({ variant }: WorkViewProps) {
  const isDesktop = variant === "desktop";
  const { t, i18n } = useTranslation();
  const timer = useTimerContext();
  useSessionCompletionToast();
  const { portalTarget: rightSidebarTarget } = useContext(RightSidebarContext);

  const [taskSelectorOpen, setTaskSelectorOpen] = useState(false);
  const [taskTree, setTaskTree] = useState<TaskNode[]>([]);

  // The task tree feeds the mobile bottom-sheet picker + folder breadcrumb.
  // Desktop uses the self-contained <TaskSelector/>, so it needs no fetch here.
  useEffect(() => {
    if (isDesktop) return;
    let cancelled = false;
    getDataService()
      .fetchTaskTree()
      .then((tree) => {
        if (!cancelled) setTaskTree(tree);
      })
      .catch((e) => console.error("Failed to load task tree:", e));
    return () => {
      cancelled = true;
    };
  }, [isDesktop, taskSelectorOpen]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, TaskNode>();
    for (const node of taskTree) map.set(node.id, node);
    return map;
  }, [taskTree]);

  const activeFolderPath = useMemo(
    () => buildFolderPath(timer.activeTask?.id ?? null, nodeMap),
    [timer.activeTask?.id, nodeMap],
  );

  const sessionColor =
    timer.sessionType === "WORK"
      ? "var(--color-notion-accent)"
      : "var(--color-notion-success)";

  const sessionLabel =
    timer.sessionType === "WORK"
      ? t("mobile.work.sessionLabel.work", "FOCUS SESSION")
      : timer.sessionType === "BREAK"
        ? t("mobile.work.sessionLabel.break", "BREAK")
        : t("mobile.work.sessionLabel.longBreak", "LONG BREAK");

  // Header subtitle: "2026年4月18日 · 土" / "Sat, Apr 18, 2026"
  const todayLabel = useMemo(() => {
    const d = new Date();
    if (i18n.language === "ja") {
      const dow = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · ${dow}`;
    }
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [i18n.language]);

  const minutes = Math.floor(timer.remainingSeconds / 60);
  const seconds = timer.remainingSeconds % 60;
  const remainingLabel = t(
    "mobile.work.remaining",
    "{{minutes}} min {{seconds}} sec left",
    {
      minutes,
      seconds,
    },
  );

  const onSwitchSession = (next: SessionType) => {
    if (next === timer.sessionType) return;
    // Tab tap should only switch sessionType; start/stop is the Control Dock's job.
    timer.setSessionType(next);
  };

  const handleSkip = () => {
    // On WORK: complete current session by starting rest. On BREAK: go back to work.
    if (timer.sessionType === "WORK") {
      timer.startRest();
    } else {
      timer.dismissCompletionModal();
      timer.reset();
    }
  };

  // The vertical timer column — identical between variants except the task area
  // (chip + sheet on mobile, legacy dropdown on desktop).
  const column = (
    <>
      {/* Top bar (title left, session tabs right) */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-[18px] pb-1 pt-4">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium text-notion-text-secondary">
            {todayLabel}
          </div>
          <div className="text-[20px] font-bold tracking-tight text-notion-text">
            {t("mobile.work.focusTitle", "Focus")}
          </div>
        </div>
        <SessionTabs value={timer.sessionType} onChange={onSwitchSession} />
      </div>

      {/* Task area */}
      <div className="flex shrink-0 justify-center pt-3.5">
        {isDesktop ? (
          <TaskSelector
            currentTitle={timer.activeTask?.title ?? t("work.freeSession")}
          />
        ) : (
          <ActiveTaskChip
            title={timer.activeTask?.title ?? null}
            folderPath={activeFolderPath}
            onOpenPicker={() => setTaskSelectorOpen(true)}
            onClear={() => timer.clearTask()}
          />
        )}
      </div>

      {/* Timer */}
      <div className="relative flex flex-1 flex-col items-center justify-center pt-2">
        <TimerArc
          progress={timer.progress / 100}
          strokeColor={sessionColor as string}
          running={timer.isRunning}
        >
          <div
            className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[1px]"
            style={{ color: sessionColor }}
          >
            <Zap size={14} style={{ color: sessionColor }} />
            <span>{sessionLabel}</span>
          </div>
          <div
            className="text-[64px] font-extralight leading-none tracking-tighter tabular-nums text-notion-text"
            style={{ marginTop: 8 }}
          >
            {timer.formatTime(timer.remainingSeconds)}
          </div>
          <div className="mt-2 text-xs font-medium text-notion-text-secondary">
            {remainingLabel}
          </div>
        </TimerArc>

        <div className="mt-6">
          <SessionDots
            done={timer.completedSessions}
            total={timer.targetSessions}
            color={sessionColor as string}
          />
        </div>
        <div className="mt-1.5 text-[11px] text-notion-text-secondary">
          {t(
            "mobile.work.dotsProgress",
            "Today {{done}} / {{total}} sessions",
            {
              done: timer.completedSessions,
              total: timer.targetSessions,
            },
          )}
        </div>
      </div>

      {/* Control dock */}
      <div className="shrink-0 pb-6 pt-1">
        <ControlDock
          running={timer.isRunning}
          color={sessionColor as string}
          onReset={timer.reset}
          onToggleRun={timer.isRunning ? timer.pause : timer.start}
          onSkip={handleSkip}
        />
      </div>
    </>
  );

  if (isDesktop) {
    return (
      <div
        className={`relative h-full overflow-hidden bg-notion-bg ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
      >
        {rightSidebarTarget &&
          createPortal(<WorkSidebarInfo />, rightSidebarTarget)}
        <div className="mx-auto flex h-full w-full max-w-sm flex-col">
          {column}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-notion-bg">
      {column}

      {/* Session completion modal (mobile only; desktop uses App-global modal) */}
      {timer.showCompletionModal && timer.completedSessionType && (
        <SessionCompletionSheet
          completedSessionType={timer.completedSessionType}
          onExtend={() => timer.extendWork(5)}
          onStartRest={timer.startRest}
          onStartWork={() => {
            timer.dismissCompletionModal();
            timer.start();
          }}
          onDismiss={timer.dismissCompletionModal}
        />
      )}

      {/* Task selector bottom sheet */}
      {taskSelectorOpen && (
        <WorkTaskSelector
          tree={taskTree}
          nodeMap={nodeMap}
          activeTaskId={timer.activeTask?.id ?? null}
          onSelect={(task) => {
            timer.startForTask(task.id, task.title);
            setTaskSelectorOpen(false);
          }}
          onClear={() => {
            timer.clearTask();
            setTaskSelectorOpen(false);
          }}
          onClose={() => setTaskSelectorOpen(false)}
        />
      )}
    </div>
  );
}

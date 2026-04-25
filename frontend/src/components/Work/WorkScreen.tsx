import { useCallback, useEffect, useState, useContext } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  History as HistoryIcon,
  Music,
  Play,
  SkipForward,
  Timer,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTimerContext } from "../../hooks/useTimerContext";
import { useSessionCompletionToast } from "../../hooks/useSessionCompletionToast";

import { getDataService } from "../../services";
import { LAYOUT } from "../../constants/layout";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { TimerDisplay } from "./TimerDisplay";
import { TimerCircularProgress } from "./TimerCircularProgress";
import { TaskSelector } from "./TaskSelector";
import { TodaySessionSummary } from "./TodaySessionSummary";
import { WorkMusicContent } from "./WorkMusicContent";
import { WorkHistoryContent } from "./WorkHistoryContent";
import { FreeSessionSaveDialog } from "./FreeSessionSaveDialog";
import { isFreeSessionSaveDialogEnabled } from "../../utils/pomodoroSettings";

import { ConfirmDialog } from "../shared/ConfirmDialog";
import { WorkSidebarInfo } from "./WorkSidebarInfo";
import { RightSidebarContext } from "../../context/RightSidebarContext";

type WorkTab = "timer" | "history" | "music";

const WORK_TABS: readonly TabItem<WorkTab>[] = [
  { id: "timer", labelKey: "work.tabTimer", icon: Timer },
  { id: "history", labelKey: "work.tabHistory", icon: HistoryIcon },
  { id: "music", labelKey: "work.tabMusic", icon: Music },
];

interface WorkScreenProps {
  onCompleteTask?: () => void;
}

export function WorkScreen({ onCompleteTask }: WorkScreenProps) {
  const { t } = useTranslation();
  const timer = useTimerContext();
  useSessionCompletionToast();

  const { portalTarget: rightSidebarTarget } = useContext(RightSidebarContext);
  const [activeTab, setActiveTab] = useState<WorkTab>("timer");
  const [confirmAction, setConfirmAction] = useState<"session" | "task" | null>(
    null,
  );

  const title = timer.activeTask?.title ?? t("work.freeSession");

  const [todaySummary, setTodaySummary] = useState({
    sessions: 0,
    totalMinutes: 0,
  });
  useEffect(() => {
    let cancelled = false;
    getDataService()
      .fetchTimerSessions()
      .then((sessions) => {
        if (cancelled) return;
        const todayStr = new Date().toISOString().substring(0, 10);
        const todaySessions = sessions.filter(
          (s) =>
            s.sessionType === "WORK" &&
            s.completed &&
            s.startedAt &&
            String(s.startedAt).substring(0, 10) === todayStr,
        );
        const totalMinutes = todaySessions.reduce(
          (acc, s) => acc + (s.duration ?? 0),
          0,
        );
        setTodaySummary({
          sessions: todaySessions.length,
          totalMinutes: Math.round(totalMinutes / 60),
        });
      })
      .catch((e) =>
        console.error("[WorkScreen] fetchTimerSessions failed:", e),
      );
    return () => {
      cancelled = true;
    };
  }, [timer.completedSessions]);

  const handleCompleteSession = useCallback(() => {
    setConfirmAction("session");
  }, []);

  const handleConfirmSession = useCallback(() => {
    if (timer.isRunning) timer.pause();
    timer.startRest();
    setConfirmAction(null);
  }, [timer]);

  const handleCompleteTask = useCallback(() => {
    setConfirmAction("task");
  }, []);

  const handleConfirmTask = useCallback(() => {
    onCompleteTask?.();
    setConfirmAction(null);
  }, [onCompleteTask]);

  // Auto-discard when the user has opted out of the save dialog
  useEffect(() => {
    if (!timer.pendingFreeSave) return;
    if (!isFreeSessionSaveDialogEnabled()) {
      timer.discardFreeSession();
    }
  }, [timer.pendingFreeSave, timer.discardFreeSession, timer]);

  return (
    <>
      {rightSidebarTarget &&
        createPortal(<WorkSidebarInfo />, rightSidebarTarget)}
      <div
        className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
      >
        <SectionHeader
          title={t("work.title")}
          tabs={WORK_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="flex-1 overflow-y-auto">
          {activeTab === "timer" && (
            <div className="h-full flex flex-col">
              {/* Header with buttons */}
              <div className="flex items-center justify-between py-3 border-b border-notion-border">
                <TaskSelector currentTitle={title} />
                <div className="flex items-center gap-2">
                  {!timer.isRunning && timer.sessionType !== "FREE" && (
                    <button
                      onClick={timer.startFreeSession}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-notion-accent hover:bg-notion-accent/10 rounded-lg transition-colors"
                    >
                      <Play size={14} />
                      {t("work.startFreeSession", "Free session")}
                    </button>
                  )}
                  {timer.sessionType === "WORK" && (
                    <button
                      onClick={handleCompleteSession}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30 rounded-lg transition-colors"
                    >
                      <SkipForward size={14} />
                      {t("work.sessionComplete")}
                    </button>
                  )}
                  {timer.activeTask && onCompleteTask && (
                    <button
                      onClick={handleCompleteTask}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30 rounded-lg transition-colors"
                    >
                      <CheckCircle2 size={14} />
                      {t("work.taskComplete")}
                    </button>
                  )}
                </div>
              </div>

              {/* Timer center */}
              <div className="flex-1 flex flex-col items-center justify-center gap-6 py-0">
                <TimerCircularProgress
                  progress={timer.progress}
                  sessionType={timer.sessionType}
                >
                  <TimerDisplay
                    sessionType={timer.sessionType}
                    remainingSeconds={timer.remainingSeconds}
                    isRunning={timer.isRunning}
                    completedSessions={timer.completedSessions}
                    sessionsBeforeLongBreak={timer.sessionsBeforeLongBreak}
                    formatTime={timer.formatTime}
                    onStart={timer.start}
                    onPause={timer.pause}
                    onReset={timer.reset}
                    onAdjustTime={timer.adjustRemainingSeconds}
                  />
                </TimerCircularProgress>
                <TodaySessionSummary
                  sessions={todaySummary.sessions}
                  totalMinutes={todaySummary.totalMinutes}
                />
              </div>
            </div>
          )}

          {activeTab === "history" && <WorkHistoryContent />}

          {activeTab === "music" && <WorkMusicContent />}
        </div>
      </div>

      {/* Confirm overlays */}
      {confirmAction === "session" && (
        <ConfirmDialog
          title={t("work.confirmSessionTitle")}
          message={t("work.confirmSessionMessage")}
          confirmLabel={t("work.sessionComplete")}
          cancelLabel={t("common.cancel")}
          onConfirm={handleConfirmSession}
          onCancel={() => setConfirmAction(null)}
          variant="blue"
        />
      )}
      {confirmAction === "task" && (
        <ConfirmDialog
          title={t("work.confirmTaskTitle")}
          message={t("work.confirmTaskMessage")}
          confirmLabel={t("work.taskComplete")}
          cancelLabel={t("common.cancel")}
          onConfirm={handleConfirmTask}
          onCancel={() => setConfirmAction(null)}
          variant="green"
        />
      )}

      {/* Free session save dialog */}
      {timer.pendingFreeSave && isFreeSessionSaveDialogEnabled() && (
        <FreeSessionSaveDialog
          elapsedSeconds={timer.pendingFreeSave.elapsedSeconds}
          onSave={timer.saveFreeSession}
          onDiscard={timer.discardFreeSession}
        />
      )}
    </>
  );
}

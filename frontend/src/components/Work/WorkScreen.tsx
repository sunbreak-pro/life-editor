import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Music, SkipForward, Timer, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTimerContext } from "../../hooks/useTimerContext";
import { useAudioContext } from "../../hooks/useAudioContext";
import { getDataService } from "../../services";
import { LAYOUT } from "../../constants/layout";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { UndoRedoButtons } from "../shared/UndoRedo";
import { TimerDisplay } from "./TimerDisplay";
import { TimerProgressBar } from "./TimerProgressBar";
import { TaskSelector } from "./TaskSelector";
import { TodaySessionSummary } from "./TodaySessionSummary";
import { PomodoroSettingsPanel } from "./PomodoroSettingsPanel";
import { WorkMusicContent } from "./WorkMusicContent";
import { PlaylistPlayerBar } from "./PlaylistPlayerBar";
import { ConfirmDialog } from "../shared/ConfirmDialog";

type WorkTab = "timer" | "pomodoro" | "music";

const WORK_TABS: readonly TabItem<WorkTab>[] = [
  { id: "timer", labelKey: "work.tabTimer", icon: Timer },
  { id: "pomodoro", labelKey: "work.tabPomodoro", icon: Clock },
  { id: "music", labelKey: "work.tabMusic", icon: Music },
];

interface WorkScreenProps {
  onCompleteTask?: () => void;
}

export function WorkScreen({ onCompleteTask }: WorkScreenProps) {
  const { t } = useTranslation();
  const timer = useTimerContext();
  const audio = useAudioContext();
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

  return (
    <>
      <div
        className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
      >
        <SectionHeader
          title={t("work.title")}
          tabs={WORK_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          actions={
            activeTab === "music" ? <UndoRedoButtons domain="playlist" /> : null
          }
        />

        <div className="flex-1 overflow-y-auto">
          {activeTab === "timer" && (
            <div className="h-full flex flex-col">
              {/* Header with buttons */}
              <div className="flex items-center justify-between py-3 border-b border-notion-border">
                <TaskSelector currentTitle={title} />
                <div className="flex items-center gap-2">
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
              <div className="flex-1 flex flex-col items-center justify-center gap-8 py-0">
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
                <div className="w-full max-w-xl">
                  <TimerProgressBar progress={timer.progress} />
                </div>
                <TodaySessionSummary
                  sessions={todaySummary.sessions}
                  totalMinutes={todaySummary.totalMinutes}
                />

                {/* Playlist selector for timer — only visible while timer is running */}
                {timer.isRunning && (
                  <div className="pb-5 w-2xl">
                    <div className="px-10">
                      <select
                        value={audio.timerPlaylistId ?? ""}
                        onChange={(e) =>
                          audio.setTimerPlaylistId(e.target.value || null)
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-notion-border bg-notion-bg text-notion-text focus:outline-none focus:border-notion-accent"
                      >
                        <option value="">{t("work.noPlaylist")}</option>
                        {audio.playlistData.playlists.map((pl) => (
                          <option key={pl.id} value={pl.id}>
                            {pl.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Player bar when playlist is selected */}
                    {audio.timerPlaylistId && (
                      <div className="pt-5">
                        <div className="max-w-xl mx-auto">
                          <PlaylistPlayerBar
                            player={audio.playlistPlayer}
                            playlistData={audio.playlistData}
                            customSounds={audio.customSounds}
                            getDisplayName={audio.getDisplayName}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "pomodoro" && (
            <PomodoroSettingsPanel
              workDurationMinutes={timer.workDurationMinutes}
              breakDurationMinutes={timer.breakDurationMinutes}
              longBreakDurationMinutes={timer.longBreakDurationMinutes}
              sessionsBeforeLongBreak={timer.sessionsBeforeLongBreak}
              onChangeWorkDuration={timer.setWorkDurationMinutes}
              onChangeBreakDuration={timer.setBreakDurationMinutes}
              onChangeLongBreakDuration={timer.setLongBreakDurationMinutes}
              onChangeSessionsBeforeLongBreak={timer.setSessionsBeforeLongBreak}
              disabled={timer.isRunning}
              autoStartBreaks={timer.autoStartBreaks}
              onChangeAutoStartBreaks={timer.setAutoStartBreaks}
            />
          )}

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
    </>
  );
}

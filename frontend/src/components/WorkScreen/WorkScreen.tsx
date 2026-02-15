import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTimerContext } from "../../hooks/useTimerContext";
import { useAudioContext } from "../../hooks/useAudioContext";
import { useSoundTags } from "../../hooks/useSoundTags";
import { useAudioFileUpload } from "../../hooks/useAudioFileUpload";
import { getDataService } from "../../services";
import { TimerDisplay } from "./TimerDisplay";
import { TimerProgressBar } from "./TimerProgressBar";
import { SoundMixer } from "./SoundMixer";
import { AudioModeSwitch } from "./AudioModeSwitch";
import { PlaylistPlayerBar } from "./PlaylistPlayerBar";
import { TaskSelector } from "./TaskSelector";
import { TodaySessionSummary } from "./TodaySessionSummary";
import { SoundPickerModal } from "../Music/SoundPickerModal";
import { ConfirmDialog } from "../common/ConfirmDialog";

interface WorkScreenProps {
  onCompleteTask?: () => void;
}

export function WorkScreen({ onCompleteTask }: WorkScreenProps) {
  const { t } = useTranslation();
  const timer = useTimerContext();
  const audio = useAudioContext();
  const soundTagState = useSoundTags();
  const { getDisplayName } = soundTagState;
  const [pickerOpen, setPickerOpen] = useState(false);
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

  const handleAddCustomSound = useAudioFileUpload(audio.addSound);

  return (
    <div className="h-full flex flex-col">
      {/* Header with buttons */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-notion-border">
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
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-8">
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
      </div>

      {/* Audio footer */}
      <div className="px-6 pb-6">
        <div className="max-w-xl mx-auto">
          {/* Mode switch */}
          <div className="flex justify-center mb-3">
            <AudioModeSwitch
              audioMode={audio.audioMode}
              onSwitch={audio.switchAudioMode}
            />
          </div>

          {/* Mixer mode */}
          {audio.audioMode === "mixer" && (
            <SoundMixer
              mixer={audio.mixer}
              onToggleSound={audio.toggleSound}
              onSetVolume={audio.setVolume}
              customSounds={audio.customSounds}
              channelPositions={audio.channelPositions}
              onSeekSound={audio.seekSound}
              workscreenSelections={audio.workscreenSelections}
              getDisplayName={getDisplayName}
              onOpenPicker={() => setPickerOpen(true)}
            />
          )}

          {/* Playlist mode */}
          {audio.audioMode === "playlist" && (
            <PlaylistPlayerBar
              player={audio.playlistPlayer}
              playlistData={audio.playlistData}
              customSounds={audio.customSounds}
              manualPlay={audio.manualPlay}
              onToggleManualPlay={audio.toggleManualPlay}
              getDisplayName={getDisplayName}
            />
          )}
        </div>
      </div>

      {/* Sound Picker Modal (only for mixer mode) */}
      {audio.audioMode === "mixer" && (
        <SoundPickerModal
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelectSound={(soundId) => {
            audio.toggleWorkscreenSelection(soundId);
            setPickerOpen(false);
          }}
          excludeSoundIds={audio.workscreenSelections}
          customSounds={audio.customSounds}
          onAddCustomSound={handleAddCustomSound}
          soundTagState={soundTagState}
        />
      )}

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
    </div>
  );
}

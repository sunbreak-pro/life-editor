import { useEffect, useState } from "react";
import { Play, Pause, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTimerContext } from "../../hooks/useTimerContext";
import { useAudioContext } from "../../hooks/useAudioContext";
import { getDataService } from "../../services";

export function WorkSidebarInfo() {
  const { t } = useTranslation();
  const timer = useTimerContext();
  const audio = useAudioContext();

  // Today's sessions
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
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [timer.completedSessions]);

  const { playlistPlayer, playlistData } = audio;
  const activePlaylist = playlistData.playlists.find(
    (p) => p.id === playlistPlayer.activePlaylistId,
  );
  const currentTrack =
    playlistPlayer.activePlaylistItems[playlistPlayer.currentTrackIndex];
  const currentTrackName = currentTrack
    ? (audio.getDisplayName(currentTrack.soundId) ?? currentTrack.soundId)
    : null;

  return (
    <div className="p-3 space-y-4">
      {/* Now Playing */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold text-notion-text-secondary uppercase tracking-wider px-1">
          {t("work.sidebar.nowPlaying")}
        </h4>
        {activePlaylist ? (
          <div className="space-y-1.5">
            <p className="text-xs text-notion-text px-1 truncate">
              {activePlaylist.name}
            </p>
            {currentTrackName && (
              <p className="text-[11px] text-notion-text-secondary px-1 truncate">
                {currentTrackName}
              </p>
            )}
            <div className="flex items-center gap-1 px-1">
              <button
                onClick={
                  playlistPlayer.isPlaying
                    ? playlistPlayer.pause
                    : playlistPlayer.play
                }
                className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
              >
                {playlistPlayer.isPlaying ? (
                  <Pause size={14} />
                ) : (
                  <Play size={14} />
                )}
              </button>
              <button
                onClick={playlistPlayer.next}
                className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
              >
                <SkipForward size={14} />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-notion-text-secondary px-1">
            {t("work.sidebar.noPlaylist")}
          </p>
        )}
      </div>

      <div className="border-t border-notion-border" />

      {/* Pomodoro Settings Summary */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold text-notion-text-secondary uppercase tracking-wider px-1">
          {t("work.sidebar.pomodoroSettings")}
        </h4>
        <div className="space-y-1 px-1">
          <div className="flex justify-between text-xs">
            <span className="text-notion-text-secondary">Work</span>
            <span className="text-notion-text">
              {timer.workDurationMinutes}m
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-notion-text-secondary">Break</span>
            <span className="text-notion-text">
              {timer.breakDurationMinutes}m
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-notion-text-secondary">Long Break</span>
            <span className="text-notion-text">
              {timer.longBreakDurationMinutes}m
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-notion-text-secondary">Sessions</span>
            <span className="text-notion-text">
              {timer.sessionsBeforeLongBreak}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-notion-border" />

      {/* Today's Stats */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold text-notion-text-secondary uppercase tracking-wider px-1">
          {t("work.sidebar.todayStats")}
        </h4>
        <div className="space-y-1 px-1">
          <p className="text-xs text-notion-text">
            {t("work.sidebar.sessions", { count: todaySummary.sessions })}
          </p>
          <p className="text-xs text-notion-text-secondary">
            {t("work.sidebar.totalTime", {
              minutes: todaySummary.totalMinutes,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

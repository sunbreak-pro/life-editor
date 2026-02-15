import { useState, useEffect, useCallback } from "react";
import {
  PanelRight,
  Timer,
  ListMusic,
  Minus,
  Plus,
  Save,
  X,
  Shuffle,
  Repeat,
  Repeat1,
  Music,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTimerContext } from "../../hooks/useTimerContext";
import { useAudioContext } from "../../hooks/useAudioContext";
import { useSoundTags } from "../../hooks/useSoundTags";
import { DurationPicker } from "../shared/DurationPicker";
import { getDataService } from "../../services";
import { SOUND_TYPES } from "../../constants/sounds";
import type { PomodoroPreset } from "../../types/timer";
import type { RepeatMode } from "../../types/playlist";

type WorkTab = "pomodoro" | "playlist";

interface WorkSidebarProps {
  width: number;
  onToggle: () => void;
}

function RepeatIcon({ mode }: { mode: RepeatMode }) {
  if (mode === "one") return <Repeat1 size={14} />;
  return <Repeat size={14} />;
}

export function WorkSidebar({ width, onToggle }: WorkSidebarProps) {
  const { t } = useTranslation();
  const timer = useTimerContext();
  const audio = useAudioContext();
  const soundTagState = useSoundTags();
  const [activeTab, setActiveTab] = useState<WorkTab>("pomodoro");

  // Pomodoro presets
  const [presets, setPresets] = useState<PomodoroPreset[]>([]);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [presetName, setPresetName] = useState("");

  const loadPresets = useCallback(() => {
    getDataService()
      .fetchPomodoroPresets()
      .then(setPresets)
      .catch((e) => console.warn("[Pomodoro] fetch presets:", e.message));
  }, []);

  useEffect(() => {
    if (activeTab === "pomodoro") loadPresets();
  }, [activeTab, loadPresets]);

  const handleApplyPreset = (preset: PomodoroPreset) => {
    timer.setWorkDurationMinutes(preset.workDuration);
    timer.setBreakDurationMinutes(preset.breakDuration);
    timer.setLongBreakDurationMinutes(preset.longBreakDuration);
    timer.setSessionsBeforeLongBreak(preset.sessionsBeforeLongBreak);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    getDataService()
      .createPomodoroPreset({
        name: presetName.trim(),
        workDuration: timer.workDurationMinutes,
        breakDuration: timer.breakDurationMinutes,
        longBreakDuration: timer.longBreakDurationMinutes,
        sessionsBeforeLongBreak: timer.sessionsBeforeLongBreak,
      })
      .then(() => {
        setShowSaveInput(false);
        setPresetName("");
        loadPresets();
      })
      .catch((e) => console.warn("[Pomodoro] save preset:", e.message));
  };

  const handleDeletePreset = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    getDataService()
      .deletePomodoroPreset(id)
      .then(loadPresets)
      .catch((err) => console.warn("[Pomodoro] delete preset:", err.message));
  };

  // Playlist helpers
  const player = audio.playlistPlayer;
  const activePlaylist = audio.playlistData.playlists.find(
    (p) => p.id === player.activePlaylistId,
  );

  const getTrackName = useCallback(
    (soundId: string): string => {
      const displayName = soundTagState.getDisplayName(soundId);
      if (displayName) return displayName;
      const builtIn = SOUND_TYPES.find((s) => s.id === soundId);
      if (builtIn) return builtIn.label;
      const custom = audio.customSounds.find((s) => s.id === soundId);
      if (custom) return custom.label;
      return soundId;
    },
    [soundTagState, audio.customSounds],
  );

  const disabled = timer.isRunning;

  return (
    <div
      className="h-screen bg-notion-bg-subsidebar border-l border-notion-border flex flex-col"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-[20px] font-semibold uppercase tracking-wider text-notion-text-secondary">
          Work
        </span>
        <button
          onClick={onToggle}
          className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
        >
          <PanelRight size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 pb-2">
        <button
          onClick={() => setActiveTab("pomodoro")}
          className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${
            activeTab === "pomodoro"
              ? "bg-notion-accent/10 text-notion-accent font-medium"
              : "text-notion-text-secondary hover:bg-notion-hover"
          }`}
        >
          <Timer size={12} />
          {t("pomodoro.title")}
        </button>
        <button
          onClick={() => setActiveTab("playlist")}
          className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${
            activeTab === "playlist"
              ? "bg-notion-accent/10 text-notion-accent font-medium"
              : "text-notion-text-secondary hover:bg-notion-hover"
          }`}
        >
          <ListMusic size={12} />
          {t("playlist.tabPlaylists")}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3">
        {activeTab === "pomodoro" && (
          <div
            className={`space-y-4 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
          >
            {/* Presets */}
            {presets.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-notion-text-secondary mb-1.5">
                  {t("pomodoro.presets")}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      className="group relative flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-notion-hover text-notion-text hover:bg-notion-accent/10 hover:text-notion-accent transition-colors"
                    >
                      <span>{preset.name}</span>
                      <button
                        onClick={(e) => handleDeletePreset(preset.id, e)}
                        className="opacity-0 group-hover:opacity-100 ml-0.5 text-notion-text-secondary hover:text-notion-danger transition-all"
                      >
                        <X size={10} />
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-notion-text-secondary mb-1">
                {t("pomodoro.workDuration")}
              </label>
              <DurationPicker
                value={timer.workDurationMinutes}
                onChange={timer.setWorkDurationMinutes}
                disabled={disabled}
                presets={[25, 30, 45, 55, 60]}
                min={5}
                max={240}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-notion-text-secondary mb-1">
                {t("pomodoro.breakDuration")}
              </label>
              <DurationPicker
                value={timer.breakDurationMinutes}
                onChange={timer.setBreakDurationMinutes}
                disabled={disabled}
                presets={[5, 10, 15, 20, 30]}
                min={5}
                max={60}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-notion-text-secondary mb-1">
                {t("pomodoro.longBreakDuration")}
              </label>
              <DurationPicker
                value={timer.longBreakDurationMinutes}
                onChange={timer.setLongBreakDurationMinutes}
                disabled={disabled}
                presets={[10, 30, 60, 90, 120]}
                min={5}
                max={120}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-notion-text-secondary mb-1">
                {t("pomodoro.sessionsPerSet")}
              </label>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() =>
                    timer.setSessionsBeforeLongBreak(
                      timer.sessionsBeforeLongBreak - 1,
                    )
                  }
                  disabled={disabled || timer.sessionsBeforeLongBreak <= 1}
                  className="p-1 rounded-md text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover transition-colors disabled:opacity-30"
                >
                  <Minus size={14} />
                </button>
                <span className="text-sm font-mono tabular-nums text-notion-text w-6 text-center">
                  {timer.sessionsBeforeLongBreak}
                </span>
                <button
                  onClick={() =>
                    timer.setSessionsBeforeLongBreak(
                      timer.sessionsBeforeLongBreak + 1,
                    )
                  }
                  disabled={disabled || timer.sessionsBeforeLongBreak >= 20}
                  className="p-1 rounded-md text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover transition-colors disabled:opacity-30"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Auto-start breaks */}
            <div className="flex items-center justify-between">
              <label className="text-xs text-notion-text-secondary">
                {t("pomodoro.autoStartBreaks")}
              </label>
              <button
                onClick={() => timer.setAutoStartBreaks(!timer.autoStartBreaks)}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  timer.autoStartBreaks
                    ? "bg-notion-accent"
                    : "bg-notion-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    timer.autoStartBreaks ? "translate-x-4" : ""
                  }`}
                />
              </button>
            </div>

            {/* Save as preset */}
            {showSaveInput ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSavePreset();
                    if (e.key === "Escape") setShowSaveInput(false);
                  }}
                  placeholder={t("pomodoro.presetName")}
                  className="flex-1 text-xs px-2 py-1.5 rounded bg-notion-bg border border-notion-border text-notion-text placeholder-notion-text-secondary"
                  autoFocus
                />
                <button
                  onClick={handleSavePreset}
                  className="p-1.5 rounded text-notion-accent hover:bg-notion-accent/10"
                >
                  <Save size={14} />
                </button>
                <button
                  onClick={() => setShowSaveInput(false)}
                  className="p-1.5 rounded text-notion-text-secondary hover:bg-notion-hover"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                className="flex items-center gap-1.5 text-xs text-notion-text-secondary hover:text-notion-accent transition-colors"
              >
                <Save size={12} />
                {t("pomodoro.saveAsPreset")}
              </button>
            )}
          </div>
        )}

        {activeTab === "playlist" && (
          <div className="space-y-3">
            {/* Playlist selector */}
            {audio.playlistData.playlists.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-notion-text-secondary mb-1.5">
                  {t("playlist.playlists")}
                </label>
                <div className="space-y-0.5">
                  {audio.playlistData.playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => player.setActivePlaylistId(pl.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
                        player.activePlaylistId === pl.id
                          ? "bg-notion-accent/10 text-notion-accent font-medium"
                          : "text-notion-text hover:bg-notion-hover"
                      }`}
                    >
                      <ListMusic size={14} className="shrink-0" />
                      <span className="truncate flex-1 text-left">
                        {pl.name}
                      </span>
                      <span className="text-[10px] text-notion-text-secondary">
                        {
                          (audio.playlistData.itemsByPlaylist[pl.id] || [])
                            .length
                        }{" "}
                        {t("playlist.tracks")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Track list */}
            {activePlaylist && player.activePlaylistItems.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-notion-text-secondary">
                    {activePlaylist.name}
                  </span>
                  <span className="text-[10px] text-notion-text-secondary">
                    {player.activePlaylistItems.length} {t("playlist.tracks")}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {player.activePlaylistItems.map((item, index) => {
                    const isCurrent = index === player.currentTrackIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={() => player.jumpToTrack(index)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
                          isCurrent
                            ? "bg-notion-accent/10 text-notion-accent font-medium"
                            : "text-notion-text hover:bg-notion-hover"
                        }`}
                      >
                        {isCurrent ? (
                          <Music
                            size={12}
                            className="shrink-0 text-notion-accent"
                          />
                        ) : (
                          <span className="w-3 text-center text-[10px] text-notion-text-secondary shrink-0">
                            {index + 1}
                          </span>
                        )}
                        <span className="truncate text-left flex-1">
                          {getTrackName(item.soundId)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shuffle / Repeat toggles */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={player.toggleShuffle}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                  player.isShuffle
                    ? "text-notion-accent bg-notion-accent/10"
                    : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
                }`}
              >
                <Shuffle size={12} />
                {t("playlist.shuffle")}
              </button>
              <button
                onClick={player.toggleRepeatMode}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                  player.repeatMode !== "off"
                    ? "text-notion-accent bg-notion-accent/10"
                    : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
                }`}
              >
                <RepeatIcon mode={player.repeatMode} />
                {t("playlist.repeat")}
              </button>
            </div>

            {!player.activePlaylistId && (
              <div className="text-center py-4 text-xs text-notion-text-secondary">
                {t("playlist.selectPlaylist")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

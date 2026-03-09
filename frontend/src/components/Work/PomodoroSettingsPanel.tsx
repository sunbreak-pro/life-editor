import { useState, useEffect, useCallback } from "react";
import { Minus, Plus, Save, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DurationPicker } from "../shared/DurationPicker";
import { getDataService } from "../../services";
import type { PomodoroPreset } from "../../types/timer";

interface PomodoroSettingsPanelProps {
  workDurationMinutes: number;
  breakDurationMinutes: number;
  longBreakDurationMinutes: number;
  sessionsBeforeLongBreak: number;
  onChangeWorkDuration: (min: number) => void;
  onChangeBreakDuration: (min: number) => void;
  onChangeLongBreakDuration: (min: number) => void;
  onChangeSessionsBeforeLongBreak: (count: number) => void;
  disabled: boolean;
  autoStartBreaks: boolean;
  onChangeAutoStartBreaks: (enabled: boolean) => void;
}

export function PomodoroSettingsPanel({
  workDurationMinutes,
  breakDurationMinutes,
  longBreakDurationMinutes,
  sessionsBeforeLongBreak,
  onChangeWorkDuration,
  onChangeBreakDuration,
  onChangeLongBreakDuration,
  onChangeSessionsBeforeLongBreak,
  disabled,
  autoStartBreaks,
  onChangeAutoStartBreaks,
}: PomodoroSettingsPanelProps) {
  const { t } = useTranslation();
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
    loadPresets();
  }, [loadPresets]);

  const handleApplyPreset = (preset: PomodoroPreset) => {
    onChangeWorkDuration(preset.workDuration);
    onChangeBreakDuration(preset.breakDuration);
    onChangeLongBreakDuration(preset.longBreakDuration);
    onChangeSessionsBeforeLongBreak(preset.sessionsBeforeLongBreak);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    getDataService()
      .createPomodoroPreset({
        name: presetName.trim(),
        workDuration: workDurationMinutes,
        breakDuration: breakDurationMinutes,
        longBreakDuration: longBreakDurationMinutes,
        sessionsBeforeLongBreak,
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

  const sessionDots = Array.from(
    { length: sessionsBeforeLongBreak },
    (_, i) => i,
  );

  return (
    <div
      className={`max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 py-4 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      {/* Left column: Current config summary */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-notion-text-secondary uppercase tracking-wider">
          {t("pomodoro.currentConfig")}
        </h3>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-notion-text-secondary font-medium">
              {t("timer.work")}
            </span>
            <span className="text-xl font-bold tabular-nums text-notion-text">
              {workDurationMinutes}
              <span className="text-sm font-normal text-notion-text-secondary ml-1">
                min
              </span>
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-notion-text-secondary font-medium">
              {t("timer.rest")}
            </span>
            <span className="text-xl font-semibold tabular-nums text-notion-text">
              {breakDurationMinutes}
              <span className="text-sm font-normal text-notion-text-secondary ml-1">
                min
              </span>
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-notion-text-secondary font-medium">
              {t("timer.longRest")}
            </span>
            <span className="text-xl font-semibold tabular-nums text-notion-text">
              {longBreakDurationMinutes}
              <span className="text-sm font-normal text-notion-text-secondary ml-1">
                min
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-notion-text-secondary font-medium">
              {t("pomodoro.sessionsPerSet")}
            </span>
            <div className="flex items-center gap-1">
              {sessionDots.map((i) => (
                <span
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-notion-accent"
                />
              ))}
              <span className="text-notion-text-secondary ml-1.5 font-medium">
                {sessionsBeforeLongBreak}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-notion-text-secondary font-medium">
              {t("pomodoro.autoStartBreaks")}
            </span>
            <span
              className={`font-medium ${autoStartBreaks ? "text-notion-accent" : "text-notion-text-secondary"}`}
            >
              {autoStartBreaks ? "ON" : "OFF"}
            </span>
          </div>
        </div>
      </div>

      {/* Right column: Settings controls */}
      <div className="space-y-5">
        {/* Presets */}
        {presets.length > 0 && (
          <div>
            <label className="block text-lg font-bold text-notion-text-secondary mb-1.5">
              {t("pomodoro.presets")}
            </label>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className="group relative flex items-center gap-1 px-3 py-1.5 text-sm rounded-full bg-notion-hover text-notion-text hover:bg-notion-accent/10 hover:text-notion-accent transition-colors"
                >
                  <span>{preset.name}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleDeletePreset(preset.id, e)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleDeletePreset(
                          preset.id,
                          e as unknown as React.MouseEvent,
                        );
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-0.5 text-notion-text-secondary hover:text-notion-danger transition-all"
                  >
                    <X size={10} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-notion-text-secondary mb-1">
            {t("pomodoro.workDuration")}
          </label>
          <DurationPicker
            value={workDurationMinutes}
            onChange={onChangeWorkDuration}
            disabled={disabled}
            presets={[25, 30, 45, 55, 60]}
            min={5}
            max={240}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-notion-text-secondary mb-1">
            {t("pomodoro.breakDuration")}
          </label>
          <DurationPicker
            value={breakDurationMinutes}
            onChange={onChangeBreakDuration}
            disabled={disabled}
            presets={[5, 10, 15, 20, 30]}
            min={5}
            max={60}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-notion-text-secondary mb-1">
            {t("pomodoro.longBreakDuration")}
          </label>
          <DurationPicker
            value={longBreakDurationMinutes}
            onChange={onChangeLongBreakDuration}
            disabled={disabled}
            presets={[10, 30, 60, 90, 120]}
            min={5}
            max={120}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-notion-text-secondary mb-1">
            {t("pomodoro.sessionsPerSet")}
          </label>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() =>
                onChangeSessionsBeforeLongBreak(sessionsBeforeLongBreak - 1)
              }
              disabled={disabled || sessionsBeforeLongBreak <= 1}
              className="p-1 rounded-md text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover transition-colors disabled:opacity-30"
            >
              <Minus size={14} />
            </button>
            <span className="font-mono tabular-nums text-notion-text w-6 text-center text-lg">
              {sessionsBeforeLongBreak}
            </span>
            <button
              onClick={() =>
                onChangeSessionsBeforeLongBreak(sessionsBeforeLongBreak + 1)
              }
              disabled={disabled || sessionsBeforeLongBreak >= 20}
              className="p-1 rounded-md text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover transition-colors disabled:opacity-30"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-notion-text-secondary font-medium">
            {t("pomodoro.autoStartBreaks")}
          </label>
          <button
            onClick={() => onChangeAutoStartBreaks(!autoStartBreaks)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              autoStartBreaks ? "bg-notion-accent" : "bg-notion-border"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                autoStartBreaks ? "translate-x-4" : ""
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
              className="flex-1 px-3 py-1.5 rounded bg-notion-bg border border-notion-border text-notion-text placeholder-notion-text-secondary"
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
            className="flex items-center gap-1.5 text-notion-text-secondary hover:text-notion-accent transition-colors font-medium"
          >
            <Save size={14} />
            {t("pomodoro.saveAsPreset")}
          </button>
        )}
      </div>
    </div>
  );
}

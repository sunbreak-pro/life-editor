import { useState, useCallback } from "react";
import { Volume2, Play, PartyPopper } from "lucide-react";
import { useTranslation } from "react-i18next";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import {
  loadSoundEffectSettings,
  saveSoundEffectSettings,
  playEffectSound,
} from "../../utils/playEffectSound";
import type {
  SoundEffectKey,
  SoundEffectSettings as SoundEffectSettingsType,
} from "../../utils/playEffectSound";

interface SoundItem {
  key: SoundEffectKey;
  labelKey: string;
  src: string;
}

const SOUND_ITEMS: SoundItem[] = [
  {
    key: "taskComplete",
    labelKey: "soundEffects.taskComplete",
    src: "/sounds/task_complete_sound.mp3",
  },
  {
    key: "sessionStart",
    labelKey: "soundEffects.sessionStart",
    src: "/sounds/session_start_sound.mp3",
  },
  {
    key: "sessionComplete",
    labelKey: "soundEffects.sessionComplete",
    src: "/sounds/session_complete_sound.mp3",
  },
  {
    key: "pomodoroComplete",
    labelKey: "soundEffects.pomodoroComplete",
    src: "/sounds/pomodoro_complete_sound.mp3",
  },
];

export function SoundEffectSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SoundEffectSettingsType>(
    loadSoundEffectSettings,
  );
  const [confettiEnabled, setConfettiEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CONFETTI_ENABLED);
    return stored !== "false"; // default: ON
  });

  const updateSetting = useCallback(
    (
      key: SoundEffectKey,
      update: Partial<{ enabled: boolean; volume: number }>,
    ) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: { ...prev[key], ...update } };
        saveSoundEffectSettings(next);
        return next;
      });
    },
    [],
  );

  const handleConfettiToggle = useCallback(() => {
    setConfettiEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEYS.CONFETTI_ENABLED, String(next));
      return next;
    });
  }, []);

  const handlePreview = useCallback(
    (src: string, key: SoundEffectKey) => {
      const setting = settings[key];
      const audio = new Audio(src);
      audio.volume = Math.max(0, Math.min(1, setting.volume / 100));
      audio.addEventListener("ended", () => audio.remove());
      audio.play().catch(() => {});
    },
    [settings],
  );

  return (
    <div data-section-id="sounds">
      <h3 className="text-lg font-semibold text-notion-text mb-4">
        {t("soundEffects.title")}
      </h3>

      <div className="space-y-4">
        {SOUND_ITEMS.map((item) => {
          const setting = settings[item.key];
          return (
            <div
              key={item.key}
              className="flex items-center gap-3 p-3 rounded-lg bg-notion-bg-secondary"
            >
              {/* Toggle */}
              <button
                onClick={() =>
                  updateSetting(item.key, { enabled: !setting.enabled })
                }
                className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                  setting.enabled ? "bg-notion-accent" : "bg-notion-border"
                } cursor-pointer`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                    setting.enabled ? "translate-x-4" : ""
                  }`}
                />
              </button>

              {/* Label */}
              <span
                className={`text-sm min-w-24 shrink-0 ${
                  setting.enabled
                    ? "text-notion-text"
                    : "text-notion-text-secondary"
                }`}
              >
                {t(item.labelKey)}
              </span>

              {/* Volume slider */}
              <Volume2
                size={14}
                className="text-notion-text-secondary shrink-0"
              />
              <input
                type="range"
                min={0}
                max={100}
                value={setting.volume}
                onChange={(e) =>
                  updateSetting(item.key, { volume: Number(e.target.value) })
                }
                disabled={!setting.enabled}
                className="flex-1 accent-notion-accent disabled:opacity-40"
              />
              <span className="text-xs text-notion-text-secondary w-7 text-right tabular-nums">
                {setting.volume}
              </span>

              {/* Preview */}
              <button
                onClick={() => handlePreview(item.src, item.key)}
                disabled={!setting.enabled}
                className="p-1 rounded text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={t("notifications.preview")}
              >
                <Play size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confetti toggle */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-notion-text mb-4">
          {t("soundEffects.confetti")}
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PartyPopper
              size={18}
              className={
                confettiEnabled
                  ? "text-notion-accent"
                  : "text-notion-text-secondary"
              }
            />
            <div>
              <p className="text-sm text-notion-text">
                {t("soundEffects.confettiLabel")}
              </p>
              <p className="text-xs text-notion-text-secondary">
                {t("soundEffects.confettiDescription")}
              </p>
            </div>
          </div>
          <button
            onClick={handleConfettiToggle}
            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
              confettiEnabled ? "bg-notion-accent" : "bg-notion-border"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                confettiEnabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

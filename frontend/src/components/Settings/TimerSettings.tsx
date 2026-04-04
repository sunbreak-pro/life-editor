import { useTranslation } from "react-i18next";
import { useTimerContext } from "../../hooks/useTimerContext";

export function TimerSettings() {
  const { t } = useTranslation();
  const {
    isRunning,
    workDurationMinutes,
    breakDurationMinutes,
    longBreakDurationMinutes,
    sessionsBeforeLongBreak,
    autoStartBreaks,
    targetSessions,
    setWorkDurationMinutes,
    setBreakDurationMinutes,
    setLongBreakDurationMinutes,
    setSessionsBeforeLongBreak,
    setAutoStartBreaks,
    setTargetSessions,
  } = useTimerContext();

  return (
    <div className="space-y-6" data-section-id="timer">
      <h3 className="text-lg font-semibold text-notion-text">
        {t("timerSettings.title")}
      </h3>

      {isRunning && (
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-4 py-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {t("timerSettings.runningWarning")}
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Work Duration */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-notion-text">
              {t("timerSettings.workDuration")}
            </p>
            <span className="text-xs text-notion-text-secondary tabular-nums">
              {workDurationMinutes} {t("timerSettings.minutes")}
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={workDurationMinutes}
            onChange={(e) => setWorkDurationMinutes(Number(e.target.value))}
            disabled={isRunning}
            className="w-full accent-[var(--notion-accent)] disabled:opacity-40"
          />
          <div className="flex justify-between text-xs text-notion-text-secondary mt-1">
            <span>5 {t("timerSettings.minutes")}</span>
            <span>120 {t("timerSettings.minutes")}</span>
          </div>
        </div>

        {/* Break Duration */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-notion-text">
              {t("timerSettings.breakDuration")}
            </p>
            <span className="text-xs text-notion-text-secondary tabular-nums">
              {breakDurationMinutes} {t("timerSettings.minutes")}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={breakDurationMinutes}
            onChange={(e) => setBreakDurationMinutes(Number(e.target.value))}
            disabled={isRunning}
            className="w-full accent-[var(--notion-accent)] disabled:opacity-40"
          />
          <div className="flex justify-between text-xs text-notion-text-secondary mt-1">
            <span>1 {t("timerSettings.minutes")}</span>
            <span>30 {t("timerSettings.minutes")}</span>
          </div>
        </div>

        {/* Long Break Duration */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-notion-text">
              {t("timerSettings.longBreakDuration")}
            </p>
            <span className="text-xs text-notion-text-secondary tabular-nums">
              {longBreakDurationMinutes} {t("timerSettings.minutes")}
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={longBreakDurationMinutes}
            onChange={(e) =>
              setLongBreakDurationMinutes(Number(e.target.value))
            }
            disabled={isRunning}
            className="w-full accent-[var(--notion-accent)] disabled:opacity-40"
          />
          <div className="flex justify-between text-xs text-notion-text-secondary mt-1">
            <span>5 {t("timerSettings.minutes")}</span>
            <span>60 {t("timerSettings.minutes")}</span>
          </div>
        </div>

        {/* Sessions Before Long Break */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-notion-text">
              {t("timerSettings.sessionsBeforeLongBreak")}
            </p>
            <span className="text-xs text-notion-text-secondary tabular-nums">
              {sessionsBeforeLongBreak}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={sessionsBeforeLongBreak}
            onChange={(e) => setSessionsBeforeLongBreak(Number(e.target.value))}
            disabled={isRunning}
            className="w-full accent-[var(--notion-accent)] disabled:opacity-40"
          />
          <div className="flex justify-between text-xs text-notion-text-secondary mt-1">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        {/* Target Sessions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-notion-text">
              {t("timerSettings.targetSessions")}
            </p>
            <span className="text-xs text-notion-text-secondary tabular-nums">
              {targetSessions}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={targetSessions}
            onChange={(e) => setTargetSessions(Number(e.target.value))}
            disabled={isRunning}
            className="w-full accent-[var(--notion-accent)] disabled:opacity-40"
          />
          <div className="flex justify-between text-xs text-notion-text-secondary mt-1">
            <span>1</span>
            <span>20</span>
          </div>
        </div>

        {/* Auto-start Breaks */}
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-notion-text">
              {t("timerSettings.autoStartBreaks")}
            </p>
            <p className="text-xs text-notion-text-secondary">
              {t("timerSettings.autoStartBreaksDesc")}
            </p>
          </div>
          <button
            onClick={() => setAutoStartBreaks(!autoStartBreaks)}
            disabled={isRunning}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              autoStartBreaks ? "bg-notion-accent" : "bg-notion-border"
            } ${isRunning ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                autoStartBreaks ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

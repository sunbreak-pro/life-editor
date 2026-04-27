import { useState, useCallback, useEffect } from "react";
import { Bell, Clock, CalendarCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services/dataServiceFactory";
import { TimeDropdown } from "../shared/TimeDropdown";
import { formatTime } from "../../utils/timeGridUtils";

const OFFSET_OPTIONS = [5, 10, 15, 30, 60, 120, 1440];

export function ReminderSettings() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [defaultOffset, setDefaultOffset] = useState(30);
  const [dailyReviewEnabled, setDailyReviewEnabled] = useState(false);
  const [dailyReviewTime, setDailyReviewTime] = useState("21:00");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDataService()
      .getReminderSettings()
      .then((settings: Record<string, unknown>) => {
        if (settings.enabled) setEnabled(settings.enabled as boolean);
        if (settings.defaultOffset)
          setDefaultOffset(settings.defaultOffset as number);
        if (settings.dailyReviewEnabled)
          setDailyReviewEnabled(settings.dailyReviewEnabled as boolean);
        if (settings.dailyReviewTime)
          setDailyReviewTime(settings.dailyReviewTime as string);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const save = useCallback((updates: Record<string, unknown>) => {
    getDataService().setReminderSettings(updates as Record<string, string>);
  }, []);

  const handleEnabledToggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    save({ enabled: next });
  }, [enabled, save]);

  const handleOffsetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = Number(e.target.value);
      setDefaultOffset(val);
      save({ defaultOffset: val });
    },
    [save],
  );

  const handleDailyReviewToggle = useCallback(() => {
    const next = !dailyReviewEnabled;
    setDailyReviewEnabled(next);
    save({ dailyReviewEnabled: next });
  }, [dailyReviewEnabled, save]);

  const handleTimeChange = useCallback(
    (h: number, m: number) => {
      const val = formatTime(h, m);
      setDailyReviewTime(val);
      save({ dailyReviewTime: val });
    },
    [save],
  );

  if (loading) return null;

  return (
    <div data-section-id="reminders" className="space-y-4">
      <h4 className="text-md font-semibold text-notion-text">
        {t("reminders.title")}
      </h4>

      {/* Task Reminders */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell size={18} className="text-notion-text-secondary" />
          <div>
            <p className="text-sm text-notion-text">
              {t("reminders.taskReminders")}
            </p>
            <p className="text-xs text-notion-text-secondary">
              {t("reminders.taskRemindersDesc")}
            </p>
          </div>
        </div>
        <button
          onClick={handleEnabledToggle}
          className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
            enabled ? "bg-notion-accent" : "bg-notion-border"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {/* Default Offset */}
      {enabled && (
        <div className="flex items-center justify-between ml-8">
          <div className="flex items-center gap-3">
            <Clock size={16} className="text-notion-text-secondary" />
            <p className="text-sm text-notion-text">
              {t("reminders.defaultOffset")}
            </p>
          </div>
          <select
            value={defaultOffset}
            onChange={handleOffsetChange}
            className="text-sm bg-notion-bg-secondary border border-notion-border rounded-md px-3 py-1.5 text-notion-text"
          >
            {OFFSET_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {t(`reminders.offset${minutes}` as const)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Daily Review */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarCheck size={18} className="text-notion-text-secondary" />
          <div>
            <p className="text-sm text-notion-text">
              {t("reminders.dailyReview")}
            </p>
            <p className="text-xs text-notion-text-secondary">
              {t("reminders.dailyReviewDesc")}
            </p>
          </div>
        </div>
        <button
          onClick={handleDailyReviewToggle}
          className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
            dailyReviewEnabled ? "bg-notion-accent" : "bg-notion-border"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
              dailyReviewEnabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {/* Daily Review Time */}
      {dailyReviewEnabled && (
        <div className="flex items-center justify-between ml-8">
          <p className="text-sm text-notion-text">
            {t("reminders.dailyReviewTime")}
          </p>
          <TimeDropdown
            hour={parseInt(dailyReviewTime.split(":")[0] || "0", 10)}
            minute={parseInt(dailyReviewTime.split(":")[1] || "0", 10)}
            onChange={handleTimeChange}
            minuteStep={15}
          />
        </div>
      )}
    </div>
  );
}

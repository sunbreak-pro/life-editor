import { useState, useCallback } from "react";
import { Bell, BellOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { SoundEffectSettings } from "./SoundEffectSettings";
import { ReminderSettings } from "./ReminderSettings";

export function NotificationSettings() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED) === "true",
  );
  const [permission, setPermission] = useState(() =>
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );

  const handleToggle = useCallback(async () => {
    if (!enabled) {
      if (typeof Notification === "undefined") return;
      if (Notification.permission === "default") {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== "granted") return;
      } else if (Notification.permission === "denied") {
        return;
      }
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, "true");
      setEnabled(true);
    } else {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, "false");
      setEnabled(false);
    }
  }, [enabled]);

  const isBlocked = permission === "denied";

  return (
    <div data-section-id="notifications">
      <h3 className="text-lg font-semibold text-notion-text mb-4">
        {t("notifications.title")}
      </h3>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {enabled ? (
            <Bell size={18} className="text-notion-accent" />
          ) : (
            <BellOff size={18} className="text-notion-text-secondary" />
          )}
          <div>
            <p className="text-sm text-notion-text">
              {t("notifications.timerNotifications")}
            </p>
            <p className="text-xs text-notion-text-secondary">
              {isBlocked
                ? t("notifications.blocked")
                : t("notifications.description")}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={isBlocked}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            enabled ? "bg-notion-accent" : "bg-notion-border"
          } ${isBlocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      <div className="mt-6 border-t border-notion-border pt-6">
        <SoundEffectSettings />
      </div>

      <div className="mt-6 border-t border-notion-border pt-6">
        <ReminderSettings />
      </div>
    </div>
  );
}

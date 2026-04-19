import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import { SettingsSection, ToggleSwitch } from "./MobileSettingsPrimitives";

const ROUTINE_REMINDERS_KEY = "life-editor-notifications-routine-reminders";
const TASK_DEADLINE_KEY = "life-editor-notifications-task-deadline";

function readFlag(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? "true" : "false");
  } catch {
    /* ignore */
  }
}

function supportsNotifications(): boolean {
  return (
    typeof window !== "undefined" && typeof window.Notification !== "undefined"
  );
}

export function MobileNotificationsSection() {
  const { t } = useTranslation();
  const supported = supportsNotifications();
  const [enabled, setEnabled] = useState<boolean>(() =>
    readFlag(STORAGE_KEYS.NOTIFICATIONS_ENABLED, false),
  );
  const [routineReminders, setRoutineReminders] = useState<boolean>(() =>
    readFlag(ROUTINE_REMINDERS_KEY, true),
  );
  const [taskDeadline, setTaskDeadline] = useState<boolean>(() =>
    readFlag(TASK_DEADLINE_KEY, true),
  );
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >(supported ? window.Notification.permission : "unsupported");

  useEffect(() => {
    writeFlag(STORAGE_KEYS.NOTIFICATIONS_ENABLED, enabled);
  }, [enabled]);

  useEffect(() => {
    writeFlag(ROUTINE_REMINDERS_KEY, routineReminders);
  }, [routineReminders]);

  useEffect(() => {
    writeFlag(TASK_DEADLINE_KEY, taskDeadline);
  }, [taskDeadline]);

  const handleEnableChange = useCallback(
    async (next: boolean) => {
      if (next && supported && window.Notification.permission === "default") {
        try {
          const result = await window.Notification.requestPermission();
          setPermission(result);
          if (result !== "granted") {
            setEnabled(false);
            return;
          }
        } catch {
          setEnabled(false);
          return;
        }
      }
      setEnabled(next);
    },
    [supported],
  );

  const blocked = supported && permission === "denied";

  return (
    <SettingsSection
      title={t("mobile.settings.notifications.title", "Notifications")}
    >
      <div className="space-y-2.5 px-4 py-2.5">
        {!supported && (
          <p className="text-[11px] text-notion-text-secondary/70">
            {t(
              "mobile.settings.notifications.unsupported",
              "Not supported on this device",
            )}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-notion-text">
            {t("mobile.settings.notifications.enable", "Enable notifications")}
          </span>
          <ToggleSwitch
            checked={enabled}
            onChange={handleEnableChange}
            disabled={!supported || blocked}
            ariaLabel={t(
              "mobile.settings.notifications.enable",
              "Enable notifications",
            )}
          />
        </div>
        {blocked && (
          <p className="text-[11px] text-notion-danger">
            {t(
              "mobile.settings.notifications.permissionBlocked",
              "Notifications blocked by system",
            )}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span
            className={`text-[13px] ${enabled ? "text-notion-text" : "text-notion-text-secondary"}`}
          >
            {t(
              "mobile.settings.notifications.routineReminders",
              "Routine reminders",
            )}
          </span>
          <ToggleSwitch
            checked={routineReminders}
            onChange={setRoutineReminders}
            disabled={!enabled}
            ariaLabel={t(
              "mobile.settings.notifications.routineReminders",
              "Routine reminders",
            )}
          />
        </div>
        <div className="flex items-center justify-between">
          <span
            className={`text-[13px] ${enabled ? "text-notion-text" : "text-notion-text-secondary"}`}
          >
            {t(
              "mobile.settings.notifications.taskDeadlineReminders",
              "Task deadline reminders",
            )}
          </span>
          <ToggleSwitch
            checked={taskDeadline}
            onChange={setTaskDeadline}
            disabled={!enabled}
            ariaLabel={t(
              "mobile.settings.notifications.taskDeadlineReminders",
              "Task deadline reminders",
            )}
          />
        </div>
      </div>
    </SettingsSection>
  );
}

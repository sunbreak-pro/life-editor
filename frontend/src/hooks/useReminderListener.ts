import { useEffect } from "react";
import { useToast } from "../context/ToastContext";
import { useTranslation } from "react-i18next";

export function useReminderListener(): void {
  const { showToast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onReminder) return;

    const cleanup = api.onReminder(
      (data: { id: string; title: string; type: string }) => {
        if (data.type === "dailyReview") {
          showToast("info", t("reminders.dailyReview"));
        } else {
          showToast(
            "info",
            t("reminders.taskDueNotification", { title: data.title }),
          );
        }
      },
    );

    return cleanup;
  }, [showToast, t]);
}

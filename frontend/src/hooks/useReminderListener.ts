import { useEffect } from "react";
import { useToast } from "../context/ToastContext";
import { useTranslation } from "react-i18next";
import { onReminder } from "../services/events";

export function useReminderListener(): void {
  const { showToast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    onReminder((data: { id: string; title: string; type: string }) => {
      if (data.type === "dailyReview") {
        showToast("info", t("reminders.dailyReview"));
      } else if (data.type === "itemReminder") {
        showToast(
          "info",
          t("reminders.itemReminderNotification", { title: data.title }),
        );
      } else {
        showToast(
          "info",
          t("reminders.taskDueNotification", { title: data.title }),
        );
      }
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
      } else {
        cleanup = unlisten;
      }
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [showToast, t]);
}

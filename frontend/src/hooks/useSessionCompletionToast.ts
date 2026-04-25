import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useTimerContext } from "./useTimerContext";
import { useToast } from "../context/ToastContext";

/**
 * Surfaces a Toast every time a Pomodoro WORK session finishes naturally.
 *
 * Background: Free Sessions get a confirmation dialog (FreeSessionSaveDialog)
 * but a normal 25-min Pomodoro silently writes to timer_sessions and the user
 * is left wondering whether anything was recorded. We watch
 * `completedSessions` (which the reducer only bumps on WORK completion) and
 * fire a success toast naming the task and duration.
 */
export function useSessionCompletionToast() {
  const timer = useTimerContext();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const prevRef = useRef(timer.completedSessions);

  useEffect(() => {
    const prev = prevRef.current;
    const next = timer.completedSessions;
    if (next > prev) {
      const minutes = timer.workDurationMinutes;
      const taskTitle = timer.activeTask?.title;
      const message = taskTitle
        ? t("work.toast.recordedToTask", {
            minutes,
            task: taskTitle,
            defaultValue: "✓ Recorded {{minutes}}min to {{task}}",
          })
        : t("work.toast.recordedFreeWork", {
            minutes,
            defaultValue: "✓ Recorded {{minutes}}min",
          });
      showToast("success", message);
    }
    prevRef.current = next;
  }, [
    timer.completedSessions,
    timer.workDurationMinutes,
    timer.activeTask,
    showToast,
    t,
  ]);
}

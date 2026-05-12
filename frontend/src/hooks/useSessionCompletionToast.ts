import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useTimerContext } from "./useTimerContext";
import { useToast } from "../context/ToastContext";
import { getDataService } from "../services/dataServiceFactory";

/**
 * Surfaces a Toast every time a Pomodoro WORK session finishes naturally.
 *
 * Background: Free Sessions get a confirmation dialog (FreeSessionSaveDialog)
 * but a normal 25-min Pomodoro silently writes to timer_sessions and the user
 * is left wondering whether anything was recorded. We watch
 * `completedSessions` (which the reducer only bumps on WORK completion) and
 * fire a success toast naming the task and duration.
 *
 * For Event subjects we additionally write the elapsed minutes back to
 * `schedule_items.actual_time_minutes` so the Event accumulates its own
 * "実績時間" (Tasks rely on querying timer_sessions instead).
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
      const subject = timer.activeTask;
      const subjectTitle = subject?.title;
      const isEvent = subject?.kind === "event";

      if (isEvent && subject) {
        getDataService()
          .incrementScheduleItemActualMinutes(subject.id, minutes)
          .catch(() => {
            // Silent — toast still surfaces below.
          });
      }

      const message = !subjectTitle
        ? t("work.toast.recordedFreeWork", {
            minutes,
            defaultValue: "✓ Recorded {{minutes}}min",
          })
        : isEvent
          ? t("work.toast.recordedToEvent", {
              minutes,
              event: subjectTitle,
              defaultValue: "✓ Recorded {{minutes}}min to event {{event}}",
            })
          : t("work.toast.recordedToTask", {
              minutes,
              task: subjectTitle,
              defaultValue: "✓ Recorded {{minutes}}min to {{task}}",
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

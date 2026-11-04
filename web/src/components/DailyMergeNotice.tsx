import { useEffect } from "react";
import {
  subscribeDailyMerges,
  useToast,
  useTranslation,
} from "@life-editor/shared";

/*
 * #2336: tells the user a day was merged after coming back online. Inside the
 * ToastProvider, which OfflineBanner sits above. Longer than the default toast:
 * the merge lands while the user may be looking elsewhere, and it changed text.
 */
const NOTICE_MS = 10_000;

export function DailyMergeNotice(): null {
  const { t } = useTranslation();
  const { showToast } = useToast();
  useEffect(
    () =>
      subscribeDailyMerges(({ date, settled }) => {
        if (!settled) return;
        showToast(
          "info",
          t("offline.dailyMerged", { date: date.replaceAll("-", "/") }),
          { durationMs: NOTICE_MS },
        );
      }),
    [showToast, t],
  );
  return null;
}

import { useMemo } from "react";
import { useTranslation, type ItemRoleLabels } from "@life-editor/shared";

/*
 * The kind names Schedule's detail glyphs announce (#1044).
 *
 * Four of the five come straight from the app-wide `itemRole.*` bundle. The
 * fifth is overridden: Schedule calls the `event` kind 「予定」
 * (`scheduleScreen.originEvent`) rather than `itemRole.event`'s 「イベント」 —
 * that is the word the whole section already uses (「予定の詳細」,
 * 「予定に変換」, 「予定を追加」), and it is the exact word the origin chip this
 * glyph replaces used to print. In `en` the two are the same string anyway.
 *
 * Resolved here rather than injected because this is a web host module that
 * arranges shared parts; §6.4 bars `useTranslation` inside shared components,
 * not inside the host layer that feeds them.
 */
export function useScheduleRoleLabels(): ItemRoleLabels {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      task: t("itemRole.task"),
      event: t("scheduleScreen.originEvent"),
      note: t("itemRole.note"),
      daily: t("itemRole.daily"),
      unknown: t("itemRole.unknown"),
    }),
    [t],
  );
}

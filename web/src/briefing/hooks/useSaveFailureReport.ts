import { useCallback } from "react";
import { useToastOptional, useTranslation } from "@life-editor/shared";

/*
 * One place the paper reports a save it could not make (#955, decision
 * D-20260815-briefing-7 = B).
 *
 * The hole this closes is not a missing caption — it is that failure was
 * SILENT. Every write on the paper (宣言 / 夕刊 / 目標) caught its error into
 * `console.error` and carried on showing the draft, so the text looked saved
 * and only vanished on the next reload. The draft still stays on screen after
 * a failure — that part was right, it is the user's only remaining copy — but
 * now they are told, while it is still there to copy or retype.
 *
 * ONE hook rather than a toast call per catch, so a fourth writer plugs in by
 * naming itself in `BriefingWriteTarget` and calling this. The i18n key is
 * derived from the target, which means a new target cannot be added without
 * adding its copy to both catalogues (an untranslated key would render as the
 * key itself and be caught the first time it is raised).
 *
 * The Toast context is read through the OPTIONAL hook: a screen rendered
 * without a ToastProvider must not turn a recoverable save failure into a
 * crash, and the console line stays either way as the developer-facing record.
 */

/** A write surface on the paper. Add a member, add its copy, done. */
export type BriefingWriteTarget = "intention" | "evening" | "goals";

export type ReportSaveFailure = (
  target: BriefingWriteTarget,
  error: unknown,
) => void;

export function useSaveFailureReport(): ReportSaveFailure {
  const { t } = useTranslation();
  const toast = useToastOptional();
  const showToast = toast?.showToast;

  return useCallback(
    (target, error) => {
      console.error(`[BriefingScreen] ${target} save failed`, error);
      // Longer than the 4s default: this is not a receipt, it is the only
      // notice that what is on screen is not stored, and it arrives while the
      // user is most likely still typing somewhere else on the page.
      showToast?.("danger", t(`briefing.saveFailed.${target}`), {
        durationMs: 8000,
      });
    },
    [showToast, t],
  );
}

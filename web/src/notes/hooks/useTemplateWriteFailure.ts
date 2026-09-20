import { useCallback } from "react";
import { useToastOptional, useTranslation } from "@life-editor/shared";

/*
 * Template write failures (#1761, the sweep half).
 *
 * The two template hooks talk to the DataService directly — a template is a
 * notes row that must never enter the note list, so it never passes through
 * NotesUnifiedContext and cannot use that provider's `onWriteError`. They had
 * the same swallow as the note delete did: the list dropped the row, the
 * request was refused, and the only trace was a `console.error`. The row is
 * then back on the next read with nothing having said why.
 *
 * The console line stays — it carries the driver's message, which the toast
 * deliberately does not.
 *
 * The toast context is read optionally so a host that mounts these hooks
 * without a ToastProvider (tests, and the Provider order is the app's to keep)
 * degrades to the old log-only behaviour rather than throwing inside a catch.
 */

export type TemplateWriteOp = "create" | "update" | "delete";

// `as const satisfies` — see NotesUnifiedHost for why the values must stay
// literal (i18next's typed `t()` turns a mistyped key into a build error).
const COPY = {
  create: "notesView.templateWriteFailed.create",
  update: "notesView.templateWriteFailed.update",
  delete: "notesView.templateWriteFailed.delete",
} as const satisfies Record<TemplateWriteOp, string>;

export { COPY as TEMPLATE_WRITE_FAILED_COPY };

/** Returns a reporter for an optimistic template write that came back refused. */
export function useTemplateWriteFailure(): (
  operation: TemplateWriteOp,
  error: unknown,
) => void {
  const toast = useToastOptional();
  const { t } = useTranslation();
  return useCallback(
    (operation: TemplateWriteOp, error: unknown) => {
      console.error(`[Notes] template ${operation} failed`, error);
      toast?.showToast("danger", t(COPY[operation]));
    },
    [toast, t],
  );
}

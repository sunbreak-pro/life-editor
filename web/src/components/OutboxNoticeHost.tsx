import { useEffect } from "react";
import {
  subscribeNoteSeparated,
  useToast,
  useTranslation,
} from "@life-editor/shared";

/*
 * Says so when a send from the outbox kept an offline edit as a separate note
 * (#2337). It lives beside the shell rather than in the Notes section, because a
 * send can land while another section is open. The toast stays until dismissed:
 * the user did nothing just now, and may be looking elsewhere when it appears.
 */
export function OutboxNoticeHost(): null {
  const { showToast } = useToast();
  const { t } = useTranslation();
  useEffect(
    () =>
      subscribeNoteSeparated(({ title, reason }) => {
        showToast(
          "info",
          t(
            reason === "gone"
              ? "offline.separateNoteGone"
              : "offline.separateNoteConflict",
            { title },
          ),
          { durationMs: 0 },
        );
      }),
    [showToast, t],
  );
  return null;
}

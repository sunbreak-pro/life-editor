import { useEffect } from "react";
import { useToastOptional, useTranslation } from "@life-editor/shared";
import { subscribeSignOutFailure } from "../hooks/signOutWithNotice";

/** Long enough to read the whole sentence: the default 4 seconds is not. */
const NOTICE_MS = 8_000;

/** Says that a sign-out was refused. Draws nothing itself (see the hook's note). */
export function SignOutFailureNotice(): null {
  const { t } = useTranslation();
  const toast = useToastOptional();
  useEffect(
    () =>
      subscribeSignOutFailure(() =>
        toast?.showToast("warning", t("nav.signOutFailed"), {
          durationMs: NOTICE_MS,
        }),
      ),
    [t, toast],
  );
  return null;
}

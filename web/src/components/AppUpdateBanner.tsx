import { useSyncExternalStore } from "react";
import { Button, NoticePanel, useTranslation } from "@life-editor/shared";
import {
  applyAppUpdate,
  isAppUpdateWaiting,
  subscribeAppUpdate,
} from "../pwa/serviceWorker";

/*
 * Offers a new version of the app (#2334). The press is the only thing that
 * reloads, so a note being typed is safe until the user chooses, and an old app
 * shell cannot stay on the device past the next time they are asked.
 *
 * `role="status"` for the same reason as OfflineBanner: it must not steal focus.
 * The button is drawn in the message for the 44px narrow tap target, which
 * NoticePanel's `action` cannot add (rules/frontend.md §Gotchas).
 */
export function AppUpdateBanner(): React.JSX.Element | null {
  const { t } = useTranslation();
  const waiting = useSyncExternalStore(subscribeAppUpdate, isAppUpdateWaiting);
  if (!waiting) return null;
  return (
    <NoticePanel
      variant="banner"
      tone="info"
      role="status"
      message={
        <>
          {t("appUpdate.message")}
          <span className="mt-1.5 block">
            <Button
              variant="secondary"
              size="sm"
              className="max-md:min-h-11 max-md:min-w-11"
              onClick={applyAppUpdate}
            >
              {t("appUpdate.reload")}
            </Button>
          </span>
        </>
      }
    />
  );
}

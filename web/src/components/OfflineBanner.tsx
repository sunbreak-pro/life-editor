import { useState, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import {
  NoticePanel,
  clearFailedOutbox,
  getOutboxCounts,
  readFailedOutboxText,
  subscribeOutbox,
  useTranslation,
} from "@life-editor/shared";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

/*
 * Global connectivity band (S7), and since #2335 the send-later box's too.
 * While offline only a Todo add is held for later, and the copy must not promise
 * more. Hidden when online with an empty box (no layout cost in the common case).
 *
 * <NoticePanel variant="banner"> (#1184): `warning` while offline because
 * nothing has failed, `info` for Todos merely waiting, `danger` for ones the
 * server refused, whose text exists nowhere else, so the band offers to copy it.
 * Only after that can they be removed, so the band does not stay up for good and
 * the text is never one press from gone. If the clipboard refuses, the text is
 * shown for selecting by hand.
 *
 * role="status" on all three: connectivity is ambient state, not the answer to
 * something the user just did, so it must not steal focus.
 */
export function OfflineBanner(): React.JSX.Element | null {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const { pending, failed } = useSyncExternalStore(
    subscribeOutbox,
    getOutboxCounts,
  );
  const [copied, setCopied] = useState(false);
  const [manualText, setManualText] = useState<string | null>(null);

  if (online && pending === 0 && failed === 0) return null;

  const copy = async (): Promise<void> => {
    const text = await readFailedOutboxText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setManualText(text);
    }
    setCopied(true);
  };
  const remove = async (): Promise<void> => {
    await clearFailedOutbox();
    setCopied(false);
    setManualText(null);
  };

  const waiting = pending > 0 ? t("offline.pending", { n: pending }) : null;
  return (
    <>
      {(!online || waiting !== null) && (
        <NoticePanel
          variant="banner"
          tone={online ? "info" : "warning"}
          role="status"
          icon={online ? undefined : <WifiOff aria-hidden />}
          message={[online ? null : t("offline.message"), waiting]
            .filter(Boolean)
            .join(" ")}
          className="font-medium"
        />
      )}
      {failed > 0 && (
        <NoticePanel
          variant="banner"
          tone="danger"
          role="status"
          message={
            <>
              {t(copied ? "offline.failedCopied" : "offline.failed", {
                n: failed,
              })}
              {manualText !== null && (
                <span className="mt-1 block select-all whitespace-pre-wrap text-left text-lumen-text">
                  {manualText}
                </span>
              )}
            </>
          }
          action={
            copied
              ? {
                  label: t("offline.remove"),
                  onClick: () => void remove().catch(console.error),
                }
              : {
                  label: t("offline.copy"),
                  onClick: () => void copy().catch(console.error),
                }
          }
        />
      )}
    </>
  );
}

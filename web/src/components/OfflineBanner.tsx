import { useState, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import {
  Button,
  NoticePanel,
  getOutboxCounts,
  readFailedOutboxCopy,
  removeFailedOutboxEntries,
  subscribeOutbox,
  useTranslation,
} from "@life-editor/shared";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

/*
 * Global connectivity band (S7), and since #2335 the send-later box's too.
 * While offline only a Todo add, a Daily body (#2336), a new note and a pinned
 * note's body (#2337) are held for later, and the copy must not promise more.
 * Hidden when online with an empty box (no layout cost in the common case).
 *
 * <NoticePanel variant="banner"> (#1184): `warning` while offline because
 * nothing has failed, `info` for changes merely waiting, `danger` for ones the
 * server refused, whose text exists nowhere else, so the band offers to copy it.
 * Only after that can they be removed, so the band does not stay up for good and
 * the text is never one press from gone. If the clipboard refuses, the text is
 * shown for selecting by hand, and Remove waits for that copy. A copy covers the
 * entries it read: a later refusal asks for a new one, and Remove takes only
 * those ids.
 *
 * The button is drawn here rather than through NoticePanel's `action`, which has
 * no way to add the 44px narrow tap target (rules/frontend.md §Gotchas).
 *
 * role="status" on all three: connectivity is ambient state, not the answer to
 * something the user just did, so it must not steal focus.
 */
interface CopyState {
  opIds: string[];
  /** Set when the clipboard refused and the text is shown instead. */
  manualText: string | null;
  copied: boolean;
}

export function OfflineBanner(): React.JSX.Element | null {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const { pending, failed } = useSyncExternalStore(
    subscribeOutbox,
    getOutboxCounts,
  );
  const [copyState, setCopyState] = useState<CopyState | null>(null);
  const held = copyState?.opIds.length === failed ? copyState : null;
  const copied = held?.copied ?? false;
  const manualText = held?.manualText ?? null;

  if (online && pending === 0 && failed === 0) return null;

  const copy = async (): Promise<void> => {
    const { text, opIds } = await readFailedOutboxCopy();
    try {
      await navigator.clipboard.writeText(text);
      setCopyState({ opIds, manualText: null, copied: true });
    } catch {
      setCopyState({ opIds, manualText: text, copied: false });
    }
  };
  const remove = async (): Promise<void> => {
    if (held === null) return;
    await removeFailedOutboxEntries(held.opIds);
    setCopyState(null);
  };
  const copiedByHand = (): void =>
    setCopyState((state) => state && { ...state, copied: true });

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
              {t(
                copied
                  ? "offline.failedCopied"
                  : manualText !== null
                    ? "offline.failedCopyManual"
                    : "offline.failed",
                { n: failed },
              )}
              {manualText !== null && (
                <span
                  className="mt-1 block select-all whitespace-pre-wrap text-left text-lumen-text"
                  onCopy={copiedByHand}
                >
                  {manualText}
                </span>
              )}
              <span className="mt-1.5 block">
                <Button
                  variant="secondary"
                  size="sm"
                  className="max-md:min-h-11 max-md:min-w-11"
                  onClick={() =>
                    void (copied ? remove() : copy()).catch(console.error)
                  }
                >
                  {t(copied ? "offline.remove" : "offline.copy")}
                </Button>
              </span>
            </>
          }
        />
      )}
    </>
  );
}

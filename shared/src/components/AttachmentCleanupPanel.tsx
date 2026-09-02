import { useCallback, useState } from "react";
import { Eraser, LoaderCircle } from "lucide-react";
import { Button } from "./Button";
import { Card } from "./Card";
import { ConfirmDialog } from "./ConfirmDialog";
import { NoticePanel } from "./NoticePanel";
import { formatAttachmentSize } from "../constants/attachments";
import type { AttachmentOrphanScan } from "../services/attachmentOrphans";

/*
 * Attachment cleanup panel (#1438) — the entry point for sweeping objects no
 * note references any more.
 *
 * PURE PRESENTATION (§6.4): every string arrives already translated, the two
 * verbs are callbacks, and the only state it owns is whether its own confirm
 * dialog is open. The host (web AttachmentCleanupCard) runs the dry run, holds
 * the result and performs the deletions.
 *
 * TWO STEPS, ALWAYS, and never one. A sweep is irreversible and the thing it
 * deletes is the user's own picture, so the panel cannot offer "delete
 * everything unreferenced" as a first action: the dry run has to have printed
 * a list first, and the delete button then acts on exactly that list. The
 * ConfirmDialog is the third gate rather than the second — belt and braces
 * for the one control here that destroys data.
 *
 * WHY THE ROWS LOOK LIKE THAT. An orphan's only identity is its object key
 * (a uuid) plus a size and an upload date, because the original file NAME
 * lived in the document node — and the absence of that node is what made this
 * object an orphan in the first place. So the list shows what actually exists
 * rather than inventing a friendly label for it.
 */

export interface AttachmentCleanupLabels {
  /** Card heading. */
  heading: string;
  /** One line under the heading explaining what a sweep does. */
  description: string;
  /** Idle button: run the dry run. */
  scan: string;
  /** In-flight label for the dry run. */
  scanning: string;
  /** Button label once a result is on screen. */
  rescan: string;
  /** Result line, already interpolated with the counts. */
  summary: string;
  /** Shown instead of a list when the sweep found nothing to delete. */
  nothing: string;
  /** Danger button, already interpolated with the count and the freed size. */
  deleteAll: string;
  /** In-flight label for the deletion. */
  deleting: string;
  /** Accessible name for the list of candidates. */
  listLabel: string;
  /** Confirm dialog body, already interpolated. */
  confirmMessage: string;
  /** Confirm dialog's affirmative. */
  confirmLabel: string;
  /** Confirm dialog's refusal. */
  cancelLabel: string;
}

export interface AttachmentCleanupPanelProps {
  labels: AttachmentCleanupLabels;
  /** The last dry run's result, or null before the first one. */
  scan: AttachmentOrphanScan | null;
  /** What is in flight right now. */
  status: "idle" | "scanning" | "deleting";
  /** Already-translated failure line, or null. */
  error: string | null;
  /** Already-translated outcome of the last deletion, or null. */
  outcome: string | null;
  /** Run the dry run. */
  onScan: () => void;
  /** Delete everything the current scan listed. */
  onDelete: () => void;
}

export function AttachmentCleanupPanel({
  labels,
  scan,
  status,
  error,
  outcome,
  onScan,
  onDelete,
}: AttachmentCleanupPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = status !== "idle";
  const orphans = scan?.orphans ?? [];

  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    onDelete();
  }, [onDelete]);

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-lumen-text">
          <Eraser size={16} className="text-lumen-text-secondary" />
          <span>{labels.heading}</span>
        </h3>
        <p className="text-sm leading-relaxed text-lumen-text-secondary">
          {labels.description}
        </p>
      </div>

      {error !== null && <NoticePanel tone="danger" message={error} />}
      {outcome !== null && (
        // role="status": the sweep is finished and the list below already
        // reflects it, so this is a report to read past rather than an alert.
        <NoticePanel tone="info" role="status" message={outcome} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onScan}
          disabled={busy}
          leadingIcon={
            status === "scanning" ? (
              <LoaderCircle
                aria-hidden
                className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
              />
            ) : undefined
          }
        >
          {status === "scanning"
            ? labels.scanning
            : scan === null
              ? labels.scan
              : labels.rescan}
        </Button>
        {orphans.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
            leadingIcon={
              status === "deleting" ? (
                <LoaderCircle
                  aria-hidden
                  className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                />
              ) : undefined
            }
          >
            {status === "deleting" ? labels.deleting : labels.deleteAll}
          </Button>
        )}
      </div>

      {scan !== null && (
        <div className="flex flex-col gap-2">
          <p role="status" className="text-sm text-lumen-text-secondary">
            {labels.summary}
          </p>
          {orphans.length === 0 ? (
            <p className="text-sm text-lumen-text-secondary">
              {labels.nothing}
            </p>
          ) : (
            <ul
              aria-label={labels.listLabel}
              className="max-h-64 divide-y divide-lumen-border overflow-y-auto rounded-lumen-lg border border-lumen-border bg-lumen-bg"
            >
              {orphans.map((orphan) => (
                <li
                  key={orphan.path}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  {/*
                   * The key without its `<uid>/` prefix: every row shares that
                   * segment, so printing it would spend the whole width on the
                   * one part that carries no information.
                   */}
                  <span className="truncate font-mono text-xs text-lumen-text">
                    {orphan.path.slice(orphan.path.indexOf("/") + 1)}
                  </span>
                  <span className="shrink-0 text-xs text-lumen-text-secondary">
                    {formatAttachmentSize(orphan.size)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        message={labels.confirmMessage}
        confirmLabel={labels.confirmLabel}
        cancelLabel={labels.cancelLabel}
        danger
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  );
}

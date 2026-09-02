import { useCallback, useMemo, useState } from "react";
import {
  AttachmentCleanupPanel,
  formatAttachmentSize,
  useTranslation,
  type AttachmentCleanupLabels,
  type AttachmentOrphanScan,
  type DataService,
} from "@life-editor/shared";

/*
 * Web host for the attachment sweep (#1438), mounted under the Settings row
 * that already owns the Trash — the one place in the app that is about
 * removing things rather than making them.
 *
 * The host does what §6.4 says a host does: calls the injected DataService,
 * resolves every string with `t`, and hands the pure panel a finished result.
 *
 * DELETION IS SEQUENTIAL AND COUNTS ITS FAILURES, exactly like the Trash's
 * bulk actions next door: Storage removals are independent, but firing 80 of
 * them at once turns one revoked session into 80 identical console errors and
 * an outcome line nobody can act on. One at a time, a failure is a number the
 * user can read next to a list that still shows what survived.
 *
 * THE LIST IS ALWAYS RE-READ AFTER A RUN rather than filtered in place. What
 * the panel shows has to be what the bucket holds — a client-side subtraction
 * would quietly disagree with it the moment one removal failed.
 */

interface AttachmentCleanupCardProps {
  dataService: DataService;
}

export function AttachmentCleanupCard({
  dataService: ds,
}: AttachmentCleanupCardProps) {
  const { t } = useTranslation();
  const [scan, setScan] = useState<AttachmentOrphanScan | null>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "deleting">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  /** Total bytes the current candidate list would free. */
  const orphanBytes = useMemo(
    () => (scan?.orphans ?? []).reduce((sum, o) => sum + o.size, 0),
    [scan],
  );

  const readScan =
    useCallback(async (): Promise<AttachmentOrphanScan | null> => {
      try {
        const result = await ds.findOrphanAttachments();
        setScan(result);
        setError(null);
        return result;
      } catch (e) {
        console.error("[attachment-cleanup] scan failed", e);
        setScan(null);
        setError(t("attachmentCleanup.scanFailed"));
        return null;
      }
    }, [ds, t]);

  const handleScan = useCallback(async () => {
    setStatus("scanning");
    setOutcome(null);
    await readScan();
    setStatus("idle");
  }, [readScan]);

  const handleDelete = useCallback(async () => {
    const targets = scan?.orphans ?? [];
    if (targets.length === 0) return;
    setStatus("deleting");
    setOutcome(null);
    let failures = 0;
    for (const target of targets) {
      try {
        await ds.deleteAttachment(target.path);
      } catch (e) {
        failures += 1;
        console.error("[attachment-cleanup] delete failed", target.path, e);
      }
    }
    const deleted = targets.length - failures;
    setOutcome(
      failures > 0
        ? t("attachmentCleanup.partialFailure", { n: failures })
        : t("attachmentCleanup.deleted", { n: deleted }),
    );
    await readScan();
    setStatus("idle");
  }, [ds, readScan, scan, t]);

  const labels: AttachmentCleanupLabels = {
    heading: t("attachmentCleanup.heading"),
    description: t("attachmentCleanup.description"),
    scan: t("attachmentCleanup.scan"),
    scanning: t("attachmentCleanup.scanning"),
    rescan: t("attachmentCleanup.rescan"),
    // The "left alone because it is too new" line only appears when there is
    // one to explain; a permanent "0 were skipped" would be noise on a screen
    // whose whole job is a short answer.
    summary:
      scan === null
        ? ""
        : [
            t("attachmentCleanup.summary", {
              scanned: scan.scanned,
              orphans: scan.orphans.length,
              referenced: scan.referenced,
            }),
            scan.recent > 0
              ? t("attachmentCleanup.recentNote", { n: scan.recent })
              : "",
          ]
            .filter(Boolean)
            .join(" "),
    nothing: t("attachmentCleanup.nothing"),
    listLabel: t("attachmentCleanup.listLabel"),
    deleteAll: t("attachmentCleanup.deleteAll", {
      n: scan?.orphans.length ?? 0,
      size: formatAttachmentSize(orphanBytes),
    }),
    deleting: t("attachmentCleanup.deleting"),
    confirmMessage: t("attachmentCleanup.confirmMessage", {
      n: scan?.orphans.length ?? 0,
      size: formatAttachmentSize(orphanBytes),
    }),
    confirmLabel: t("attachmentCleanup.confirmLabel"),
    cancelLabel: t("common.cancel"),
  };

  return (
    <AttachmentCleanupPanel
      labels={labels}
      scan={scan}
      status={status}
      error={error}
      outcome={outcome}
      onScan={() => void handleScan()}
      onDelete={() => void handleDelete()}
    />
  );
}

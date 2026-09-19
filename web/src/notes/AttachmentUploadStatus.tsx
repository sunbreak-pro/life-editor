import { Loader2 } from "lucide-react";

/*
 * The one-line band above a note's body while an attachment uploads (#1674,
 * D-20260902-materials-1 = B).
 *
 * Outside the document on purpose: the node is still inserted only once the
 * upload has finished (useAttachmentUpload), so nothing here can be saved by
 * the editor's autosave. A toast was ruled out — it either vanishes after
 * 4000ms while a slow upload is still running, or (durationMs: 0) has no way
 * to be closed on completion because showToast returns no id.
 *
 * Indeterminate by necessity: Storage's upload() is a single fetch with no
 * progress callback, so there is no percentage to show.
 *
 * `role="status"` + `aria-live="polite"` announce the upload without taking
 * focus. Renders nothing when idle, so the band costs no space between uploads.
 */

export interface AttachmentUploadStatusProps {
  /** The file being uploaded, or null when nothing is. */
  fileName: string | null;
  /** Already-translated「アップロード中」. */
  uploadingLabel: string;
}

export function AttachmentUploadStatus({
  fileName,
  uploadingLabel,
}: AttachmentUploadStatusProps) {
  if (fileName === null) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-2 flex items-center gap-2 rounded-lumen-md border border-lumen-border bg-lumen-bg px-3 py-1.5 text-xs text-lumen-text-secondary"
    >
      <Loader2
        size={13}
        aria-hidden="true"
        className="shrink-0 motion-safe:animate-spin"
      />
      <span className="min-w-0 truncate font-medium text-lumen-text">
        {fileName}
      </span>
      <span className="shrink-0">{uploadingLabel}</span>
    </div>
  );
}

import { useCallback, useMemo } from "react";
import {
  useTranslation,
  useToastOptional,
  ATTACHMENT_IMAGE_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  formatAttachmentSize,
  type AttachmentRef,
  type DataService,
} from "@life-editor/shared";
import { pickFile } from "./pickFile";
import type { ResolveAttachmentUrl } from "./attachmentNode";

/*
 * The host half of the editor's attach flow (#1404): pick → check → upload →
 * hand the reference back, plus the URL resolver the attachment node draws
 * with.
 *
 * Lives here rather than inside the extension because all three of the things
 * it needs are React's: the injected DataService (§3.1 — the editor never
 * reaches a backend itself), `t` for the failure copy (§6.4), and the toast
 * queue. The extension gets two plain callbacks and stays testable without a
 * provider tree.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: touch the document before the upload
 * lands. A placeholder node would mean a document that can be persisted
 * mid-upload — a note saved with a node pointing at bytes that do not exist
 * yet. The wait is instead SHOWN OUTSIDE the document: `onUploadingChange`
 * hands the host the file name while the upload runs and null however it ends,
 * and the host draws the band above the body (#1674 /
 * D-20260902-materials-1 = B — see AttachmentUploadStatus). There is no
 * percentage to report: Storage's `upload()` is one fetch with no progress
 * callback. The 10 MB cap keeps the wait bounded.
 */

/** Which picker the slash entry opened. Only the accept filter differs. */
export type AttachmentKind = "image" | "file";

export interface AttachmentWiring {
  /** Open the picker, upload what was chosen, and return its reference. */
  attach: (kind: AttachmentKind) => Promise<AttachmentRef | null>;
  /** Signed-URL resolver for the attachment node's draw. */
  resolveUrl: ResolveAttachmentUrl;
}

/**
 * Build the attach + resolve pair, or `undefined` when there is no
 * DataService to reach Storage through — which is what hides the two slash
 * entries rather than offering an upload that cannot work.
 */
export function useAttachmentUpload(
  dataService?: DataService,
  /**
   * Called with the file name when an upload starts and with null when it
   * ends — resolved, failed, or refused by the size check (which never
   * starts one). One upload at a time: the slash entry picks a single file.
   */
  onUploadingChange?: (fileName: string | null) => void,
): AttachmentWiring | undefined {
  const { t } = useTranslation();
  const toast = useToastOptional();

  const attach = useCallback(
    async (kind: AttachmentKind): Promise<AttachmentRef | null> => {
      if (!dataService) return null;
      const file = await pickFile(
        kind === "image" ? ATTACHMENT_IMAGE_ACCEPT : undefined,
      );
      if (!file) return null;
      /*
       * Checked here as well as in the service. The service's copy is the one
       * that protects the $0 budget; this one exists so the user is told why
       * in their own language, with the limit spelled out, instead of seeing
       * the generic failure toast a thrown Error would produce.
       */
      if (file.size > ATTACHMENT_MAX_BYTES) {
        toast?.showToast(
          "danger",
          t("attachment.tooLarge", {
            limit: formatAttachmentSize(ATTACHMENT_MAX_BYTES),
          }),
        );
        return null;
      }
      onUploadingChange?.(file.name);
      try {
        return await dataService.uploadAttachment(file);
      } catch (e) {
        console.error("[attachment] upload failed", e);
        toast?.showToast("danger", t("attachment.uploadFailed"));
        return null;
      } finally {
        // In `finally`, not after the await: a failure clears the band too,
        // and the danger toast is the only thing left saying what happened
        // (裁定 3 — no retry affordance, which would mean holding on to a
        // File the app has not sent).
        onUploadingChange?.(null);
      }
    },
    [dataService, t, toast, onUploadingChange],
  );

  const resolveUrl = useCallback<ResolveAttachmentUrl>(
    (path) => {
      if (!dataService) return Promise.reject(new Error("no data service"));
      return dataService.getAttachmentUrl(path);
    },
    [dataService],
  );

  return useMemo(
    () => (dataService ? { attach, resolveUrl } : undefined),
    [dataService, attach, resolveUrl],
  );
}

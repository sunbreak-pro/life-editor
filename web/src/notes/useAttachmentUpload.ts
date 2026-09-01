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
 * WHAT IT DELIBERATELY DOES NOT DO: show progress. The upload happens BEFORE
 * the node is inserted, so a slow one looks like a pause between choosing the
 * file and seeing it appear. Inserting a placeholder node first would mean a
 * document that can be persisted mid-upload — a note saved with a node
 * pointing at bytes that do not exist yet — and that is a worse failure than a
 * wait. The 10 MB cap keeps the wait bounded.
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
      try {
        return await dataService.uploadAttachment(file);
      } catch (e) {
        console.error("[attachment] upload failed", e);
        toast?.showToast("danger", t("attachment.uploadFailed"));
        return null;
      }
    },
    [dataService, t, toast],
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

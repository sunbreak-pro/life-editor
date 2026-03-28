import { useRef, useCallback } from "react";
import { getDataService } from "../services";
import type { AttachmentMeta, AttachmentType } from "../types/attachment";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB

const IMAGE_MIMES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/gif": [0x47, 0x49, 0x46, 0x38],
  "image/webp": [0x52, 0x49, 0x46, 0x46], // + WEBP at offset 8
};

function validateImageBytes(buf: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buf);
  for (const [mime, magic] of Object.entries(IMAGE_MIMES)) {
    if (magic.every((b, i) => bytes[i] === b)) {
      if (mime === "image/webp") {
        if (
          bytes[8] === 0x57 &&
          bytes[9] === 0x45 &&
          bytes[10] === 0x42 &&
          bytes[11] === 0x50
        ) {
          return mime;
        }
        continue;
      }
      return mime;
    }
  }
  return null;
}

function validatePdfBytes(buf: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buf);
  // %PDF
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

function generateId(type: AttachmentType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAttachments() {
  const blobUrlsRef = useRef<Record<string, string>>({});

  const resolveAttachmentUrls = useCallback(
    async (ids: string[]): Promise<Record<string, string>> => {
      const ds = getDataService();
      const result: Record<string, string> = {};
      await Promise.all(
        ids.map(async (id) => {
          if (blobUrlsRef.current[id]) {
            result[id] = blobUrlsRef.current[id];
            return;
          }
          const buf = await ds.loadAttachment(id);
          if (buf) {
            const blob = new Blob([buf]);
            const url = URL.createObjectURL(blob);
            blobUrlsRef.current[id] = url;
            result[id] = url;
          }
        }),
      );
      return result;
    },
    [],
  );

  const uploadImage = useCallback(
    async (file: File): Promise<{ id: string; blobUrl: string } | null> => {
      if (file.size > MAX_IMAGE_SIZE) {
        console.error(
          `Image too large: ${file.size} bytes (max ${MAX_IMAGE_SIZE})`,
        );
        return null;
      }
      const buf = await file.arrayBuffer();
      const detectedMime = validateImageBytes(buf);
      if (!detectedMime) {
        console.error("Invalid image file: magic bytes mismatch");
        return null;
      }
      const id = generateId("image");
      const meta: AttachmentMeta = {
        id,
        type: "image",
        filename: file.name,
        mimeType: detectedMime,
        size: file.size,
        createdAt: new Date().toISOString(),
      };
      await getDataService().saveAttachment(meta, buf);
      const blob = new Blob([buf], { type: detectedMime });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlsRef.current[id] = blobUrl;
      return { id, blobUrl };
    },
    [],
  );

  const uploadPdf = useCallback(
    async (
      file: File,
    ): Promise<{ id: string; filename: string; size: number } | null> => {
      if (file.size > MAX_PDF_SIZE) {
        console.error(
          `PDF too large: ${file.size} bytes (max ${MAX_PDF_SIZE})`,
        );
        return null;
      }
      const buf = await file.arrayBuffer();
      if (!validatePdfBytes(buf)) {
        console.error("Invalid PDF file: magic bytes mismatch");
        return null;
      }
      const id = generateId("pdf");
      const meta: AttachmentMeta = {
        id,
        type: "pdf",
        filename: file.name,
        mimeType: "application/pdf",
        size: file.size,
        createdAt: new Date().toISOString(),
      };
      await getDataService().saveAttachment(meta, buf);
      return { id, filename: file.name, size: file.size };
    },
    [],
  );

  const cleanup = useCallback(() => {
    for (const url of Object.values(blobUrlsRef.current)) {
      URL.revokeObjectURL(url);
    }
    blobUrlsRef.current = {};
  }, []);

  const getBlobUrl = useCallback((id: string): string | undefined => {
    return blobUrlsRef.current[id];
  }, []);

  const setBlobUrl = useCallback((id: string, url: string) => {
    blobUrlsRef.current[id] = url;
  }, []);

  return {
    resolveAttachmentUrls,
    uploadImage,
    uploadPdf,
    cleanup,
    getBlobUrl,
    setBlobUrl,
    blobUrlsRef,
  };
}

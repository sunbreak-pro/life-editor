import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

export interface AttachmentMeta {
  id: string;
  type: "image" | "pdf";
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

const ATTACHMENTS_DIR = path.join(app.getPath("userData"), "attachments");
const META_FILE = path.join(ATTACHMENTS_DIR, "_meta.json");

function ensureDir(): void {
  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }
}

function loadMetas(): AttachmentMeta[] {
  ensureDir();
  if (!fs.existsSync(META_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeMetas(metas: AttachmentMeta[]): void {
  ensureDir();
  fs.writeFileSync(META_FILE, JSON.stringify(metas, null, 2), "utf-8");
}

export function createAttachmentRepository() {
  let writing = false;

  function withWriteLock<T>(fn: () => T): T {
    if (writing) {
      throw new Error("[Attachment] Concurrent write detected");
    }
    writing = true;
    try {
      return fn();
    } finally {
      writing = false;
    }
  }

  return {
    fetchAllMetas(): AttachmentMeta[] {
      return loadMetas();
    },

    saveMeta(meta: AttachmentMeta): void {
      withWriteLock(() => {
        const metas = loadMetas();
        const idx = metas.findIndex((m) => m.id === meta.id);
        if (idx >= 0) {
          metas[idx] = meta;
        } else {
          metas.push(meta);
        }
        writeMetas(metas);
      });
    },

    saveBlob(id: string, data: Buffer): void {
      ensureDir();
      fs.writeFileSync(path.join(ATTACHMENTS_DIR, id), data);
    },

    loadBlob(id: string): Buffer | null {
      const filePath = path.join(ATTACHMENTS_DIR, id);
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath);
    },

    deletePermanent(id: string): void {
      withWriteLock(() => {
        const metas = loadMetas().filter((m) => m.id !== id);
        writeMetas(metas);
      });
      const filePath = path.join(ATTACHMENTS_DIR, id);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    },
  };
}

export type AttachmentRepository = ReturnType<
  typeof createAttachmentRepository
>;

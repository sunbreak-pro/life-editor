import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import type { CustomSoundMeta } from "../types";

const CUSTOM_SOUNDS_DIR = path.join(app.getPath("userData"), "custom-sounds");
const META_FILE = path.join(CUSTOM_SOUNDS_DIR, "_meta.json");

function ensureDir(): void {
  if (!fs.existsSync(CUSTOM_SOUNDS_DIR)) {
    fs.mkdirSync(CUSTOM_SOUNDS_DIR, { recursive: true });
  }
}

function loadMetas(): CustomSoundMeta[] {
  ensureDir();
  if (!fs.existsSync(META_FILE)) return [];
  try {
    const raw: CustomSoundMeta[] = JSON.parse(
      fs.readFileSync(META_FILE, "utf-8"),
    );
    // Normalize legacy numeric deletedAt to ISO string
    return raw.map((m) => {
      if (typeof m.deletedAt === "number") {
        return { ...m, deletedAt: new Date(m.deletedAt).toISOString() };
      }
      return m;
    });
  } catch {
    return [];
  }
}

function writeMetas(metas: CustomSoundMeta[]): void {
  ensureDir();
  fs.writeFileSync(META_FILE, JSON.stringify(metas, null, 2), "utf-8");
}

export function createCustomSoundRepository() {
  let writing = false;

  function withWriteLock<T>(fn: () => T): T {
    if (writing) {
      throw new Error("[CustomSound] Concurrent write detected");
    }
    writing = true;
    try {
      return fn();
    } finally {
      writing = false;
    }
  }

  return {
    fetchAllMetas(): CustomSoundMeta[] {
      return loadMetas().filter((m) => !m.isDeleted);
    },

    fetchDeletedMetas(): CustomSoundMeta[] {
      return loadMetas().filter((m) => m.isDeleted);
    },

    saveMeta(meta: CustomSoundMeta): void {
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

    softDeleteMeta(id: string): void {
      withWriteLock(() => {
        const metas = loadMetas();
        const idx = metas.findIndex((m) => m.id === id);
        if (idx >= 0) {
          metas[idx] = {
            ...metas[idx],
            isDeleted: true,
            deletedAt: new Date().toISOString(),
          };
          writeMetas(metas);
        }
      });
    },

    restoreMeta(id: string): void {
      withWriteLock(() => {
        const metas = loadMetas();
        const idx = metas.findIndex((m) => m.id === id);
        if (idx >= 0) {
          const { isDeleted, deletedAt, ...rest } = metas[idx];
          metas[idx] = rest as CustomSoundMeta;
          writeMetas(metas);
        }
      });
    },

    permanentDelete(id: string): void {
      withWriteLock(() => {
        const metas = loadMetas().filter((m) => m.id !== id);
        writeMetas(metas);
      });
      const filePath = path.join(CUSTOM_SOUNDS_DIR, id);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    },

    updateLabel(id: string, label: string): void {
      withWriteLock(() => {
        const metas = loadMetas();
        const idx = metas.findIndex((m) => m.id === id);
        if (idx >= 0) {
          metas[idx] = { ...metas[idx], label };
          writeMetas(metas);
        }
      });
    },

    saveBlob(id: string, data: Buffer): void {
      ensureDir();
      fs.writeFileSync(path.join(CUSTOM_SOUNDS_DIR, id), data);
    },

    loadBlob(id: string): Buffer | null {
      const filePath = path.join(CUSTOM_SOUNDS_DIR, id);
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath);
    },
  };
}

export type CustomSoundRepository = ReturnType<
  typeof createCustomSoundRepository
>;

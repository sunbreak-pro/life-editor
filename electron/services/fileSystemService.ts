import * as fs from "fs";
import * as path from "path";
import { shell } from "electron";

export interface FileEntry {
  name: string;
  relativePath: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: string;
  extension: string;
}

export interface FileInfo extends FileEntry {
  createdAt: string;
  mimeType: string;
}

const MIME_MAP: Record<string, string> = {
  // Text
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".toml": "text/plain",
  ".xml": "application/xml",
  ".csv": "text/csv",
  ".log": "text/plain",
  // Code
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".js": "text/javascript",
  ".jsx": "text/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".scss": "text/css",
  ".py": "text/x-python",
  ".go": "text/x-go",
  ".rs": "text/x-rust",
  ".java": "text/x-java",
  ".c": "text/x-c",
  ".cpp": "text/x-c++",
  ".h": "text/x-c",
  ".sh": "text/x-shellscript",
  ".sql": "text/x-sql",
  // Images
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  // Audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  // Video
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  // Documents
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Archives
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".tar": "application/x-tar",
};

function getMimeType(ext: string): string {
  return MIME_MAP[ext.toLowerCase()] ?? "application/octet-stream";
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function createFileSystemService(rootPath: string) {
  function validatePath(relativePath: string): string {
    const resolved = path.resolve(rootPath, relativePath);
    if (!resolved.startsWith(path.resolve(rootPath))) {
      throw new Error("Path traversal detected");
    }
    return resolved;
  }

  function ensureRootExists(): void {
    if (!fs.existsSync(rootPath)) {
      fs.mkdirSync(rootPath, { recursive: true });
    }
  }

  function statToEntry(filePath: string, stat: fs.Stats): FileEntry {
    const rel = path.relative(rootPath, filePath);
    const ext = path.extname(filePath);
    return {
      name: path.basename(filePath),
      relativePath: rel,
      type: stat.isDirectory() ? "directory" : "file",
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      extension: ext,
    };
  }

  ensureRootExists();

  return {
    listDirectory(relativePath: string): FileEntry[] {
      const absPath = validatePath(relativePath);
      if (!fs.existsSync(absPath)) {
        throw new Error(`Directory not found: ${relativePath}`);
      }
      const stat = fs.statSync(absPath);
      if (!stat.isDirectory()) {
        throw new Error(`Not a directory: ${relativePath}`);
      }

      const entries = fs.readdirSync(absPath, { withFileTypes: true });
      const result: FileEntry[] = [];
      for (const entry of entries) {
        // Skip hidden files
        if (entry.name.startsWith(".")) continue;
        const fullPath = path.join(absPath, entry.name);
        try {
          const s = fs.statSync(fullPath);
          result.push(statToEntry(fullPath, s));
        } catch {
          // Skip inaccessible files
        }
      }
      // Directories first, then alphabetical
      result.sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return result;
    },

    getFileInfo(relativePath: string): FileInfo {
      const absPath = validatePath(relativePath);
      if (!fs.existsSync(absPath)) {
        throw new Error(`File not found: ${relativePath}`);
      }
      const stat = fs.statSync(absPath);
      const entry = statToEntry(absPath, stat);
      return {
        ...entry,
        createdAt: stat.birthtime.toISOString(),
        mimeType: getMimeType(entry.extension),
      };
    },

    readTextFile(relativePath: string): string {
      const absPath = validatePath(relativePath);
      const stat = fs.statSync(absPath);
      if (stat.size > MAX_FILE_SIZE) {
        throw new Error(
          `File too large: ${stat.size} bytes (max ${MAX_FILE_SIZE})`,
        );
      }
      return fs.readFileSync(absPath, "utf-8");
    },

    readFile(relativePath: string): Buffer {
      const absPath = validatePath(relativePath);
      const stat = fs.statSync(absPath);
      if (stat.size > MAX_FILE_SIZE) {
        throw new Error(
          `File too large: ${stat.size} bytes (max ${MAX_FILE_SIZE})`,
        );
      }
      return fs.readFileSync(absPath);
    },

    writeTextFile(relativePath: string, content: string): void {
      const absPath = validatePath(relativePath);
      const dir = path.dirname(absPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(absPath, content, "utf-8");
    },

    writeFile(relativePath: string, data: Buffer): void {
      const absPath = validatePath(relativePath);
      const dir = path.dirname(absPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(absPath, data);
    },

    createDirectory(relativePath: string): void {
      const absPath = validatePath(relativePath);
      if (fs.existsSync(absPath)) {
        throw new Error(`Already exists: ${relativePath}`);
      }
      fs.mkdirSync(absPath, { recursive: true });
    },

    createFile(relativePath: string): void {
      const absPath = validatePath(relativePath);
      if (fs.existsSync(absPath)) {
        throw new Error(`Already exists: ${relativePath}`);
      }
      const dir = path.dirname(absPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(absPath, "", "utf-8");
    },

    rename(oldRelativePath: string, newRelativePath: string): void {
      const oldAbs = validatePath(oldRelativePath);
      const newAbs = validatePath(newRelativePath);
      if (!fs.existsSync(oldAbs)) {
        throw new Error(`Not found: ${oldRelativePath}`);
      }
      if (fs.existsSync(newAbs)) {
        throw new Error(`Already exists: ${newRelativePath}`);
      }
      fs.renameSync(oldAbs, newAbs);
    },

    move(sourcePath: string, destPath: string): void {
      const srcAbs = validatePath(sourcePath);
      const dstAbs = validatePath(destPath);
      if (!fs.existsSync(srcAbs)) {
        throw new Error(`Not found: ${sourcePath}`);
      }
      if (fs.existsSync(dstAbs)) {
        throw new Error(`Already exists: ${destPath}`);
      }
      const dstDir = path.dirname(dstAbs);
      if (!fs.existsSync(dstDir)) {
        fs.mkdirSync(dstDir, { recursive: true });
      }
      fs.renameSync(srcAbs, dstAbs);
    },

    async delete(relativePath: string): Promise<void> {
      const absPath = validatePath(relativePath);
      if (!fs.existsSync(absPath)) {
        throw new Error(`Not found: ${relativePath}`);
      }
      await shell.trashItem(absPath);
    },

    exists(relativePath: string): boolean {
      const absPath = validatePath(relativePath);
      return fs.existsSync(absPath);
    },

    openInSystem(relativePath: string): Promise<string> {
      const absPath = validatePath(relativePath);
      if (!fs.existsSync(absPath)) {
        throw new Error(`Not found: ${relativePath}`);
      }
      return shell.openPath(absPath);
    },

    getRootPath(): string {
      return rootPath;
    },
  };
}

export type FileSystemService = ReturnType<typeof createFileSystemService>;

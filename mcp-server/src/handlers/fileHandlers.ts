import * as fs from "fs";
import * as path from "path";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_SEARCH_FILE_SIZE = 1 * 1024 * 1024; // 1MB for content search

function getRootPath(): string {
  const root = process.env.FILES_ROOT_PATH;
  if (!root) throw new Error("FILES_ROOT_PATH not configured");
  return root;
}

function validatePath(relativePath: string): string {
  const root = getRootPath();
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(path.resolve(root))) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

interface FileEntry {
  name: string;
  relativePath: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: string;
  extension: string;
}

function statToEntry(filePath: string, stat: fs.Stats): FileEntry {
  const root = getRootPath();
  return {
    name: path.basename(filePath),
    relativePath: path.relative(root, filePath),
    type: stat.isDirectory() ? "directory" : "file",
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    extension: path.extname(filePath),
  };
}

export function listFiles(args: { path?: string }): {
  entries: FileEntry[];
  path: string;
} {
  const relativePath = args.path ?? "";
  const absPath = validatePath(relativePath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`Directory not found: ${relativePath}`);
  }

  const stat = fs.statSync(absPath);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${relativePath}`);
  }

  const dirents = fs.readdirSync(absPath, { withFileTypes: true });
  const entries: FileEntry[] = [];

  for (const dirent of dirents) {
    if (dirent.name.startsWith(".")) continue;
    const fullPath = path.join(absPath, dirent.name);
    try {
      const s = fs.statSync(fullPath);
      entries.push(statToEntry(fullPath, s));
    } catch {
      // Skip inaccessible
    }
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { entries, path: relativePath };
}

export function readFile(args: { path: string }): {
  path: string;
  content: string;
  size: number;
} {
  const absPath = validatePath(args.path);

  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${args.path}`);
  }

  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    throw new Error(`Cannot read directory as file: ${args.path}`);
  }
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(
      `File too large: ${stat.size} bytes (max ${MAX_FILE_SIZE})`,
    );
  }

  const content = fs.readFileSync(absPath, "utf-8");
  return { path: args.path, content, size: stat.size };
}

export function writeFile(args: { path: string; content: string }): {
  path: string;
  size: number;
} {
  const absPath = validatePath(args.path);
  const dir = path.dirname(absPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(absPath, args.content, "utf-8");
  const stat = fs.statSync(absPath);
  return { path: args.path, size: stat.size };
}

export function createDirectory(args: { path: string }): {
  path: string;
  created: boolean;
} {
  const absPath = validatePath(args.path);

  if (fs.existsSync(absPath)) {
    throw new Error(`Already exists: ${args.path}`);
  }

  fs.mkdirSync(absPath, { recursive: true });
  return { path: args.path, created: true };
}

export function renameFile(args: { old_path: string; new_path: string }): {
  old_path: string;
  new_path: string;
} {
  const oldAbs = validatePath(args.old_path);
  const newAbs = validatePath(args.new_path);

  if (!fs.existsSync(oldAbs)) {
    throw new Error(`Not found: ${args.old_path}`);
  }
  if (fs.existsSync(newAbs)) {
    throw new Error(`Already exists: ${args.new_path}`);
  }

  const newDir = path.dirname(newAbs);
  if (!fs.existsSync(newDir)) {
    fs.mkdirSync(newDir, { recursive: true });
  }

  fs.renameSync(oldAbs, newAbs);
  return { old_path: args.old_path, new_path: args.new_path };
}

export function deleteFile(args: { path: string }): {
  path: string;
  deleted: boolean;
} {
  const absPath = validatePath(args.path);

  if (!fs.existsSync(absPath)) {
    throw new Error(`Not found: ${args.path}`);
  }

  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    fs.rmSync(absPath, { recursive: true });
  } else {
    fs.unlinkSync(absPath);
  }

  return { path: args.path, deleted: true };
}

export function searchFiles(args: { query: string; path?: string }): {
  results: Array<{
    path: string;
    type: "name" | "content";
    line?: number;
    snippet?: string;
  }>;
} {
  const root = getRootPath();
  const searchRoot = args.path ? validatePath(args.path) : root;
  const query = args.query.toLowerCase();
  const results: Array<{
    path: string;
    type: "name" | "content";
    line?: number;
    snippet?: string;
  }> = [];

  function walk(dir: string): void {
    if (results.length >= 50) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= 50) return;
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(root, fullPath);

      // Name match
      if (entry.name.toLowerCase().includes(query)) {
        results.push({ path: relPath, type: "name" });
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        // Content search for text files
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > MAX_SEARCH_FILE_SIZE) continue;

          const ext = path.extname(entry.name).toLowerCase();
          const textExts = new Set([
            ".txt",
            ".md",
            ".json",
            ".yaml",
            ".yml",
            ".toml",
            ".xml",
            ".csv",
            ".log",
            ".ts",
            ".tsx",
            ".js",
            ".jsx",
            ".html",
            ".css",
            ".py",
            ".go",
            ".rs",
            ".sh",
            ".sql",
          ]);
          if (!textExts.has(ext)) continue;

          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(query)) {
              results.push({
                path: relPath,
                type: "content",
                line: i + 1,
                snippet: lines[i].trim().slice(0, 200),
              });
              break; // One match per file
            }
          }
        } catch {
          // Skip unreadable
        }
      }
    }
  }

  walk(searchRoot);
  return { results };
}

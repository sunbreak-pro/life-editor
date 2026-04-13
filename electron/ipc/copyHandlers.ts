import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { query } from "./handlerUtil";
import type { NoteRepository } from "../database/noteRepository";
import type { MemoRepository } from "../database/memoRepository";
import type { AppSettingsRepository } from "../database/appSettingsRepository";
import { tiptapToMarkdown } from "../utils/tiptapToMarkdown";
import { markdownToTiptap } from "../utils/markdownToTiptap";
import type { TipTapDoc } from "../utils/tiptapJsonBuilder";

const FILES_ROOT_KEY = "files_root_path";
const DEFAULT_ROOT = path.join(os.homedir(), "life-editor", "files");

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim() || "untitled";
}

function resolveUniquePath(dir: string, baseName: string, ext: string): string {
  let candidate = path.join(dir, `${baseName}${ext}`);
  let counter = 0;
  while (fs.existsSync(candidate)) {
    counter++;
    candidate = path.join(dir, `${baseName}-${counter}${ext}`);
  }
  return candidate;
}

function parseTipTapContent(content: string): TipTapDoc {
  if (!content) return { type: "doc", content: [{ type: "paragraph" }] };
  try {
    return JSON.parse(content) as TipTapDoc;
  } catch {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
}

export function registerCopyHandlers(
  noteRepo: NoteRepository,
  memoRepo: MemoRepository,
  settingsRepo: AppSettingsRepository,
): void {
  // Note → .md file
  query(
    "copy:noteToFile",
    "Copy",
    "noteToFile",
    (_event: unknown, noteId: string, dirPath: string) => {
      const note = noteRepo.fetchById(noteId);
      if (!note) throw new Error(`Note not found: ${noteId}`);

      const doc = parseTipTapContent(note.content);
      const markdown = tiptapToMarkdown(doc);
      const baseName = sanitizeFilename(note.title || "untitled");
      const filePath = resolveUniquePath(dirPath, baseName, ".md");

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, markdown, "utf-8");
      return filePath;
    },
  );

  // Memo → .md file
  query(
    "copy:memoToFile",
    "Copy",
    "memoToFile",
    (_event: unknown, memoDate: string, dirPath: string) => {
      const memo = memoRepo.fetchByDate(memoDate);
      if (!memo) throw new Error(`Memo not found for date: ${memoDate}`);

      const doc = parseTipTapContent(memo.content);
      const markdown = tiptapToMarkdown(doc);
      const baseName = `memo-${memoDate}`;
      const filePath = resolveUniquePath(dirPath, baseName, ".md");

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, markdown, "utf-8");
      return filePath;
    },
  );

  // Read .md file and convert to TipTap JSON (pure conversion, no DB mutation)
  query(
    "copy:convertFileToTiptap",
    "Copy",
    "convertFileToTiptap",
    (_event: unknown, relativePath: string) => {
      const rootPath = settingsRepo.get(FILES_ROOT_KEY) ?? DEFAULT_ROOT;
      const absPath = path.resolve(rootPath, relativePath);

      // Path traversal check
      if (!absPath.startsWith(path.resolve(rootPath))) {
        throw new Error("Path traversal detected");
      }

      const markdown = fs.readFileSync(absPath, "utf-8");
      const doc = markdownToTiptap(markdown);
      const content = JSON.stringify(doc);

      const ext = path.extname(relativePath);
      const title = path.basename(relativePath, ext);

      return { title, content };
    },
  );
}

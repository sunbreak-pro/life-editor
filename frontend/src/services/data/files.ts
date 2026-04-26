import type { FileEntry, FileInfo } from "../../types/fileExplorer";
import { tauriInvoke } from "../bridge";

export const filesApi = {
  selectFolder(): Promise<string | null> {
    return tauriInvoke("files_select_folder");
  },
  getFilesRootPath(): Promise<string | null> {
    return tauriInvoke("files_get_root_path");
  },
  listDirectory(relativePath: string): Promise<FileEntry[]> {
    return tauriInvoke("files_list_directory", {
      relativePath,
    });
  },
  getFileInfo(relativePath: string): Promise<FileInfo> {
    return tauriInvoke("files_get_file_info", {
      relativePath,
    });
  },
  readTextFile(relativePath: string): Promise<string> {
    return tauriInvoke("files_read_text_file", {
      relativePath,
    });
  },
  readFile(relativePath: string): Promise<ArrayBuffer> {
    return tauriInvoke("files_read_file", { relativePath });
  },
  createDirectory(relativePath: string): Promise<void> {
    return tauriInvoke("files_create_directory", {
      relativePath,
    });
  },
  createFile(relativePath: string): Promise<void> {
    return tauriInvoke("files_create_file", { relativePath });
  },
  writeTextFile(relativePath: string, content: string): Promise<void> {
    return tauriInvoke("files_write_text_file", {
      relativePath,
      content,
    });
  },
  renameFile(oldPath: string, newPath: string): Promise<void> {
    return tauriInvoke("files_rename", {
      oldPath,
      newPath,
    });
  },
  moveFile(sourcePath: string, destPath: string): Promise<void> {
    return tauriInvoke("files_move", {
      sourcePath,
      destPath,
    });
  },
  deleteFile(relativePath: string): Promise<void> {
    return tauriInvoke("files_delete", { relativePath });
  },
  openFileInSystem(relativePath: string): Promise<void> {
    return tauriInvoke("files_open_in_system", {
      relativePath,
    });
  },
  copyNoteToFile(noteId: string, directoryPath: string): Promise<string> {
    return tauriInvoke("copy_note_to_file", {
      noteId,
      directoryPath,
    });
  },
  copyDailyToFile(dailyDate: string, directoryPath: string): Promise<string> {
    return tauriInvoke("copy_daily_to_file", {
      dailyDate,
      directoryPath,
    });
  },
  convertFileToTiptap(
    relativeFilePath: string,
  ): Promise<{ title: string; content: string }> {
    return tauriInvoke("copy_convert_file_to_tiptap", {
      relativeFilePath,
    });
  },
};

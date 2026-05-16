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

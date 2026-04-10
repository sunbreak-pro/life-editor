import {
  File,
  FileText,
  FileCode,
  FileJson,
  Image,
  Music,
  Video,
  FileSpreadsheet,
  FileArchive,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  // Text
  ".txt": FileText,
  ".md": FileText,
  ".log": FileText,
  ".csv": FileSpreadsheet,
  // Code
  ".ts": FileCode,
  ".tsx": FileCode,
  ".js": FileCode,
  ".jsx": FileCode,
  ".html": FileCode,
  ".css": FileCode,
  ".scss": FileCode,
  ".py": FileCode,
  ".go": FileCode,
  ".rs": FileCode,
  ".java": FileCode,
  ".c": FileCode,
  ".cpp": FileCode,
  ".h": FileCode,
  ".sh": FileCode,
  ".sql": FileCode,
  ".yaml": FileCode,
  ".yml": FileCode,
  ".toml": FileCode,
  ".xml": FileCode,
  // Data
  ".json": FileJson,
  // Images
  ".png": Image,
  ".jpg": Image,
  ".jpeg": Image,
  ".gif": Image,
  ".svg": Image,
  ".webp": Image,
  ".bmp": Image,
  ".ico": Image,
  // Audio
  ".mp3": Music,
  ".wav": Music,
  ".ogg": Music,
  ".flac": Music,
  ".m4a": Music,
  ".aac": Music,
  // Video
  ".mp4": Video,
  ".webm": Video,
  ".mov": Video,
  ".avi": Video,
  ".mkv": Video,
  // Archives
  ".zip": FileArchive,
  ".gz": FileArchive,
  ".tar": FileArchive,
};

const TEXT_EXTENSIONS = new Set([
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
  ".scss",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".sh",
  ".sql",
  ".env",
  ".gitignore",
  ".editorconfig",
]);

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".bmp",
  ".ico",
]);

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".m4a",
  ".aac",
]);

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".avi", ".mkv"]);

export function getFileIcon(extension: string): LucideIcon {
  return ICON_MAP[extension.toLowerCase()] ?? File;
}

export function isTextFile(extension: string): boolean {
  return TEXT_EXTENSIONS.has(extension.toLowerCase());
}

export function isImageFile(extension: string): boolean {
  return IMAGE_EXTENSIONS.has(extension.toLowerCase());
}

export function isAudioFile(extension: string): boolean {
  return AUDIO_EXTENSIONS.has(extension.toLowerCase());
}

export function isVideoFile(extension: string): boolean {
  return VIDEO_EXTENSIONS.has(extension.toLowerCase());
}

export function isPdfFile(extension: string): boolean {
  return extension.toLowerCase() === ".pdf";
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

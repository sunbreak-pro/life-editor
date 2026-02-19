export interface CustomSoundMeta {
  id: string; // "custom-{timestamp}-{random4}"
  label: string; // ファイル名から拡張子除去
  filename: string; // 元のファイル名
  mimeType: string; // "audio/mpeg" | "audio/wav" | "audio/ogg"
  size: number; // バイト数
  createdAt: number; // Date.now()
  isDeleted?: boolean;
  deletedAt?: number;
}

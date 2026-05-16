export type AttachmentType = "image" | "pdf";

export interface AttachmentMeta {
  id: string;
  type: AttachmentType;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

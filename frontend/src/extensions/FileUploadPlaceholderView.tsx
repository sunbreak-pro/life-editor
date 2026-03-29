import { useRef, useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ImageIcon, FileText } from "lucide-react";
import type { FileUploadPlaceholderStorage } from "./FileUploadPlaceholder";

export function FileUploadPlaceholderView({
  node,
  deleteNode,
  editor,
  extension,
}: NodeViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mode = (node.attrs.mode as string) || "image";
  const isImage = mode === "image";

  const Icon = isImage ? ImageIcon : FileText;
  const label = isImage ? "画像を選択" : "PDFを選択";
  const accept = isImage
    ? "image/png,image/jpeg,image/gif,image/webp"
    : ".pdf,application/pdf";

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const storage = extension.storage as FileUploadPlaceholderStorage;
      const callback = isImage ? storage.onImageUpload : storage.onPdfUpload;

      deleteNode();
      callback?.(file);
    },
    [isImage, deleteNode, extension.storage],
  );

  const handleCancel = useCallback(() => {
    deleteNode();
    editor.commands.focus();
  }, [deleteNode, editor]);

  return (
    <NodeViewWrapper>
      <div className="file-upload-placeholder" contentEditable={false}>
        <Icon size={24} className="file-upload-placeholder-icon" />
        <button
          className="file-upload-placeholder-btn"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          {label}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <button
          className="file-upload-placeholder-cancel"
          onClick={handleCancel}
          type="button"
        >
          キャンセル
        </button>
      </div>
    </NodeViewWrapper>
  );
}

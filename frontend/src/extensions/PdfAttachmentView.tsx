import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { FileText, ExternalLink } from "lucide-react";
import { getDataService } from "../services";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PdfAttachmentView({ node }: NodeViewProps) {
  const { attachmentId, filename, size } = node.attrs as {
    attachmentId: string;
    filename: string;
    size: number;
  };

  const handleOpen = () => {
    if (attachmentId) {
      getDataService().openAttachmentFile(attachmentId);
    }
  };

  return (
    <NodeViewWrapper>
      <div className="pdf-attachment-block" contentEditable={false}>
        <FileText size={24} className="pdf-attachment-icon" />
        <div className="pdf-attachment-info">
          <span className="pdf-attachment-filename">{filename || "PDF"}</span>
          {size > 0 && (
            <span className="pdf-attachment-size">{formatFileSize(size)}</span>
          )}
        </div>
        <button
          className="pdf-attachment-open-btn"
          onClick={handleOpen}
          title="Open in Preview"
          type="button"
        >
          <ExternalLink size={16} />
          <span>Open</span>
        </button>
      </div>
    </NodeViewWrapper>
  );
}

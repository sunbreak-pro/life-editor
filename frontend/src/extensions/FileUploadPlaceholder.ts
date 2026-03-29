import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FileUploadPlaceholderView } from "./FileUploadPlaceholderView";

export interface FileUploadPlaceholderStorage {
  onImageUpload: ((file: File) => void) | null;
  onPdfUpload: ((file: File) => void) | null;
}

export const FileUploadPlaceholder = Node.create<
  Record<string, never>,
  FileUploadPlaceholderStorage
>({
  name: "fileUploadPlaceholder",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      mode: {
        default: "image",
        parseHTML: (element) => element.getAttribute("data-mode") || "image",
        renderHTML: (attributes) => ({
          "data-mode": attributes.mode as string,
        }),
      },
    };
  },

  addStorage() {
    return {
      onImageUpload: null,
      onPdfUpload: null,
    };
  },

  parseHTML() {
    return [];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      { ...HTMLAttributes, "data-file-upload-placeholder": "" },
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileUploadPlaceholderView);
  },
});

import { Image } from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ResizableImageView } from "./ResizableImageView";

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      attachmentId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-attachment-id"),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.attachmentId) return {};
          return { "data-attachment-id": attributes.attachmentId };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

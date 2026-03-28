import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { PdfAttachmentView } from "./PdfAttachmentView";

export const PdfAttachment = Node.create({
  name: "pdfAttachment",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      attachmentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
        renderHTML: (attributes) => ({
          "data-attachment-id": attributes.attachmentId,
        }),
      },
      filename: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-filename"),
        renderHTML: (attributes) => ({
          "data-filename": attributes.filename,
        }),
      },
      size: {
        default: 0,
        parseHTML: (element) =>
          parseInt(element.getAttribute("data-size") ?? "0"),
        renderHTML: (attributes) => ({
          "data-size": String(attributes.size),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-pdf-attachment]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-pdf-attachment": "",
        class: "pdf-attachment",
      }),
      HTMLAttributes["data-filename"] || "PDF",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PdfAttachmentView);
  },
});

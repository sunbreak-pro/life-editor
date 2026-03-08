import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { WikiTagView } from "./WikiTagView";

export const WikiTag = Node.create({
  name: "wikiTag",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      tagId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-tag-id"),
        renderHTML: (attributes) => ({
          "data-tag-id": attributes.tagId,
        }),
      },
      tagName: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-tag-name"),
        renderHTML: (attributes) => ({
          "data-tag-name": attributes.tagName,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-wiki-tag]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-wiki-tag": "",
        class: "wiki-tag",
      }),
      `[[${HTMLAttributes["data-tag-name"]}]]`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiTagView);
  },
});

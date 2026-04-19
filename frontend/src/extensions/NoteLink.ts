import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { NoteLinkView } from "./NoteLinkView";

export interface NoteLinkAttributes {
  targetNoteId: string | null;
  displayTitle: string;
  alias: string | null;
  heading: string | null;
  blockId: string | null;
  embed: boolean;
}

export const NoteLink = Node.create({
  name: "noteLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      targetNoteId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-target-note-id"),
        renderHTML: (attributes) => ({
          "data-target-note-id": attributes.targetNoteId,
        }),
      },
      displayTitle: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-display-title") ?? "",
        renderHTML: (attributes) => ({
          "data-display-title": attributes.displayTitle,
        }),
      },
      alias: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-alias"),
        renderHTML: (attributes) =>
          attributes.alias ? { "data-alias": attributes.alias } : {},
      },
      heading: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-heading"),
        renderHTML: (attributes) =>
          attributes.heading ? { "data-heading": attributes.heading } : {},
      },
      blockId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-block-id"),
        renderHTML: (attributes) =>
          attributes.blockId ? { "data-block-id": attributes.blockId } : {},
      },
      embed: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-embed") === "true",
        renderHTML: (attributes) =>
          attributes.embed ? { "data-embed": "true" } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-note-link]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const title = HTMLAttributes["data-display-title"] ?? "";
    const alias = HTMLAttributes["data-alias"];
    const heading = HTMLAttributes["data-heading"];
    const blockId = HTMLAttributes["data-block-id"];
    const isEmbed = HTMLAttributes["data-embed"] === "true";

    let suffix = "";
    if (heading) suffix += `#${heading}`;
    if (blockId) suffix += `#^${blockId}`;
    const inner = alias ? `${title}${suffix}|${alias}` : `${title}${suffix}`;
    const bracket = isEmbed ? `![[${inner}]]` : `[[${inner}]]`;

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-note-link": "",
        class: "note-link",
      }),
      bracket,
    ];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-ArrowRight": ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;
        const endOfLine = $from.end();
        const tr = state.tr.setSelection(
          TextSelection.create(state.doc, endOfLine),
        );
        editor.view.dispatch(tr);
        return true;
      },
      "Mod-ArrowLeft": ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;
        const startOfLine = $from.start();
        const tr = state.tr.setSelection(
          TextSelection.create(state.doc, startOfLine),
        );
        editor.view.dispatch(tr);
        return true;
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteLinkView);
  },
});

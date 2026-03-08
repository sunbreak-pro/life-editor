import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { CalloutView } from "./CalloutView";

export const CALLOUT_COLORS: Record<
  string,
  { label: string; bg: string; border: string }
> = {
  default: {
    label: "Default",
    bg: "var(--color-hover)",
    border: "var(--color-accent)",
  },
  blue: {
    label: "Blue",
    bg: "rgba(137,180,250,0.1)",
    border: "var(--color-accent)",
  },
  green: {
    label: "Green",
    bg: "rgba(166,227,161,0.1)",
    border: "#a6e3a1",
  },
  yellow: {
    label: "Yellow",
    bg: "rgba(249,226,175,0.1)",
    border: "#f9e2af",
  },
  red: { label: "Red", bg: "rgba(243,139,168,0.1)", border: "#f38ba8" },
  purple: {
    label: "Purple",
    bg: "rgba(203,166,247,0.1)",
    border: "#cba6f7",
  },
};

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      iconName: {
        default: "Lightbulb",
        parseHTML: (element) =>
          element.getAttribute("data-icon") || "Lightbulb",
        renderHTML: (attributes) => ({ "data-icon": attributes.iconName }),
      },
      color: {
        default: "default",
        parseHTML: (element) => element.getAttribute("data-color") || "default",
        renderHTML: (attributes) => ({ "data-color": attributes.color }),
      },
      emoji: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-emoji") || null,
        renderHTML: (attributes) => {
          if (!attributes.emoji) return {};
          return { "data-emoji": attributes.emoji };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-callout": "",
        class: "callout",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;

        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === "callout") {
            const isAtEnd = $from.parentOffset === $from.parent.content.size;
            const isEmpty = $from.parent.content.size === 0;
            const isLastChild =
              $from.index(depth) === $from.node(depth).childCount - 1;

            if (isAtEnd && isEmpty && isLastChild) {
              const emptyParaPos = $from.before($from.depth);
              const emptyParaEnd = $from.after($from.depth);
              const calloutEnd = $from.after(depth);
              const { tr } = state;
              tr.delete(emptyParaPos, emptyParaEnd);
              const insertPos = tr.mapping.map(calloutEnd);
              tr.insert(insertPos, state.schema.nodes.paragraph.create());
              tr.setSelection(
                TextSelection.near(tr.doc.resolve(insertPos + 1)),
              );
              editor.view.dispatch(tr);
              return true;
            }
            break;
          }
        }
        return false;
      },

      Backspace: ({ editor }) => {
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;

        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === "callout") {
            const atStart = $from.parentOffset === 0;
            const isFirstChild = $from.index(depth) === 0;
            const calloutNode = $from.node(depth);

            if (atStart && isFirstChild && calloutNode.childCount === 1) {
              const isEmpty = $from.parent.content.size === 0;
              const calloutPos = $from.before(depth);
              const calloutEnd = $from.after(depth);
              const { tr } = state;

              if (isEmpty) {
                tr.replaceWith(
                  calloutPos,
                  calloutEnd,
                  state.schema.nodes.paragraph.create(),
                );
              } else {
                tr.replaceWith(
                  calloutPos,
                  calloutEnd,
                  state.schema.nodes.paragraph.create(
                    null,
                    $from.parent.content,
                  ),
                );
              }
              tr.setSelection(
                TextSelection.near(tr.doc.resolve(calloutPos + 1)),
              );
              try {
                editor.view.dispatch(tr);
              } catch {
                return false;
              }
              return true;
            }
            break;
          }
        }
        return false;
      },
    };
  },
});

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
    bg: "rgba(46,170,220,0.25)",
    border: "#2EAADC",
  },
  green: {
    label: "Green",
    bg: "rgba(15,123,108,0.25)",
    border: "#0F7B6C",
  },
  yellow: {
    label: "Yellow",
    bg: "rgba(223,171,1,0.25)",
    border: "#DFAB01",
  },
  red: { label: "Red", bg: "rgba(224,62,62,0.25)", border: "#E03E3E" },
  purple: {
    label: "Purple",
    bg: "rgba(155,89,182,0.25)",
    border: "#9B59B6",
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
      showIcon: {
        default: true,
        parseHTML: (element) =>
          element.getAttribute("data-show-icon") !== "false",
        renderHTML: (attributes) => ({
          "data-show-icon": attributes.showIcon ? "true" : "false",
        }),
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

        // Block below callout: prevent callout from extending
        if ($from.parentOffset === 0 && $from.depth >= 1) {
          const blockPos = $from.before($from.depth);
          if (blockPos > 0) {
            const $blockStart = state.doc.resolve(blockPos);
            const parentDepth = $blockStart.depth;
            const indexInParent = $blockStart.index(parentDepth);
            if (indexInParent > 0) {
              const parentNode = $blockStart.node(parentDepth);
              const prevNode = parentNode.child(indexInParent - 1);
              if (prevNode.type.name === "callout") {
                const currentBlock = $from.parent;
                const currentBlockEnd = blockPos + currentBlock.nodeSize;
                const calloutPos = blockPos - prevNode.nodeSize;

                if (currentBlock.content.size === 0) {
                  // Empty line: delete it, move cursor to end of callout
                  const { tr } = state;
                  tr.delete(blockPos, currentBlockEnd);
                  try {
                    tr.setSelection(
                      TextSelection.near(tr.doc.resolve(blockPos - 1), -1),
                    );
                    editor.view.dispatch(tr);
                  } catch {
                    return false;
                  }
                  return true;
                } else {
                  // Has content: merge into callout's last paragraph
                  // Position of the last child's end inside callout
                  // callout structure: calloutPos, [children...], calloutPos + prevNode.nodeSize
                  // Last child ends at: calloutPos + prevNode.nodeSize - 1 (before callout close tag)
                  const lastChildEnd = calloutPos + prevNode.nodeSize - 1;
                  // Delete boundary: lastChild close + callout close + nextBlock open
                  // = lastChildEnd .. blockPos + 1
                  const { tr } = state;
                  try {
                    tr.delete(lastChildEnd, blockPos + 1);
                    tr.setSelection(
                      TextSelection.near(tr.doc.resolve(lastChildEnd)),
                    );
                    editor.view.dispatch(tr);
                  } catch {
                    return false;
                  }
                  return true;
                }
              }
            }
          }
        }

        // Inside callout: existing logic
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

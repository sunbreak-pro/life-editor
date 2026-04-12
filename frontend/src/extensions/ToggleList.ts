import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { ToggleListView } from "./ToggleListView";

export const ToggleList = Node.create({
  name: "toggleList",
  group: "block",
  content: "toggleSummary toggleContent",
  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (element) => {
          // <details> backward compat: open attribute present = true
          if (element.tagName === "DETAILS") {
            return element.hasAttribute("open") || true;
          }
          return element.getAttribute("data-open") !== "false";
        },
        renderHTML: (attributes) => ({
          "data-open": attributes.open ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "details" }, { tag: "div[data-toggle-list]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-toggle-list": "" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleListView);
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;

        // Check if cursor is at the start of toggleSummary
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === "toggleSummary") {
            const atStart = $from.parentOffset === 0;
            if (!atStart) return false;

            const toggleListDepth = depth - 1;
            if ($from.node(toggleListDepth).type.name !== "toggleList")
              return false;

            const summaryNode = $from.node(depth);
            const isEmpty = summaryNode.content.size === 0;

            if (isEmpty) {
              // Empty summary: delete entire toggle, insert empty paragraph
              const pos = $from.before(toggleListDepth);
              const end = $from.after(toggleListDepth);
              const tr = state.tr.replaceWith(
                pos,
                end,
                state.schema.nodes.paragraph.create(),
              );
              tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
              editor.view.dispatch(tr);
              return true;
            } else {
              // Non-empty summary: unwrap to paragraph
              const pos = $from.before(toggleListDepth);
              const end = $from.after(toggleListDepth);
              const tr = state.tr.replaceWith(
                pos,
                end,
                state.schema.nodes.paragraph.create(null, summaryNode.content),
              );
              tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
              editor.view.dispatch(tr);
              return true;
            }
          }
        }
        return false;
      },

      Enter: ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;

        // If inside toggleSummary, open toggle and focus into content
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === "toggleSummary") {
            const toggleDepth = depth - 1;
            const toggleNode = $from.node(toggleDepth);
            if (toggleNode.type.name !== "toggleList") break;

            const { tr } = state;
            const togglePos = $from.before(toggleDepth);

            // Ensure toggle is open
            if (!toggleNode.attrs.open) {
              tr.setNodeMarkup(togglePos, undefined, {
                ...toggleNode.attrs,
                open: true,
              });
            }

            // Find toggleContent position and focus into its first child
            const summarySize = toggleNode.child(0).nodeSize;
            const contentPos = togglePos + 1 + summarySize; // after toggleList open + summary
            if (toggleNode.childCount >= 2) {
              // Focus into first block of existing content
              tr.setSelection(
                TextSelection.near(tr.doc.resolve(contentPos + 1)),
              );
            }
            editor.view.dispatch(tr);
            return true;
          }
        }

        // If inside toggleContent and at end of empty block, exit toggle
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === "toggleContent") {
            const parentDepth = depth - 1;
            if ($from.node(parentDepth).type.name === "toggleList") {
              const isAtEnd = $from.parentOffset === $from.parent.content.size;
              const isEmpty = $from.parent.content.size === 0;
              if (isAtEnd && isEmpty) {
                const pos = $from.after(parentDepth);
                const tr = state.tr.insert(
                  pos,
                  state.schema.nodes.paragraph.create(),
                );
                tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
                editor.view.dispatch(tr);
                return true;
              }
            }
          }
        }
        return false;
      },
    };
  },
});

export const ToggleSummary = Node.create({
  name: "toggleSummary",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "summary" }, { tag: "div[data-toggle-summary]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-toggle-summary": "" }),
      0,
    ];
  },
});

export const ToggleContent = Node.create({
  name: "toggleContent",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-toggle-content]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-toggle-content": "" }),
      0,
    ];
  },
});

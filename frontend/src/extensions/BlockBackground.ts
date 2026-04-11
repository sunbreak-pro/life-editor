import { Extension } from "@tiptap/core";

export const BLOCK_BG_COLORS = [
  { label: "Default", value: "" },
  { label: "Gray", value: "rgba(128,128,128,0.08)" },
  { label: "Blue", value: "rgba(137,180,250,0.12)" },
  { label: "Green", value: "rgba(166,227,161,0.12)" },
  { label: "Yellow", value: "rgba(249,226,175,0.12)" },
  { label: "Red", value: "rgba(243,139,168,0.12)" },
  { label: "Purple", value: "rgba(203,166,247,0.12)" },
];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockBackground: {
      setBlockBackground: (color: string) => ReturnType;
      unsetBlockBackground: () => ReturnType;
    };
  }
}

export const BlockBackground = Extension.create({
  name: "blockBackground",

  addGlobalAttributes() {
    return [
      {
        types: [
          "paragraph",
          "heading",
          "blockquote",
          "bulletList",
          "orderedList",
          "taskList",
          "callout",
          "toggleList",
          "codeBlock",
        ],
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-bg-color") || null,
            renderHTML: (attributes) => {
              if (!attributes.backgroundColor) return {};
              return {
                "data-bg-color": attributes.backgroundColor,
                style: `background-color: ${attributes.backgroundColor}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setBlockBackground:
        (color: string) =>
        ({ tr, state, dispatch }) => {
          const { from, to } = state.selection;
          let applied = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.isBlock && node.type.spec.group === "block") {
              const resolved = state.doc.resolve(pos);
              if (resolved.depth === 0 || resolved.depth === 1) {
                if (dispatch) {
                  tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    backgroundColor: color || null,
                  });
                }
                applied = true;
                return false;
              }
            }
            return true;
          });
          return applied;
        },

      unsetBlockBackground:
        () =>
        ({ commands }) => {
          return commands.setBlockBackground("");
        },
    };
  },
});

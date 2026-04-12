import { Extension } from "@tiptap/core";

export const BLOCK_BG_COLORS = [
  { label: "Default", value: "" },
  { label: "Gray", value: "rgba(107,114,128,0.25)" },
  { label: "Blue", value: "rgba(46,170,220,0.25)" },
  { label: "Green", value: "rgba(15,123,108,0.25)" },
  { label: "Yellow", value: "rgba(223,171,1,0.25)" },
  { label: "Red", value: "rgba(224,62,62,0.25)" },
  { label: "Purple", value: "rgba(155,89,182,0.25)" },
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

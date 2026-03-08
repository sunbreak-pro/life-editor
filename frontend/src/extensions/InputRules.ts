import { Extension, InputRule } from "@tiptap/core";

export const CustomInputRules = Extension.create({
  name: "customInputRules",

  addInputRules() {
    return [
      // [] + Space → TaskList
      new InputRule({
        find: /^\[\]\s$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).toggleTaskList().run();
        },
      }),

      // > + Space → Toggle List
      new InputRule({
        find: /^>\s$/,
        handler: ({ state, range, chain }) => {
          const { tr } = state;
          tr.delete(range.from, range.to);
          const toggleList = state.schema.nodes.toggleList.create(
            { open: true },
            [
              state.schema.nodes.toggleSummary.create(),
              state.schema.nodes.toggleContent.create(null, [
                state.schema.nodes.paragraph.create(),
              ]),
            ],
          );
          tr.replaceWith(range.from, range.from, toggleList);
          chain().run();
        },
      }),

      // | + Space → Blockquote
      new InputRule({
        find: /^\|\s$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).toggleBlockquote().run();
        },
      }),
    ];
  },
});

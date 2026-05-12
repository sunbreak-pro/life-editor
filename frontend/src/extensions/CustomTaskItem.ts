import TaskItem from "@tiptap/extension-task-item";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CustomTaskItemView } from "./CustomTaskItemView";

export const CustomTaskItem = TaskItem.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CustomTaskItemView);
  },
});

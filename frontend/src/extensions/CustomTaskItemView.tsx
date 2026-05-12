import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { RoundedCheckbox } from "../components/shared/RoundedCheckbox";

export function CustomTaskItemView({
  node,
  updateAttributes,
  editor,
}: NodeViewProps) {
  const checked = node.attrs.checked === true;
  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper
      as="li"
      data-checked={checked ? "true" : "false"}
      className="custom-task-item"
    >
      <div className="custom-task-item-checkbox" contentEditable={false}>
        <RoundedCheckbox
          checked={checked}
          onChange={(next) => {
            if (!isEditable) return;
            updateAttributes({ checked: next });
          }}
          size={16}
          ariaLabel="Toggle task"
          disabled={!isEditable}
          stopPropagation
        />
      </div>
      <NodeViewContent
        as="div"
        className={`custom-task-item-content${checked ? " is-checked" : ""}`}
      />
    </NodeViewWrapper>
  );
}

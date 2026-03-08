import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

export function WikiTagView({ node }: NodeViewProps) {
  const tagName = node.attrs.tagName || "";

  return (
    <NodeViewWrapper
      as="span"
      className="wiki-tag"
      contentEditable={false}
      data-wiki-tag=""
      data-tag-id={node.attrs.tagId}
      data-tag-name={tagName}
    >
      [[{tagName}]]
    </NodeViewWrapper>
  );
}

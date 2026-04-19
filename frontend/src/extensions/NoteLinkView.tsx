import { useMemo } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useNoteContext } from "../hooks/useNoteContext";

export function NoteLinkView({ node }: NodeViewProps) {
  const { notes, setSelectedNoteId } = useNoteContext();
  const targetNoteId: string | null = node.attrs.targetNoteId;
  const displayTitle: string = node.attrs.displayTitle || "";
  const alias: string | null = node.attrs.alias;
  const heading: string | null = node.attrs.heading;
  const blockId: string | null = node.attrs.blockId;
  const isEmbed: boolean = !!node.attrs.embed;

  const targetNote = useMemo(
    () => (targetNoteId ? notes.find((n) => n.id === targetNoteId) : null),
    [notes, targetNoteId],
  );

  const broken = targetNoteId != null && targetNote == null;
  const label = alias ?? displayTitle;
  const suffix =
    (heading ? `#${heading}` : "") + (blockId ? `#^${blockId}` : "");

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (targetNoteId && targetNote) {
      setSelectedNoteId(targetNoteId);
    }
  };

  return (
    <NodeViewWrapper
      as="span"
      className={`note-link${broken ? " note-link-broken" : ""}${isEmbed ? " note-link-embed" : ""}`}
      contentEditable={false}
      data-note-link=""
      data-target-note-id={targetNoteId ?? ""}
      data-display-title={displayTitle}
      onClick={handleClick}
      title={broken ? "Note not found" : (targetNote?.title ?? displayTitle)}
    >
      <span className="note-link-bracket">{isEmbed ? "![[" : "[["}</span>
      <span className="note-link-text">
        {label}
        {suffix && <span className="note-link-suffix">{suffix}</span>}
      </span>
      <span className="note-link-bracket">]]</span>
    </NodeViewWrapper>
  );
}

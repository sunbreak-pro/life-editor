import { useMemo } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Link as LinkIcon } from "lucide-react";
import { useNoteContext } from "../hooks/useNoteContext";
import { NAVIGATE_TO_NOTE_EVENT } from "../constants/events";

export function NoteLinkView({ node }: NodeViewProps) {
  const { notes } = useNoteContext();
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
    (heading ? ` #${heading}` : "") + (blockId ? ` ^${blockId}` : "");

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (targetNoteId && targetNote) {
      window.dispatchEvent(
        new CustomEvent(NAVIGATE_TO_NOTE_EVENT, {
          detail: { noteId: targetNoteId },
        }),
      );
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
      <LinkIcon size={12} className="note-link-icon" />
      <span className="note-link-text">
        {label}
        {suffix && <span className="note-link-suffix">{suffix}</span>}
      </span>
    </NodeViewWrapper>
  );
}

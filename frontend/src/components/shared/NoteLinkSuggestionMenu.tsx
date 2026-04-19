import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useNoteLinkSuggestion } from "../../hooks/useNoteLinkSuggestion";
import type { NoteNode } from "../../types/note";

interface NoteLinkSuggestionMenuProps {
  editor: Editor;
}

export function NoteLinkSuggestionMenu({
  editor,
}: NoteLinkSuggestionMenuProps) {
  const { t } = useTranslation();
  const { notes } = useNoteContext();

  const handleInsertNoteLink = useCallback(
    (args: {
      note: NoteNode;
      heading: string | null;
      blockId: string | null;
      alias: string | null;
      embed: boolean;
    }) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "noteLink",
          attrs: {
            targetNoteId: args.note.id,
            displayTitle: args.note.title,
            alias: args.alias,
            heading: args.heading,
            blockId: args.blockId,
            embed: args.embed,
          },
        })
        .run();
    },
    [editor],
  );

  const {
    isOpen,
    position,
    selectedIndex,
    filteredNotes,
    parsed,
    embed,
    insertNote,
  } = useNoteLinkSuggestion(editor, notes, handleInsertNoteLink);

  if (!isOpen) return null;

  return (
    <div
      className="absolute z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        width: 300,
        maxHeight: 260,
      }}
    >
      <div className="p-1.5 border-b border-notion-border flex items-center justify-between">
        <span className="text-[11px] text-notion-text-secondary px-1.5">
          {embed ? t("noteLinks.embedNote") : t("noteLinks.linkToNote")}
        </span>
        {(parsed.heading || parsed.blockId || parsed.alias) && (
          <span className="text-[10px] text-notion-text-secondary truncate max-w-[150px]">
            {parsed.heading && `#${parsed.heading}`}
            {parsed.blockId && `#^${parsed.blockId}`}
            {parsed.alias && ` | ${parsed.alias}`}
          </span>
        )}
      </div>
      <div className="overflow-y-auto max-h-[220px] p-1">
        {filteredNotes.length === 0 && (
          <div className="px-2 py-3 text-xs text-notion-text-secondary text-center">
            {t("noteLinks.noResults")}
          </div>
        )}
        {filteredNotes.map((note, index) => (
          <button
            key={note.id}
            type="button"
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
              index === selectedIndex
                ? "bg-notion-hover text-notion-text"
                : "text-notion-text hover:bg-notion-hover/50"
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              insertNote(index);
            }}
          >
            <FileText size={14} className="shrink-0 opacity-70" />
            <span className="truncate">{note.title || "(untitled)"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

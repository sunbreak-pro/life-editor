import { useState, type ReactNode } from "react";
import { type TodoDetailPatch } from "@life-editor/shared";

/*
 * The todo body's draft (#713).
 *
 * The panel is shared and the editor is a web dependency it can only take as a
 * slot, so the two halves of one save press start apart: the panel knows the
 * title, this knows the body. It hands both to the press.
 *
 * A component of its own, mounted with `key={todo.id}` inside the detail, so
 * the draft lives exactly as long as the surface showing it. That is the whole
 * discard story: closing without saving unmounts this, and reopening the same
 * todo cannot find yesterday's typing still pending. Keeping it in the board's
 * state instead would need every close path to remember to clear it — and the
 * board would re-render all its columns on every keystroke, for a value only
 * this subtree reads.
 */
export function TodoBodyDraft({
  onSave,
  children,
}: {
  onSave: (id: string, patch: TodoDetailPatch, content?: string) => void;
  children: (draft: {
    dirty: boolean;
    onDraftChange: (content: string) => void;
    onSave: (id: string, patch: TodoDetailPatch) => void;
  }) => ReactNode;
}) {
  // `null` = the body has not moved. Any reported change counts as pending:
  // the editor reports the document, not a diff, so "typed it back exactly"
  // is not a distinction it can make cheaply.
  const [content, setContent] = useState<string | null>(null);
  return children({
    dirty: content !== null,
    onDraftChange: setContent,
    onSave: (id, patch) => {
      onSave(id, patch, content ?? undefined);
      setContent(null);
    },
  });
}

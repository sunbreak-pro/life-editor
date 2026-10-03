import type { Editor } from "@tiptap/react";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";

/*
 * Put a body that came from elsewhere into an OPEN editor (#2057 NOTE-SYNC-1).
 *
 * `setContent` would do it in one call and break three things on the way: the
 * caret jumps to the end, the Undo stack is thrown away, and a Japanese
 * composition in progress is cut off. This replaces only the top-level blocks
 * that actually differ, in ONE transaction that:
 *
 *  - keeps the selection — ProseMirror maps it through the step, so a caret in
 *    an untouched paragraph stays exactly where it was;
 *  - stays out of the Undo history (`addToHistory: false`) — the history plugin
 *    rebases the user's own steps over it the way it does for a collaborator's
 *    change, so Ctrl+Z still undoes the user's typing and never undoes the
 *    other device's write;
 *  - does not fire the editor's `update` (`preventUpdate`) — the body is
 *    already the server's, and reporting it as an edit would save it straight
 *    back as a new version.
 *
 * The caller (RichTextEditor) holds the call while a composition is open.
 *
 * Returns whether the document changed.
 */
export function replaceDocument(editor: Editor, content: string): boolean {
  const next = parseDocument(editor, content);
  if (next === null) return false;
  const current = editor.state.doc;
  if (current.eq(next)) return false;

  // Blocks equal at the start…
  let start = 0;
  let from = 0;
  while (
    start < current.childCount &&
    start < next.childCount &&
    current.child(start).eq(next.child(start))
  ) {
    from += current.child(start).nodeSize;
    start++;
  }
  // …and at the end, without crossing the start.
  let endCurrent = current.childCount;
  let endNext = next.childCount;
  let to = current.content.size;
  while (
    endCurrent > start &&
    endNext > start &&
    current.child(endCurrent - 1).eq(next.child(endNext - 1))
  ) {
    endCurrent--;
    endNext--;
    to -= current.child(endCurrent).nodeSize;
  }

  const inserted: PMNode[] = [];
  for (let i = start; i < endNext; i++) inserted.push(next.child(i));

  const tr = editor.state.tr.replaceWith(from, to, Fragment.from(inserted));
  tr.setMeta("addToHistory", false);
  tr.setMeta("preventUpdate", true);
  editor.view.dispatch(tr);
  return true;
}

/** The stored body as a document of this editor's schema, or null. */
function parseDocument(editor: Editor, content: string): PMNode | null {
  const { schema } = editor;
  if (content === "") return schema.topNodeType.createAndFill();
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    // A legacy plain-text body: one paragraph holding the text.
    return schema.topNodeType.createAndFill(
      null,
      schema.nodes.paragraph.create(null, schema.text(content)),
    );
  }
  try {
    const doc = schema.nodeFromJSON(json);
    doc.check();
    return doc;
  } catch (error) {
    console.warn("[web RichTextEditor] external body did not fit the schema", {
      error,
    });
    return null;
  }
}

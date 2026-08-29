import { useCallback, useState } from "react";
import {
  generateId,
  type DataService,
  type NoteNode,
} from "@life-editor/shared";

/*
 * "Register this note as a template" (#1179).
 *
 * WHY THIS TALKS TO THE DataService DIRECTLY, unlike everything else in
 * NotesView: a template IS a notes row (items_meta role='note' +
 * notes_payload.note_type='template'), but it must never enter the note list,
 * the search results, the badge count or Trash — so the reads that feed those
 * filter it out, and NotesUnifiedContext consequently never holds one. Routing
 * templates through that context would mean teaching it to carry rows it also
 * has to hide from every consumer it has. (Inherited from #1047's host, which
 * this replaced.)
 *
 * The panel opens only AFTER the write lands. It is a receipt — "created, and
 * here is where it went" — so showing it over a write that failed would be the
 * one lie this surface can tell.
 *
 * NO TAGS OR LINKS COME ACROSS (2026-08-29 ユーザー裁定 on #1179). A template
 * is a stamp, not an item in the graph, and #1047 already built the read side
 * on that premise. The body does: the whole point of registering the open note
 * is that its content is the template.
 */

export interface NoteTemplateRegistration {
  /** Name + body to register. The host derives the name (it owns i18n). */
  name: string;
  content: string;
}

export interface NoteTemplateRegister {
  /** id of the template the confirmation panel is about, or null when closed. */
  savedId: string | null;
  /** Draft name shown in the panel. */
  name: string;
  setName: (value: string) => void;
  /** Persist the draft name onto the registered template. */
  commitName: () => void;
  register: (input: NoteTemplateRegistration) => void;
  /** Commit any pending rename, then dismiss the panel. */
  close: () => void;
}

export function useNoteTemplateRegister(
  dataService?: DataService,
): NoteTemplateRegister {
  const [savedId, setSavedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  // The last name written out. Comparing against it — rather than against the
  // row — is what keeps blur-then-close from sending the same title twice.
  const [committed, setCommitted] = useState("");

  const register = useCallback(
    ({ name: initialName, content }: NoteTemplateRegistration) => {
      if (!dataService) return;
      const now = new Date().toISOString();
      const node: NoteNode = {
        id: generateId("note"),
        type: "template",
        title: initialName,
        content,
        parentId: null,
        order: 0,
        isPinned: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      void dataService
        .createNoteUnified(node)
        .then((created) => {
          setName(created.title);
          setCommitted(created.title);
          setSavedId(created.id);
        })
        .catch((e) =>
          console.error("createNoteUnified (register template) failed", e),
        );
    },
    [dataService],
  );

  const commitName = useCallback(() => {
    if (savedId == null || !dataService) return;
    const next = name.trim();
    if (next === committed) return;
    setCommitted(next);
    void dataService
      .updateNoteUnified(savedId, { title: next })
      .catch((e) =>
        console.error("updateNoteUnified (register template) failed", e),
      );
  }, [committed, dataService, name, savedId]);

  const close = useCallback(() => {
    commitName();
    setSavedId(null);
  }, [commitName]);

  return { savedId, name, setName, commitName, register, close };
}

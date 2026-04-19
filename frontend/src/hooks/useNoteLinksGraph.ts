import { useCallback, useEffect, useState } from "react";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import type { NoteLink } from "../types/noteLink";

const RELOAD_EVENT = "life-editor:note-links-changed";

export function dispatchNoteLinksChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent(RELOAD_EVENT));
  } catch {
    /* noop */
  }
}

export function useNoteLinksGraph() {
  const [noteLinks, setNoteLinks] = useState<NoteLink[]>([]);

  const reload = useCallback(() => {
    const ds = getDataService();
    ds.fetchAllNoteLinks()
      .then((links) => {
        setNoteLinks(links.filter((l) => !l.isDeleted));
      })
      .catch((err) => {
        logServiceError("useNoteLinksGraph", "fetchAllNoteLinks", err);
      });
  }, []);

  useEffect(() => {
    const ds = getDataService();
    ds.fetchAllNoteLinks()
      .then((links) => {
        setNoteLinks(links.filter((l) => !l.isDeleted));
      })
      .catch((err) => {
        logServiceError("useNoteLinksGraph", "fetchAllNoteLinks", err);
      });
    const handler = () => {
      reload();
    };
    window.addEventListener(RELOAD_EVENT, handler);
    return () => {
      window.removeEventListener(RELOAD_EVENT, handler);
    };
  }, [reload]);

  return { noteLinks, reload };
}

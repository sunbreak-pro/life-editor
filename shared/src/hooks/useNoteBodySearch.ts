import { useEffect, useState } from "react";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";

/** How long typing has to stop before the body search is worth a round trip. */
const DEBOUNCE_MS = 300;

/** What the server said about one query, and which query it was about. */
interface Answer {
  query: string;
  /** The ids whose body matched, or null when the search itself failed. */
  ids: ReadonlySet<string> | null;
}

export interface NoteBodySearchState {
  /** Ids whose BODY matched, or null while nothing has answered this query. */
  bodyMatchIds: ReadonlySet<string> | null;
  /** A query is on and its answer has not arrived. */
  isSearching: boolean;
  /**
   * The body search for the CURRENT query failed (#1972). The title matches
   * are still right, but "nothing matched" would be a claim about bodies
   * nobody read — #1837 shipped exactly that for a 404 and it went unnoticed
   * until a browser check after merge.
   */
  bodySearchFailed: boolean;
}

/**
 * The server-side half of the notes search (#1837).
 *
 * The note list is body-free by design (M1): a row carries a title and no
 * content, so the client filter next door can only ever match titles. The full
 * text lives in the database, `ds.searchNotesUnified` has queried it since
 * #587, and nothing called it — which is why typing a word from the open note
 * answered "No notes match that search".
 *
 * This returns ids, not notes. The rows on screen keep coming from the list the
 * Provider already holds, so a body hit lights up the row that is already there
 * rather than introducing a second, differently-shaped copy of it — and no note
 * body is copied into React state on the way (#1763 is about exactly that).
 *
 * The answer is stored WITH the query it answered, and both outputs are derived
 * from comparing that to the query now. Two things fall out of it. Nothing is
 * written back during the effect, which is what the lint rule about cascading
 * renders asks for. And `isSearching` cannot get stuck: it is "the current
 * query has no answer", not a flag somebody has to remember to lower.
 *
 * A failed search stores `ids: null` — answered, with nothing to add. The list
 * then shows its title matches rather than sitting dimmed forever.
 */
export function useNoteBodySearch(
  ds: DataService,
  query: string,
): NoteBodySearchState {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    const current = query.trim();
    if (current === "") return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const hits = await ds.searchNotesUnified(current);
          // `content_json` is jsonb and the match is an ILIKE over its text
          // form, so a broad first keystroke can easily outlive the narrower
          // query typed after it. The cleanup has already run for that older
          // effect; this is where its answer is dropped.
          if (!cancelled)
            setAnswer({ query: current, ids: new Set(hits.map((n) => n.id)) });
        } catch (e) {
          // The title filter is still on screen and still correct, so a failed
          // body search narrows the answer rather than breaking it. Logged,
          // not raised: the tree's error card is about the tree being gone.
          logServiceError("Notes", "searchNotesUnified", e);
          if (!cancelled) setAnswer({ query: current, ids: null });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ds, query]);

  const answered = trimmed !== "" && answer?.query === trimmed;
  return {
    bodyMatchIds: answered ? (answer?.ids ?? null) : null,
    isSearching: trimmed !== "" && !answered,
    bodySearchFailed: answered && answer?.ids === null,
  };
}

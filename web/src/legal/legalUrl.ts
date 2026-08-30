import type { LegalDocumentId } from "./legalContent";

/*
 * The open document, kept in the address bar — and the whole of this
 * feature's state (#1198, lifted out of AuthScreen by #1251).
 *
 * There is no router (§3.2), and a policy nobody can link to is only half a
 * policy: an app store form, a mail, a message to a friend all want a URL.
 * `?legal=privacy` is the cheapest thing that gives one — the SPA is served
 * for any query string, so the parameter survives a reload and a shared link
 * opens straight onto the document.
 *
 * Making the URL the SSOT rather than a mirror of React state is what lets
 * two screens on opposite sides of the session gate open the same reader
 * without a Provider between them: AuthScreen and Settings both just call
 * `openLegalDocument`, and the one host that renders the document listens.
 * A Context would have meant wrapping every Settings suite that renders the
 * screen — six of them — in a Provider they otherwise have no use for.
 *
 * Opening from inside the app PUSHES a history entry (#1281). The first
 * version replaced the current one, which made the browser's back button skip
 * the reader entirely and leave the app: the URL you had before opening the
 * policy was gone. Now the reader sits on its own entry, so back closes it
 * and nothing else — and closing it from the inside (the Back control,
 * Escape) is the same step back, which keeps the two exits from disagreeing
 * about where you land. A shared link is the one case with no entry to step
 * back to: there, closing rewrites the URL in place, because going back would
 * leave the site.
 */

/**
 * Fired after `openLegalDocument` rewrites the query. `popstate` covers the
 * back button but never a `pushState` / `replaceState` we made ourselves, so
 * the host would otherwise never hear about a click.
 */
const LEGAL_CHANGE_EVENT = "life-editor:legal-change";

/**
 * Marks the history entry the reader was PUSHED onto from inside the app. It
 * lives in `history.state` rather than a module variable so it survives a
 * reload: a reader reopened by F5 still knows it has an app entry beneath it.
 */
const PUSHED_ENTRY_KEY = "life-editor:legal-pushed";

export function readLegalParam(): LegalDocumentId | null {
  try {
    const value = new URLSearchParams(window.location.search).get("legal");
    return value === "privacy" || value === "terms" ? value : null;
  } catch {
    return null;
  }
}

function legalUrl(id: LegalDocumentId | null): string {
  const params = new URLSearchParams(window.location.search);
  if (id) params.set("legal", id);
  else params.delete("legal");
  const query = params.toString();
  const { pathname, hash } = window.location;
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

function stateRecord(): Record<string, unknown> | null {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null
    ? (state as Record<string, unknown>)
    : null;
}

/** True on the entry `openLegalDocument` pushed over the app. */
function onPushedEntry(): boolean {
  return stateRecord()?.[PUSHED_ENTRY_KEY] === true;
}

function notify(): void {
  window.dispatchEvent(new CustomEvent(LEGAL_CHANGE_EVENT));
}

/** Open a document, or close the reader with `null`. */
export function openLegalDocument(id: LegalDocumentId | null): void {
  if (id === null) {
    closeLegalDocument();
    return;
  }
  try {
    if (readLegalParam()) {
      // Already reading: swapping the document must not stack a second entry,
      // or back would page through documents instead of closing the reader.
      window.history.replaceState(window.history.state, "", legalUrl(id));
    } else {
      window.history.pushState(
        { ...(stateRecord() ?? {}), [PUSHED_ENTRY_KEY]: true },
        "",
        legalUrl(id),
      );
    }
  } catch {
    // Then the document still opens; only the address bar misses out.
  }
  notify();
}

function closeLegalDocument(): void {
  if (onPushedEntry()) {
    // Step back over our own entry. The traversal fires `popstate`, which the
    // subscribers below already handle — the host reads an empty param and
    // closes. Same path as the browser's back button, by design.
    window.history.back();
    return;
  }
  try {
    window.history.replaceState(window.history.state, "", legalUrl(null));
  } catch {
    // As above: the reader closes regardless.
  }
  notify();
}

/** Subscribe to both our own writes and the back button. */
export function subscribeLegalParam(onChange: () => void): () => void {
  window.addEventListener(LEGAL_CHANGE_EVENT, onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener(LEGAL_CHANGE_EVENT, onChange);
    window.removeEventListener("popstate", onChange);
  };
}

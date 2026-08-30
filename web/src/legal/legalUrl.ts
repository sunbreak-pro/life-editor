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
 */

/**
 * Fired after `openLegalDocument` rewrites the query. `popstate` covers the
 * back button but never a `replaceState` we made ourselves, so the host would
 * otherwise never hear about a click.
 */
const LEGAL_CHANGE_EVENT = "life-editor:legal-change";

export function readLegalParam(): LegalDocumentId | null {
  try {
    const value = new URLSearchParams(window.location.search).get("legal");
    return value === "privacy" || value === "terms" ? value : null;
  } catch {
    return null;
  }
}

function writeLegalParam(id: LegalDocumentId | null): void {
  try {
    const params = new URLSearchParams(window.location.search);
    if (id) params.set("legal", id);
    else params.delete("legal");
    const query = params.toString();
    const { pathname, hash } = window.location;
    window.history.replaceState(
      window.history.state,
      "",
      `${pathname}${query ? `?${query}` : ""}${hash}`,
    );
  } catch {
    // Then the document still opens; only the address bar misses out.
  }
}

/** Open a document, or close the reader with `null`. */
export function openLegalDocument(id: LegalDocumentId | null): void {
  writeLegalParam(id);
  window.dispatchEvent(new CustomEvent(LEGAL_CHANGE_EVENT));
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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { LegalReaderHost } from "../src/legal/LegalReaderHost";
import { openLegalDocument } from "../src/legal/legalUrl";
import { LEGAL_DOCUMENTS } from "../src/legal/legalContent";

/*
 * #1251 — the reader, now that it is App's rather than AuthScreen's.
 *
 * The bug it fixes is invisible in a passing build: the documents existed and
 * the links worked, but only while signed OUT. After sign-in the terms were
 * unreachable and `?legal=privacy` was swallowed by the session gate — which
 * is backwards, since the reason to check what you agreed to arrives long
 * after you agreed to it.
 *
 * The host is mounted beside the app rather than in place of it, so the case
 * below pins that the app underneath survives being read over.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The catalog is a key echo above, so the documents are the only real copy on
// screen — en, because that is i18next's fallback.
const EN = LEGAL_DOCUMENTS.en;

function setQuery(search: string): void {
  window.history.replaceState({}, "", `${window.location.pathname}${search}`);
}

/** The host beside a stand-in for whatever the user was doing. */
function renderHost() {
  return render(
    <>
      <div>app underneath</div>
      <LegalReaderHost />
    </>,
  );
}

beforeEach(() => setQuery(""));
afterEach(() => setQuery(""));

describe("LegalReaderHost", () => {
  it("renders nothing until a document is asked for", () => {
    renderHost();
    expect(screen.queryByText(EN.privacy.title)).toBeNull();
    expect(screen.queryByText(EN.terms.title)).toBeNull();
  });

  it("opens what openLegalDocument names, without unmounting the app", () => {
    renderHost();

    act(() => openLegalDocument("terms"));

    expect(screen.getByText(EN.terms.title)).toBeTruthy();
    expect(screen.getByText(EN.terms.sections[0].heading)).toBeTruthy();
    // The whole point of overlaying: the section you were in and the note you
    // were typing are still there when you come back.
    expect(screen.getByText("app underneath")).toBeTruthy();
  });

  it("opens straight onto a shared ?legal= link", () => {
    setQuery("?legal=privacy");
    renderHost();
    expect(screen.getByText(EN.privacy.title)).toBeTruthy();
  });

  it("ignores a query that names no document", () => {
    setQuery("?legal=nonsense");
    renderHost();
    expect(screen.queryByText(EN.privacy.title)).toBeNull();
    expect(screen.queryByText(EN.terms.title)).toBeNull();
  });

  it("takes the query back out on the way out", () => {
    renderHost();

    act(() => openLegalDocument("privacy"));
    expect(window.location.search).toBe("?legal=privacy");

    act(() => openLegalDocument(null));
    expect(window.location.search).toBe("");
    expect(screen.queryByText(EN.privacy.title)).toBeNull();
  });

  it("follows the back button", () => {
    setQuery("?legal=terms");
    renderHost();
    expect(screen.getByText(EN.terms.title)).toBeTruthy();

    // What a real back press looks like from in here: the URL is already the
    // previous one by the time the event lands.
    setQuery("");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.queryByText(EN.terms.title)).toBeNull();
  });
});

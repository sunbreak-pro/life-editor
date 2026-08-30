import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
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
 *
 * #1281 — the reader as a dialog. Three findings from the real-browser check
 * of #1251: focus stayed on the button underneath (one Tab walked into the
 * invisible app), Escape did nothing, and opening from Settings REPLACED the
 * history entry, so the browser's back button left the app instead of closing
 * the reader. The cases under "as a dialog" and "in history" pin each.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The catalog is a key echo above, so the documents are the only real copy on
// screen — en, because that is i18next's fallback.
const EN = LEGAL_DOCUMENTS.en;
const BACK = "auth.legal.back";

function setQuery(search: string, state: unknown = {}): void {
  window.history.replaceState(
    state,
    "",
    `${window.location.pathname}${search}`,
  );
}

/** The host beside a stand-in for whatever the user was doing. */
function renderHost() {
  return render(
    <>
      <div>app underneath</div>
      <button type="button" onClick={() => openLegalDocument("terms")}>
        open terms
      </button>
      <LegalReaderHost />
    </>,
  );
}

/** Runs the pending rAF callback — that is when initial focus is applied. */
async function afterFrame() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

/**
 * jsdom traverses history on a queued task, like a browser: `history.back()`
 * returns before the URL moves and `popstate` lands later. Anything that
 * closes the reader by stepping back has to be awaited through here.
 */
async function untilPopstate(run: () => void) {
  await act(async () => {
    const landed = new Promise<void>((resolve) =>
      window.addEventListener("popstate", () => resolve(), { once: true }),
    );
    run();
    await landed;
  });
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

  describe("as a dialog (#1281)", () => {
    it("is a modal dialog named by the document title", () => {
      renderHost();
      act(() => openLegalDocument("privacy"));

      const dialog = screen.getByRole("dialog", { name: EN.privacy.title });
      expect(dialog.getAttribute("aria-modal")).toBe("true");
    });

    it("moves focus inside on open and returns it to the opener on close", async () => {
      renderHost();
      const opener = screen.getByRole("button", { name: "open terms" });
      opener.focus();

      fireEvent.click(opener);
      await afterFrame();
      // The Back control is the first thing in the reader, so it is where a
      // keyboard user lands — not on the Settings button behind the overlay.
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: BACK }),
      );

      await untilPopstate(() => fireEvent.keyDown(document, { key: "Escape" }));
      expect(screen.queryByText(EN.terms.title)).toBeNull();
      expect(document.activeElement).toBe(opener);
    });

    it("keeps Tab inside the reader", async () => {
      renderHost();
      act(() => openLegalDocument("terms"));
      await afterFrame();
      const back = screen.getByRole("button", { name: BACK });

      // Loose on the page (a click on the overlay's own padding leaves focus
      // on <body>): Tab must come back in, not walk the app underneath.
      (document.activeElement as HTMLElement | null)?.blur();
      fireEvent.keyDown(document.body, { key: "Tab" });
      expect(document.activeElement).toBe(back);

      // Back is also the last control — the document is plain text — so the
      // cycle wraps onto itself rather than leaving.
      fireEvent.keyDown(back, { key: "Tab" });
      expect(document.activeElement).toBe(back);
    });
  });

  describe("in history (#1281)", () => {
    it("opens on its own entry, so the back button closes only the reader", async () => {
      setQuery("", { app: "before" });
      renderHost();
      const before = window.history.length;

      act(() => openLegalDocument("terms"));
      expect(window.history.length).toBe(before + 1);
      expect(window.location.search).toBe("?legal=terms");

      await untilPopstate(() => window.history.back());

      expect(screen.queryByText(EN.terms.title)).toBeNull();
      expect(window.location.search).toBe("");
      // The entry we came from, state and all — not a rewritten copy of it.
      expect(window.history.state).toEqual({ app: "before" });
      expect(screen.getByText("app underneath")).toBeTruthy();
    });

    it("closes from the inside by the same step back", async () => {
      setQuery("", { app: "before" });
      renderHost();
      act(() => openLegalDocument("privacy"));

      await untilPopstate(() =>
        fireEvent.click(screen.getByRole("button", { name: BACK })),
      );

      expect(screen.queryByText(EN.privacy.title)).toBeNull();
      expect(window.location.search).toBe("");
      expect(window.history.state).toEqual({ app: "before" });
    });

    it("swaps documents in place rather than stacking entries", async () => {
      renderHost();
      act(() => openLegalDocument("terms"));
      const opened = window.history.length;

      act(() => openLegalDocument("privacy"));
      expect(screen.getByText(EN.privacy.title)).toBeTruthy();
      expect(window.history.length).toBe(opened);

      // One step back still lands on the app, whichever document was read last.
      await untilPopstate(() => window.history.back());
      expect(screen.queryByText(EN.privacy.title)).toBeNull();
      expect(window.location.search).toBe("");
    });

    it("rewrites a shared link's entry on close instead of stepping out of the site", () => {
      // A link opened from a message has no app entry beneath it: back from
      // there is the previous SITE, which is not where "close" should go.
      setQuery("?legal=privacy");
      const back = vi.spyOn(window.history, "back");
      renderHost();
      expect(screen.getByText(EN.privacy.title)).toBeTruthy();

      act(() => openLegalDocument(null));

      expect(back).not.toHaveBeenCalled();
      expect(window.location.search).toBe("");
      expect(screen.queryByText(EN.privacy.title)).toBeNull();
      back.mockRestore();
    });
  });
});

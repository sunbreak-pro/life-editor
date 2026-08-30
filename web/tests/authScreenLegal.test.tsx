import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthScreen } from "../src/AuthScreen";
import { LegalReaderHost } from "../src/legal/LegalReaderHost";
import { LEGAL_DOCUMENTS } from "../src/legal/legalContent";

/*
 * #1198 — the policy and the terms have to be reachable from the screen that
 * asks for the account, not filed somewhere the signer-up never goes.
 *
 * The `?legal=` case matters as much as the click: the app has no router, so
 * that query string is the only thing that makes "here is our privacy policy"
 * a link somebody can send.
 *
 * #1251 moved the reader itself to App, so these cases mount AuthScreen and
 * LegalReaderHost together the way App does. That pairing IS the assertion:
 * the screen only writes the URL, and something else has to be listening for
 * a click to show anything at all.
 */

const state = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updatePassword: vi.fn(),
  resendConfirmationEmail: vi.fn(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key }),
    signIn: state.signIn,
    signUp: state.signUp,
    sendPasswordResetEmail: state.sendPasswordResetEmail,
    updatePassword: state.updatePassword,
    resendConfirmationEmail: state.resendConfirmationEmail,
  };
});

// The catalog is stubbed to a key echo above, so the documents themselves are
// the only real copy on screen — en, because that is i18next's fallback.
const EN = LEGAL_DOCUMENTS.en;

function setQuery(search: string): void {
  window.history.replaceState({}, "", `${window.location.pathname}${search}`);
}

/** The pair App mounts: the screen that links, and the host that renders. */
function renderAuth() {
  return render(
    <>
      <AuthScreen />
      <LegalReaderHost />
    </>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setQuery("");
});

afterEach(() => {
  setQuery("");
});

describe("AuthScreen — policy and terms", () => {
  it("opens the privacy policy from the auth card and comes back", () => {
    renderAuth();

    fireEvent.click(screen.getByRole("button", { name: "auth.legal.privacy" }));
    expect(screen.getByText(EN.privacy.title)).toBeTruthy();
    expect(screen.getByText(EN.privacy.sections[0].heading)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "auth.legal.back" }));
    expect(screen.getByRole("button", { name: "auth.signIn" })).toBeTruthy();
  });

  it("opens the terms from the auth card", () => {
    renderAuth();

    fireEvent.click(screen.getByRole("button", { name: "auth.legal.terms" }));
    expect(screen.getByText(EN.terms.title)).toBeTruthy();
  });

  it("keeps the open document in the address bar so it can be linked", () => {
    renderAuth();

    fireEvent.click(screen.getByRole("button", { name: "auth.legal.terms" }));
    expect(window.location.search).toBe("?legal=terms");

    fireEvent.click(screen.getByRole("button", { name: "auth.legal.back" }));
    expect(window.location.search).toBe("");
  });

  it("opens straight to the document named in the query", () => {
    setQuery("?legal=privacy");
    renderAuth();

    expect(screen.getByText(EN.privacy.title)).toBeTruthy();
  });

  it("ignores a query that names no document", () => {
    setQuery("?legal=nonsense");
    renderAuth();

    expect(screen.getByRole("button", { name: "auth.signIn" })).toBeTruthy();
  });

  it("states the agreement only where an account is being created", () => {
    renderAuth();
    expect(screen.queryByText("auth.legal.consent")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "auth.signUp" }));
    expect(screen.getByText("auth.legal.consent")).toBeTruthy();
  });
});

describe("legal documents", () => {
  it("carries the same sections in both languages", () => {
    for (const id of ["privacy", "terms"] as const) {
      expect(LEGAL_DOCUMENTS.ja[id].sections).toHaveLength(
        LEGAL_DOCUMENTS.en[id].sections.length,
      );
      expect(LEGAL_DOCUMENTS.ja[id].updated).toBe(
        LEGAL_DOCUMENTS.en[id].updated,
      );
    }
  });

  it("names the operator and a way to reach them in every document", () => {
    for (const locale of ["en", "ja"] as const) {
      for (const id of ["privacy", "terms"] as const) {
        const text = JSON.stringify(LEGAL_DOCUMENTS[locale][id]);
        expect(text).toContain("sunbreak-pro");
        expect(text).toContain("github.com/sunbreak-pro/life-editor/issues");
      }
    }
  });
});

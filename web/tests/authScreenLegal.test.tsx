import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthScreen } from "../src/AuthScreen";
import { i18n } from "@life-editor/shared";
import { LEGAL_DOCUMENTS } from "../src/legal/legalContent";

/*
 * #1198 — the policy and the terms have to be reachable from the screen that
 * asks for the account, not filed somewhere the signer-up never goes.
 *
 * The `?legal=` case matters as much as the click: the app has no router, so
 * that query string is the only thing that makes "here is our privacy policy"
 * a link somebody can send.
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

beforeEach(() => {
  vi.clearAllMocks();
  setQuery("");
});

afterEach(() => {
  setQuery("");
});

describe("AuthScreen — policy and terms", () => {
  it("opens the privacy policy from the auth card and comes back", () => {
    render(<AuthScreen />);

    fireEvent.click(screen.getByRole("button", { name: "auth.legal.privacy" }));
    expect(screen.getByText(EN.privacy.title)).toBeTruthy();
    expect(screen.getByText(EN.privacy.sections[0].heading)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "auth.legal.back" }));
    expect(screen.getByRole("button", { name: "auth.signIn" })).toBeTruthy();
  });

  it("opens the terms from the auth card", () => {
    render(<AuthScreen />);

    fireEvent.click(screen.getByRole("button", { name: "auth.legal.terms" }));
    expect(screen.getByText(EN.terms.title)).toBeTruthy();
  });

  it("keeps the open document in the address bar so it can be linked", () => {
    render(<AuthScreen />);

    fireEvent.click(screen.getByRole("button", { name: "auth.legal.terms" }));
    expect(window.location.search).toBe("?legal=terms");

    fireEvent.click(screen.getByRole("button", { name: "auth.legal.back" }));
    expect(window.location.search).toBe("");
  });

  it("opens straight to the document named in the query", () => {
    setQuery("?legal=privacy");
    render(<AuthScreen />);

    expect(screen.getByText(EN.privacy.title)).toBeTruthy();
  });

  it("ignores a query that names no document", () => {
    setQuery("?legal=nonsense");
    render(<AuthScreen />);

    expect(screen.getByRole("button", { name: "auth.signIn" })).toBeTruthy();
  });

  it("states the agreement only where an account is being created", () => {
    render(<AuthScreen />);
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

  /*
   * #1252 — the policy and the app drifted apart: Settings → Account shipped
   * the delete (#1200) while the deletion section still called it "in
   * preparation". A policy that understates what the product does is the
   * kind of wrong nobody notices until somebody relies on it.
   *
   * The catalog entry is the cheapest proof the feature exists — `exists`,
   * not `t`, because `t` hands back the key itself for a missing one and
   * would pass either way.
   */
  it("keeps the deletion section in step with what Settings actually offers", () => {
    expect(i18n.exists("settings.account.delete.button")).toBe(true);

    for (const locale of ["en", "ja"] as const) {
      const section = LEGAL_DOCUMENTS[locale].privacy.sections.find((s) =>
        /Deleting your data|データの削除/.test(s.heading),
      );
      expect(section).toBeTruthy();
      const text = (section?.paragraphs ?? []).join(" ");
      expect(text).not.toMatch(/in preparation|準備中/);
      expect(text).toMatch(locale === "en" ? /Settings/ : /設定/);
    }
  });
});

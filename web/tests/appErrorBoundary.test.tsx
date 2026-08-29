import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { i18n } from "@life-editor/shared";
import { AppErrorBoundary } from "../src/components/AppErrorBoundary";

/*
 * #1199 — the wiring half of the boundary. shared/tests/errorBoundary.test.tsx
 * proves the class catches; this proves the two mount sites read the catalog
 * and not a hardcoded English string.
 *
 * The REAL i18next singleton is used (same reasoning as notesI18n.test.tsx):
 * a key-echo stub would pass just as happily against copy that never reached
 * ja.json, which is the mistake worth catching here.
 */

function Boom(): never {
  throw new Error("boom");
}

let consoleError: ReturnType<typeof vi.spyOn>;
let previousLanguage: string;

beforeAll(async () => {
  previousLanguage = i18n.language;
  await i18n.changeLanguage("ja");
});

afterAll(async () => {
  await i18n.changeLanguage(previousLanguage);
});

beforeEach(() => {
  // React reports the caught error itself; an expected throw is not a failure.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("AppErrorBoundary", () => {
  it("renders the page fallback in the active language", () => {
    render(
      <AppErrorBoundary variant="page">
        <Boom />
      </AppErrorBoundary>,
    );
    expect(screen.getByText(i18n.t("errorBoundary.appTitle"))).toBeTruthy();
    expect(
      screen.getByRole("button", { name: i18n.t("errorBoundary.reload") }),
    ).toBeTruthy();
    // The page variant must not offer an in-place retry — a Provider that
    // threw would only throw again, which reads as a dead button.
    expect(
      screen.queryByRole("button", { name: i18n.t("errorBoundary.retry") }),
    ).toBeNull();
  });

  it("uses the section wording and offers retry when wrapping a section body", () => {
    render(
      <AppErrorBoundary variant="section" resetKey="todos">
        <Boom />
      </AppErrorBoundary>,
    );
    expect(screen.getByText(i18n.t("errorBoundary.sectionTitle"))).toBeTruthy();
    expect(
      screen.getByRole("button", { name: i18n.t("errorBoundary.retry") }),
    ).toBeTruthy();
  });

  it("passes children through untouched while nothing throws", () => {
    render(
      <AppErrorBoundary variant="section">
        <p>section body</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText("section body")).toBeTruthy();
  });
});

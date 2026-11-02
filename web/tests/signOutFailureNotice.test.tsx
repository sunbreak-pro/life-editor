import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ToastProvider } from "@life-editor/shared";
import en from "../../shared/src/i18n/locales/en.json";
import ja from "../../shared/src/i18n/locales/ja.json";
import { SignOutFailureNotice } from "../src/components/SignOutFailureNotice";
import { signOutWithNotice } from "../src/hooks/signOutWithNotice";

/*
 * #2334 — a sign-out the network refused has to say so. The session stays, and on
 * a shared device someone would otherwise walk away believing it had ended.
 */

const h = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key }),
  signOut: h.signOut,
}));

const srcRoot = resolve(__dirname, "../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

const press = () =>
  act(async () => {
    signOutWithNotice();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe("a refused sign-out", () => {
  // In a block: vitest would run a returned function as this hook's teardown.
  beforeEach(() => {
    h.signOut.mockReset();
  });

  const mount = () =>
    render(
      <ToastProvider>
        <SignOutFailureNotice />
      </ToastProvider>,
    );

  it("says so when the sign-out returns an error", async () => {
    h.signOut.mockResolvedValue({ error: "Signing out needs a connection." });
    mount();
    await press();
    expect(screen.getByText("nav.signOutFailed")).toBeTruthy();
  });

  it("says so when the sign-out throws", async () => {
    h.signOut.mockRejectedValue(new Error("lock timed out"));
    mount();
    await press();
    expect(screen.getByText("nav.signOutFailed")).toBeTruthy();
  });

  it("says nothing when it worked", async () => {
    h.signOut.mockResolvedValue({ error: null });
    mount();
    await press();
    expect(screen.queryByText("nav.signOutFailed")).toBeNull();
  });

  it("has its copy in both catalogs", () => {
    expect(en.nav.signOutFailed).toBeTruthy();
    expect(ja.nav.signOutFailed).toBeTruthy();
  });

  it("is what every button in the app goes through", () => {
    const direct = sourceFiles(srcRoot).filter(
      (path) =>
        !path.endsWith("signOutWithNotice.ts") &&
        /\bsignOut\(\)/.test(readFileSync(path, "utf8")),
    );
    expect(direct).toEqual([]);
    const main = readFileSync(join(srcRoot, "MainScreen.tsx"), "utf8");
    expect(main).toContain("onSignOut={signOutWithNotice}");
    expect(main).toContain("<SignOutFailureNotice />");
  });
});

describe("the read ahead of pinned notes", () => {
  it("is mounted for the whole session, not with the Notes tab", () => {
    const main = readFileSync(join(srcRoot, "MainScreen.tsx"), "utf8");
    expect(main).toContain("<PinnedNotesReadAhead dataService={ds} />");
  });
});

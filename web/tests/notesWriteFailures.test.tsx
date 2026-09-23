import { describe, it, expect, vi, afterAll } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { i18n, type DataService, type NoteWriteOp } from "@life-editor/shared";
import {
  NotesUnifiedHost,
  WRITE_FAILED_COPY,
} from "../src/notes/NotesUnifiedHost";
import { TEMPLATE_WRITE_FAILED_COPY } from "../src/notes/hooks/useTemplateWriteFailure";

/*
 * #1761 — a Notes write that fails after the screen has already changed has to
 * say so. A delete refused by a dropped connection used to leave nothing but a
 * `console.warn`: the row came back and the user's only read was "the button
 * is broken".
 *
 * Two things are pinned here. That the host turns the provider's report into a
 * danger toast, and that every key the two copy maps name actually resolves in
 * BOTH catalogs. i18next's typed `t()` already rejects a key that is in
 * neither catalog at build time; what it cannot see is a key added to en and
 * forgotten in ja, which ships as a raw key shown to the user at exactly the
 * worst moment.
 *
 * Only the toast surface and the provider are faked, and the real i18n
 * singleton is kept (the same reason notesI18n.test.tsx keeps it: a key echo
 * would pass just as happily over a missing translation).
 */

const captured = vi.hoisted(() => ({
  onWriteError: null as ((op: NoteWriteOp, error: unknown) => void) | null,
  untitledTitle: undefined as string | undefined,
  showToast: vi.fn(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useToast: () => ({ showToast: captured.showToast }),
    NotesUnifiedProvider: ({
      children,
      onWriteError,
      untitledTitle,
    }: {
      children: ReactNode;
      onWriteError?: (op: NoteWriteOp, error: unknown) => void;
      untitledTitle?: string;
    }) => {
      captured.onWriteError = onWriteError ?? null;
      captured.untitledTitle = untitledTitle;
      return <>{children}</>;
    },
  };
});

const originalLanguage = i18n.language;
afterAll(async () => {
  await i18n.changeLanguage(originalLanguage);
});

function mountHost() {
  captured.onWriteError = null;
  captured.untitledTitle = undefined;
  captured.showToast.mockClear();
  render(
    <NotesUnifiedHost dataService={{} as DataService}>
      <div>notes</div>
    </NotesUnifiedHost>,
  );
  return captured;
}

describe("NotesUnifiedHost", () => {
  it("turns a refused delete into a danger toast", async () => {
    await i18n.changeLanguage("en");
    const h = mountHost();
    expect(h.onWriteError).toBeTypeOf("function");

    h.onWriteError?.("delete", new Error("ERR_CONNECTION_CLOSED"));

    expect(h.showToast).toHaveBeenCalledWith(
      "danger",
      i18n.t("notesView.writeFailed.delete"),
    );
    // The copy has to name the delete specifically — "couldn't save" over a
    // row that is back in the list is the ambiguity this issue was about.
    expect(h.showToast.mock.calls[0][1]).toMatch(/delete/i);
  });

  it("names the operation, so two failures do not read the same", async () => {
    await i18n.changeLanguage("en");
    const h = mountHost();

    h.onWriteError?.("update", new Error("boom"));
    h.onWriteError?.("restore", new Error("boom"));

    const [first, second] = h.showToast.mock.calls.map((c) => c[1]);
    expect(first).not.toBe(second);
  });
});

describe("NotesUnifiedHost — the new note's placeholder title (#1953)", () => {
  /*
   * A note created with no title used to be named by a literal in the shared
   * hook, so a Japanese UI got an English title. The host now hands the
   * provider the catalog's word for the current language.
   */
  it("hands the provider the Japanese word in ja", async () => {
    await i18n.changeLanguage("ja");
    const h = mountHost();
    expect(h.untitledTitle).toBe("無題");
  });

  it("follows the catalog in en", async () => {
    await i18n.changeLanguage("en");
    const h = mountHost();
    expect(h.untitledTitle).toBe(i18n.t("common.untitled"));
    expect(h.untitledTitle).not.toBe("common.untitled");
  });
});

describe("write-failure copy", () => {
  const keys = [
    ...Object.values(WRITE_FAILED_COPY),
    ...Object.values(TEMPLATE_WRITE_FAILED_COPY),
  ];

  for (const lang of ["en", "ja"] as const) {
    it(`resolves every key in ${lang}`, async () => {
      await i18n.changeLanguage(lang);
      for (const key of keys) {
        const copy = i18n.t(key);
        // i18next echoes the key back when it has no entry for it.
        expect(copy, `${key} (${lang})`).not.toBe(key);
        expect(copy.length, `${key} (${lang})`).toBeGreaterThan(0);
      }
    });
  }
});

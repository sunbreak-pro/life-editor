import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { i18n, type NoteNode } from "@life-editor/shared";
import { NotesView } from "../src/notes/NotesView";

/*
 * #680 — the Notes strings that never reached the catalog. notesView.test.tsx
 * stubs useTranslation into a key echo, which is right for wiring assertions
 * and blind to exactly this bug: a hardcoded English label passes an echo test
 * just as happily as a translated one. So this suite keeps the REAL i18next
 * singleton, switches it to ja, and reads the rendered Japanese back.
 *
 * What is left under test is the note body's PLACEHOLDER, which no call site
 * was passing. The trash row's restore / permanently-delete labels used to be
 * here too — #1286 removed that list from the sidebar (Trash owns recovery for
 * the whole app), so the strings it was reading are gone with it.
 *
 * Only the context hooks are faked — the same set notesView.test.tsx fakes, and
 * for the same reason (the real ones need Providers, a DataService and a
 * network). RichTextEditor is replaced by a stub that prints its placeholder:
 * TipTap needs no exercising here, the prop reaching it does.
 */

const state = vi.hoisted(() => ({
  notes: [] as unknown[],
  deletedNotes: [] as unknown[],
  selectedId: null as string | null,
  setSelectedNoteId: vi.fn(),
  restoreNote: vi.fn(),
  permanentDeleteNote: vi.fn(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useMediaQuery: () => true,
    useSyncDomains: () => 0,
    useNotesUnifiedContext: () => ({
      notes: state.notes,
      deletedNotes: state.deletedNotes,
      selectedNote:
        (state.notes as NoteNode[]).find((n) => n.id === state.selectedId) ??
        null,
      setSelectedNoteId: state.setSelectedNoteId,
      isLoading: false,
      error: null,
      searchQuery: "",
      setSearchQuery: vi.fn(),
      sortMode: "updatedAt",
      setSortMode: vi.fn(),
      sortDirection: "asc",
      setSortDirection: vi.fn(),
      isContentLoaded: () => true,
      createNote: vi.fn(),
      softDeleteNote: vi.fn(),
      restoreNote: state.restoreNote,
      permanentDeleteNote: state.permanentDeleteNote,
      updateNote: vi.fn(),
      togglePin: vi.fn(),
      setNotePassword: vi.fn(),
      removeNotePassword: vi.fn(),
      verifyNotePassword: vi.fn(),
    }),
    useWikiTagsUnifiedContext: () => ({
      allTags: [],
      getTagsForItem: () => [],
      assignTagToItem: vi.fn(),
    }),
    useRightSidebarContext: () => ({ open: vi.fn(), close: vi.fn() }),
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

vi.mock("../src/notes/RichTextEditor", () => ({
  RichTextEditor: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="editor">{placeholder}</div>
  ),
}));

vi.mock("../src/wikitag", () => ({
  TagPicker: () => <div data-testid="tag-picker" />,
  LinkPanel: () => <div data-testid="link-panel" />,
}));

function note(over: Partial<NoteNode> & { id: string }): NoteNode {
  return {
    type: "note",
    title: "Untitled",
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  } as NoteNode;
}

const ALPHA = note({ id: "note-a", title: "Alpha" });

beforeEach(async () => {
  state.notes = [ALPHA];
  state.deletedNotes = [];
  state.selectedId = null;
  state.setSelectedNoteId.mockClear();
  await i18n.changeLanguage("ja");
});

// The singleton outlives this file; leave it on the default the others expect.
afterAll(async () => {
  await i18n.changeLanguage("en");
});

describe("Notes i18n — body placeholder (#680)", () => {
  it("hands the editor a translated placeholder", () => {
    state.selectedId = "note-a";
    render(<NotesView />);

    expect(screen.getByTestId("editor").textContent).toBe("ノートを書く…");
  });

  it("hands it the English copy under en", async () => {
    await i18n.changeLanguage("en");
    state.selectedId = "note-a";
    render(<NotesView />);

    expect(screen.getByTestId("editor").textContent).toBe("Write your note…");
  });
});

/*
 * #1843 — the password dialog's copy.
 *
 * It lived in a module constant of English strings, which is invisible to
 * notesView.test.tsx: an echoed key and a hardcoded English label look exactly
 * alike to an assertion that reads the key back. This suite runs the real
 * i18next singleton, which is the only place a missing translation shows.
 */
describe("Notes i18n — password dialog (#1843)", () => {
  const LOCKED = note({ id: "note-locked", title: "Locked", hasPassword: true } as Partial<NoteNode> & { id: string });

  function openUnlockDialog(): HTMLElement {
    state.notes = [LOCKED];
    state.selectedId = "note-locked";
    render(<NotesView />);
    // The gate's CTA is labelled with the hint, so the label comes from the
    // catalog rather than being spelled out here — a reworded hint should not
    // fail this test.
    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("materials.notes.lockedHint"),
      }),
    );
    return screen.getByRole("dialog");
  }

  it("asks for the password in Japanese", () => {
    const dialog = openUnlockDialog();

    within(dialog).getByText("ノートのロックを解除");
    within(dialog).getByLabelText("現在のパスワード");
    within(dialog).getByRole("button", { name: "確認" });
    within(dialog).getByRole("button", { name: "キャンセル" });
  });

  it("asks for it in English under en", async () => {
    await i18n.changeLanguage("en");
    const dialog = openUnlockDialog();

    within(dialog).getByText("Unlock note");
    within(dialog).getByLabelText("Current password");
    within(dialog).getByRole("button", { name: "Confirm" });
    within(dialog).getByRole("button", { name: "Cancel" });
  });

  it("reads the empty-field error in Japanese", () => {
    const dialog = openUnlockDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "確認" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "パスワードを入力してください。",
    );
  });

  it("has a Japanese line for the modes nothing can open yet", () => {
    // set / remove are wired in the dialog and unreachable from the UI (the
    // decision about whether to give them an entry point is queued, #1843), so
    // the catalog is the only place their copy can be checked. A key that is
    // missing comes back as its own name.
    for (const [key, ja] of [
      ["setTitle", "ノートにパスワードを設定"],
      ["removeTitle", "ノートのパスワードを解除"],
      ["passwordLabel", "パスワード"],
      ["confirmPasswordLabel", "パスワード（確認）"],
      ["mismatch", "パスワードが一致しません。"],
      ["wrongPassword", "パスワードが正しくありません。"],
      ["busy", "処理中…"],
      ["saveFailed", "保存できませんでした。もう一度お試しください。"],
    ] as const) {
      expect(i18n.t(`materials.notes.password.${key}`)).toBe(ja);
    }
  });
});

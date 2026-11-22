import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { i18n, type NoteNode } from "@life-editor/shared";
import { NotesView } from "../src/notes/NotesView";

/*
 * #2585 — the locked note's "unlock" button, from the screen that hosts it.
 * The gate's own drawing is covered in shared/tests/lockedBodyGate.test.tsx;
 * what can only break here is the wiring: the label reaching the gate at both
 * widths, the press reaching the password dialog, and the body staying out of
 * the DOM until the password is right (#1763).
 *
 * The real i18next singleton is kept (a key-echo stub would pass with the key
 * missing from a catalog); the context hooks are faked for the same reason as
 * in notesI18n.test.tsx — the real ones need Providers and a network.
 */

const state = vi.hoisted(() => ({
  isWide: true,
  notes: [] as unknown[],
  verifyNotePassword: vi.fn(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useMediaQuery: () => state.isWide,
    useSyncDomains: () => 0,
    useNotesUnifiedContext: () => ({
      saveNoteBody: vi.fn(async () => ({ status: "saved", updatedAt: "" })),
      fetchNoteBodySnapshot: vi.fn(async () => null),
      replaceNoteBody: vi.fn(async () => true),
      adoptNoteBody: vi.fn(),
      serverStampOf: () => null,
      notes: state.notes,
      deletedNotes: [],
      selectedNote: (state.notes as NoteNode[])[0] ?? null,
      setSelectedNoteId: vi.fn(),
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
      restoreNote: vi.fn(),
      permanentDeleteNote: vi.fn(),
      updateNote: vi.fn(),
      togglePin: vi.fn(),
      setNotePassword: vi.fn(),
      removeNotePassword: vi.fn(),
      verifyNotePassword: state.verifyNotePassword,
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
  RichTextEditor: () => <div data-testid="editor" />,
}));

vi.mock("../src/wikitag", () => ({
  TagPicker: () => <div data-testid="tag-picker" />,
  LinkPanel: () => <div data-testid="link-panel" />,
}));

const BODY = "a body that must stay behind the lock";

const LOCKED = {
  id: "note-locked",
  type: "note",
  title: "Sealed",
  // A real locked note arrives with an empty body (#1763). One is put here so
  // the test would catch the gate drawing its children's text as the stand-in.
  content: BODY,
  parentId: null,
  order: 0,
  isPinned: false,
  isDeleted: false,
  hasPassword: true,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
} as NoteNode;

beforeEach(async () => {
  state.isWide = true;
  state.notes = [LOCKED];
  state.verifyNotePassword.mockReset();
  await i18n.changeLanguage("ja");
});

// The singleton outlives this file; leave it on the default the others expect.
afterAll(async () => {
  await i18n.changeLanguage("en");
});

function submitPassword(password: string): void {
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("現在のパスワード"), {
    target: { value: password },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "確認" }));
}

describe("Locked note — the unlock button (#2585)", () => {
  it.each([
    ["wide", true],
    ["narrow", false],
  ])("draws the stand-in and the unlock button on %s", (_, isWide) => {
    state.isWide = isWide;
    render(<NotesView />);

    screen.getByRole("button", { name: "ロックを解除" });
    const placeholder = screen.getByTestId("locked-body-placeholder");
    expect(placeholder.textContent).toBe("");
    const gate = placeholder.parentElement as HTMLElement;
    within(gate).getByText("このノートはロックされています");
    expect(gate.textContent).not.toContain(BODY);
    expect(screen.queryByTestId("editor")).toBeNull();
  });

  it("names the button in English under en", async () => {
    await i18n.changeLanguage("en");
    render(<NotesView />);

    screen.getByRole("button", { name: "Unlock" });
  });

  it("opens the password dialog and uncovers the body on the right password", async () => {
    state.verifyNotePassword.mockResolvedValue(true);
    render(<NotesView />);

    fireEvent.click(screen.getByRole("button", { name: "ロックを解除" }));
    submitPassword("open sesame");

    await screen.findByTestId("editor");
    expect(state.verifyNotePassword).toHaveBeenCalledWith(
      "note-locked",
      "open sesame",
    );
    expect(screen.queryByTestId("locked-body-placeholder")).toBeNull();
    expect(screen.queryByRole("button", { name: "ロックを解除" })).toBeNull();
  });

  it("stays covered on a wrong password", async () => {
    state.verifyNotePassword.mockResolvedValue(false);
    render(<NotesView />);

    fireEvent.click(screen.getByRole("button", { name: "ロックを解除" }));
    submitPassword("nope");

    await screen.findByText("パスワードが正しくありません。");
    expect(screen.queryByTestId("editor")).toBeNull();
    screen.getByTestId("locked-body-placeholder");
  });

  it("still opens the dialog from a press elsewhere on the cover", () => {
    render(<NotesView />);

    fireEvent.click(screen.getByText("このノートはロックされています"));
    screen.getByRole("dialog");
  });
});

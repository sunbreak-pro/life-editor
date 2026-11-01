import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, renderHook, screen, fireEvent } from "@testing-library/react";
import en from "../../shared/src/i18n/locales/en.json";
import ja from "../../shared/src/i18n/locales/ja.json";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { useShellChrome } from "../src/hooks/useShellChrome";

/*
 * #2335 — the band and the sidebar's sign-out prompt, as the user meets them.
 * The counts come from a stand-in for the outbox's store; the store itself is
 * covered in shared/tests/outbox.test.ts.
 */

const state = vi.hoisted(() => ({
  counts: { pending: 0, failed: 0 },
  readFailedOutboxCopy: vi.fn(),
  removeFailedOutboxEntries: vi.fn(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts?.n === undefined ? key : `${key}|${String(opts.n)}`,
    }),
    getOutboxCounts: () => state.counts,
    subscribeOutbox: () => () => {},
    readFailedOutboxCopy: state.readFailedOutboxCopy,
    removeFailedOutboxEntries: state.removeFailedOutboxEntries,
  };
});

const setOnline = (value: boolean) =>
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);

const writeText = vi.fn();

beforeEach(() => {
  state.counts = { pending: 0, failed: 0 };
  state.readFailedOutboxCopy.mockResolvedValue({
    text: "title a\n\ntitle b",
    opIds: ["op-a", "op-b"],
  });
  state.removeFailedOutboxEntries.mockReset();
  state.removeFailedOutboxEntries.mockResolvedValue(undefined);
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});
afterEach(() => vi.restoreAllMocks());

const press = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });

describe("OfflineBanner", () => {
  it("draws nothing online with an empty box", () => {
    setOnline(true);
    const { container } = render(<OfflineBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("says offline, with the count when Todos wait", () => {
    setOnline(false);
    state.counts = { pending: 2, failed: 0 };
    render(<OfflineBanner />);
    expect(screen.getByRole("status").textContent).toBe(
      "offline.message offline.pending|2",
    );
  });

  it("keeps the count on screen after coming back online", () => {
    setOnline(true);
    state.counts = { pending: 1, failed: 0 };
    render(<OfflineBanner />);
    expect(screen.getByRole("status").textContent).toBe("offline.pending|1");
  });

  it("copies a failed Todo's text, and only then offers to remove it", async () => {
    setOnline(true);
    state.counts = { pending: 0, failed: 2 };
    render(<OfflineBanner />);
    expect(screen.queryByRole("button", { name: "offline.remove" })).toBeNull();

    await press("offline.copy");
    expect(writeText).toHaveBeenCalledWith("title a\n\ntitle b");

    await press("offline.remove");
    expect(state.removeFailedOutboxEntries).toHaveBeenCalledTimes(1);
    expect(state.removeFailedOutboxEntries).toHaveBeenCalledWith([
      "op-a",
      "op-b",
    ]);
  });

  it("asks for a new copy when another Todo is refused after the first", async () => {
    setOnline(true);
    state.counts = { pending: 0, failed: 2 };
    const { rerender } = render(<OfflineBanner />);
    await press("offline.copy");
    screen.getByRole("button", { name: "offline.remove" });

    state.counts = { pending: 0, failed: 3 };
    rerender(<OfflineBanner />);
    expect(screen.queryByRole("button", { name: "offline.remove" })).toBeNull();
    screen.getByRole("button", { name: "offline.copy" });
    expect(state.removeFailedOutboxEntries).not.toHaveBeenCalled();
  });

  it("does not claim a copy the clipboard refused, and holds Remove back", async () => {
    setOnline(true);
    state.counts = { pending: 0, failed: 2 };
    writeText.mockRejectedValue(new Error("denied"));
    render(<OfflineBanner />);
    await press("offline.copy");

    const text = screen.getByText(/title a/);
    const band = screen.getByRole("status").textContent ?? "";
    expect(band).toContain("offline.failedCopyManual|2");
    expect(band).not.toContain("offline.failedCopied");
    expect(screen.queryByRole("button", { name: "offline.remove" })).toBeNull();

    // The hand copy is the user acting: now it may go.
    fireEvent.copy(text);
    await press("offline.remove");
    expect(state.removeFailedOutboxEntries).toHaveBeenCalledWith([
      "op-a",
      "op-b",
    ]);
  });

  it("gives its button a 44px target on narrow widths", async () => {
    setOnline(true);
    state.counts = { pending: 0, failed: 1 };
    render(<OfflineBanner />);
    const copy = screen.getByRole("button", { name: "offline.copy" });
    expect(copy.className).toContain("max-md:min-h-11");
    expect(copy.className).toContain("max-md:min-w-11");
  });

  it("promises no more than a Todo add, in both catalogs", () => {
    expect(en.offline.message).toContain("Todo");
    expect(ja.offline.message).toContain("Todo");
    expect(Object.keys(ja.offline)).toEqual(Object.keys(en.offline));
    expect(en.nav.signOutPromptPending).toContain("{{n}}");
    expect(ja.nav.signOutPromptPending).toContain("{{n}}");
  });
});

describe("the sidebar's sign-out prompt", () => {
  const prompt = () =>
    renderHook(() =>
      useShellChrome({ setSection: () => {}, setMaterialsTab: () => {} }),
    ).result.current.shellLabels.signOutPrompt;

  it("is the plain question with nothing waiting", () => {
    expect(prompt()).toBe("nav.signOutPrompt");
  });

  it("says the count when Todos wait", () => {
    state.counts = { pending: 3, failed: 0 };
    expect(prompt()).toBe("nav.signOutPromptPending|3");
  });
});

import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useBodySyncSession,
  type BodyRemote,
  type BodySaveOutcome,
  type UseBodySyncSessionOptions,
} from "../src/hooks/useBodySyncSession";
import { docBlocks, blockText } from "../src/utils/blockMerge";

/*
 * #2057 — the editor-side half of the version-checked note save.
 *
 * NOTE-SYNC-1  a write from elsewhere replaces the body when nothing is pending
 * NOTE-SYNC-2  our own save's echo is not mistaken for a write from elsewhere
 * NOTE-SYNC-3  a write from elsewhere while something IS pending raises a
 *              conflict, and each of the three choices lands as promised
 * NOTE-SYNC-4  a refused save keeps the user's text and becomes a conflict
 */

const p = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const doc = (...lines: string[]) =>
  JSON.stringify({ type: "doc", content: lines.map(p) });
const texts = (body: string) => docBlocks(body).map(blockText);

const V0 = "2026-10-01T09:00:00+00:00";
const V1 = "2026-10-01T09:09:00+00:00";
const V2 = "2026-10-01T09:12:00+00:00";

interface Harness {
  save: ReturnType<
    typeof vi.fn<
      (content: string, expected: string | null) => Promise<BodySaveOutcome>
    >
  >;
  fetchCurrent: ReturnType<typeof vi.fn<() => Promise<BodyRemote | null>>>;
  editor: { body: string };
  onAdopted: ReturnType<typeof vi.fn<(content: string) => void>>;
  onSaved: ReturnType<typeof vi.fn<(content: string) => void>>;
}

/**
 * `onServer` answers the read made when the session opens (it checks the
 * opened body against the server once); absent = no such read result.
 */
function setup(initial = doc("a", "b"), onServer: BodyRemote | null = null) {
  const h: Harness = {
    save: vi.fn<
      (content: string, expected: string | null) => Promise<BodySaveOutcome>
    >(async () => ({
      status: "saved" as const,
      updatedAt: V2,
    })),
    fetchCurrent: vi.fn<() => Promise<BodyRemote | null>>(async () => onServer),
    editor: { body: initial },
    onAdopted: vi.fn<(content: string) => void>(),
    onSaved: vi.fn<(content: string) => void>(),
  };
  const options = (remoteUpdatedAt: string | null) =>
    ({
      initial: { content: initial, updatedAt: V0 },
      remoteUpdatedAt,
      save: h.save,
      fetchCurrent: h.fetchCurrent,
      readEditor: () => h.editor.body,
      onAdopted: h.onAdopted,
      onSaved: h.onSaved,
    }) satisfies UseBodySyncSessionOptions;
  const view = renderHook(
    ({ remote }: { remote: string | null }) =>
      useBodySyncSession(options(remote)),
    { initialProps: { remote: V0 } },
  );
  return { h, view };
}

describe("saving against a version", () => {
  it("names the opened version, then the version each save leaves", async () => {
    const { h, view } = setup();
    act(() => view.result.current.commit(doc("a", "b", "c")));
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    expect(h.save.mock.calls[0][1]).toBe(V0);

    act(() => view.result.current.commit(doc("a", "b", "c", "d")));
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(2));
    expect(h.save.mock.calls[1][1]).toBe(V2);
  });

  it("retries quietly when only the version moved (a rename elsewhere)", async () => {
    const { h, view } = setup();
    h.save
      .mockResolvedValueOnce({
        status: "conflict",
        current: { content: doc("a", "b"), updatedAt: V1 },
      })
      .mockResolvedValueOnce({ status: "saved", updatedAt: V2 });

    act(() => view.result.current.commit(doc("a", "b", "mine")));

    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(2));
    expect(h.save.mock.calls[1]).toEqual([doc("a", "b", "mine"), V1]);
    expect(view.result.current.conflict).toBeNull();
  });
});

describe("NOTE-SYNC-1 / -2 — writes from elsewhere", () => {
  it("replaces the body when nothing is pending", async () => {
    const { h, view } = setup();
    h.fetchCurrent.mockResolvedValue({ content: doc("a", "B"), updatedAt: V1 });

    view.rerender({ remote: V1 });

    await waitFor(() =>
      expect(view.result.current.replacement?.content).toBe(doc("a", "B")),
    );
    // The base moves only once the editor reports the body applied.
    expect(h.onAdopted).not.toHaveBeenCalled();
    act(() => view.result.current.replacement?.onSettled(true));
    expect(h.onAdopted).toHaveBeenCalledWith(doc("a", "B"));
    expect(view.result.current.conflict).toBeNull();
  });

  it("turns into a conflict when the editor reports typing in between", async () => {
    const { h, view } = setup();
    h.fetchCurrent.mockResolvedValue({ content: doc("a", "B"), updatedAt: V1 });
    view.rerender({ remote: V1 });
    await waitFor(() => expect(view.result.current.replacement).not.toBeNull());

    // An IME composition committed text before the editor could apply it.
    h.editor.body = doc("a", "b", "typed");
    act(() => view.result.current.markDirty());
    expect(view.result.current.replacement?.canApply()).toBe(false);
    act(() => view.result.current.replacement?.onSettled(false));

    expect(view.result.current.conflict?.mine).toBe(doc("a", "b", "typed"));
    expect(h.onAdopted).not.toHaveBeenCalled();
    // The typing is saved against nothing until the user chooses.
    act(() => view.result.current.commit(doc("a", "b", "typed")));
    await act(async () => {});
    expect(h.save).not.toHaveBeenCalled();
  });

  it("does not read the server back for its own save's echo", async () => {
    const { h, view } = setup();
    act(() => view.result.current.commit(doc("a", "b", "c")));
    await waitFor(() => expect(h.onSaved).toHaveBeenCalled());

    // The one read is the check made on open.
    const readsBefore = h.fetchCurrent.mock.calls.length;
    // The list reload after our save carries the version our save returned.
    view.rerender({ remote: V2 });

    await act(async () => {});
    expect(h.fetchCurrent.mock.calls.length).toBe(readsBefore);
    expect(view.result.current.replacement).toBeNull();
  });

  it("ignores a version move that left the body as it was", async () => {
    const { h, view } = setup();
    h.fetchCurrent.mockResolvedValue({ content: doc("a", "b"), updatedAt: V1 });

    view.rerender({ remote: V1 });

    await waitFor(() => expect(h.fetchCurrent).toHaveBeenCalled());
    expect(view.result.current.replacement).toBeNull();
    // …and the next save is made against the new version.
    act(() => view.result.current.commit(doc("a", "b", "c")));
    await waitFor(() => expect(h.save).toHaveBeenCalled());
    expect(h.save.mock.calls[0][1]).toBe(V1);
  });
});

describe("NOTE-SYNC-3 — a write from elsewhere while typing", () => {
  async function conflicted() {
    const s = setup(doc("intro", "line"));
    s.h.fetchCurrent.mockResolvedValue({
      content: doc("intro", "their line"),
      updatedAt: V1,
    });
    act(() => s.view.result.current.markDirty());
    s.h.editor.body = doc("intro", "my line");
    s.view.rerender({ remote: V1 });
    await waitFor(() => expect(s.view.result.current.conflict).not.toBeNull());
    return s;
  }

  it("raises the conflict and holds the save until a choice is made", async () => {
    const { h, view } = await conflicted();
    act(() => view.result.current.commit(doc("intro", "my line")));
    await act(async () => {});
    expect(h.save).not.toHaveBeenCalled();
    expect(view.result.current.replacement).toBeNull();
    expect(view.result.current.conflict?.merge.hasConflict).toBe(true);
  });

  it("keep mine: saves my body over the other version", async () => {
    const { h, view } = await conflicted();
    act(() => view.result.current.resolve("mine"));
    await waitFor(() => expect(h.save).toHaveBeenCalled());
    expect(h.save.mock.calls[0]).toEqual([doc("intro", "my line"), V1]);
    expect(view.result.current.conflict).toBeNull();
  });

  it("take theirs: shows the other version and saves nothing", async () => {
    const { h, view } = await conflicted();
    act(() => view.result.current.resolve("theirs"));
    expect(view.result.current.replacement?.content).toBe(
      doc("intro", "their line"),
    );
    expect(h.onAdopted).toHaveBeenCalledWith(doc("intro", "their line"));
    await act(async () => {});
    expect(h.save).not.toHaveBeenCalled();
  });

  it("keep both: shows and saves the block-merged body", async () => {
    const { h, view } = await conflicted();
    act(() => view.result.current.resolve("both"));
    const merged = view.result.current.replacement?.content ?? "";
    expect(texts(merged)).toEqual(["intro", "my line", "their line"]);
    await waitFor(() => expect(h.save).toHaveBeenCalled());
    expect(h.save.mock.calls[0]).toEqual([merged, V1]);
  });
});

describe("NOTE-SYNC-4 — a refused save", () => {
  it("keeps the user's text and turns into a conflict", async () => {
    const { h, view } = setup(doc("a"));
    h.save.mockResolvedValueOnce({
      status: "conflict",
      current: { content: doc("a", "from MCP"), updatedAt: V1 },
    });
    h.editor.body = doc("a", "typed");

    act(() => view.result.current.commit(doc("a", "typed")));

    await waitFor(() => expect(view.result.current.conflict).not.toBeNull());
    expect(view.result.current.conflict?.mine).toBe(doc("a", "typed"));
    expect(view.result.current.replacement).toBeNull();
  });
});

describe("a read that predates our own save", () => {
  it("is dropped, not mistaken for a write from elsewhere", async () => {
    const { h, view } = setup(doc("a"));
    await waitFor(() => expect(h.fetchCurrent).toHaveBeenCalledTimes(1));
    // A late list reload announces an OLD version; its read is slow.
    let answer: (v: BodyRemote | null) => void = () => {};
    h.fetchCurrent.mockImplementationOnce(
      () => new Promise((resolve) => (answer = resolve)),
    );
    view.rerender({ remote: V1 });
    await waitFor(() => expect(h.fetchCurrent).toHaveBeenCalledTimes(2));

    // Our next save lands while that read is still out.
    act(() => view.result.current.commit(doc("a", "typed")));
    await waitFor(() => expect(h.onSaved).toHaveBeenCalled());

    // The read finally answers with our own older body.
    await act(async () => answer({ content: doc("a"), updatedAt: V1 }));

    expect(view.result.current.replacement).toBeNull();
    expect(view.result.current.conflict).toBeNull();
  });
});

describe("opening a body whose version does not belong to it", () => {
  it("asks instead of saving it against that version", async () => {
    // Same version as the opened one, different body: the pair was broken by
    // a save that never landed.
    const { view } = setup(doc("unsaved mine"), {
      content: doc("theirs"),
      updatedAt: V0,
    });
    await waitFor(() => expect(view.result.current.conflict).not.toBeNull());
    // No common base: "keep both" keeps every block of each side.
    act(() => view.result.current.resolve("both"));
    expect(texts(view.result.current.replacement?.content ?? "")).toEqual([
      "unsaved mine",
      "theirs",
    ]);
  });

  it("stays quiet when the opened body is the server's", async () => {
    const { h, view } = setup(doc("a"), { content: doc("a"), updatedAt: V0 });
    await waitFor(() => expect(h.fetchCurrent).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(view.result.current.conflict).toBeNull();
    expect(view.result.current.replacement).toBeNull();
  });
});

describe("leaving with a conflict open", () => {
  it("settles it as keep-both so neither side is lost", async () => {
    const { h, view } = setup(doc("x"));
    h.fetchCurrent.mockResolvedValue({
      content: doc("x", "theirs"),
      updatedAt: V1,
    });
    act(() => view.result.current.markDirty());
    h.editor.body = doc("x", "mine");
    view.rerender({ remote: V1 });
    await waitFor(() => expect(view.result.current.conflict).not.toBeNull());

    view.unmount();

    await waitFor(() => expect(h.save).toHaveBeenCalled());
    const [body, expected] = h.save.mock.calls[0];
    expect(texts(body)).toEqual(["x", "mine", "theirs"]);
    expect(expected).toBe(V1);
  });
});

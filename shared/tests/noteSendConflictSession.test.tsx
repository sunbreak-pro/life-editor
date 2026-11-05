import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  useBodySyncSession,
  type BodySaveOutcome,
} from "../src/hooks/useBodySyncSession";
import { docBlocks, blockText } from "../src/utils/blockMerge";

/*
 * #2337 — the outbox's send found a conflict on the note open here. It has
 * already kept this body in a separate note, so the banner is the same one, and
 * only leaving without a choice differs: the server's version stays.
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

const BASE = doc("base");
const MINE = doc("mine");
const THEIRS = { content: doc("theirs"), updatedAt: V1 };

function setup() {
  const editor = { body: MINE };
  let stored = { content: MINE, updatedAt: V0 };
  const save = vi.fn(
    async (): Promise<BodySaveOutcome> => ({
      status: "saved",
      updatedAt: "2026-10-01T09:20:00+00:00",
    }),
  );
  const onAdopted = vi.fn();
  const view = renderHook(() =>
    useBodySyncSession({
      initial: { content: MINE, updatedAt: V0 },
      remoteUpdatedAt: V0,
      save,
      fetchCurrent: async () => stored,
      readEditor: () => editor.body,
      onAdopted,
    }),
  );
  const raise = () =>
    act(async () => {
      stored = THEIRS;
      view.result.current.raiseConflict({
        base: BASE,
        mine: MINE,
        theirs: THEIRS,
      });
    });
  return { view, editor, save, onAdopted, raise };
}

describe("raiseConflict", () => {
  it("raises the banner with the base the send compared against", async () => {
    const { view, raise } = setup();
    await raise();
    const { conflict } = view.result.current;
    expect(conflict?.base).toBe(BASE);
    expect(conflict?.mine).toBe(MINE);
    expect(conflict?.theirs).toEqual(THEIRS);
    expect(conflict?.merge.hasConflict).toBe(true);
  });

  it("holds saves while the choice is open, and each choice lands", async () => {
    const { view, save, raise } = setup();
    await raise();
    await act(async () => view.result.current.commit(doc("mine", "typed")));
    expect(save).not.toHaveBeenCalled();

    await act(async () => view.result.current.resolve("theirs"));
    expect(view.result.current.conflict).toBeNull();
    expect(view.result.current.replacement?.content).toBe(THEIRS.content);
    expect(save).not.toHaveBeenCalled();
  });

  it("'keep mine' writes against the server's version", async () => {
    const { view, save, raise } = setup();
    await raise();
    await act(async () => view.result.current.resolve("mine"));
    await waitFor(() => expect(save).toHaveBeenCalledWith(MINE, V1));
  });

  it("leaving without a choice leaves the server's version alone", async () => {
    const { view, save, onAdopted, raise } = setup();
    await raise();
    view.unmount();
    await act(async () => {});
    expect(save).not.toHaveBeenCalled();
    expect(onAdopted).toHaveBeenCalledWith(THEIRS.content);
  });

  it("leaving with new typing still keeps both", async () => {
    const { view, save, raise } = setup();
    await raise();
    await act(async () => view.result.current.commit(doc("mine", "typed")));
    view.unmount();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const body = (save.mock.calls[0] as unknown as [string])[0];
    expect(texts(body)).toEqual(
      expect.arrayContaining(["mine", "typed", "theirs"]),
    );
  });

  it("flushes last keystrokes on the way out without overwriting the server", async () => {
    const { view, save, raise } = setup();
    await raise();
    const { commit } = view.result.current;
    view.unmount();
    await act(async () => commit(doc("mine", "flushed")));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const body = (save.mock.calls[0] as unknown as [string])[0];
    expect(texts(body)).toEqual(
      expect.arrayContaining(["mine", "flushed", "theirs"]),
    );
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/*
 * LinkPanel's #749 rewrite: the two things the old panel could not do.
 *
 *   1. ADD BY TITLE. The former input took an `items_meta.id`, so linking to
 *      anything meant knowing its id. The picker filters the cross-role pool by
 *      title and hands `createItemLink` the id behind the row the user chose —
 *      including for roles the Notes context cannot see (a Todo).
 *   2. OPEN A LINK. Rows were a <span> / an <li>; a click did nothing. They are
 *      buttons now and emit the same `{ id, role }` navigation intent a "[["
 *      link click emits (#475).
 *
 * Keyboard-only add is covered too (↑/↓/Enter), since that is the path the IME
 * guard sits on: `isImeComposing` is the REAL helper here, not a stub, so a
 * regression that reads `event.isComposing` directly would still pass — what
 * this suite protects is that Enter commits the highlighted row at all.
 *
 * Only the wiki-tag context is faked (the real one needs a Provider, a
 * DataService and a network). i18next stays real: the panel reads its copy from
 * the catalog, and asserting through `i18n.t` keeps a hardcoded English string
 * from sneaking back in.
 */

const state = vi.hoisted(() => ({
  outgoing: [] as unknown[],
  incoming: [] as unknown[],
  // #1172: the related popover derives "shares a tag" from the same bulk
  // assignment cache TagPicker reads, so the fake context has to carry it.
  assignments: [] as unknown[],
  tagsForItem: [] as unknown[],
  loading: false,
  createItemLink: vi.fn(() => Promise.resolve()),
  // Typed signature, not a bare `vi.fn(() => …)`: the #884 suite reads
  // `mock.calls[n][0]` to assert WHICH link rows a chip removal deleted, and an
  // argument-less mock types its calls as the empty tuple.
  deleteItemLink: vi.fn<(linkId: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useWikiTagsUnifiedContext: () => ({
      loading: state.loading,
      allAssignments: state.assignments,
      getTagsForItem: () => state.tagsForItem,
      getLinksForItem: () => ({
        outgoing: state.outgoing,
        incoming: state.incoming,
      }),
      createItemLink: state.createItemLink,
      deleteItemLink: state.deleteItemLink,
    }),
  };
});

const { i18n } = await import("@life-editor/shared");
const { LinkPanel } = await import("../src/wikitag/LinkPanel");

const TARGETS = [
  { id: "note-2", label: "Kitchen rebuild", role: "note" },
  { id: "task-9", label: "Order the tiles", role: "task" },
  { id: "daily-2026-08-12", label: "2026-08-12", role: "daily" },
];

const loadTargets = vi.fn(() => Promise.resolve(TARGETS));

function link(over: { id: string; from?: string; to?: string }) {
  return {
    id: over.id,
    fromItemId: over.from ?? "note-1",
    toItemId: over.to ?? "note-2",
    origin: "manual",
    isDeleted: false,
  };
}

/** Opens the picker and waits for the (async) candidate pool to land. */
async function openPicker(): Promise<HTMLElement> {
  fireEvent.click(
    screen.getByRole("button", { name: i18n.t("materials.links.add") }),
  );
  return await screen.findByRole("combobox");
}

beforeEach(() => {
  state.outgoing = [];
  state.incoming = [];
  state.assignments = [];
  state.tagsForItem = [];
  state.loading = false;
  state.createItemLink.mockClear();
  state.deleteItemLink.mockClear();
  loadTargets.mockClear();
});

describe("LinkPanel — add by title (#749)", () => {
  it("links the item behind the picked row, not the typed text", async () => {
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);
    const input = await openPicker();

    fireEvent.change(input, { target: { value: "tiles" } });

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain("Order the tiles");

    fireEvent.click(options[0]);

    await waitFor(() =>
      expect(state.createItemLink).toHaveBeenCalledExactlyOnceWith(
        "note-1",
        "task-9",
      ),
    );
  });

  it("commits the highlighted row with ↑/↓ + Enter", async () => {
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);
    const input = await openPicker();
    await screen.findAllByRole("option");

    // Down twice from the first row: note-2 → task-9 → daily.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(state.createItemLink).toHaveBeenCalledExactlyOnceWith(
        "note-1",
        "task-9",
      ),
    );
  });

  it("hides the item itself and anything already linked", async () => {
    state.outgoing = [link({ id: "l1", to: "note-2" })];
    render(
      <LinkPanel
        itemId="daily-2026-08-12"
        loadTargets={loadTargets}
        onNavigateToItem={vi.fn()}
      />,
    );
    await openPicker();

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Order the tiles"),
    ]);
  });

  it("closes on Escape without linking anything", async () => {
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);
    const input = await openPicker();

    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(state.createItemLink).not.toHaveBeenCalled();
  });
});

describe("LinkPanel — rows open their target (#749)", () => {
  it("emits the navigation intent for an outgoing row", async () => {
    state.outgoing = [link({ id: "l1", to: "task-9" })];
    const onNavigateToItem = vi.fn();
    render(
      <LinkPanel
        itemId="note-1"
        loadTargets={loadTargets}
        onNavigateToItem={onNavigateToItem}
      />,
    );

    // The row's name resolves through the pool, so it appears once loaded.
    const row = await screen.findByRole("button", {
      name: i18n.t("materials.links.open", { title: "Order the tiles" }),
    });
    fireEvent.click(row);

    expect(onNavigateToItem).toHaveBeenCalledExactlyOnceWith({
      id: "task-9",
      role: "task",
    });
  });

  it("emits it for a backlink row too", async () => {
    state.incoming = [link({ id: "l2", from: "note-2", to: "note-1" })];
    const onNavigateToItem = vi.fn();
    render(
      <LinkPanel
        itemId="note-1"
        loadTargets={loadTargets}
        onNavigateToItem={onNavigateToItem}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: i18n.t("materials.links.open", { title: "Kitchen rebuild" }),
      }),
    );

    expect(onNavigateToItem).toHaveBeenCalledExactlyOnceWith({
      id: "note-2",
      role: "note",
    });
  });

  it("removes an outgoing link from its row", async () => {
    state.outgoing = [link({ id: "l1", to: "note-2" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: i18n.t("materials.links.remove", { title: "Kitchen rebuild" }),
      }),
    );

    expect(state.deleteItemLink).toHaveBeenCalledExactlyOnceWith("l1");
  });
});

describe("LinkPanel — direction is not part of the vocabulary (#884)", () => {
  it("shows a pair linked from both sides once, and removes both rows", async () => {
    state.outgoing = [link({ id: "l1", from: "note-1", to: "note-2" })];
    state.incoming = [link({ id: "l2", from: "note-2", to: "note-1" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);

    const remove = await screen.findAllByRole("button", {
      name: i18n.t("materials.links.remove", { title: "Kitchen rebuild" }),
    });
    expect(remove).toHaveLength(1);

    fireEvent.click(remove[0]);

    await waitFor(() => expect(state.deleteItemLink).toHaveBeenCalledTimes(2));
    expect(state.deleteItemLink.mock.calls.map((c) => c[0])).toEqual([
      "l1",
      "l2",
    ]);
  });

  it("offers a remove action on a backlink too", async () => {
    state.incoming = [link({ id: "l2", from: "note-2", to: "note-1" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: i18n.t("materials.links.remove", { title: "Kitchen rebuild" }),
      }),
    );

    expect(state.deleteItemLink).toHaveBeenCalledExactlyOnceWith("l2");
  });

  it("keeps an item already linked only inbound out of the picker", async () => {
    state.incoming = [link({ id: "l2", from: "note-2", to: "note-1" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);
    await openPicker();

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Order the tiles"),
      expect.stringContaining("2026-08-12"),
    ]);
  });
});

describe("LinkPanel — title resolution (#749)", () => {
  it("names a non-note target from the cross-role pool", async () => {
    state.outgoing = [link({ id: "l1", to: "daily-2026-08-12" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);

    expect(await screen.findByText("2026-08-12")).toBeTruthy();
  });

  it("prefers the host resolver, then falls back to an id fragment", async () => {
    state.outgoing = [
      link({ id: "l1", to: "note-2" }),
      link({ id: "l2", to: "event-abcdef12345678" }),
    ];
    render(
      <LinkPanel
        itemId="note-1"
        loadTargets={loadTargets}
        resolveTitle={(id) =>
          id === "note-2" ? "Renamed just now" : undefined
        }
      />,
    );

    expect(await screen.findByText("Renamed just now")).toBeTruthy();
    expect(screen.getByText("…12345678")).toBeTruthy();
  });
});

describe("LinkPanel — the refusal line (#1278)", () => {
  /*
   * A failed write is the only in-panel error a user can actually reach (the
   * self-link guard at handleAdd is unreachable from the picker, which already
   * filters `target.id !== itemId`), and until #1278 nothing asserted it at
   * all. What is worth pinning is not the copy but the ANNOUNCEMENT: the line
   * moved from a hand-typed role="alert" span to NoticePanel's tone-derived
   * live region, and a screen reader is the only place that difference shows.
   */
  it("announces a failed link and leaves the picker open", async () => {
    state.createItemLink.mockRejectedValueOnce(new Error("network is down"));
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);
    const input = await openPicker();

    fireEvent.change(input, { target: { value: "tiles" } });
    const options = await screen.findAllByRole("option");
    fireEvent.click(options[0]);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "network is down",
    );
    // The picker stays up: closePicker only runs on the success path, so the
    // retry is one click away rather than behind reopening the popover.
    expect(screen.getByRole("combobox")).toBeTruthy();
  });
});

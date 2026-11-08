import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

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
 * #2391 took the title and the X off the chip: it is a square with its kind's
 * icon now, named for the title. #2630 took the "linked" list out of the "+"
 * popover, so a link comes off from the chip's panel only.
 * jsdom has no layout, so what the design measures (the sizes, the 44px hit
 * area) is pinned as the classes that produce it.
 *
 * #2392 made the chip open a panel instead of the item, so a link is followed
 * from the panel's button here. What the panel itself does is
 * linkChipPopover.test.tsx.
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
  // The rows of one removal arrive together (#884): one press, one Undo (#2392).
  removeItemLinks: vi.fn<(linkIds: readonly string[]) => Promise<void>>(() =>
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
      removeItemLinks: state.removeItemLinks,
    }),
  };
});

const { i18n } = await import("@life-editor/shared");
const { LinkPanel } = await import("../src/wikitag/LinkPanel");

const TARGETS = [
  { id: "note-2", label: "Kitchen rebuild", role: "note" },
  { id: "task-9", label: "Order the tiles", role: "task" },
  { id: "daily-2026-08-12", label: "2026-08-12", role: "daily" },
  { id: "event-5", label: "Tile delivery", role: "event", date: "2026-08-20" },
];

/** The catalog's name for a kind. */
function kindName(role: string): string {
  const names: Record<string, string> = {
    note: i18n.t("itemRole.note"),
    daily: i18n.t("itemRole.daily"),
    event: i18n.t("itemRole.event"),
    task: i18n.t("itemRole.task"),
    unknown: i18n.t("itemRole.unknown"),
  };
  return names[role];
}

/** A chip's accessible name: the kind AND the title it no longer shows. */
/** Named at call time, after the suite has set the language. */
const unlinkLabel = (): string => i18n.t("materials.links.unlink");

function chipName(role: string, title: string): string {
  return i18n.t("materials.links.chipName", {
    kind: kindName(role),
    title,
  });
}

/** The icon inside a chip, by the class lucide stamps on it. */
function glyphOf(chip: Element): string {
  return chip.querySelector("svg")?.getAttribute("class") ?? "";
}

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

/** Pins a chip's panel, then follows the link from the panel's button. */
async function follow(role: string, title: string, buttonLabel: string) {
  fireEvent.click(
    await screen.findByRole("button", { name: chipName(role, title) }),
  );
  fireEvent.click(await screen.findByRole("button", { name: buttonLabel }));
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
  state.removeItemLinks.mockClear();
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
      expect.stringContaining("Tile delivery"),
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
    await follow(
      "task",
      "Order the tiles",
      i18n.t("scheduleScreen.openInSchedule"),
    );

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

    await follow(
      "note",
      "Kitchen rebuild",
      i18n.t("materials.links.openAction"),
    );

    expect(onNavigateToItem).toHaveBeenCalledExactlyOnceWith({
      id: "note-2",
      role: "note",
    });
  });

  it("hands an event's date to the route, which cannot select one without it", async () => {
    state.outgoing = [link({ id: "l1", to: "event-5" })];
    const onNavigateToItem = vi.fn();
    render(
      <LinkPanel
        itemId="note-1"
        loadTargets={loadTargets}
        onNavigateToItem={onNavigateToItem}
      />,
    );

    await follow(
      "event",
      "Tile delivery",
      i18n.t("scheduleScreen.openInSchedule"),
    );

    expect(onNavigateToItem).toHaveBeenCalledExactlyOnceWith({
      id: "event-5",
      role: "event",
      date: "2026-08-20",
    });
  });

  it("removes an outgoing link from the chip's panel", async () => {
    state.outgoing = [link({ id: "l1", to: "note-2" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);

    await follow("note", "Kitchen rebuild", unlinkLabel());

    expect(state.removeItemLinks).toHaveBeenCalledExactlyOnceWith(["l1"]);
  });

  it("only adds from the + popover: no linked list, and linked items stay out (#2630)", async () => {
    state.outgoing = [link({ id: "l1", to: "note-2" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);
    await openPicker();

    const options = await screen.findAllByRole("option");
    expect(options.some((o) => o.textContent?.includes("Kitchen rebuild"))).toBe(
      false,
    );
    const dialog = screen.getByRole("dialog", {
      name: i18n.t("materials.links.pickerDialog"),
    });
    expect(within(dialog).queryByText("Kitchen rebuild")).toBeNull();
    expect(within(dialog).queryByRole("list")).toBeNull();
    // The only buttons left are the candidates themselves.
    expect(
      within(dialog)
        .queryAllByRole("button")
        .filter((b) => b.getAttribute("role") !== "option"),
    ).toHaveLength(0);
  });
});

describe("LinkPanel — direction is not part of the vocabulary (#884)", () => {
  it("shows a pair linked from both sides once, and removes both rows", async () => {
    state.outgoing = [link({ id: "l1", from: "note-1", to: "note-2" })];
    state.incoming = [link({ id: "l2", from: "note-2", to: "note-1" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);

    const chips = await screen.findAllByRole("button", {
      name: chipName("note", "Kitchen rebuild"),
    });
    expect(chips).toHaveLength(1);

    await follow("note", "Kitchen rebuild", unlinkLabel());

    expect(state.removeItemLinks).toHaveBeenCalledExactlyOnceWith(["l1", "l2"]);
  });

  it("offers a remove action on a backlink too", async () => {
    state.incoming = [link({ id: "l2", from: "note-2", to: "note-1" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);

    await follow("note", "Kitchen rebuild", unlinkLabel());

    expect(state.removeItemLinks).toHaveBeenCalledExactlyOnceWith(["l2"]);
  });

  it("keeps an item already linked only inbound out of the picker", async () => {
    state.incoming = [link({ id: "l2", from: "note-2", to: "note-1" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);
    await openPicker();

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Order the tiles"),
      expect.stringContaining("2026-08-12"),
      expect.stringContaining("Tile delivery"),
    ]);
  });
});

describe("LinkPanel — title resolution (#749)", () => {
  it("names a non-note target from the cross-role pool", async () => {
    state.outgoing = [link({ id: "l1", to: "daily-2026-08-12" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);

    expect(
      await screen.findByRole("button", {
        name: chipName("daily", "2026-08-12"),
      }),
    ).toBeTruthy();
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

    expect(
      await screen.findByRole("button", {
        name: chipName("note", "Renamed just now"),
      }),
    ).toBeTruthy();
    // A target the pool cannot name: the fragment for the name, and the whole
    // id on the panel's title, since nothing else can identify it.
    fireEvent.click(
      screen.getByRole("button", {
        name: chipName("unknown", "…12345678"),
      }),
    );
    expect(screen.getByText("…12345678").getAttribute("title")).toBe(
      "event-abcdef12345678",
    );
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

/*
 * #1292 — a link whose target was deleted.
 *
 * The user-visible bug was the FALLBACK: `useItemLinkTargets` dropped
 * soft-deleted rows, so a chip pointing at a deleted todo had nothing to name
 * it by and printed a shortened id (`…56123478`) — reported as "the link turned
 * into a run of digits". The pool now flags deleted rows instead of hiding
 * them, which is what lets the chip keep the title AND say it is gone.
 *
 * The three assertions here are the three halves of that contract, and each is
 * a way the fix could regress into a different lie: name it, mark it, and never
 * offer it as a NEW link.
 */
const DELETED_TARGETS = [
  ...TARGETS,
  {
    id: "task-77",
    label: "Return the extra tiles",
    role: "task",
    isDeleted: true,
  },
];

describe("LinkPanel — deleted link target (#1292)", () => {
  const loadWithDeleted = vi.fn(() => Promise.resolve(DELETED_TARGETS));

  beforeEach(() => loadWithDeleted.mockClear());

  it("names a deleted target and marks it deleted instead of showing its id", async () => {
    state.outgoing = [link({ id: "l1", to: "task-77" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadWithDeleted} />);

    const label = i18n.t("materials.links.deletedTarget", {
      title: "Return the extra tiles",
    });
    const chip = await screen.findByRole("button", {
      name: chipName("task", label),
    });
    // A deleted target wears the trash, not its kind's icon.
    expect(glyphOf(chip)).toContain("lucide-trash");
  });

  it("does not open a deleted target", async () => {
    const onNavigateToItem = vi.fn();
    state.outgoing = [link({ id: "l1", to: "task-77" })];
    render(
      <LinkPanel
        itemId="note-1"
        loadTargets={loadWithDeleted}
        onNavigateToItem={onNavigateToItem}
      />,
    );

    const label = i18n.t("materials.links.deletedTarget", {
      title: "Return the extra tiles",
    });
    const chip = await screen.findByRole("button", {
      name: chipName("task", label),
    });
    // The chip still opens its panel, which is where the link comes off. The
    // panel has nothing that leads nowhere: no button to the item.
    fireEvent.click(chip);
    expect(
      await screen.findByRole("button", {
        name: i18n.t("materials.links.unlink"),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: i18n.t("scheduleScreen.openInSchedule"),
      }),
    ).toBeNull();
    expect(onNavigateToItem).not.toHaveBeenCalled();
  });

  it("can still be removed from its chip's panel", async () => {
    state.outgoing = [link({ id: "l1", to: "task-77" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadWithDeleted} />);

    const label = i18n.t("materials.links.deletedTarget", {
      title: "Return the extra tiles",
    });
    await follow("task", label, unlinkLabel());

    expect(state.removeItemLinks).toHaveBeenCalledExactlyOnceWith(["l1"]);
  });

  it("keeps a deleted item out of the picker's candidates", async () => {
    render(<LinkPanel itemId="note-1" loadTargets={loadWithDeleted} />);
    const input = await openPicker();

    fireEvent.change(input, { target: { value: "tiles" } });

    const options = await screen.findAllByRole("option");
    const titles = options.map((o) => o.textContent ?? "");
    expect(titles.some((tx) => tx.includes("Order the tiles"))).toBe(true);
    expect(titles.some((tx) => tx.includes("Return the extra tiles"))).toBe(
      false,
    );
  });
});

/*
 * #2391 — the row itself. Rule, count, one square per link, dashed "+", with the
 * kinds told apart by the shape and the color of the glyph alone.
 */
describe("LinkPanel — icon-only chips (#2391)", () => {
  const FOUR_KINDS = [
    link({ id: "l1", to: "note-2" }),
    link({ id: "l2", to: "daily-2026-08-12" }),
    link({ id: "l3", to: "event-5" }),
    link({ id: "l4", to: "task-9" }),
  ];

  async function renderRow() {
    state.outgoing = FOUR_KINDS;
    render(
      <LinkPanel
        itemId="note-1"
        loadTargets={loadTargets}
        onNavigateToItem={vi.fn()}
      />,
    );
    return await screen.findByRole("button", {
      name: chipName("event", "Tile delivery"),
    });
  }

  it("lays out rule, count, chips and + in that order", async () => {
    await renderRow();

    const rule = screen.getByRole("separator");
    expect(rule.getAttribute("aria-orientation")).toBe("vertical");
    expect(rule.className).toContain("w-px");
    expect(rule.className).toContain("bg-lumen-border-strong");

    const count = screen.getByRole("img", {
      name: i18n.t("materials.links.countLabel", { total: 4 }),
    });
    expect(count.textContent).toBe("4");
    expect(glyphOf(count)).toContain("lucide-link-2");

    const chip = screen.getByRole("button", {
      name: chipName("note", "Kitchen rebuild"),
    });
    const add = screen.getByRole("button", {
      name: i18n.t("materials.links.add"),
    });
    const inOrder = (a: Element, b: Element) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(inOrder(rule, count)).toBeTruthy();
    expect(inOrder(count, chip)).toBeTruthy();
    expect(inOrder(chip, add)).toBeTruthy();
  });

  it("counts a pair linked from both sides as one", async () => {
    state.outgoing = [link({ id: "l1", from: "note-1", to: "note-2" })];
    state.incoming = [link({ id: "l2", from: "note-2", to: "note-1" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);

    expect(
      await screen.findByRole("img", {
        name: i18n.t("materials.links.countLabel", { total: 1 }),
      }),
    ).toBeTruthy();
  });

  it.each([
    ["note", "Kitchen rebuild", "lucide-file-text", "text-lumen-accent"],
    [
      "daily",
      "2026-08-12",
      "lucide-calendar-days",
      "text-lumen-chip-routine-dot",
    ],
    ["event", "Tile delivery", "lucide-calendar ", "text-lumen-chip-event-dot"],
    [
      "task",
      "Order the tiles",
      "lucide-square-check",
      "text-lumen-chip-task-dot",
    ],
  ])(
    "draws a %s with its own icon and color",
    async (role, title, icon, tint) => {
      await renderRow();

      const glyph = glyphOf(
        screen.getByRole("button", { name: chipName(role, title) }),
      );
      expect(`${glyph} `).toContain(icon);
      expect(glyph).toContain(tint);
    },
  );

  it("keeps the title out of the text and in the name", async () => {
    const chip = await renderRow();

    expect(chip.textContent).toBe("");
    expect(chip.getAttribute("aria-label")).toBe(
      chipName("event", "Tile delivery"),
    );
    // #2392: the panel says it now. A native tooltip would open over it.
    expect(chip.hasAttribute("title")).toBe(false);
  });

  it("falls back to the neutral link glyph for a kind outside the four", async () => {
    state.outgoing = [link({ id: "l1", to: "goal-abcdef12345678" })];
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);

    const chip = await screen.findByRole("button", {
      name: chipName("unknown", "…12345678"),
    });
    expect(glyphOf(chip)).toContain("lucide-link-2");
    expect(glyphOf(chip)).toContain("text-lumen-text-secondary");
  });

  it("sizes the squares 1.5rem, and 2.25rem with a 44px area on narrow", async () => {
    const chip = await renderRow();
    const add = screen.getByRole("button", {
      name: i18n.t("materials.links.add"),
    });

    for (const square of [chip, add]) {
      expect(square.className).toContain("size-6");
      expect(square.className).toContain("max-md:size-9");
      expect(square.className).toContain("max-md:after:size-11");
      expect(square.className).toContain("rounded-lumen-sm");
      // The icon-only floor in tokens.css would lift 1.5rem to 1.75rem.
      expect(square.className.split(" ")).toContain("min-h-0");
    }
    expect(chip.className).toContain("bg-lumen-bg");
    expect(add.className).toContain("border-dashed");
    expect(add.textContent).toBe("");
  });

  it("scrolls the chips sideways on narrow, with the + outside the strip", async () => {
    const chip = await renderRow();
    const add = screen.getByRole("button", {
      name: i18n.t("materials.links.add"),
    });

    // The chip's own box sits between it and the strip (#2392).
    const strip = chip.parentElement?.parentElement as HTMLElement;
    expect(strip.className).toContain("max-md:overflow-x-auto");
    expect(strip.contains(add)).toBe(false);
  });

  it("gives the popover's rows the 44px floor on narrow", async () => {
    // Nothing linked: renderRow links all four kinds, which empties the list.
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);
    await openPicker();

    const [option] = await screen.findAllByRole("option");
    expect(option.className).toContain("max-md:min-h-11");
  });

  it("offers an event with its day, and finds it by that day", async () => {
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);
    const input = await openPicker();

    fireEvent.change(input, { target: { value: "2026-08-20" } });

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain("Tile delivery");
    expect(options[0].textContent).toContain("2026-08-20");
    expect(options[0].textContent).toContain(kindName("event"));
  });

});

describe("LinkPanel — candidate rows on narrow (#2474)", () => {
  it("drops the kind and the day under the title, and leaves Desktop's three items", async () => {
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);
    const input = await openPicker();
    fireEvent.change(input, { target: { value: "Tile delivery" } });

    const [option] = await screen.findAllByRole("option");
    const title = within(option).getByText("Tile delivery");
    const meta = within(option).getByText(`${kindName("event")} 2026-08-20`);

    // One box holds the title over the meta; it is `contents` at Desktop, so
    // the row there is still tile, title, meta side by side.
    const stack = title.parentElement as HTMLElement;
    expect(meta.parentElement).toBe(stack);
    expect(stack.parentElement).toBe(option);
    const classes = stack.className.split(" ");
    expect(classes).toContain("contents");
    expect(classes).toContain("max-md:flex-col");
    // The title has the row's whole width on narrow, and still truncates.
    expect(title.className).toContain("max-md:w-full");
    expect(title.className).toContain("truncate");
    expect(
      stack.className.split(" ").filter((c) => !c.startsWith("max-md:")),
    ).toEqual(["contents"]);
  });
});

/*
 * #2618: the "+" popover (and the related one) flip to hang from the
 * trigger's LEFT edge when a 15rem panel would cross the left edge of the
 * pane that clips it. jsdom has no layout, so the rects are stubbed: the
 * trigger's by its accessible name, the clipping pane's by a test id (and
 * `overflow-x: auto`, which is what makes it the boundary). jsdom reports no
 * root font size, so the panel is measured at 15 × 16 = 240px.
 */
describe("LinkPanel — popover stays inside its pane (#2618)", () => {
  const PANE_LEFT = 200;
  const PANE_RIGHT = 1000;

  // A failed expect must not leave the rect stub on for the next test.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function stubRects(triggerName: string, triggerRight: number) {
    return vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const isTrigger = this.getAttribute("aria-label") === triggerName;
        const isPane = this.dataset.testid === "pane";
        const left = isTrigger ? triggerRight - 24 : isPane ? PANE_LEFT : 0;
        const right = isTrigger ? triggerRight : isPane ? PANE_RIGHT : 0;
        return {
          left,
          right,
          top: 0,
          bottom: 0,
          width: right - left,
          height: 0,
          x: left,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });
  }

  function renderInPane() {
    render(
      <div data-testid="pane" style={{ overflowX: "auto" }}>
        <LinkPanel itemId="note-1" loadTargets={loadTargets} />
      </div>,
    );
  }

  /** Class tokens, so `left-0` does not match inside `max-md:left-0`. */
  const classesOf = (el: Element) => el.className.split(/\s+/);

  const pickerPanel = () =>
    screen.getByRole("dialog", {
      name: i18n.t("materials.links.pickerDialog"),
    });

  it("hangs from the left edge when the '+' sits near the pane's left", async () => {
    // 230 − 240 = −10, left of the pane at 200: no room to grow left.
    const spy = stubRects(i18n.t("materials.links.add"), PANE_LEFT + 30);
    renderInPane();
    await openPicker();
    expect(classesOf(pickerPanel())).toContain("left-0");
    expect(classesOf(pickerPanel())).not.toContain("right-0");
    // Narrow still spans the header row edge to edge.
    expect(classesOf(pickerPanel())).toEqual(
      expect.arrayContaining(["max-md:left-0", "max-md:right-0"]),
    );
    // The search field is the part that used to go missing.
    expect(
      within(pickerPanel()).getByPlaceholderText(
        i18n.t("materials.links.searchPlaceholder"),
      ),
    ).toBeTruthy();
    spy.mockRestore();
  });

  it("keeps hanging from the right edge when there is room on the left", async () => {
    // 700 − 240 = 460, right of the pane at 200: grows left as before.
    const spy = stubRects(i18n.t("materials.links.add"), 700);
    renderInPane();
    await openPicker();
    expect(classesOf(pickerPanel())).toContain("right-0");
    expect(classesOf(pickerPanel())).not.toContain("left-0");
    spy.mockRestore();
  });

  it("still hangs from the right edge with exactly a panel's width of room", async () => {
    // 440 − 240 = 200, the pane's left edge itself.
    const spy = stubRects(i18n.t("materials.links.add"), PANE_LEFT + 240);
    renderInPane();
    await openPicker();
    expect(classesOf(pickerPanel())).toContain("right-0");
    spy.mockRestore();
  });

  it("measures against the pane, not the viewport", async () => {
    // 400 − 240 = 160: clear of the viewport's 0, but under a pane at 200.
    const spy = stubRects(i18n.t("materials.links.add"), 400);
    renderInPane();
    await openPicker();
    expect(classesOf(pickerPanel())).toContain("left-0");
    spy.mockRestore();
  });

  it("applies the same rule to the related popover", () => {
    const spy = stubRects(i18n.t("materials.related.open"), PANE_LEFT + 30);
    renderInPane();
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("materials.related.open") }),
    );
    const related = screen.getByRole("dialog", {
      name: i18n.t("materials.related.dialog"),
    });
    expect(classesOf(related)).toContain("left-0");
    expect(classesOf(related)).not.toContain("right-0");
    spy.mockRestore();
  });

  it("names every kind it searches in the placeholder", async () => {
    render(<LinkPanel itemId="note-1" loadTargets={loadTargets} />);
    const input = await openPicker();
    expect(input.getAttribute("placeholder")).toBe(
      i18n.t("materials.links.searchPlaceholder"),
    );
    expect(i18n.getFixedT("ja")("materials.links.searchPlaceholder")).toBe(
      "ノート・デイリー・予定・Todo を検索",
    );
    expect(i18n.getFixedT("en")("materials.links.searchPlaceholder")).toBe(
      "Search notes, dailies, events and todos",
    );
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { DataService } from "@life-editor/shared";
import { stubDataService } from "./helpers";

/*
 * #2392 — pointing at a link chip opens a panel with what the chip no longer
 * shows, and the panel is where the link is followed and taken off.
 *
 * jsdom has no layout, so everything here is DOM events. The real timers run:
 * the hover delays are short, and the suite waits on the outcome rather than on
 * their length. The read side is the real useItemLinkPreview over a stub service,
 * because "one item, once" and "a locked note's body is never asked for" are
 * claims about which service methods get called.
 */

const state = vi.hoisted(() => ({
  outgoing: [] as unknown[],
  removeItemLinks: vi.fn<(linkIds: readonly string[]) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  showToast: vi.fn(),
  syncVersion: 0,
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useSyncDomains: () => state.syncVersion,
    useToastOptional: () => ({ showToast: state.showToast }),
    useWikiTagsUnifiedContext: () => ({
      loading: false,
      allAssignments: [],
      getTagsForItem: () => [],
      getLinksForItem: () => ({ outgoing: state.outgoing, incoming: [] }),
      removeItemLinks: state.removeItemLinks,
    }),
  };
});

const { i18n } = await import("@life-editor/shared");
const { LinkPanel } = await import("../src/wikitag/LinkPanel");
const { useItemLinkPreview } = await import("../src/notes/useItemLinkPreview");

const THIS_YEAR = new Date().getFullYear();
const DAY = `${THIS_YEAR}-08-20`;
const SHORT_DAY = new Intl.DateTimeFormat(i18n.language, {
  month: "numeric",
  day: "numeric",
}).format(new Date(THIS_YEAR, 7, 20));

const TARGETS = [
  { id: "note-2", label: "Kitchen rebuild", role: "note" },
  { id: "note-locked", label: "Private", role: "note" },
  { id: `daily-${DAY}`, label: DAY, role: "daily" },
  { id: "task-9", label: "Order the tiles", role: "task" },
  { id: "event-5", label: "Tile delivery", role: "event", date: DAY },
  { id: "task-gone", label: "Old", role: "task", isDeleted: true },
];

const loadTargets = vi.fn(() => Promise.resolve(TARGETS));

function doc(text: string): string {
  return JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
}

function makeDS(over: Partial<Record<keyof DataService, unknown>> = {}) {
  return stubDataService({
    getNoteUnified: vi.fn(async (id: string) =>
      id === "note-locked"
        ? {
            id,
            title: "Private",
            // Never true of the real read (#1763). The panel must not lean on that.
            content: doc("Secret body"),
            hasPassword: true,
            updatedAt: `${DAY}T05:30:00.000Z`,
          }
        : {
            id,
            title: "Kitchen rebuild",
            content: doc("Measure the wall first"),
            updatedAt: `${DAY}T05:30:00.000Z`,
          },
    ),
    getNoteBodyUnified: vi.fn(async () => "never"),
    getDailyByDateUnified: vi.fn(async (date: string) => ({
      id: `daily-${date}`,
      date,
      content: "A slow morning",
    })),
    getTodoById: vi.fn(async (id: string) => ({
      id,
      title: "Order the tiles",
      status: "NOT_STARTED",
      content: "Ask for the matte ones",
    })),
    fetchScheduleItemsByDate: vi.fn(async () => [
      {
        id: "event-5",
        date: DAY,
        title: "Tile delivery",
        startTime: "09:00",
        endTime: "10:30",
        memo: "Gate code 1234",
      },
    ]),
    ...over,
  } as Parameters<typeof stubDataService>[0]);
}

function Host({
  ds,
  onNavigateToItem,
}: {
  ds: DataService;
  onNavigateToItem?: (target: {
    id: string;
    role: string;
    date?: string;
  }) => void;
}) {
  const previews = useItemLinkPreview(ds);
  return (
    <LinkPanel
      itemId="note-1"
      loadTargets={loadTargets}
      previews={previews}
      onNavigateToItem={onNavigateToItem}
    />
  );
}

function link(to: string, id = `l-${to}`) {
  return {
    id,
    fromItemId: "note-1",
    toItemId: to,
    origin: "manual",
    isDeleted: false,
  };
}

function kind(role: string): string {
  return i18n.t(`itemRole.${role}` as "itemRole.note");
}

function chipName(role: string, title: string): string {
  return i18n.t("materials.links.chipName", { kind: kind(role), title });
}

async function findChip(role: string, title: string): Promise<HTMLElement> {
  return await screen.findByRole("button", { name: chipName(role, title) });
}

/** Renders one link and returns its chip. */
async function renderChip(
  to: string,
  role: string,
  title: string,
  ds: DataService = makeDS(),
) {
  state.outgoing = [link(to)];
  render(<Host ds={ds} />);
  return await findChip(role, title);
}

function panel(): HTMLElement | null {
  return screen.queryByRole("dialog");
}

const unlinkLabel = () => i18n.t("materials.links.unlink");

/**
 * A pointer event from a finger. jsdom has no PointerEvent, so the field a
 * browser sets is put on by hand. React reads over / out for enter / leave.
 */
function touch(kind: "pointerOver" | "pointerOut", el: HTMLElement): void {
  const event = createEvent[kind](el);
  Object.defineProperty(event, "pointerType", { value: "touch" });
  fireEvent(el, event);
}

/** Longer than either hover delay. */
const settle = () => act(() => new Promise((r) => setTimeout(r, 220)));

beforeEach(() => {
  state.outgoing = [];
  state.removeItemLinks.mockClear();
  state.removeItemLinks.mockImplementation(() => Promise.resolve());
  state.showToast.mockClear();
  state.syncVersion = 0;
  loadTargets.mockClear();
});

describe("what opens the panel, and what closes it (#2392)", () => {
  it("opens on hover and closes on leaving", async () => {
    const chip = await renderChip("note-2", "note", "Kitchen rebuild");
    expect(panel()).toBeNull();

    fireEvent.pointerEnter(chip);
    expect(await screen.findByRole("dialog")).toBeTruthy();

    fireEvent.pointerLeave(chip);
    await waitFor(() => expect(panel()).toBeNull());
  });

  it("stays open when the pointer comes back across the gap to the panel", async () => {
    const chip = await renderChip("note-2", "note", "Kitchen rebuild");
    fireEvent.pointerEnter(chip);
    const dialog = await screen.findByRole("dialog");

    fireEvent.pointerLeave(chip);
    fireEvent.pointerEnter(dialog);
    await settle();

    expect(panel()).toBeTruthy();
  });

  it("pins on click: leaving no longer closes it, a second click does", async () => {
    const chip = await renderChip("note-2", "note", "Kitchen rebuild");
    fireEvent.pointerEnter(chip);
    await screen.findByRole("dialog");

    fireEvent.click(chip);
    fireEvent.pointerLeave(chip);
    await settle();
    expect(panel()).toBeTruthy();

    fireEvent.click(chip);
    expect(panel()).toBeNull();
  });

  it("closes a pinned panel on Esc and on a click elsewhere", async () => {
    const chip = await renderChip("note-2", "note", "Kitchen rebuild");

    fireEvent.click(chip);
    expect(panel()).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(panel()).toBeNull();

    fireEvent.click(chip);
    expect(panel()).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(panel()).toBeNull();

    // iOS Safari sends no mousedown for a tap on nothing in particular.
    fireEvent.click(chip);
    expect(panel()).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(panel()).toBeNull();
  });

  it("ignores Esc while an IME is converting", async () => {
    const chip = await renderChip("note-2", "note", "Kitchen rebuild");
    fireEvent.click(chip);

    fireEvent.keyDown(document.body, { key: "Escape", isComposing: true });

    expect(panel()).toBeTruthy();
  });

  it("opens on a tap, with no hover from the touch pointer", async () => {
    const chip = await renderChip("note-2", "note", "Kitchen rebuild");

    touch("pointerOver", chip);
    await settle();
    expect(panel()).toBeNull();

    fireEvent.pointerDown(chip);
    fireEvent.click(chip);
    expect(panel()).toBeTruthy();

    // Pinned: the pointer lifting off the screen does not close it.
    touch("pointerOut", chip);
    await settle();
    expect(panel()).toBeTruthy();
  });

  it("keeps a pinned panel when the pointer passes over another chip", async () => {
    state.outgoing = [link("note-2"), link("task-9")];
    render(<Host ds={makeDS()} />);
    const first = await findChip("note", "Kitchen rebuild");
    const second = await findChip("task", "Order the tiles");

    fireEvent.click(first);
    fireEvent.pointerEnter(second);
    await settle();

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(first.getAttribute("aria-expanded")).toBe("true");
  });

  it("marks the open chip with the accent, and sizes the panel by width", async () => {
    const chip = await renderChip("note-2", "note", "Kitchen rebuild");
    expect(chip.className).not.toContain("border-lumen-accent");
    expect(chip.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(chip);

    expect(chip.className).toContain("border-lumen-accent");
    expect(chip.className).toContain("bg-lumen-accent-subtle");
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("w-[17rem]");
    expect(dialog.className).toContain("max-md:w-auto");
    expect(dialog.className).toContain("max-md:right-0");
    expect(dialog.className).toContain("bg-lumen-bg");
  });
});

describe("the keyboard (#2392)", () => {
  it("opens on focus, and Tab goes from the chip to the panel's buttons", async () => {
    state.outgoing = [link("note-2")];
    render(<Host ds={makeDS()} onNavigateToItem={vi.fn()} />);
    const chip = await findChip("note", "Kitchen rebuild");

    act(() => chip.focus());
    expect(panel()).toBeTruthy();

    // Tab follows the DOM order: the panel comes right after the chip.
    const buttons = Array.from(document.querySelectorAll("button"));
    const at = buttons.indexOf(chip as HTMLButtonElement);
    expect(buttons[at + 1].textContent).toBe(
      i18n.t("materials.links.openAction"),
    );
    expect(buttons[at + 2].textContent).toBe(unlinkLabel());
  });

  it("keeps the panel up while the focus moves inside it, and closes it past the end", async () => {
    state.outgoing = [link("note-2")];
    render(<Host ds={makeDS()} onNavigateToItem={vi.fn()} />);
    const chip = await findChip("note", "Kitchen rebuild");
    act(() => chip.focus());

    const open = screen.getByRole("button", {
      name: i18n.t("materials.links.openAction"),
    });
    const unlink = screen.getByRole("button", { name: unlinkLabel() });
    act(() => open.focus());
    act(() => unlink.focus());
    expect(panel()).toBeTruthy();

    const add = screen.getByRole("button", {
      name: i18n.t("materials.links.add"),
    });
    act(() => add.focus());
    expect(panel()).toBeNull();
  });

  it("gives the focus back to the chip on Esc, without opening it again", async () => {
    state.outgoing = [link("note-2")];
    render(<Host ds={makeDS()} onNavigateToItem={vi.fn()} />);
    const chip = await findChip("note", "Kitchen rebuild");
    act(() => chip.focus());
    const unlink = screen.getByRole("button", { name: unlinkLabel() });
    act(() => unlink.focus());

    fireEvent.keyDown(unlink, { key: "Escape" });

    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(chip);
  });

  it("does not treat a mouse press's focus as the keyboard arriving", async () => {
    const chip = await renderChip("note-2", "note", "Kitchen rebuild");
    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(panel()).toBeNull();

    // Press on an unfocused chip: focus lands first, the click decides.
    fireEvent.pointerDown(chip);
    act(() => chip.focus());
    expect(panel()).toBeNull();
    fireEvent.click(chip);
    expect(panel()).toBeTruthy();
  });
});

describe("what the panel says, by kind (#2392)", () => {
  it("note: the kind, the title, when it was updated, and the body's first line", async () => {
    const chip = await renderChip("note-2", "note", "Kitchen rebuild");
    fireEvent.click(chip);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.textContent).toContain("Measure the wall first"),
    );
    expect(dialog.textContent).toContain(kind("note"));
    expect(dialog.textContent).toContain("Kitchen rebuild");
    const clock = new Intl.DateTimeFormat(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(`${DAY}T05:30:00.000Z`));
    expect(dialog.textContent).toContain(
      i18n.t("materials.links.noteUpdated", {
        when: `${SHORT_DAY} ${clock}`,
      }),
    );
  });

  it("daily: the date and the mood, with the first line", async () => {
    const ds = makeDS({
      getDailyByDateUnified: vi.fn(async (date: string) => ({
        id: `daily-${date}`,
        date,
        content: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "A slow morning" }],
            },
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "夕刊" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "気分: 4/5" }],
            },
          ],
        }),
      })),
    });
    const chip = await renderChip(`daily-${DAY}`, "daily", DAY, ds);
    fireEvent.click(chip);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.textContent).toContain(
        i18n.t("materials.links.dailyMood", { date: SHORT_DAY, mood: 4 }),
      ),
    );
    expect(dialog.textContent).toContain("A slow morning");
  });

  it("daily: only the date when no mood was recorded", async () => {
    const chip = await renderChip(`daily-${DAY}`, "daily", DAY);
    fireEvent.click(chip);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.textContent).toContain("A slow morning"));
    expect(dialog.textContent).toContain(SHORT_DAY);
    expect(dialog.textContent).not.toContain("/5");
  });

  it("todo: not started, with no date when it has none, and its memo", async () => {
    const chip = await renderChip("task-9", "task", "Order the tiles");
    fireEvent.click(chip);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.textContent).toContain("Ask for the matte ones"),
    );
    expect(dialog.textContent).toContain(
      i18n.t("materials.links.todoNotStarted"),
    );
  });

  it("todo: done, with its date and time", async () => {
    // Local instants, so the expected clock does not depend on the zone.
    const start = new Date(THIS_YEAR, 7, 20, 14, 0);
    const end = new Date(THIS_YEAR, 7, 20, 15, 30);
    const ds = makeDS({
      getTodoById: vi.fn(async (id: string) => ({
        id,
        title: "Order the tiles",
        status: "DONE",
        scheduledAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
      })),
    });
    const chip = await renderChip("task-9", "task", "Order the tiles", ds);
    fireEvent.click(chip);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.textContent).toContain(
        i18n.t("materials.links.todoWhen", {
          status: i18n.t("materials.links.todoDone"),
          when: `${SHORT_DAY} 14:00 – 15:30`,
        }),
      ),
    );
  });

  it("event: the date and time, and its memo", async () => {
    const chip = await renderChip("event-5", "event", "Tile delivery");
    fireEvent.click(chip);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.textContent).toContain(`${SHORT_DAY} 09:00 – 10:30`),
    );
    expect(dialog.textContent).toContain("Gate code 1234");
  });

  it("event: says all day instead of a time", async () => {
    const ds = makeDS({
      fetchScheduleItemsByDate: vi.fn(async () => [
        {
          id: "event-5",
          date: DAY,
          title: "Tile delivery",
          startTime: "00:00",
          endTime: "00:00",
          isAllDay: true,
          memo: null,
        },
      ]),
    });
    const chip = await renderChip("event-5", "event", "Tile delivery", ds);
    fireEvent.click(chip);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.textContent).toContain(
        `${SHORT_DAY} ${i18n.t("scheduleScreen.allDay")}`,
      ),
    );
  });

  it("makes plain text of a rich body and cuts it at 64 characters", async () => {
    const long = "あ".repeat(70);
    const ds = makeDS({
      getNoteUnified: vi.fn(async (id: string) => ({
        id,
        title: "Kitchen rebuild",
        content: doc(long),
        updatedAt: `${DAY}T05:30:00.000Z`,
      })),
    });
    const chip = await renderChip("note-2", "note", "Kitchen rebuild", ds);
    fireEvent.click(chip);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.textContent).toContain(`${"あ".repeat(64)}…`),
    );
    expect(dialog.textContent).not.toContain("あ".repeat(65));
    expect(dialog.textContent).not.toContain('"type"');
  });

  it("leaves a text of exactly 64 characters whole", async () => {
    const exact = "あ".repeat(64);
    const ds = makeDS({
      getNoteUnified: vi.fn(async (id: string) => ({
        id,
        title: "Kitchen rebuild",
        content: doc(exact),
        updatedAt: `${DAY}T05:30:00.000Z`,
      })),
    });
    const chip = await renderChip("note-2", "note", "Kitchen rebuild", ds);
    fireEvent.click(chip);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.textContent).toContain(exact));
    expect(dialog.textContent).not.toContain("…");
  });
});

describe("a locked item keeps its text out of the panel (#2392)", () => {
  it("shows a locked note's update time, no excerpt, and never asks for its body", async () => {
    const ds = makeDS();
    const chip = await renderChip("note-locked", "note", "Private", ds);
    fireEvent.click(chip);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.textContent).toContain(
        i18n.t("materials.links.noteUpdated", { when: "" }).trim(),
      ),
    );
    expect(ds.getNoteBodyUnified).not.toHaveBeenCalled();
    expect(dialog.textContent).not.toContain("Secret body");
    // Kind, title, update time, the two buttons: nothing else was drawn.
    expect(dialog.querySelectorAll("p")).toHaveLength(3);
  });

  it("drops a locked daily's body even though the read returns it", async () => {
    const ds = makeDS({
      getDailyByDateUnified: vi.fn(async (date: string) => ({
        id: `daily-${date}`,
        date,
        hasPassword: true,
        content: doc("A private morning"),
      })),
    });
    const chip = await renderChip(`daily-${DAY}`, "daily", DAY, ds);
    fireEvent.click(chip);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.textContent).toContain(SHORT_DAY));
    expect(dialog.textContent).not.toContain("A private morning");
  });
});

describe("reads one item, once (#2392)", () => {
  it("reads nothing until a panel opens, then only that item", async () => {
    const ds = makeDS();
    state.outgoing = [link("note-2"), link("task-9")];
    render(<Host ds={ds} />);
    const chip = await findChip("note", "Kitchen rebuild");
    await settle();
    expect(ds.getNoteUnified).not.toHaveBeenCalled();
    expect(ds.getTodoById).not.toHaveBeenCalled();

    fireEvent.click(chip);

    await waitFor(() =>
      expect(ds.getNoteUnified).toHaveBeenCalledExactlyOnceWith("note-2"),
    );
    expect(ds.getTodoById).not.toHaveBeenCalled();
  });

  it("draws the kept value at once when the same panel opens again", async () => {
    const ds = makeDS();
    const chip = await renderChip("note-2", "note", "Kitchen rebuild", ds);

    fireEvent.click(chip);
    await waitFor(() =>
      expect(screen.getByRole("dialog").textContent).toContain(
        "Measure the wall first",
      ),
    );
    fireEvent.click(chip);
    expect(panel()).toBeNull();

    fireEvent.click(chip);
    expect(screen.getByRole("dialog").textContent).toContain(
      "Measure the wall first",
    );
    expect(ds.getNoteUnified).toHaveBeenCalledTimes(1);
  });

  it("reads again after a sync says something changed", async () => {
    const ds = makeDS();
    state.outgoing = [link("note-2")];
    const { rerender } = render(<Host ds={ds} />);
    fireEvent.click(await findChip("note", "Kitchen rebuild"));
    await waitFor(() => expect(ds.getNoteUnified).toHaveBeenCalledTimes(1));

    state.syncVersion = 1;
    rerender(<Host ds={ds} />);

    await waitFor(() => expect(ds.getNoteUnified).toHaveBeenCalledTimes(2));
  });

  it("says a read failed, and tries again on the next open", async () => {
    const getNoteUnified = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({
        id: "note-2",
        title: "Kitchen rebuild",
        content: doc("Measure the wall first"),
        updatedAt: `${DAY}T05:30:00.000Z`,
      });
    const ds = makeDS({ getNoteUnified });
    const chip = await renderChip("note-2", "note", "Kitchen rebuild", ds);

    fireEvent.click(chip);
    await waitFor(() =>
      expect(screen.getByRole("dialog").textContent).toContain(
        i18n.t("materials.links.previewFailed"),
      ),
    );
    // The title and the way out are still there.
    expect(screen.getByRole("button", { name: unlinkLabel() })).toBeTruthy();

    fireEvent.click(chip);
    fireEvent.click(chip);
    await waitFor(() =>
      expect(screen.getByRole("dialog").textContent).toContain(
        "Measure the wall first",
      ),
    );
  });
});

describe("the panel's buttons (#2392)", () => {
  it.each([
    ["note-2", "note", "Kitchen rebuild", "materials.links.openAction", {}],
    ["task-9", "task", "Order the tiles", "scheduleScreen.openInSchedule", {}],
    [
      "event-5",
      "event",
      "Tile delivery",
      "scheduleScreen.openInSchedule",
      { date: DAY },
    ],
  ])(
    "%s: the button by kind carries the id, the role and the date",
    async (to, role, title, labelKey, extra) => {
      const onNavigateToItem = vi.fn();
      state.outgoing = [link(to)];
      render(<Host ds={makeDS()} onNavigateToItem={onNavigateToItem} />);
      fireEvent.click(await findChip(role, title));

      fireEvent.click(
        screen.getByRole("button", {
          name: i18n.t(labelKey as "scheduleScreen.openInSchedule"),
        }),
      );

      expect(onNavigateToItem).toHaveBeenCalledExactlyOnceWith({
        id: to,
        role,
        ...extra,
      });
      expect(panel()).toBeNull();
    },
  );

  it("removes the link, says how to undo it, and closes", async () => {
    const chip = await renderChip("note-2", "note", "Kitchen rebuild");
    fireEvent.click(chip);

    fireEvent.click(screen.getByRole("button", { name: unlinkLabel() }));

    await waitFor(() =>
      expect(state.removeItemLinks).toHaveBeenCalledExactlyOnceWith([
        "l-note-2",
      ]),
    );
    await waitFor(() =>
      expect(state.showToast).toHaveBeenCalledExactlyOnceWith(
        "info",
        i18n.t("materials.links.unlinked", { title: "Kitchen rebuild" }),
      ),
    );
    expect(panel()).toBeNull();
    // The chip it came from is on its way out; the "+" holds the focus.
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: i18n.t("materials.links.add") }),
    );
  });

  it("shows why when the removal fails, and offers no undo", async () => {
    state.removeItemLinks.mockRejectedValueOnce(new Error("network is down"));
    const chip = await renderChip("note-2", "note", "Kitchen rebuild");
    fireEvent.click(chip);

    fireEvent.click(screen.getByRole("button", { name: unlinkLabel() }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "network is down",
    );
    expect(state.showToast).not.toHaveBeenCalled();
  });
});

describe("a target with nothing to read (#2392)", () => {
  /*
   * A dismissed event is left out of the pool (fetchEvents skips it), so its
   * chip has no name and no kind. So does a goal. It still has a row to remove.
   */
  it("opens for a target the pool cannot name, reads nothing, and can be removed", async () => {
    const ds = makeDS();
    const onNavigateToItem = vi.fn();
    state.outgoing = [link("event-abcdef12345678", "l-dismissed")];
    render(<Host ds={ds} onNavigateToItem={onNavigateToItem} />);
    const chip = await findChip("unknown", "…12345678");

    fireEvent.click(chip);

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain(
      i18n.t("materials.links.previewUnavailable"),
    );
    expect(screen.getByText("…12345678").getAttribute("title")).toBe(
      "event-abcdef12345678",
    );
    expect(ds.fetchScheduleItemsByDate).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", {
        name: i18n.t("scheduleScreen.openInSchedule"),
      }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: unlinkLabel() }));
    await waitFor(() =>
      expect(state.removeItemLinks).toHaveBeenCalledExactlyOnceWith([
        "l-dismissed",
      ]),
    );
  });

  it("names a deleted target, struck through, with no read and no way in", async () => {
    const ds = makeDS();
    state.outgoing = [link("task-gone")];
    render(<Host ds={ds} onNavigateToItem={vi.fn()} />);
    const label = i18n.t("materials.links.deletedTarget", { title: "Old" });
    fireEvent.click(await findChip("task", label));

    expect(screen.getByText(label).className).toContain("line-through");
    expect(ds.getTodoById).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", {
        name: i18n.t("scheduleScreen.openInSchedule"),
      }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: unlinkLabel() })).toBeTruthy();
  });

  it("shows the title alone when the item is gone from the service", async () => {
    const ds = makeDS({ getTodoById: vi.fn(async () => null) });
    const chip = await renderChip("task-9", "task", "Order the tiles", ds);
    fireEvent.click(chip);

    await waitFor(() => expect(ds.getTodoById).toHaveBeenCalled());
    const dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(dialog.textContent).not.toContain(
        i18n.t("materials.links.previewLoading"),
      ),
    );
    expect(dialog.textContent).toContain("Order the tiles");
  });
});

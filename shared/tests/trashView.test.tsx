import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  TrashView,
  type TrashGroup,
  type TrashViewLabels,
} from "../src/components";

/*
 * Target-IA TrashView behaviors (ClaudeDesign import 2026-07-05): empty
 * categories collapse, per-category count badges, confirm-dialog cascade
 * warning, row-level busy, and the wide↔narrow confirm chrome (Modal vs
 * BottomSheet). Layout Standard v2: the shell SectionHeader owns the title,
 * so the view renders no in-body heading. The basic restore/confirm-delete
 * flows stay in components.test.tsx.
 */

const LABELS: TrashViewLabels = {
  empty: "Trash is empty",
  emptyDescription: "Deleted items will appear here.",
  restore: "Restore",
  restoring: "Restoring…",
  deleting: "Deleting…",
  deletePermanently: "Delete permanently",
  confirmMessage: 'Permanently delete "{name}"? This cannot be undone.',
  cascadeWarning: "Related sub-items and tag assignments are deleted together.",
  cancel: "Cancel",
  close: "Close",
  selectItem: 'Select "{name}"',
  selectGroup: "Select all {name}",
  selectedCount: "{count} selected",
  clearSelection: "Clear the selection",
  restoreSelected: "Restore selected",
  deleteSelected: "Delete selected",
  emptyTrash: "Empty the trash",
  confirmSelectionMessage:
    "The {count} selected items will be permanently deleted.",
  confirmEmptyMessage: "All {count} items in the trash will be deleted.",
  restoringMany: "Restoring…",
  deletingMany: "Deleting…",
};

const GROUPS: TrashGroup[] = [
  {
    category: "todos",
    title: "Todos",
    items: [
      { id: "t1", label: "Buy milk" },
      { id: "t2", label: "Walk the dog" },
    ],
  },
  { category: "notes", title: "Notes", items: [] },
  {
    category: "routines",
    title: "Routines",
    items: [{ id: "r1", label: "Morning stretch" }],
  },
];

function mockMatchMedia(matches: boolean) {
  // A bare vi.fn() is untyped, so the partial stub needs no suppression;
  // `satisfies` keeps the shape checked against the real interface (#711).
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  } satisfies Partial<MediaQueryList>);
}

afterEach(() => {
  // @ts-expect-error — restore the jsdom default (no matchMedia).
  delete window.matchMedia;
});

function renderView(props?: Partial<Parameters<typeof TrashView>[0]>) {
  const onRestore = vi.fn();
  const onPermanentDelete = vi.fn();
  const onRestoreMany = vi.fn();
  const onPermanentDeleteMany = vi.fn();
  render(
    <TrashView
      groups={GROUPS}
      onRestore={onRestore}
      onPermanentDelete={onPermanentDelete}
      onRestoreMany={onRestoreMany}
      onPermanentDeleteMany={onPermanentDeleteMany}
      labels={LABELS}
      {...props}
    />,
  );
  return {
    onRestore,
    onPermanentDelete,
    onRestoreMany,
    onPermanentDeleteMany,
  };
}

describe("TrashView — target IA", () => {
  it("collapses empty categories instead of rendering empty sections", () => {
    renderView();
    expect(screen.getByRole("region", { name: "Todos" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Routines" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Notes" })).toBeNull();
  });

  it("renders no in-body heading (v2: the shell owns the title) and shows per-category badges", () => {
    renderView();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    const todos = screen.getByRole("region", { name: "Todos" });
    expect(within(todos).getByText("2")).toBeInTheDocument();
  });

  it("shows the global empty state", () => {
    renderView({
      groups: [
        { category: "todos", title: "Todos", items: [] },
        { category: "notes", title: "Notes", items: [] },
      ],
    });
    expect(screen.getByText("Trash is empty")).toBeInTheDocument();
    expect(
      screen.getByText("Deleted items will appear here."),
    ).toBeInTheDocument();
  });

  it("confirms in a Modal on wide screens with cancel first and the cascade warning", () => {
    mockMatchMedia(true);
    const { onPermanentDelete } = renderView();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete permanently" })[0],
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(
        'Permanently delete "Buy milk"? This cannot be undone.',
      ),
    ).toBeInTheDocument();
    // #1275: the cascade note goes through the shared NoticePanel now, so it
    // is a live region rather than a plain div — polite, not assertive,
    // because the copy is there from the moment the dialog opens.
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      LABELS.cascadeWarning,
    );

    // Wide DOM order puts Cancel before the destructive action, so the
    // Modal's first-focusable focus lands on the safe button (design 1c).
    const buttons = within(dialog).getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Cancel");

    fireEvent.click(buttons[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onPermanentDelete).not.toHaveBeenCalled();
  });

  it("confirms in a BottomSheet on narrow screens with the destructive action stacked first", () => {
    mockMatchMedia(false);
    const { onPermanentDelete } = renderView();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete permanently" })[0],
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("rounded-t-2xl");
    // The sheet's own close button (#525) is chrome, not one of the stacked
    // actions — this case is about the order of the two decision buttons.
    const buttons = within(dialog)
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label") !== LABELS.close);
    expect(buttons[0]).toHaveTextContent("Delete permanently");
    expect(buttons[buttons.length - 1]).toHaveTextContent("Cancel");

    fireEvent.click(buttons[0]);
    expect(onPermanentDelete).toHaveBeenCalledWith("todos", "t1");
  });

  it("pins the busy marker to its row and disables every action", () => {
    renderView({ busy: { category: "todos", id: "t1", action: "restore" } });
    expect(screen.getByText("Restoring…")).toBeInTheDocument();
    // The busy row swaps its Restore button for the status chip; every
    // remaining action (other rows' restore + all delete icons) is disabled.
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
    const busyRow = screen.getByText("Buy milk").closest("li");
    expect(busyRow).toHaveAttribute("aria-busy", "true");
  });

  it("shows the deleting label when the busy action is a permanent delete", () => {
    renderView({ busy: { category: "routines", id: "r1", action: "delete" } });
    expect(screen.getByText("Deleting…")).toBeInTheDocument();
    expect(screen.queryByText("Restoring…")).toBeNull();
  });
});

/*
 * Multi-select and bulk actions (#1294).
 *
 * The dangerous parts are what these pin. A bulk delete must go through the
 * SAME confirm a single delete does — it is the one place on this screen where
 * one press can take fifteen things away at once. "Empty the trash" must not
 * need a selection and must still ask. And the selection has to survive the
 * only thing that reliably breaks a set keyed by id: rows that disappear
 * underneath it after a restore, which is why the view filters the selection
 * through the CURRENT groups rather than handing its keys straight to the
 * host.
 */
describe("TrashView — multi-select (#1294)", () => {
  const selectRow = (label: string) =>
    fireEvent.click(
      screen.getByRole("checkbox", { name: `Select "${label}"` }),
    );

  it("offers no bulk actions until something is selected", () => {
    mockMatchMedia(true);
    renderView();

    // The one press that needs no selection is there…
    screen.getByRole("button", { name: "Empty the trash" });
    // …and the ones that do are not.
    expect(
      screen.queryByRole("button", { name: "Restore selected" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Delete selected" }),
    ).toBeNull();
  });

  /*
   * #1871. jsdom has no layout, so what can be pinned is the contract rather
   * than the pixels: the bar is sticky exactly while it carries a selection,
   * and its surface is an opaque token either way.
   */
  it("pins the bar while rows are selected, and only then", () => {
    mockMatchMedia(true);
    renderView();
    const bar = () =>
      document.querySelector("[data-trash-action-bar]") as HTMLElement;

    expect(bar().className).not.toContain("sticky");

    selectRow("Buy milk");

    expect(bar().className).toContain("sticky");
    expect(bar().className).toContain("top-0");
    expect(bar().className).toContain("bg-lumen-bg");
  });

  it("counts the selection and restores exactly what is ticked", () => {
    mockMatchMedia(true);
    const { onRestoreMany } = renderView();

    selectRow("Buy milk");
    selectRow("Morning stretch");

    screen.getByText("2 selected");
    fireEvent.click(screen.getByRole("button", { name: "Restore selected" }));

    expect(onRestoreMany).toHaveBeenCalledTimes(1);
    expect(onRestoreMany.mock.calls[0][0]).toEqual([
      { category: "todos", id: "t1" },
      { category: "routines", id: "r1" },
    ]);
  });

  it("selects and clears a whole category from its heading", () => {
    mockMatchMedia(true);
    renderView();

    const groupBox = screen.getByRole("checkbox", { name: "Select all Todos" });
    fireEvent.click(groupBox);
    screen.getByText("2 selected");

    fireEvent.click(groupBox);
    expect(screen.queryByText("2 selected")).toBeNull();
  });

  it("puts a bulk delete through the confirm, with the count in it", () => {
    mockMatchMedia(true);
    const { onPermanentDeleteMany } = renderView();

    selectRow("Buy milk");
    selectRow("Walk the dog");
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));

    // Nothing has happened yet — the dialog is the gate.
    expect(onPermanentDeleteMany).not.toHaveBeenCalled();
    screen.getByText("The 2 selected items will be permanently deleted.");
    screen.getByText(LABELS.cascadeWarning);

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete permanently",
      }),
    );
    expect(onPermanentDeleteMany.mock.calls[0][0]).toEqual([
      { category: "todos", id: "t1" },
      { category: "todos", id: "t2" },
    ]);
  });

  it("lets a cancelled bulk delete change nothing", () => {
    mockMatchMedia(true);
    const { onPermanentDeleteMany } = renderView();

    selectRow("Buy milk");
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    expect(onPermanentDeleteMany).not.toHaveBeenCalled();
    // The selection is still there to try again with.
    screen.getByText("1 selected");
  });

  it("empties the trash — every row, still behind the confirm", () => {
    mockMatchMedia(true);
    const { onPermanentDeleteMany } = renderView();

    fireEvent.click(screen.getByRole("button", { name: "Empty the trash" }));

    expect(onPermanentDeleteMany).not.toHaveBeenCalled();
    screen.getByText("All 3 items in the trash will be deleted.");

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete permanently",
      }),
    );
    // All three, including the one in a category nothing was ticked in.
    expect(onPermanentDeleteMany.mock.calls[0][0]).toHaveLength(3);
  });

  it("drops rows that left the list from the selection", () => {
    mockMatchMedia(true);
    const onRestoreMany = vi.fn();
    const view = render(
      <TrashView
        groups={GROUPS}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
        onRestoreMany={onRestoreMany}
        onPermanentDeleteMany={vi.fn()}
        labels={LABELS}
      />,
    );

    selectRow("Buy milk");
    selectRow("Walk the dog");

    // "Buy milk" came back and is no longer in the trash.
    view.rerender(
      <TrashView
        groups={[
          { ...GROUPS[0], items: [{ id: "t2", label: "Walk the dog" }] },
          GROUPS[1],
          GROUPS[2],
        ]}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
        onRestoreMany={onRestoreMany}
        onPermanentDeleteMany={vi.fn()}
        labels={LABELS}
      />,
    );

    screen.getByText("1 selected");
    fireEvent.click(screen.getByRole("button", { name: "Restore selected" }));
    expect(onRestoreMany.mock.calls[0][0]).toEqual([
      { category: "todos", id: "t2" },
    ]);
  });

  it("locks the whole view while a bulk run is in flight", () => {
    mockMatchMedia(true);
    renderView({ bulkBusy: "delete" });

    for (const box of screen.getAllByRole("checkbox")) {
      expect(box).toBeDisabled();
    }
    for (const button of screen.getAllByRole("button", { name: "Restore" })) {
      expect(button).toBeDisabled();
    }
  });

  it("gives every checkbox the phone minimum touch target on narrow", () => {
    mockMatchMedia(false);
    renderView();

    // mobile-scope.md: 44px is the floor. The group heading's box keeps the
    // compact size — it sits in a heading row, not a tappable list row.
    const rowBox = screen.getByRole("checkbox", { name: 'Select "Buy milk"' });
    expect(rowBox.parentElement?.className).toContain("min-h-11");
  });
});

/*
 * #1527 — the name has to be readable.
 *
 * At 390px the single-line row spent its width on chrome: a 44px checkbox, a
 * labelled restore button and a delete button left the name 111px, which cut
 * every title to 6-8 characters. Thirty rows generated from one routine came
 * out as thirty identical stubs, so the list could not answer the only
 * question it is for — which of these am I restoring?
 *
 * jsdom has no layout (CLAUDE.md §7.1), so the pixels are not assertable here.
 * What IS assertable is the arrangement that produces them: on narrow nothing
 * clickable shares the name's line, and on wide the row is untouched.
 */
describe("TrashView — narrow rows (#1527)", () => {
  function rowFor(label: string): HTMLElement {
    const box = screen.getByRole("checkbox", { name: `Select "${label}"` });
    const row = box.closest("li");
    if (!row) throw new Error(`no row around the checkbox for "${label}"`);
    return row;
  }

  function lineOf(el: HTMLElement): HTMLElement {
    const line = el.parentElement;
    if (!line) throw new Error("element is not in a row");
    return line;
  }

  it("gives the name a line of its own on narrow", () => {
    mockMatchMedia(false);
    renderView();

    const row = rowFor("Buy milk");
    const nameLine = lineOf(within(row).getByText("Buy milk"));

    // The checkbox stays beside the name (it selects THIS row, so it has to);
    // both buttons are what the name was losing its width to.
    within(nameLine).getByRole("checkbox", { name: 'Select "Buy milk"' });
    expect(within(nameLine).queryAllByRole("button")).toHaveLength(0);
  });

  it("keeps both controls in the row, one line down", () => {
    mockMatchMedia(false);
    renderView();

    const row = rowFor("Buy milk");
    const nameLine = lineOf(within(row).getByText("Buy milk"));
    const restore = within(row).getByRole("button", { name: "Restore" });
    const remove = within(row).getByRole("button", {
      name: "Delete permanently",
    });

    // Moved, not dropped — and moved together, so the pair still reads as one
    // group rather than straddling the fold.
    expect(nameLine.contains(restore)).toBe(false);
    expect(lineOf(restore)).toBe(lineOf(remove));
  });

  it("leaves the wide row on a single line", () => {
    mockMatchMedia(true);
    renderView();

    const row = rowFor("Buy milk");
    const name = within(row).getByText("Buy milk");
    const restore = within(row).getByRole("button", { name: "Restore" });

    // Same parent as the row itself = one flex line, exactly as before #1527.
    expect(lineOf(name)).toBe(row);
    expect(lineOf(restore)).toBe(row);
  });
});

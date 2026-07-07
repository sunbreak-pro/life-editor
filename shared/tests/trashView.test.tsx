import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  TrashView,
  type TrashGroup,
  type TrashViewLabels,
} from "../src/components";

/*
 * Target-IA TrashView behaviors (ClaudeDesign import 2026-07-05): empty
 * categories collapse, header/count badges, confirm-dialog cascade warning,
 * row-level busy, and the wide↔narrow confirm chrome (Modal vs BottomSheet).
 * The basic restore/confirm-delete flows stay in components.test.tsx.
 */

const LABELS: TrashViewLabels = {
  title: "Trash",
  description: "Deleted items can be restored from here.",
  totalCount: "{count} total",
  empty: "Trash is empty",
  emptyDescription: "Deleted items will appear here.",
  restore: "Restore",
  restoring: "Restoring…",
  deleting: "Deleting…",
  deletePermanently: "Delete permanently",
  confirmMessage: 'Permanently delete "{name}"? This cannot be undone.',
  cascadeWarning: "Related sub-items and tag assignments are deleted together.",
  cancel: "Cancel",
};

const GROUPS: TrashGroup[] = [
  {
    category: "tasks",
    title: "Tasks",
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
  // @ts-expect-error — minimal MediaQueryList stub for tests.
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

afterEach(() => {
  // @ts-expect-error — restore the jsdom default (no matchMedia).
  delete window.matchMedia;
});

function renderView(props?: Partial<Parameters<typeof TrashView>[0]>) {
  const onRestore = vi.fn();
  const onPermanentDelete = vi.fn();
  render(
    <TrashView
      groups={GROUPS}
      onRestore={onRestore}
      onPermanentDelete={onPermanentDelete}
      labels={LABELS}
      {...props}
    />,
  );
  return { onRestore, onPermanentDelete };
}

describe("TrashView — target IA", () => {
  it("collapses empty categories instead of rendering empty sections", () => {
    renderView();
    expect(screen.getByRole("region", { name: "Tasks" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Routines" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Notes" })).toBeNull();
  });

  it("shows the header description, total count and per-category badges", () => {
    renderView();
    expect(
      screen.getByText("Deleted items can be restored from here."),
    ).toBeInTheDocument();
    expect(screen.getByText("3 total")).toBeInTheDocument();
    const tasks = screen.getByRole("region", { name: "Tasks" });
    expect(within(tasks).getByText("2")).toBeInTheDocument();
  });

  it("shows the global empty state without a total count", () => {
    renderView({
      groups: [
        { category: "tasks", title: "Tasks", items: [] },
        { category: "notes", title: "Notes", items: [] },
      ],
    });
    expect(screen.getByText("Trash is empty")).toBeInTheDocument();
    expect(
      screen.getByText("Deleted items will appear here."),
    ).toBeInTheDocument();
    expect(screen.queryByText("0 total")).toBeNull();
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
    expect(within(dialog).getByText(LABELS.cascadeWarning)).toBeInTheDocument();

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
    const buttons = within(dialog).getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Delete permanently");
    expect(buttons[buttons.length - 1]).toHaveTextContent("Cancel");

    fireEvent.click(buttons[0]);
    expect(onPermanentDelete).toHaveBeenCalledWith("tasks", "t1");
  });

  it("pins the busy marker to its row and disables every action", () => {
    renderView({ busy: { category: "tasks", id: "t1", action: "restore" } });
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

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  BacklinkView,
  type BacklinkEntry,
  type BacklinkNode,
  type BacklinkViewLabels,
} from "../src/components";

/*
 * BacklinkView after the Connect retirement (#1152).
 *
 * The component came through that deletion with a type swap: it used to take
 * the graph's `GraphNode`, and now takes a three-field `BacklinkNode` declared
 * beside it. Nothing else changed, and nothing calls it today — which is
 * exactly why these cases exist. A presentational part with no caller has no
 * other way to fail loudly, so the three render states (nothing selected /
 * selection with no incoming links / selection with rows) and the select
 * intent are pinned here.
 */
const LABELS: BacklinkViewLabels = {
  incomingLinks: "Links to this note",
  empty: "No notes link here yet.",
  selectHint: "Select an item to see what links to it.",
};

const NODE: BacklinkNode = {
  id: "note-1",
  label: "Supabase migration notes",
  type: "note",
};

const ENTRIES: BacklinkEntry[] = [
  { id: "note-2", label: "Weekly review", type: "note" },
  { id: "daily-2026-08-29", label: "2026-08-29", type: "daily" },
  { id: "note-3", label: "Untyped source" }, // type omitted → note icon
];

describe("BacklinkView", () => {
  it("shows only the select hint when nothing is selected", () => {
    render(
      <BacklinkView
        node={null}
        entries={ENTRIES}
        labels={LABELS}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(LABELS.selectHint)).toBeTruthy();
    // Entries must not leak through a null selection.
    expect(screen.queryByText("Weekly review")).toBeNull();
    cleanup();
  });

  it("renders the selected item and one row per incoming link", () => {
    render(
      <BacklinkView
        node={NODE}
        entries={ENTRIES}
        labels={LABELS}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(NODE.label)).toBeTruthy();
    expect(screen.getByText(NODE.id)).toBeTruthy();
    expect(screen.getByText(LABELS.incomingLinks)).toBeTruthy();
    // The count sits next to the header, so it has to track the array.
    expect(screen.getByText(String(ENTRIES.length))).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(ENTRIES.length);
    cleanup();
  });

  it("shows the empty copy when the selection has no incoming links", () => {
    render(
      <BacklinkView
        node={NODE}
        entries={[]}
        labels={LABELS}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(LABELS.empty)).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    cleanup();
  });

  it("emits the source id — not the selected node's — when a row is clicked", () => {
    const onSelect = vi.fn();
    render(
      <BacklinkView
        node={NODE}
        entries={ENTRIES}
        labels={LABELS}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("Weekly review"));
    expect(onSelect).toHaveBeenCalledWith("note-2");
    cleanup();
  });
});

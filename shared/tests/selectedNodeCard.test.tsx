import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SelectedNodeCard } from "../src/components/Connect/SelectedNodeCard";
import type { GraphNode } from "../src/components/Connect/graph/graph-types";
import { tagNodeId } from "../src/components/Connect/graph/graph-types";
import type { ConnectGraphLabels } from "../src/components/Connect/labels";

/*
 * STEP 2 link-editing affordances on the SelectedNodeCard. The card is
 * presentational — it never touches the DataService/context; the host wires
 * onCreateLink / onDeleteLink. These tests assert the callback contracts:
 *   add  → onCreateLink(selectedId, targetId)
 *   ×    → onDeleteLink(linkId)  (only on outgoing-link rows)
 * and that a tag node (synthetic `tag:<id>`) hides the add-link input.
 */

// Every label resolves to its own key — enough for query-by-name assertions.
const labels = new Proxy({} as ConnectGraphLabels, {
  get: (_t, key) => String(key),
});

function noteNode(id: string, label = id): GraphNode {
  return { id, label, type: "note" };
}

describe("SelectedNodeCard link editing", () => {
  it("calls onCreateLink(selectedId, targetId) when a link is added", () => {
    const onCreateLink = vi.fn();
    render(
      <SelectedNodeCard
        labels={labels}
        node={noteNode("note-1")}
        neighbors={[]}
        localDepth={0}
        onLocalDepthChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        linkableItems={[{ id: "note-2", label: "Second" }]}
        onCreateLink={onCreateLink}
      />,
    );

    const input = screen.getByLabelText(
      "linkTargetPlaceholder",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "note-2" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCreateLink).toHaveBeenCalledWith("note-1", "note-2");
  });

  it("does not call onCreateLink for a self-loop", () => {
    const onCreateLink = vi.fn();
    render(
      <SelectedNodeCard
        labels={labels}
        node={noteNode("note-1")}
        neighbors={[]}
        localDepth={0}
        onLocalDepthChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCreateLink={onCreateLink}
      />,
    );

    const input = screen.getByLabelText(
      "linkTargetPlaceholder",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "note-1" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCreateLink).not.toHaveBeenCalled();
  });

  it("does not call onCreateLink when the target is already linked outgoing", () => {
    const onCreateLink = vi.fn();
    render(
      <SelectedNodeCard
        labels={labels}
        node={noteNode("note-1")}
        neighbors={[noteNode("note-2")]}
        localDepth={0}
        onLocalDepthChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        linkableItems={[{ id: "note-2", label: "Second" }]}
        outgoingLinkIds={new Map([["note-2", "lnk-existing"]])}
        onCreateLink={onCreateLink}
      />,
    );

    const input = screen.getByLabelText(
      "linkTargetPlaceholder",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "note-2" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCreateLink).not.toHaveBeenCalled();
  });

  it("calls onDeleteLink(linkId) for an outgoing-link neighbour row", () => {
    const onDeleteLink = vi.fn();
    render(
      <SelectedNodeCard
        labels={labels}
        node={noteNode("note-1")}
        neighbors={[noteNode("note-2"), noteNode("note-3")]}
        localDepth={0}
        onLocalDepthChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        outgoingLinkIds={new Map([["note-2", "lnk-1"]])}
        onCreateLink={vi.fn()}
        onDeleteLink={onDeleteLink}
      />,
    );

    // Only the outgoing-link neighbour (note-2) gets a remove button.
    const removeButtons = screen.getAllByLabelText("removeLink");
    expect(removeButtons).toHaveLength(1);
    fireEvent.click(removeButtons[0]);
    expect(onDeleteLink).toHaveBeenCalledWith("lnk-1");
  });

  it("resolves a datalist label to its id (byLabel path)", () => {
    // The user types/selects the visible label; the card must resolve it back
    // to the underlying items_meta id before calling onCreateLink.
    const onCreateLink = vi.fn();
    render(
      <SelectedNodeCard
        labels={labels}
        node={noteNode("note-1")}
        neighbors={[]}
        localDepth={0}
        onLocalDepthChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        linkableItems={[{ id: "note-2", label: "Second" }]}
        onCreateLink={onCreateLink}
      />,
    );

    const input = screen.getByLabelText(
      "linkTargetPlaceholder",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Second" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCreateLink).toHaveBeenCalledWith("note-1", "note-2");
  });

  it("passes a raw pasted id straight through (raw path)", () => {
    // A value that matches neither an id nor a label is treated as a pasted
    // cross-role items_meta id and forwarded verbatim.
    const onCreateLink = vi.fn();
    render(
      <SelectedNodeCard
        labels={labels}
        node={noteNode("note-1")}
        neighbors={[]}
        localDepth={0}
        onLocalDepthChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        linkableItems={[{ id: "note-2", label: "Second" }]}
        onCreateLink={onCreateLink}
      />,
    );

    const input = screen.getByLabelText(
      "linkTargetPlaceholder",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "daily-2026-06-30" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCreateLink).toHaveBeenCalledWith("note-1", "daily-2026-06-30");
  });

  it("reports the create-failure copy via onLinkError when onCreateLink rejects", async () => {
    // The card is presentational — on a rejected create it no longer renders an
    // inline alert; it hands the already-translated failure copy to onLinkError
    // (the host turns it into a toast).
    const onCreateLink = vi.fn().mockRejectedValue(new Error("boom"));
    const onLinkError = vi.fn();
    render(
      <SelectedNodeCard
        labels={labels}
        node={noteNode("note-1")}
        neighbors={[]}
        localDepth={0}
        onLocalDepthChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        linkableItems={[{ id: "note-2", label: "Second" }]}
        onCreateLink={onCreateLink}
        onLinkError={onLinkError}
      />,
    );

    const input = screen.getByLabelText(
      "linkTargetPlaceholder",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "note-2" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(onLinkError).toHaveBeenCalledWith("linkCreateFailed"),
    );
    // No inline alert is rendered anymore — the toast is the host's job.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reports the delete-failure copy via onLinkError when onDeleteLink rejects", async () => {
    const onDeleteLink = vi.fn().mockRejectedValue(new Error("boom"));
    const onLinkError = vi.fn();
    render(
      <SelectedNodeCard
        labels={labels}
        node={noteNode("note-1")}
        neighbors={[noteNode("note-2")]}
        localDepth={0}
        onLocalDepthChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        outgoingLinkIds={new Map([["note-2", "lnk-1"]])}
        onCreateLink={vi.fn()}
        onDeleteLink={onDeleteLink}
        onLinkError={onLinkError}
      />,
    );

    fireEvent.click(screen.getByLabelText("removeLink"));

    await waitFor(() =>
      expect(onLinkError).toHaveBeenCalledWith("linkDeleteFailed"),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("hides the add-link input for a tag node", () => {
    render(
      <SelectedNodeCard
        labels={labels}
        node={{ id: tagNodeId("t1"), label: "#t1", type: "tag" }}
        neighbors={[]}
        localDepth={0}
        onLocalDepthChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCreateLink={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("linkTargetPlaceholder")).toBeNull();
  });
});

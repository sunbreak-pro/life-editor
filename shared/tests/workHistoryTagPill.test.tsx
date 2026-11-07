import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { WorkHistoryList, type WorkHistoryEntry } from "../src/components";

/*
 * #2428 — the work history's tags after #2391 reshaped the shared TagPill.
 *
 * #2391 turned TagPill into a round pill on the neutral face with the tag's
 * colour on its glyph, and WorkHistoryList draws its tags through that pill in
 * both of its layouts. The browser checks of #2428 covered the Work tag picker
 * but not this list, so these pin what the list puts on screen: one round,
 * neutral pill per tag, the colour on the glyph only, and no remove control on
 * a history row (a past session's tags are read here, not edited).
 */

const ENTRY: WorkHistoryEntry = {
  id: "session-1",
  timeRange: "9:00–9:25",
  durationLabel: "25 min",
  target: { kind: "todo", title: "Draft the outline" },
  tags: [
    { id: "tag-a", name: "Writing", color: "#336699", icon: "Star" },
    { id: "tag-b", name: "Uncoloured", color: null, icon: null },
  ],
};

const LABELS = {
  heading: "Today",
  empty: "No sessions yet",
  noTarget: "No target",
  listLabel: "Work history",
};

function pillsIn(root: HTMLElement): HTMLElement[] {
  return ["Writing", "Uncoloured"].map(
    (name) => within(root).getByText(name).parentElement as HTMLElement,
  );
}

describe.each([
  ["card", { variant: "card" as const, entries: [ENTRY] }],
  [
    "rows",
    {
      variant: "rows" as const,
      entries: [],
      groups: [{ key: "today", heading: "Today", entries: [ENTRY] }],
    },
  ],
])("WorkHistoryList tags in the %s layout (#2428)", (_, props) => {
  it("draws each tag as a round pill on the neutral face", () => {
    const { container } = render(
      <WorkHistoryList labels={LABELS} {...props} />,
    );
    for (const pill of pillsIn(container)) {
      expect(pill.className).toContain("rounded-lumen-full");
      expect(pill.className).toContain("bg-lumen-bg-secondary");
      // The face never takes the tag's colour (#2391).
      expect(pill.style.backgroundColor).toBe("");
      expect(pill.style.borderColor).toBe("");
    }
  });

  it("puts the tag's colour on its glyph only", () => {
    const { container } = render(
      <WorkHistoryList labels={LABELS} {...props} />,
    );
    const [coloured, plain] = pillsIn(container);
    expect(coloured.querySelector("svg.lucide-star")).toHaveStyle({
      color: "#336699",
    });
    // No colour stored: the generic tag glyph, untinted.
    const glyph = plain.querySelector("svg.lucide-tag");
    expect(glyph).not.toBeNull();
    expect((glyph as SVGElement).style.color).toBe("");
  });

  it("offers no remove control on a past session's tags", () => {
    const { container } = render(
      <WorkHistoryList labels={LABELS} {...props} />,
    );
    for (const pill of pillsIn(container)) {
      expect(pill.querySelector("button")).toBeNull();
    }
  });
});

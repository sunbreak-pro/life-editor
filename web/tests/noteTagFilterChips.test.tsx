import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  NoteTagFilterChips,
  VISIBLE_LIMIT,
  type NoteTagFilterChip,
} from "../src/notes/NoteTagFilterChips";

/*
 * #1364 — picking a tag used to lift its chip to the front of the row, so the
 * next tag you meant to press had moved by the time you looked for it. These
 * pin the row's order as CALLER order, at both states of the cap.
 *
 * The cap is the reason the hoist existed (#1288: a selected chip must never
 * be the hidden one), so the interesting case is a selection BELOW the cap —
 * it has to stay on screen without being promoted.
 */

const LABELS = {
  group: "Tags",
  clear: "Clear",
  more: (count: number) => `more:${count}`,
  less: "less",
};

/** `count` chips named tag-a, tag-b, … in that order. Letters, not numbers,
    so stripping the trailing count off the chip's text leaves the name. */
function chipsOf(count: number): NoteTagFilterChip[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String.fromCharCode(97 + i);
    return { id: `t-${n}`, label: `tag-${n}`, count: 1 };
  });
}

/** The chip buttons in DOM order — the more/less and clear buttons carry no
    aria-pressed, which is what separates them from the chips. */
const chipLabels = () =>
  screen
    .getAllByRole("button")
    .filter((b) => b.hasAttribute("aria-pressed"))
    .map((b) => b.textContent?.replace(/\d+$/, "") ?? "");

function renderRow(chips: NoteTagFilterChip[], value: string[] = []) {
  const onToggle = vi.fn();
  const onClear = vi.fn();
  render(
    <NoteTagFilterChips
      chips={chips}
      value={value}
      onToggle={onToggle}
      onClear={onClear}
      labels={LABELS}
    />,
  );
  return { onToggle, onClear };
}

describe("NoteTagFilterChips keeps its order (#1364)", () => {
  beforeEach(cleanup);

  it("draws the chips in the order the caller gave them", () => {
    renderRow(chipsOf(4));

    expect(chipLabels()).toEqual(["tag-a", "tag-b", "tag-c", "tag-d"]);
  });

  it("leaves a selected chip exactly where it was", () => {
    renderRow(chipsOf(4), ["t-c"]);

    // Before #1364 this read tag-c, tag-a, tag-b, tag-d.
    expect(chipLabels()).toEqual(["tag-a", "tag-b", "tag-c", "tag-d"]);
    expect(screen.getByRole("button", { pressed: true }).textContent).toContain(
      "tag-c",
    );
  });

  it("does not rearrange as more chips are picked", () => {
    renderRow(chipsOf(5), ["t-d", "t-b"]);

    expect(chipLabels()).toEqual([
      "tag-a",
      "tag-b",
      "tag-c",
      "tag-d",
      "tag-e",
    ]);
  });

  it("still reports which chip was pressed, and still clears", () => {
    const { onToggle, onClear } = renderRow(chipsOf(3), ["t-a"]);

    fireEvent.click(screen.getByRole("button", { name: /tag-b/ }));
    expect(onToggle).toHaveBeenCalledExactlyOnceWith("t-b");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe("NoteTagFilterChips keeps the cap honest (#1288 under #1364)", () => {
  beforeEach(cleanup);

  const OVER = VISIBLE_LIMIT + 4;

  it("draws only the first VISIBLE_LIMIT and offers the rest", () => {
    renderRow(chipsOf(OVER));

    expect(chipLabels()).toHaveLength(VISIBLE_LIMIT);
    screen.getByRole("button", { name: `more:${OVER - VISIBLE_LIMIT}` });
  });

  it("keeps a selection from below the cap on screen, at the end", () => {
    const belowCap = chipsOf(OVER)[OVER - 1];
    renderRow(chipsOf(OVER), [belowCap.id]);

    const labels = chipLabels();
    // Kept — that is #1288's guarantee, which the hoist used to provide.
    expect(labels).toContain(belowCap.label);
    // But at the END, not promoted to the head of the row.
    expect(labels[labels.length - 1]).toBe(belowCap.label);
    expect(labels[0]).toBe("tag-a");
    // And the offer shrinks by the one that is no longer hidden.
    screen.getByRole("button", { name: `more:${OVER - VISIBLE_LIMIT - 1}` });
  });

  it("drops the toggle once nothing is left hidden", () => {
    const below = chipsOf(OVER)
      .slice(VISIBLE_LIMIT)
      .map((c) => c.id);
    renderRow(chipsOf(OVER), below);

    expect(chipLabels()).toHaveLength(OVER);
    expect(screen.queryByRole("button", { name: /^more:/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "less" })).toBeNull();
  });

  it("expands to everything, in caller order, and offers to collapse", () => {
    renderRow(chipsOf(OVER), ["t-l"]);

    fireEvent.click(screen.getByRole("button", { name: /^more:/ }));

    expect(chipLabels()).toEqual(chipsOf(OVER).map((c) => c.label));
    screen.getByRole("button", { name: "less" });
  });
});

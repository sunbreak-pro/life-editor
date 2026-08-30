import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TagPill } from "../src/components";

/*
 * #1291 — a tag's icon follows its name everywhere the name is shown.
 *
 * The chip used to draw a colour DOT, which said nothing for the tags that
 * never got a colour and nothing at all about the icon picked in the tag
 * editor. Every tag surface now resolves through the one <TagHeadingIcon>
 * path, so "edit the icon and the chips follow" holds by construction rather
 * than by each call site remembering to read `wiki_tags.icon` for itself.
 *
 * lucide stamps its component name onto the rendered <svg> (`lucide-star`,
 * `lucide-tag`), which is what lets these assert WHICH glyph came out without
 * a snapshot.
 */

/** The lucide glyph names a subtree rendered, e.g. ["star"]. */
function glyphNames(root: HTMLElement): string[] {
  return [...root.querySelectorAll("svg")]
    .map((svg) => /lucide-([a-z0-9-]+)/.exec(svg.getAttribute("class") ?? ""))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[1]);
}

describe("TagPill — the chip carries the tag's own icon (#1291)", () => {
  it("draws the stored icon", () => {
    const { container } = render(
      <TagPill name="work" color={null} icon="Star" />,
    );

    expect(glyphNames(container)).toEqual(["star"]);
  });

  it("falls back to the generic tag glyph when none is set", () => {
    const { container } = render(
      <TagPill name="work" color={null} icon={null} />,
    );

    // Not "no glyph": a chip without an icon still reads as a tag, which is
    // the same fallback the editor's master list has always drawn.
    expect(glyphNames(container)).toEqual(["tag"]);
  });

  it("tints the glyph with the tag colour", () => {
    const { container } = render(
      <TagPill name="work" color="#336699" icon="Star" />,
    );

    // Colour is user data, so it arrives as an inline style (the Kanban rule),
    // not as a token class.
    expect(container.querySelector("svg")).toHaveStyle({ color: "#336699" });
  });

  it("keeps the glyph decorative and the remove X the only control", () => {
    const onRemove = vi.fn();
    render(
      <TagPill
        name="work"
        color={null}
        icon="Star"
        onRemove={onRemove}
        removeLabel="Remove work"
      />,
    );

    expect(screen.getByRole("button", { name: "Remove work" })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("still reads as one tag: no leftover colour dot beside the glyph", () => {
    const { container } = render(
      <TagPill name="work" color="#336699" icon="Star" />,
    );

    // The dot and the tinted glyph said the same thing twice.
    expect(container.querySelectorAll(".rounded-full")).toHaveLength(0);
  });
});

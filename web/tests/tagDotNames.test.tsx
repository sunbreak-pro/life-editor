import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TagDotNames } from "../src/wikitag/TagDotNames";

/*
 * #2408: a row's tags, read-only. The dot takes the tag's colour and falls back
 * to a token for a tag that has none, and there is nothing to press: editing
 * stays in the panel, through <TagPicker>.
 */

const wiki = {
  loading: false,
  allTags: [
    { id: "tag-1", name: "Home", color: "#112233", icon: null },
    { id: "tag-2", name: "Plain", color: null, icon: null },
  ],
  getTagsForItem: vi.fn(),
};

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useWikiTagsUnifiedContext: () => wiki,
}));

beforeEach(() => {
  wiki.loading = false;
  wiki.getTagsForItem.mockReset();
  wiki.getTagsForItem.mockReturnValue([
    { id: "a-1", tagId: "tag-1" },
    { id: "a-2", tagId: "tag-2" },
  ]);
});

describe("TagDotNames", () => {
  it("draws a dot and a name per tag, and no control", () => {
    const { container } = render(<TagDotNames itemId="task-1" />);
    expect(wiki.getTagsForItem).toHaveBeenCalledWith("task-1");
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Plain")).toBeTruthy();
    expect(container.querySelectorAll("span.rounded-full")).toHaveLength(2);
    expect(container.querySelector("button")).toBeNull();
  });

  it("colours the dot with the tag, or the token when it has no colour", () => {
    render(<TagDotNames itemId="task-1" />);
    const dot = (name: string) =>
      screen.getByText(name).previousElementSibling as HTMLElement;
    expect(dot("Home").style.backgroundColor).toBe("rgb(17, 34, 51)");
    expect(dot("Home").className).not.toContain("bg-lumen-text-secondary");
    expect(dot("Plain").style.backgroundColor).toBe("");
    expect(dot("Plain").className).toContain("bg-lumen-text-secondary");
  });

  it("draws nothing while loading, without tags, or for a tag that is gone", () => {
    wiki.loading = true;
    const { container, rerender } = render(<TagDotNames itemId="task-1" />);
    expect(container.firstChild).toBeNull();

    wiki.loading = false;
    wiki.getTagsForItem.mockReturnValue([]);
    rerender(<TagDotNames itemId="task-1" />);
    expect(container.firstChild).toBeNull();

    wiki.getTagsForItem.mockReturnValue([{ id: "a-9", tagId: "tag-gone" }]);
    rerender(<TagDotNames itemId="task-1" />);
    expect(container.firstChild).toBeNull();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { Modal, TagEditModal, type TagEditRow } from "../src/components";
import { TAG_LABELS } from "./tagEditLabels";

/*
 * #830 — the tag panel asked for 860px and rendered at 448.
 *
 * `cn` is a plain string join, not tailwind-merge, so `className="max-w-[860px]"`
 * did not remove the `max-w-md` the Modal already carried: BOTH landed on the
 * panel and the stylesheet decided, in the order Tailwind happens to emit
 * utilities. jsdom has no layout (CLAUDE.md §7.1), so these tests cannot measure
 * a rendered width — but the bug was never about a computed pixel. It was about
 * two competing classes on one element, and that IS visible from the class list.
 *
 * So: the panel must carry exactly ONE max-w-*, and it must be the one the
 * caller asked for. The source scan at the bottom keeps the next call site from
 * reintroducing the collision through `className`.
 */

const ONE_MAX_WIDTH = /(?:^|\s)max-w-\S+/g;

const panel = () => screen.getByRole("dialog");
const panelClasses = () => panel().className;

describe("Modal — the caller's width wins, not the class order (#830)", () => {
  it("defaults to md with padding", () => {
    render(
      <Modal open onClose={vi.fn()} title="T">
        body
      </Modal>,
    );

    expect(panelClasses().match(ONE_MAX_WIDTH)).toEqual([" max-w-md"]);
    expect(panel()).toHaveClass("p-5");
  });

  it("emits the panel width INSTEAD of the default, never beside it", () => {
    render(
      <Modal open onClose={vi.fn()} title="T" size="panel">
        body
      </Modal>,
    );

    expect(panelClasses().match(ONE_MAX_WIDTH)).toEqual([" max-w-[860px]"]);
    expect(panel()).not.toHaveClass("max-w-md");
  });

  it("gives every size exactly one width", () => {
    for (const size of ["sm", "md", "lg", "xl", "panel"] as const) {
      const { unmount } = render(
        <Modal open onClose={vi.fn()} title="T" size={size}>
          body
        </Modal>,
      );
      expect(panelClasses().match(ONE_MAX_WIDTH)).toHaveLength(1);
      unmount();
    }
  });

  it("keeps w-full so a window narrower than the size still fits", () => {
    render(
      <Modal open onClose={vi.fn()} title="T" size="panel">
        body
      </Modal>,
    );

    // max-w is a CEILING; w-full lets the panel shrink under it, and the
    // backdrop's own padding keeps it off the window edge.
    expect(panel()).toHaveClass("w-full");
    expect(panel().parentElement).toHaveClass("p-4");
  });

  it("drops the panel padding but keeps the heading inset", () => {
    render(
      <Modal open onClose={vi.fn()} title="Tags" padded={false}>
        body
      </Modal>,
    );

    expect(panel()).not.toHaveClass("p-5");
    // Only the BODY rows asked to run edge to edge — a title flush against the
    // border is not what "unpadded" was for.
    expect(screen.getByRole("heading", { name: "Tags" })).toHaveClass(
      "px-5",
      "pt-5",
    );
  });
});

describe("TagEditModal opens at the width it asks for (#830)", () => {
  const ROWS: TagEditRow[] = [
    { id: "tag-1", name: "work", color: null, icon: null, count: 2, items: [] },
  ];

  it("renders an 860px panel with no competing default", () => {
    render(
      <TagEditModal
        open
        onClose={vi.fn()}
        tags={ROWS}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onSetColor={vi.fn()}
        onSetIcon={vi.fn()}
        onUnassign={vi.fn()}
        formatCount={(count) => `${count} items`}
        labels={TAG_LABELS}
      />,
    );

    // The regression itself: 448px worth of panel minus a 260px rail left the
    // right column too narrow to read.
    expect(panelClasses().match(ONE_MAX_WIDTH)).toEqual([" max-w-[860px]"]);
    expect(panel()).not.toHaveClass("p-5");
  });
});

/*
 * The prop only helps while call sites use it. This walks the JSX by hand
 * (brace- and quote-aware) rather than by regex, because `onClose={() => x()}`
 * puts a `>` inside the tag and a lazy `.*?>` would stop there — before the
 * className it is looking for.
 */
function modalOpeningTags(source: string): string[] {
  const tags: string[] = [];
  const marker = /<Modal(?=[\s/>])/g;
  let hit: RegExpExecArray | null;

  while ((hit = marker.exec(source)) !== null) {
    let depth = 0;
    let quote = "";
    let i = hit.index + hit[0].length;

    for (; i < source.length; i += 1) {
      const ch = source[i];
      if (quote) {
        if (ch === quote) quote = "";
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      else if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      else if (ch === ">" && depth === 0) break;
    }
    tags.push(source.slice(hit.index, i));
  }
  return tags;
}

function tsxFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFilesUnder(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("no Modal call site smuggles width or padding through className", () => {
  // Both packages, because the collision is a property of the shared component
  // and web/ renders it too (CalendarTab). They are one checkout and one CI
  // job away from each other, so scanning across the boundary costs nothing.
  const roots = ["../src", "../../web/src"].map((rel) =>
    fileURLToPath(new URL(rel, import.meta.url)),
  );

  it("keeps every <Modal> free of max-w-* and p-N in className", () => {
    const offenders: string[] = [];

    for (const file of roots.flatMap(tsxFilesUnder)) {
      for (const tag of modalOpeningTags(readFileSync(file, "utf8"))) {
        const className = /className=(?:"[^"]*"|\{[^}]*\})/.exec(tag)?.[0];
        // `size` and `padded` exist so these two never ride along in
        // className, where `cn` cannot make them win.
        if (className && /max-w-|(?:^|\s|")p-\d/.test(className)) {
          offenders.push(`${file}: ${className}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

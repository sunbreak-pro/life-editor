import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  ToastProvider,
  WikiTagsUnifiedProvider,
  type DataService,
} from "@life-editor/shared";
import { stubDataService, createBumpableSync } from "./helpers";
import { TagPicker } from "../src/wikitag/TagPicker";

/*
 * #2291 — the Mobile note screen, items 2, 3, 4, 5 and 8 of the 2026-10-19
 * sweep (the row's "…" is in notesSidebarRowEdit.test.tsx; the title field,
 * the stuck edge and the chip's X are in shared/tests/noteMobilePolish).
 *
 * jsdom has no layout and no media queries, so the stylesheet is read as text
 * and the picker's classes are what is pinned.
 */

const here = dirname(fileURLToPath(import.meta.url));
const indexCss = readFileSync(resolve(here, "../src/index.css"), "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(selector: string, from = indexCss): string {
  const at = from.indexOf(`${selector} {`);
  expect(at).toBeGreaterThanOrEqual(0);
  return from.slice(at, from.indexOf("}", at));
}

describe("Note body surfaces (#2291 item 3)", () => {
  it.each([
    ".note-editor .ProseMirror th",
    ".note-editor .ProseMirror code",
    ".note-editor .ProseMirror pre",
  ])("paints %s on the recessed surface, not the card's", (selector) => {
    const body = rule(selector);
    expect(body).toContain("background-color: var(--color-surface-sunken)");
    expect(body).not.toContain("--color-bg-secondary");
  });
});

describe("Note tables on a phone (#2291 item 4)", () => {
  it("gives every cell 10rem below the breakpoint and scrolls the wrapper", () => {
    const media = indexCss.indexOf("@media (max-width: 767px)", 0);
    const narrow = indexCss.slice(
      indexCss.indexOf(
        ".note-editor .ProseMirror th,\n  .note-editor .ProseMirror td {",
        media,
      ),
    );
    expect(narrow.slice(0, narrow.indexOf("}"))).toContain("min-width: 10rem");
    expect(rule(".note-editor .ProseMirror .tableWrapper")).toContain(
      "overflow-x: auto",
    );
  });
});

const { wrapper: SyncWrapper } = createBumpableSync();
const ITEM = "note-a";
const TAG = { id: "tag-work", name: "Work", color: null, icon: null };

function renderPicker(singleRow: boolean) {
  const ds = stubDataService({
    listAllWikiTagsUnified: async () => [
      { ...TAG },
      { id: "tag-home", name: "Home", color: null, icon: null },
    ],
    listAllTagConnections: async () => [],
    listAllTagAssignments: async () => [
      {
        id: "assign-work",
        itemId: ITEM,
        tagId: TAG.id,
        createdAt: "2026-10-19T00:00:00.000Z",
        updatedAt: "2026-10-19T00:00:00.000Z",
        isDisplayColor: false,
        isDeleted: false,
      },
    ],
  }) as DataService;
  render(
    <SyncWrapper>
      <ToastProvider>
        <WikiTagsUnifiedProvider dataService={ds}>
          <TagPicker itemId={ITEM} singleRow={singleRow} />
        </WikiTagsUnifiedProvider>
      </ToastProvider>
    </SyncWrapper>,
  );
}

describe("Note header tag row (#2291 items 2, 5 and 8)", () => {
  it("keeps the chips on one sideways-scrolling line, the + outside it", async () => {
    renderPicker(true);
    const remove = await screen.findByRole("button", {
      name: "Remove tag Work",
    });
    const strip = remove.closest("span.contents") as HTMLElement;
    expect(strip).not.toBeNull();
    expect(strip.className).toContain("max-md:overflow-x-auto");
    expect(strip.className).toContain("max-md:whitespace-nowrap");
    const add = screen.getByRole("button", { name: "Add tag" });
    expect(strip.contains(add)).toBe(false);
    expect(add.parentElement?.className).toContain("max-md:flex-nowrap");
  });

  it("wraps as before without singleRow", async () => {
    renderPicker(false);
    const remove = await screen.findByRole("button", {
      name: "Remove tag Work",
    });
    expect(remove.closest("span.contents")).toBeNull();
  });

  it("gives the chip's X and every picker row the 44px floor on narrow", async () => {
    renderPicker(false);
    const remove = await screen.findByRole("button", {
      name: "Remove tag Work",
    });
    expect(remove.className).toContain("max-md:min-h-11");
    expect(remove.className).toContain("max-md:min-w-11");

    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));
    const candidate = await screen.findByRole("button", { name: "Home" });
    expect(candidate.className).toContain("max-md:min-h-11");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Errands" },
    });
    const create = await screen.findByRole("button", { name: /Errands/ });
    expect(create.className).toContain("max-md:min-h-11");
  });
});

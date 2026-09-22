import { createRef } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, fireEvent } from "@testing-library/react";
import { Hash } from "lucide-react";
import {
  SlashMenu,
  type SlashMenuHandle,
  type SlashMenuItem,
} from "../src/notes/SlashMenu";
import {
  ItemLinkMenu,
  type ItemLinkMenuHandle,
  type ItemLinkMenuItem,
} from "../src/notes/ItemLinkMenu";

/*
 * #1902 — the highlighted row stays inside the list's own scroller.
 *
 * Both pickers cap themselves (max-h-72, or the inline cap the placer hands
 * them when the caret is near an edge) and scroll. Moving `selected` only
 * repainted the highlight, so holding ↓ walked the selection past the bottom
 * edge and left the user pressing Enter on a row they could not see.
 *
 * jsdom has no layout and no scrollIntoView, which is exactly why the fix calls
 * it optionally and why this test asserts the CALL rather than a scroll
 * position: there is no position to read (#475). The element it was called on
 * is read off the spy's `this`, so "the right row" is checked too.
 */

const ROWS = 12;

function slashItems(): SlashMenuItem[] {
  return Array.from({ length: ROWS }, (_, i) => ({
    id: `slash-${i}`,
    title: `Slash ${i}`,
    Icon: Hash,
    command: () => {},
  }));
}

function linkItems(): ItemLinkMenuItem[] {
  return Array.from({ length: ROWS }, (_, i) => ({
    id: `link-${i}`,
    title: `Link ${i}`,
    kind: "candidate" as const,
    Icon: Hash,
    command: () => {},
  }));
}

let scrollSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollSpy = vi.fn();
  // jsdom implements no scrollIntoView at all, so this both installs the seam
  // and proves the production call has to stay optional.
  (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView =
    scrollSpy;
});

afterEach(() => {
  delete (Element.prototype as unknown as { scrollIntoView?: unknown })
    .scrollIntoView;
  vi.restoreAllMocks();
});

function press(
  handle: { onKeyDown: (event: KeyboardEvent) => boolean },
  key: string,
) {
  act(() => {
    handle.onKeyDown(new KeyboardEvent("keydown", { key }));
  });
}

describe("slash menu keeps the selection in view (#1902)", () => {
  it("scrolls to the row ArrowDown just selected", () => {
    const ref = createRef<SlashMenuHandle>();
    const { container } = render(
      <SlashMenu
        ref={ref}
        items={slashItems()}
        command={() => {}}
        emptyLabel="nothing"
      />,
    );
    if (!ref.current) throw new Error("menu exposed no handle");

    press(ref.current, "ArrowDown");

    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest" });
    // `this` is the row it was called on — index 1 after one step down.
    const target = scrollSpy.mock.instances[0] as HTMLElement;
    expect(target.getAttribute("data-slash-index")).toBe("1");
    expect(target.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(ROWS);
  });

  it("follows the wrap ArrowUp makes from the top to the last row", () => {
    const ref = createRef<SlashMenuHandle>();
    render(
      <SlashMenu
        ref={ref}
        items={slashItems()}
        command={() => {}}
        emptyLabel="nothing"
      />,
    );
    if (!ref.current) throw new Error("menu exposed no handle");

    press(ref.current, "ArrowUp");

    const target = scrollSpy.mock.instances[0] as HTMLElement;
    expect(target.getAttribute("data-slash-index")).toBe(String(ROWS - 1));
  });

  it("does not scroll when the pointer moves the highlight", () => {
    // A list that scrolls under a stationary pointer slides the next row
    // beneath it, which moves the selection again — the list walks away from
    // the cursor on its own.
    const ref = createRef<SlashMenuHandle>();
    const { container } = render(
      <SlashMenu
        ref={ref}
        items={slashItems()}
        command={() => {}}
        emptyLabel="nothing"
      />,
    );

    const row = container.querySelector<HTMLElement>('[data-slash-index="5"]');
    if (!row) throw new Error("row 5 did not render");
    fireEvent.mouseEnter(row);

    expect(row.getAttribute("aria-selected")).toBe("true");
    expect(scrollSpy).not.toHaveBeenCalled();
  });
});

describe("the [[ picker does the same thing (#1902)", () => {
  it("scrolls to the row ArrowDown just selected", () => {
    const ref = createRef<ItemLinkMenuHandle>();
    render(
      <ItemLinkMenu
        ref={ref}
        items={linkItems()}
        command={() => {}}
        emptyLabel="nothing"
      />,
    );
    if (!ref.current) throw new Error("menu exposed no handle");

    press(ref.current, "ArrowDown");

    expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest" });
    const target = scrollSpy.mock.instances[0] as HTMLElement;
    expect(target.getAttribute("data-item-link-index")).toBe("1");
  });

  it("does not scroll when the pointer moves the highlight", () => {
    const ref = createRef<ItemLinkMenuHandle>();
    const { container } = render(
      <ItemLinkMenu
        ref={ref}
        items={linkItems()}
        command={() => {}}
        emptyLabel="nothing"
      />,
    );

    const row = container.querySelector<HTMLElement>(
      '[data-item-link-index="5"]',
    );
    if (!row) throw new Error("row 5 did not render");
    fireEvent.mouseEnter(row);

    expect(scrollSpy).not.toHaveBeenCalled();
  });
});

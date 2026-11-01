import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";
import {
  ITEM_LINK_KINDS,
  UNKNOWN_ITEM_LINK_VISUAL,
  itemLinkVisual,
  type ItemLinkVisual,
} from "@life-editor/shared";
import { RichTextEditor } from "../src/notes/RichTextEditor";
import { resolveItemLinkTarget } from "../src/notes/itemLinkNode";

/*
 * Click navigation on `[[…]]` item links (#475 — it was silently dead from #288
 * until then, with no test to catch it).
 *
 * These drive the REAL RichTextEditor through real DOM click events, which is
 * possible precisely because the fix moved navigation off ProseMirror's
 * coordinate-based single-click pipeline onto a plain `click` DOM handler: there
 * is no layout to fake, so nothing here is stubbed. A test written against the
 * old `handleClickOn` had to hand it a position that jsdom cannot compute — it
 * would have asserted a simulation, not the path the browser takes.
 */

function docWithLink(attrs: {
  targetId: string | null;
  label: string;
  role: string | null;
}) {
  return JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "see " },
          { type: "itemLink", attrs },
          { type: "text", text: " for details" },
        ],
      },
    ],
  });
}

const NOTE_LINK = docWithLink({
  targetId: "note-2",
  label: "Other note",
  role: "note",
});

function renderEditor(props: {
  content: string;
  onNavigateToItem?: (target: { id: string; role: string }) => void;
  editable?: boolean;
}) {
  const view = render(
    <RichTextEditor
      noteId="note-1"
      initialContent={props.content}
      onUpdate={() => {}}
      editable={props.editable ?? true}
      onNavigateToItem={props.onNavigateToItem}
    />,
  );
  return view;
}

/**
 * Dispatch a real left click and report whether the handler claimed it. A click
 * is preceded by its mousedown at the same point, because the handler measures
 * the two against each other to tell a click from a drag (see `drag` below).
 */
function click(
  el: Element,
  init: MouseEventInit = {},
): { defaultPrevented: boolean } {
  const at = { clientX: 40, clientY: 40, ...init };
  el.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...at,
    }),
  );
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...at,
  });
  el.dispatchEvent(event);
  return { defaultPrevented: event.defaultPrevented };
}

/** Press at one point and release at another — sweeping the label to copy it. */
function drag(el: Element, dx: number): { defaultPrevented: boolean } {
  el.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 40,
      clientY: 40,
    }),
  );
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: 40 + dx,
    clientY: 40,
  });
  el.dispatchEvent(event);
  return { defaultPrevented: event.defaultPrevented };
}

const link = (container: HTMLElement) =>
  container.querySelector("[data-item-link]") as HTMLElement;

describe("itemLink click navigation", () => {
  it("navigates on a resolved note link", () => {
    const onNavigateToItem = vi.fn();
    const { container } = renderEditor({
      content: NOTE_LINK,
      onNavigateToItem,
    });

    const { defaultPrevented } = click(link(container));

    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "note-2",
      role: "note",
    });
    expect(defaultPrevented).toBe(true);
  });

  // The role is what the host routes on (MainScreen's ITEM_NAV_TARGET maps
  // note/daily → Materials tabs and todo → Schedule → Todo), so the editor's
  // contract is "hand back the target's own role verbatim".
  it.each([
    ["task", "task-1779546217506"],
    ["daily", "daily-2026-07-29"],
  ])("passes the %s role through untouched", (role, id) => {
    const onNavigateToItem = vi.fn();
    const { container } = renderEditor({
      content: docWithLink({ targetId: id, label: "target", role }),
      onNavigateToItem,
    });

    click(link(container));

    expect(onNavigateToItem).toHaveBeenCalledWith({ id, role });
  });

  // The mobile read sheet mounts the editor with editable={false}; a read-only
  // note is exactly where following a link matters most.
  it("navigates in a read-only editor", () => {
    const onNavigateToItem = vi.fn();
    const { container } = renderEditor({
      content: NOTE_LINK,
      onNavigateToItem,
      editable: false,
    });

    click(link(container));

    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "note-2",
      role: "note",
    });
  });

  it("leaves an unresolved link inert so it stays selectable", () => {
    const onNavigateToItem = vi.fn();
    const { container } = renderEditor({
      content: docWithLink({
        targetId: null,
        label: "Nothing yet",
        role: null,
      }),
      onNavigateToItem,
    });
    const el = link(container);
    expect(el.className).toContain("item-link--unresolved");

    const { defaultPrevented } = click(el);

    expect(onNavigateToItem).not.toHaveBeenCalled();
    // Not claimed → ProseMirror still gets the click and can select the atom.
    expect(defaultPrevented).toBe(false);
    expect(link(container)).toBe(el);
  });

  it("ignores clicks on ordinary text", () => {
    const onNavigateToItem = vi.fn();
    const { container } = renderEditor({
      content: NOTE_LINK,
      onNavigateToItem,
    });

    const paragraph = container.querySelector("p") as HTMLElement;
    const { defaultPrevented } = click(paragraph);

    expect(onNavigateToItem).not.toHaveBeenCalled();
    expect(defaultPrevented).toBe(false);
  });

  // cmd/ctrl-click is ProseMirror's select-this-node gesture and shift-click
  // extends a selection; navigating away would hijack both.
  it.each([
    ["meta", { metaKey: true }],
    ["ctrl", { ctrlKey: true }],
    ["shift", { shiftKey: true }],
  ])("ignores %s-click so the select gesture survives", (_name, init) => {
    const onNavigateToItem = vi.fn();
    const { container } = renderEditor({
      content: NOTE_LINK,
      onNavigateToItem,
    });

    const { defaultPrevented } = click(link(container), init);

    expect(onNavigateToItem).not.toHaveBeenCalled();
    expect(defaultPrevented).toBe(false);
  });

  // Sweeping the label to copy it starts and ends inside the same span, so the
  // browser still fires a click — ProseMirror allows 4px of slop before it
  // treats a press as a drag, and this must match.
  it("ignores a drag that ends inside the link", () => {
    const onNavigateToItem = vi.fn();
    const { container } = renderEditor({
      content: NOTE_LINK,
      onNavigateToItem,
    });

    const { defaultPrevented } = drag(link(container), 12);

    expect(onNavigateToItem).not.toHaveBeenCalled();
    expect(defaultPrevented).toBe(false);
  });

  it("still navigates when the pointer only jitters", () => {
    const onNavigateToItem = vi.fn();
    const { container } = renderEditor({
      content: NOTE_LINK,
      onNavigateToItem,
    });

    drag(link(container), 3);

    expect(onNavigateToItem).toHaveBeenCalledTimes(1);
  });

  // The editor's extensions are built once per mount, so a callback that is
  // absent on the first render must still be reachable later — the whole point
  // of reading the host callback through a getter rather than capturing it.
  it("uses the callback the host passes AFTER mount", () => {
    const onNavigateToItem = vi.fn();
    const { container, rerender } = render(
      <RichTextEditor
        noteId="note-1"
        initialContent={NOTE_LINK}
        onUpdate={() => {}}
      />,
    );

    click(link(container));
    expect(onNavigateToItem).not.toHaveBeenCalled();

    rerender(
      <RichTextEditor
        noteId="note-1"
        initialContent={NOTE_LINK}
        onUpdate={() => {}}
        onNavigateToItem={onNavigateToItem}
      />,
    );
    click(link(container));

    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "note-2",
      role: "note",
    });
  });
});

/*
 * #2394 — the link draws as a chip with its kind's icon. The node builds that
 * icon out of lucide's internals (iconNodeOf), so the shapes are compared with
 * what the real React icon draws: a lucide bump that moves them goes red here.
 */
describe("itemLink chip", () => {
  /** The shapes one lucide icon draws, as React renders it. */
  function shapesOf({ Icon }: ItemLinkVisual): string[] {
    const { container } = render(createElement(Icon));
    const svg = container.querySelector("svg") as SVGSVGElement;
    return Array.from(svg.children).map((shape) => shape.outerHTML);
  }

  const chipIcon = (el: Element) =>
    el.querySelector(".item-link__icon") as SVGSVGElement;
  const shapesIn = (svg: SVGSVGElement) =>
    Array.from(svg.children).map((shape) => shape.outerHTML);

  it.each([...ITEM_LINK_KINDS])("draws the %s kind's own icon", (role) => {
    const { container } = renderEditor({
      content: docWithLink({ targetId: "item-1", label: "Target", role }),
    });

    const icon = chipIcon(link(container));

    expect(shapesIn(icon).length).toBeGreaterThan(0);
    expect(shapesIn(icon)).toEqual(shapesOf(itemLinkVisual(role)));
  });

  it("gives each of the four kinds a different icon", () => {
    const drawn = ITEM_LINK_KINDS.map((role) =>
      shapesOf(itemLinkVisual(role)).join(""),
    );
    expect(new Set(drawn).size).toBe(ITEM_LINK_KINDS.length);
  });

  // A goal or a table can be linked, and a stored role may be one this build
  // does not know: a link that cannot say its kind is still a link.
  it.each(["goal", "table", "something-new"])(
    "falls back to the neutral icon for the %s role",
    (role) => {
      const { container } = renderEditor({
        content: docWithLink({ targetId: "item-1", label: "Target", role }),
      });

      expect(shapesIn(chipIcon(link(container)))).toEqual(
        shapesOf(UNKNOWN_ITEM_LINK_VISUAL),
      );
    },
  );

  // Even with a role on it: there is nothing on the other end to be a kind of.
  it.each([null, "note"])(
    "draws an unresolved link with the neutral icon (role %s)",
    (role) => {
      const { container } = renderEditor({
        content: docWithLink({ targetId: null, label: "Nothing yet", role }),
      });
      const el = link(container);

      expect(el.className).toContain("item-link--unresolved");
      expect(shapesIn(chipIcon(el))).toEqual(
        shapesOf(UNKNOWN_ITEM_LINK_VISUAL),
      );
    },
  );

  it("makes the icon a real SVG element that a reader skips", () => {
    const { container } = renderEditor({ content: NOTE_LINK });

    const icon = chipIcon(link(container));

    const svgNs = "http://www.w3.org/2000/svg";
    expect(icon.namespaceURI).toBe(svgNs);
    expect(icon.firstElementChild?.namespaceURI).toBe(svgNs);
    expect(icon.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    // React's key is not an attribute of the drawn shape.
    expect(icon.firstElementChild?.hasAttribute("key")).toBe(false);
  });

  it("keeps the attributes the click handler and other selectors read", () => {
    const { container } = renderEditor({ content: NOTE_LINK });

    const el = link(container);

    expect(el.tagName).toBe("SPAN");
    expect(el.classList.contains("item-link")).toBe(true);
    expect(el.getAttribute("data-target-id")).toBe("note-2");
    expect(el.getAttribute("data-role")).toBe("note");
    expect(el.getAttribute("data-label")).toBe("Other note");
    // ProseMirror writes this on every leaf through the property, and jsdom
    // does not reflect that property onto the attribute.
    expect(el.contentEditable).toBe("false");
  });

  it("keeps the title readable beside the icon", () => {
    const { container } = renderEditor({ content: NOTE_LINK });

    const el = link(container);

    expect(el.querySelector(".item-link__label")?.textContent).toBe(
      "Other note",
    );
    // The icon adds no text, so anything reading the chip's text gets the title.
    expect(el.textContent).toBe("Other note");
    expect(el.getAttribute("title")).toBe("Other note");
    // The icon comes first, the way the header's chip and its row do it.
    expect(el.firstElementChild).toBe(chipIcon(el));
  });

  // The pointer lands on a <path> or the <svg> as often as on the title, and
  // those are not HTMLElements. The handler must still find the chip from them.
  it.each([
    ["the icon", (el: Element) => chipIcon(el)],
    [
      "a shape inside the icon",
      (el: Element) => chipIcon(el).firstElementChild!,
    ],
    ["the title", (el: Element) => el.querySelector(".item-link__label")!],
  ])("navigates from a click on %s", (_name, pick) => {
    const onNavigateToItem = vi.fn();
    const { container } = renderEditor({
      content: NOTE_LINK,
      onNavigateToItem,
    });

    const { defaultPrevented } = click(pick(link(container)));

    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "note-2",
      role: "note",
    });
    expect(defaultPrevented).toBe(true);
  });

  it("leaves a click on an unresolved chip's icon inert", () => {
    const onNavigateToItem = vi.fn();
    const { container } = renderEditor({
      content: docWithLink({
        targetId: null,
        label: "Nothing yet",
        role: null,
      }),
      onNavigateToItem,
    });

    const { defaultPrevented } = click(chipIcon(link(container)));

    expect(onNavigateToItem).not.toHaveBeenCalled();
    expect(defaultPrevented).toBe(false);
  });
});

describe("resolveItemLinkTarget", () => {
  it("rejects a link that belongs to another editor", () => {
    const root = document.createElement("div");
    const outside = document.createElement("span");
    outside.setAttribute("data-item-link", "");
    outside.setAttribute("data-target-id", "note-2");
    outside.setAttribute("data-role", "note");

    expect(resolveItemLinkTarget(root, outside)).toBeNull();
    root.appendChild(outside);
    expect(resolveItemLinkTarget(root, outside)).toEqual({
      id: "note-2",
      role: "note",
    });
  });

  it("returns null for a non-element event target", () => {
    expect(
      resolveItemLinkTarget(document.createElement("div"), null),
    ).toBeNull();
  });
});

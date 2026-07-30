import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/*
 * itemLink — inline atom node for `[[…]]` wiki-style item links (web Notes/
 * Daily editor). A single opaque inline token carrying the link target:
 *
 *   attrs.targetId  resolved items_meta.id  (null = unresolved link)
 *   attrs.label     the display text the user picked / typed
 *   attrs.role      the target's role (note / daily / …) for navigation
 *
 * Persistence is the editor's own getJSON() round-trip — the node only has to
 * exist in the schema for stored `[[…]]` JSON to survive a save→reload (which
 * is why RichTextEditor registers it UNCONDITIONALLY, even where the `[[`
 * suggestion + click navigation are off, so a note authored on one surface
 * opens without a schema error on another). renderHTML/parseHTML use
 * `data-item-link` attributes so the DOM copy path round-trips too, and
 * renderText emits `[[label]]` so plain-text extraction (briefing) and
 * clipboard keep something readable.
 *
 * Click navigation is a ProseMirror plugin listening on the plain DOM `click`
 * event (`handleDOMEvents.click`): it finds the clicked link with
 * `closest("[data-item-link]")` and calls the host `getOnNavigate()` callback
 * with { id, role }. An unresolved node is a no-op (so it can still be
 * selected / deleted).
 *
 * #475 — why navigation is a DOM `click` listener and NOT ProseMirror's
 * `handleClickOn`: `handleClickOn` only ever runs if ProseMirror's whole
 * single-click pipeline survives first — `eventBelongsToView`, no other plugin
 * claiming `mousedown` through handleDOMEvents, `posAtCoords()` returning
 * non-null AND resolving `inside` onto this atom's own position, and
 * MouseDown.up() not bailing out (shift held / pointer moved >4px / mouseup
 * target no longer inside the view). Those preconditions are layout- and
 * browser-dependent and have nothing to do with this node, yet every one of
 * them silently degrades a link click into "just select the atom" — the #475
 * symptom. A `handleDOMEvents` event type that ProseMirror has no built-in
 * handler for (click is one) gets a bare listener that goes straight to the
 * plugin props, so this path skips all of the above. Measured on the real
 * editor: no other plugin in the RichTextEditor extension set registers a
 * `click` DOM handler, so nothing can preempt this one.
 *
 * `handleClickOn` is still registered, but as a CLAIM ONLY (it never
 * navigates): when that pipeline does run, its selectClickedLeaf fallback would
 * leave the atom selected, and where the editor survives the navigation a
 * following keystroke would replace the link.
 *
 * lumen-* only — the visual treatment lives in web/src/index.css.
 */

export interface ItemLinkNavTarget {
  id: string;
  role: string;
}

export type ItemLinkNavigate = (target: ItemLinkNavTarget) => void;

/** Alias for the DOM Node type, which TipTap's `Node` import shadows here. */
type DomNode = globalThis.Node;

export interface ItemLinkOptions {
  /**
   * Getter for the host navigate callback, read at CLICK time — never captured
   * at mount. Same shape as itemLinkSuggestion's host wiring
   * (getOnResolvedInserted / getCreateNote) and for the same reason: the node
   * is built once per editor mount, so a directly captured prop would freeze
   * whatever value the host happened to pass on that first render.
   */
  getOnNavigate?: () => ItemLinkNavigate | undefined;
}

const itemLinkClickKey = new PluginKey("itemLinkClick");

/**
 * The navigation target of a clicked `[[…]]` link, or null when the click was
 * not on a navigable link. Reads the rendered `data-*` attributes (written by
 * renderHTML straight from the node attrs, so they mirror the model) instead of
 * mapping coordinates back to a document position — that mapping is the part
 * that breaks (see the #475 note above).
 *
 * Returns null for: a click outside any link, a link that does not belong to
 * this editor, and an UNRESOLVED link (no targetId / role) — the last one keeps
 * unresolved atoms inert so they stay selectable and deletable while editing.
 */
export function resolveItemLinkTarget(
  root: DomNode | null,
  eventTarget: EventTarget | null,
): ItemLinkNavTarget | null {
  const from = eventTarget as Element | null;
  if (!from || typeof from.closest !== "function") return null;
  const link = from.closest("[data-item-link]");
  if (!link || !root?.contains(link)) return null;
  const id = link.getAttribute("data-target-id");
  const role = link.getAttribute("data-role");
  if (!id || !role) return null;
  return { id, role };
}

const ItemLink = Node.create<ItemLinkOptions>({
  name: "itemLink",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,

  addOptions() {
    return {
      getOnNavigate: undefined,
    };
  },

  addAttributes() {
    return {
      targetId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-target-id") || null,
        renderHTML: (attrs) =>
          attrs.targetId ? { "data-target-id": attrs.targetId } : {},
      },
      label: {
        default: "",
        parseHTML: (el) =>
          el.getAttribute("data-label") ?? el.textContent ?? "",
        renderHTML: (attrs) => ({ "data-label": attrs.label }),
      },
      role: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-role") || null,
        renderHTML: (attrs) => (attrs.role ? { "data-role": attrs.role } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-item-link]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const resolved = !!node.attrs.targetId;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-item-link": "",
        class: resolved ? "item-link" : "item-link item-link--unresolved",
      }),
      node.attrs.label || "",
    ];
  },

  renderText({ node }) {
    return `[[${node.attrs.label ?? ""}]]`;
  },

  addProseMirrorPlugins() {
    const getOnNavigate = this.options.getOnNavigate;
    // Where the pointer went down, so a DRAG that starts and ends inside the
    // link (sweeping the label to copy it) is not mistaken for a click. Per
    // editor, not module-level. ProseMirror applies the same 4px slop to its
    // own single-click path (MouseDown.updateAllowDefault), which is why a drag
    // never reaches handleClickOn below either.
    let downAt: { x: number; y: number } | null = null;
    const navigable = (view: EditorView, event: MouseEvent) => {
      // Left button only, no modifier — cmd/ctrl-click is ProseMirror's "select
      // this node" gesture and shift-click extends a selection, so navigating
      // on those would take the editor away mid-edit.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return null;
      }
      if (
        downAt &&
        (Math.abs(downAt.x - event.clientX) > 4 ||
          Math.abs(downAt.y - event.clientY) > 4)
      ) {
        return null;
      }
      const target = resolveItemLinkTarget(view.dom, event.target);
      if (!target || !getOnNavigate?.()) return null;
      return target;
    };
    return [
      new Plugin({
        key: itemLinkClickKey,
        props: {
          handleDOMEvents: {
            mousedown: (_view, event) => {
              downAt = { x: event.clientX, y: event.clientY };
              // Never claim mousedown — ProseMirror owns focus / selection
              // start, and this only records where the gesture began.
              return false;
            },
            click: (view, event) => {
              const target = navigable(view, event);
              if (!target) return false;
              event.preventDefault();
              getOnNavigate?.()?.(target);
              return true;
            },
          },
          // Claim ONLY — navigation lives in the click handler above. When
          // ProseMirror's single-click path does run, its selectClickedLeaf
          // fallback would leave the atom selected; on the surfaces where the
          // editor survives the navigation (a self-link, or a role the host has
          // no destination for) the next keystroke would then replace the link.
          handleClickOn(view, _pos, node, _nodePos, event, direct) {
            if (!direct || node.type.name !== "itemLink") return false;
            return !!navigable(view, event);
          },
        },
      }),
    ];
  },
});

/**
 * Build the itemLink node with the host navigate getter wired in. Registered
 * unconditionally by RichTextEditor (schema must always know the node); the
 * `[[` suggestion that CREATES the nodes is gated separately.
 */
export function createItemLinkNode(options: ItemLinkOptions = {}): Node {
  return ItemLink.configure(options);
}

import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

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
 * Click navigation is a ProseMirror plugin (handleClickOn): a click on a
 * RESOLVED node calls the host `getOnNavigate()` callback with { id, role };
 * an unresolved node is a no-op (so it can still be selected / deleted).
 * lumen-* only — the visual treatment lives in web/src/index.css.
 */

export interface ItemLinkNavTarget {
  id: string;
  role: string;
}

export type ItemLinkNavigate = (target: ItemLinkNavTarget) => void;

export interface ItemLinkOptions {
  /**
   * Host navigate callback, invoked on a click of a RESOLVED link. Passed
   * directly (not through a ref): the only caller wires a referentially stable
   * `useCallback` here, so the node — built once per editor mount — never goes
   * stale. (The `[[` suggestion's frequently-changing inputs DO use the ref
   * getter pattern; navigation does not need it.)
   */
  onNavigate?: ItemLinkNavigate;
}

const itemLinkClickKey = new PluginKey("itemLinkClick");

const ItemLink = Node.create<ItemLinkOptions>({
  name: "itemLink",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,

  addOptions() {
    return {
      onNavigate: undefined,
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
    const onNavigate = this.options.onNavigate;
    return [
      new Plugin({
        key: itemLinkClickKey,
        props: {
          handleClickOn(_view, _pos, node, _nodePos, _event, direct) {
            if (!direct) return false;
            if (node.type.name !== "itemLink") return false;
            const targetId = node.attrs.targetId as string | null;
            const role = node.attrs.role as string | null;
            // Unresolved links (no target) are inert — let the click fall
            // through so the atom can still be selected / deleted while editing.
            if (!targetId || !role) return false;
            if (!onNavigate) return false;
            onNavigate({ id: targetId, role });
            return true;
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

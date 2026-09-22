import { Node, InputRule, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/*
 * linkCard — block atom for a URL that stands alone in the note (#1607).
 *
 * A URL written into the body used to be an underlined string and nothing else
 * (the Link mark, `openOnClick: false`), so a reader had to parse the URL
 * themselves to find out where it pointed, and an embedded file — a full-width
 * chip since #1606 — looked like a different kind of thing entirely. This is
 * that same shape for a link: a full-width block with the host as its heading,
 * the path underneath, and a delete button at the right edge.
 *
 *   attrs.href  the URL, exactly as it was written
 *
 * NOTHING IS FETCHED. Showing a page's real title means reading that site's
 * HTML, which a browser cannot do (CORS) without a proxy of our own, and a
 * proxy costs money the project does not spend (CLAUDE.md: $0 until it is
 * finished). A favicon would be the same trade in miniature — one request per
 * card to a third party, telling them what the user is reading. So the card
 * shows what the URL itself already says: host, then path. No network request
 * is added by this file.
 *
 * NOTHING IS REWRITTEN, EITHER. Only text the user types or pastes right now
 * becomes a card (the input rule and the paste handler below). A note written
 * before this existed keeps its underlined links, and opening it does not change
 * a byte of the stored JSON — converting on load would mean every old note is
 * rewritten by the autosave that follows the first open.
 *
 * WHAT IS AND IS NOT A CARD: a URL alone in its paragraph. A URL sitting in a
 * sentence stays an inline link, because turning it into a block would tear the
 * sentence in half.
 *
 * REGISTERED UNCONDITIONALLY, like itemLink, attachment (#1404) and callout
 * (#1521), and for the same reason: once one surface has written this node into
 * a document, every other surface has to be able to open that document. A schema
 * that does not know the node rejects the WHOLE document, and RichTextEditor
 * only logs that — the note comes up blank and the next autosave writes the
 * blank back over the real body.
 *
 * lumen-* only — the visual treatment lives in web/src/index.css.
 */

/** Node type name. It is stored in documents, so it never changes. */
export const LINK_CARD_NODE_TYPE = "linkCard";

export interface LinkCardLabels {
  /** Accessible name for the card's link, completed with the host. */
  open: string;
  /** Accessible name for the card's delete button. */
  remove: string;
}

export interface LinkCardNodeOptions {
  labels: LinkCardLabels;
}

/** A URL on its own: a scheme we open, and not one space anywhere in it. */
const STANDALONE_URL = /^https?:\/\/\S+$/;

/** Is this text a URL standing on its own? */
export function isStandaloneUrl(text: string): boolean {
  return STANDALONE_URL.test(text);
}

/**
 * The href this card is allowed to navigate to, or null.
 *
 * The rules above only ever build a card from http(s), but a DOCUMENT can hold
 * anything: the MCP server writes note bodies, and a note is synced from
 * wherever the user last edited it. An `href` is handed straight to the browser
 * on click, so a `javascript:` one would run in the app's own origin. Anything
 * that is not a plain http(s) URL is drawn as text with no href at all — still
 * readable, not clickable.
 */
export function safeHref(href: string): string | null {
  return isStandaloneUrl(href) ? href : null;
}

/**
 * The two lines the card shows, read out of the URL itself.
 *
 * `new URL()` throws on anything it cannot parse, and the callers' own check is
 * not proof that it will parse (`http://` passes the regex above). The fallback
 * prints the raw string rather than an empty card — a link the parser dislikes
 * is still a link the user meant to keep.
 */
export function describeUrl(href: string): { host: string; path: string } {
  // Anything this would not link to is shown verbatim. `new URL()` accepts far
  // more than http(s) — "javascript:alert(1)" parses happily, with an EMPTY host
  // and the rest as its path — so without this the card for one would draw a
  // blank heading and hide what it actually is.
  if (!isStandaloneUrl(href)) return { host: href, path: "" };
  try {
    const url = new URL(href);
    // "www." carries no information and costs four characters of a heading that
    // has to survive a 390px column.
    const host = url.host.replace(/^www\./, "");
    const path = `${url.pathname}${url.search}${url.hash}`;
    return { host, path: path === "/" ? "" : path };
  } catch {
    return { host: href, path: "" };
  }
}

const LinkCard = Node.create<LinkCardNodeOptions>({
  name: LINK_CARD_NODE_TYPE,
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      labels: { open: "Open link", remove: "Remove link" },
    };
  },

  addAttributes() {
    return {
      href: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-href") ?? "",
        renderHTML: (attrs) => ({ "data-href": attrs.href }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-link-card]" }];
  },

  /*
   * The DOM shape the node serialises to (clipboard, and the fallback when no
   * node view runs). The anchor carries the URL as its own text, so a card
   * copied into a plain editor arrives as a working link rather than an empty
   * box.
   */
  renderHTML({ node, HTMLAttributes }) {
    const href = String(node.attrs.href ?? "");
    const safe = safeHref(href);
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-link-card": "",
        class: "note-link-card",
      }),
      [
        "a",
        {
          class: "note-link-card__link",
          // An <a> with no href is not a link: no navigation, no focus stop.
          ...(safe
            ? { href: safe, rel: "noopener noreferrer", target: "_blank" }
            : {}),
        },
        href,
      ],
    ];
  },

  /** Plain-text extraction (briefing, clipboard as text) keeps the URL. */
  renderText({ node }) {
    return String(node.attrs.href ?? "");
  },

  /*
   * Typing one. The rule fires on the space or newline that ENDS the URL, which
   * is the first moment the text is finished — converting per keystroke would
   * turn "https://a" into a card before the user reached the rest of it.
   *
   * It converts only when the URL is the whole paragraph, which is read off
   * `$from.parent` rather than from the match: a URL typed after other words
   * stays an inline link.
   */
  addInputRules() {
    return [
      new InputRule({
        find: /^(https?:\/\/\S+)\s$/,
        handler: ({ state, range, match, commands }) => {
          const href = match[1];
          const $from = state.doc.resolve(range.from);
          const parent = $from.parent;
          if (!parent.isTextblock || parent.type.name !== "paragraph") return;
          if (parent.textContent.trim() !== href) return;
          const start = $from.before();
          /*
           * The card AND an empty paragraph after it (#1836).
           *
           * A card is a block atom, so replacing the paragraph with the card
           * alone leaves the selection on the node itself — the NodeSelection
           * that draws `.ProseMirror-selectednode`. The next keystroke replaces
           * what is selected, which is the card, and the URL the reader just
           * finished typing is gone from the document and from the save that
           * follows, without a word on screen.
           *
           * Inserting a paragraph in the same step gives the insertion an end
           * to collapse into: `insertContentAt` puts the caret at the end of
           * what it inserted, which is now inside an empty paragraph under the
           * card, and typing carries on there.
           *
           * The paragraph is added every time, not only when the card would
           * otherwise be the last block. The user was writing a sentence when
           * the URL turned into a card; the empty line under it is where the
           * rest of that sentence goes.
           */
          commands.insertContentAt(
            { from: start, to: start + parent.nodeSize },
            [
              { type: LINK_CARD_NODE_TYPE, attrs: { href } },
              { type: "paragraph" },
            ],
          );
        },
      }),
    ];
  },

  /*
   * Pasting one. The same condition read from the other side: the clipboard
   * holds a bare URL and the cursor sits in an empty paragraph. Pasting a URL
   * into the middle of a sentence falls through to TipTap's own handling and
   * stays an inline link.
   */
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("linkCardPaste"),
        props: {
          handlePaste: (view: EditorView, event: ClipboardEvent) => {
            const text = event.clipboardData?.getData("text/plain")?.trim();
            if (!text || !isStandaloneUrl(text)) return false;
            const { state } = view;
            const { $from, empty } = state.selection;
            if (!empty) return false;
            const parent = $from.parent;
            if (parent.type.name !== "paragraph") return false;
            if (parent.textContent.trim() !== "") return false;
            const type = state.schema.nodes[LINK_CARD_NODE_TYPE];
            if (!type) return false;
            const start = $from.before();
            view.dispatch(
              state.tr.replaceWith(
                start,
                start + parent.nodeSize,
                type.create({ href: text }),
              ),
            );
            return true;
          },
        },
      }),
    ];
  },

  addNodeView() {
    const labels = this.options.labels;
    return ({ node, editor, getPos }) => {
      const href = String(node.attrs.href ?? "");
      const { host, path } = describeUrl(href);

      const dom = document.createElement("div");
      dom.className = "note-link-card";
      dom.setAttribute("data-link-card", "");
      dom.setAttribute("data-href", href);

      const link = document.createElement("a");
      link.className = "note-link-card__link";
      const safe = safeHref(href);
      if (safe) {
        link.href = safe;
        link.rel = "noopener noreferrer";
        link.target = "_blank";
      }
      link.setAttribute("data-link-card-open", "");
      // The HOST is the accessible name, not the raw URL: a screen reader
      // reading a query string aloud tells the listener nothing.
      link.setAttribute("aria-label", `${labels.open}: ${host}`);

      const hostLine = document.createElement("span");
      hostLine.className = "note-link-card__host";
      hostLine.textContent = host;
      link.appendChild(hostLine);

      if (path) {
        const pathLine = document.createElement("span");
        pathLine.className = "note-link-card__path";
        pathLine.textContent = path;
        link.appendChild(pathLine);
      }
      dom.appendChild(link);

      /*
       * The delete button, the same arrangement the attachment chip grows in
       * #1606: a sibling of the anchor rather than a child, because a button
       * inside a link is invalid HTML; always visible, because a finger has no
       * hover; and only where the editor is writable, because a read-only
       * surface would draw a button that cannot do anything.
       *
       * `editor.options.editable` and not `editor.isEditable` — this runs while
       * the EditorView is still being constructed, and isEditable reads
       * `this.view`, which TipTap has not assigned yet.
       */
      if (editor.options.editable !== false) {
        dom.classList.add("note-link-card--removable");
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "note-link-card__delete";
        remove.setAttribute("data-link-card-remove", "");
        remove.setAttribute("aria-label", `${labels.remove}: ${host}`);
        remove.addEventListener("click", (event) => {
          event.preventDefault();
          const pos = typeof getPos === "function" ? getPos() : undefined;
          if (typeof pos !== "number") return;
          // The node's own range, so the blocks around it are untouched.
          // `scrollIntoView: false` for the reason onCreate's focus passes it
          // (RichTextEditor.tsx): the scroll runs coordsAtPos, which jsdom does
          // not implement, and the block being deleted is already on screen.
          editor
            .chain()
            .focus(undefined, { scrollIntoView: false })
            .deleteRange({ from: pos, to: pos + node.nodeSize })
            .run();
        });
        dom.appendChild(remove);
      }

      return {
        dom,
        /* Everything in here is written above, never by the user. */
        ignoreMutation: () => true,
        /*
         * Let the link and the delete button have their own clicks. The rest of
         * the node stays ProseMirror's (click selects the atom, drag moves it).
         */
        stopEvent: (event: Event) => {
          const target = event.target as Element | null;
          return typeof target?.closest === "function"
            ? target.closest(
                "[data-link-card-open], [data-link-card-remove]",
              ) !== null
            : false;
        },
      };
    };
  },
});

/**
 * Build the link-card node with its labels. Registered unconditionally by
 * RichTextEditor (the schema must always know the node).
 */
export function createLinkCardNode(options: LinkCardNodeOptions): Node {
  return LinkCard.configure(options);
}

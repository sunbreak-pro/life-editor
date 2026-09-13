import { Node, mergeAttributes } from "@tiptap/core";
import {
  ATTACHMENT_NODE_TYPE,
  isEmbeddableImage,
  formatAttachmentSize,
} from "@life-editor/shared";

/*
 * attachment — block atom node for an embedded image or an attached file
 * (#1404, web Notes editor).
 *
 *   attrs.path  object key in the private `attachments` Storage bucket
 *   attrs.name  the file's original name (the chip's label, the img's alt)
 *   attrs.mime  MIME type — decides image embed vs download chip
 *   attrs.size  bytes, for the chip's caption
 *
 * THE DOCUMENT STORES A PATH, NEVER A URL. The bucket is private, so a URL
 * for one of these objects is signed and expires within the hour
 * (ATTACHMENT_URL_TTL_SECONDS). Writing one into the note would mean choosing
 * between a note whose pictures break overnight and a bucket that is public
 * forever. The path is durable, so the node resolves a fresh URL each time it
 * is drawn — which is what `addNodeView` below is for.
 *
 * REGISTERED UNCONDITIONALLY, like itemLink and for the same reason: a note
 * authored with an image has to open without a schema error on every surface,
 * including the ones that pass no resolver. Those draw the node's fallback
 * (the file name, unlinked) rather than failing to load the document.
 *
 * WHY A PLAIN NODEVIEW AND NOT ReactNodeViewRenderer: this needs one async
 * assignment to `img.src` and nothing else — no state, no hooks, no React
 * children. itemLinkNode next door is plain DOM too, so the editor keeps a
 * single idiom for its custom nodes.
 *
 * lumen-* only — the visual treatment lives in web/src/index.css.
 */

/** Resolve a signed, time-limited URL for a stored object. */
export type ResolveAttachmentUrl = (path: string) => Promise<string>;

export interface AttachmentLabels {
  /** Shown in place of the image / link when no URL could be resolved. */
  unavailable: string;
  /** Accessible name for the file chip's download link. */
  download: string;
  /** Accessible name for the file chip's delete button (#1606). */
  remove: string;
}

export interface AttachmentNodeOptions {
  /**
   * Getter for the host resolver, read at DRAW time rather than captured at
   * mount — same contract as itemLinkNode's `getOnNavigate`, because the node
   * is built once per editor mount and a directly captured prop would freeze
   * at whatever the host passed on that first render.
   *
   * Absent (or returning undefined) leaves every node in its fallback state.
   */
  getResolveUrl?: () => ResolveAttachmentUrl | undefined;
  labels: AttachmentLabels;
}

const Attachment = Node.create<AttachmentNodeOptions>({
  // Shared, not a literal: the orphan sweep (#1438) decides what to DELETE by
  // matching this exact type name in stored documents, so the two must not be
  // able to drift apart.
  name: ATTACHMENT_NODE_TYPE,
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      getResolveUrl: undefined,
      labels: {
        unavailable: "Attachment unavailable",
        download: "Download",
        remove: "Remove attachment",
      },
    };
  },

  addAttributes() {
    return {
      path: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-path") ?? "",
        renderHTML: (attrs) => ({ "data-path": attrs.path }),
      },
      name: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-name") ?? "",
        renderHTML: (attrs) => ({ "data-name": attrs.name }),
      },
      mime: {
        default: "application/octet-stream",
        parseHTML: (el) =>
          el.getAttribute("data-mime") ?? "application/octet-stream",
        renderHTML: (attrs) => ({ "data-mime": attrs.mime }),
      },
      size: {
        default: 0,
        // Number(null) is 0, which is also the default, so a missing attribute
        // and an unparseable one land in the same place: no caption.
        parseHTML: (el) => Number(el.getAttribute("data-size")) || 0,
        renderHTML: (attrs) => ({ "data-size": String(attrs.size ?? 0) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-attachment]" }];
  },

  /*
   * The DOM shape the node serialises to (clipboard, and the fallback when no
   * node view runs). It carries the attributes and the file NAME — never a
   * URL, which would be expired by the time anything read this back.
   */
  renderHTML({ node, HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-attachment": "",
        class: "note-attachment",
      }),
      ["figcaption", {}, String(node.attrs.name ?? "")],
    ];
  },

  /** Plain-text extraction (briefing, clipboard as text) keeps the name. */
  renderText({ node }) {
    return `[${node.attrs.name ?? "attachment"}]`;
  },

  addNodeView() {
    const getResolveUrl = this.options.getResolveUrl;
    const labels = this.options.labels;
    return ({ node, editor, getPos }) => {
      const path = String(node.attrs.path ?? "");
      const name = String(node.attrs.name ?? "");
      const mime = String(node.attrs.mime ?? "");
      const size = Number(node.attrs.size ?? 0);

      const dom = document.createElement("figure");
      dom.className = "note-attachment";
      dom.setAttribute("data-attachment", "");
      dom.setAttribute("data-path", path);
      dom.setAttribute("data-name", name);
      dom.setAttribute("data-mime", mime);
      dom.setAttribute("data-size", String(size));

      const isImage = isEmbeddableImage(mime);
      if (!isImage) dom.classList.add("note-attachment--file");
      /*
       * Built up front, before any URL exists, so the node occupies its place
       * in the document from the first frame. The async step below only ever
       * fills in `src` / `href`; it never decides the shape.
       */
      const media = document.createElement(isImage ? "img" : "a");
      if (media instanceof HTMLImageElement) {
        // The file name IS the alt text. A generic "image" would be worse than
        // nothing for a screen reader, and the name is the only description
        // this node has.
        media.alt = name;
        media.className = "note-attachment__image";
        media.draggable = false;
      } else {
        media.className = "note-attachment__file";
        media.setAttribute("data-attachment-download", "");
        media.setAttribute("aria-label", `${labels.download}: ${name}`);
        media.rel = "noopener noreferrer";
        media.target = "_blank";
        // `download` asks the browser to save rather than navigate. It is
        // honoured only for same-origin or CORS-permitted responses; where it
        // is not, target="_blank" above keeps the click from replacing the app.
        media.setAttribute("download", name);
        const label = document.createElement("span");
        label.className = "note-attachment__name";
        label.textContent = name;
        media.appendChild(label);
        const caption = formatAttachmentSize(size);
        if (caption) {
          const meta = document.createElement("span");
          meta.className = "note-attachment__meta";
          meta.textContent = caption;
          media.appendChild(meta);
        }
      }
      dom.appendChild(media);

      /*
       * The delete button (#1606) — the chip's own way out.
       *
       * Until now the only way to remove an attachment was to select the atom
       * and press Backspace, which is no affordance at all on a touch screen.
       * The button takes the node out of the DOCUMENT; the object stays in the
       * bucket, where the orphan sweep (#1438) decides its fate. That split is
       * deliberate — an undo has to be able to bring the node back, and it
       * cannot bring back a deleted file.
       *
       * ALWAYS VISIBLE, never hover-only: a finger has no hover, so a delete
       * that lived behind `:hover` would be unreachable on the surface that
       * needs it most. It is a real <button>, so Tab reaches it too.
       *
       * A SIBLING of the anchor, not a child: a button inside a link is invalid
       * HTML and nests two controls the keyboard has to tell apart. CSS parks it
       * over the anchor's right edge, which is what lets the anchor stay the
       * full-width element this issue measures.
       *
       * IMAGES DO NOT GET ONE — #1606 scopes itself to the file chip and leaves
       * the image's presentation alone.
       *
       * `editor.options.editable` rather than `editor.isEditable`: this runs
       * while the EditorView is still being constructed, and isEditable reads
       * `this.view`, which TipTap has not assigned yet — it would be false on
       * every surface, editable or not. RichTextEditor's setEditable keeps
       * options.editable in step, so the two agree everywhere else.
       */
      if (!isImage && editor.options.editable !== false) {
        dom.classList.add("note-attachment--removable");
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "note-attachment__delete";
        remove.setAttribute("data-attachment-remove", "");
        remove.setAttribute(
          "aria-label",
          name ? `${labels.remove}: ${name}` : labels.remove,
        );
        remove.addEventListener("click", (event) => {
          event.preventDefault();
          const pos = typeof getPos === "function" ? getPos() : undefined;
          if (typeof pos !== "number") return;
          // The node's own range, so the blocks around it are untouched.
          // `scrollIntoView: false` for the same reason onCreate's focus passes
          // it (RichTextEditor.tsx): the scroll runs coordsAtPos, which jsdom
          // does not implement, and the block being deleted is already on
          // screen.
          editor
            .chain()
            .focus(undefined, { scrollIntoView: false })
            .deleteRange({ from: pos, to: pos + node.nodeSize })
            .run();
        });
        dom.appendChild(remove);
      }

      /*
       * Resolving the URL is a real round trip (a signature comes from the
       * server), so it happens once per draw and the result is written
       * straight onto the element. `cancelled` covers the note switch that
       * destroys this view while the request is still out — assigning to a
       * detached element is harmless, but leaving the failure branch to run
       * would replace a node the user has already navigated away from.
       */
      let cancelled = false;
      const fail = () => {
        if (cancelled) return;
        dom.classList.add("note-attachment--unavailable");
        media.remove();
        const note = document.createElement("figcaption");
        note.className = "note-attachment__fallback";
        note.textContent = name
          ? `${name} — ${labels.unavailable}`
          : labels.unavailable;
        dom.appendChild(note);
      };
      const resolve = getResolveUrl?.();
      if (!resolve || !path) {
        fail();
      } else {
        void resolve(path).then(
          (url) => {
            if (cancelled) return;
            if (media instanceof HTMLImageElement) media.src = url;
            else (media as HTMLAnchorElement).href = url;
          },
          () => fail(),
        );
      }

      return {
        dom,
        destroy() {
          cancelled = true;
        },
        /*
         * Everything inside this view is written by the code above, never by
         * the user, so no mutation of it is a document edit. Without this
         * ProseMirror would read the async `src` assignment as content having
         * changed under it and try to re-parse the node out of the DOM.
         */
        ignoreMutation: () => true,
        /*
         * Let the download link and the delete button have their own clicks.
         * The rest of the node stays ProseMirror's (click selects the atom,
         * drag moves it) — without the delete half a press on the button would
         * be read as "select this atom" and the button would never fire.
         */
        stopEvent: (event: Event) => {
          const target = event.target as Element | null;
          return typeof target?.closest === "function"
            ? target.closest(
                "[data-attachment-download], [data-attachment-remove]",
              ) !== null
            : false;
        },
      };
    };
  },
});

/**
 * Build the attachment node with the host URL resolver wired in. Registered
 * unconditionally by RichTextEditor (the schema must always know the node);
 * the slash entries that CREATE these nodes are gated separately.
 */
export function createAttachmentNode(options: AttachmentNodeOptions): Node {
  return Attachment.configure(options);
}

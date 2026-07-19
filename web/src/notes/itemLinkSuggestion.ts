import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { FileText, CalendarDays, CheckSquare, Link2, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ItemLinkMenu,
  type ItemLinkMenuHandle,
  type ItemLinkMenuItem,
} from "./ItemLinkMenu";

/*
 * "[[" item-link suggestion extension (web Notes/Daily editor). Types "[[" to
 * open an autocomplete of existing items (Notion/Obsidian-style); picking one
 * inserts a resolved `itemLink` atom (itemLinkNode.ts). Built on TipTap's
 * Suggestion util exactly like slashCommand.ts — a ReactRenderer positioned
 * against the caret rect (no tippy), z-index 60, Escape-to-close.
 *
 * `char: "[["` is escaped by @tiptap/suggestion's findSuggestionMatch
 * (escapeForRegEx), and `query = match[0].slice(char.length)` strips the two
 * "[" — so the two-char trigger works and the query is the text after "[[".
 * `allowSpaces` lets multi-word titles match; `allowedPrefixes: null` lets the
 * trigger fire after any character (wiki links are typed mid-sentence).
 *
 * Host wiring is read through getters (not captured values) so the extension,
 * built once per editor mount, always sees the latest link pool + callbacks:
 *   - getTargets()            the current candidate pool (notes / dailies / …)
 *   - onResolvedInserted(id)  fired after a RESOLVED link is inserted (the host
 *                             upserts the item_links edge for the graph)
 *   - createNote(label)       optional; when provided a "create note & link"
 *                             row appears (returns the new id or null on fail)
 * Labels are host-injected (i18n stays host-side); the two action rows format
 * the live query through host callbacks so ja/en word order stays correct.
 */

export interface ItemLinkTarget {
  id: string;
  label: string;
  role: string;
}

export interface ItemLinkSuggestionLabels {
  empty: string;
  /** Formats the "insert '<query>' as an unresolved link" row title. */
  unresolved: (query: string) => string;
  /** Formats the "create note '<query>' and link" row title. */
  create: (query: string) => string;
  roleNote: string;
  roleDaily: string;
}

export interface ItemLinkSuggestionDeps {
  getTargets: () => ItemLinkTarget[];
  labels: ItemLinkSuggestionLabels;
  /** Host hook: a resolved link was inserted (upsert the item_links edge). */
  getOnResolvedInserted: () => ((targetId: string) => void) | undefined;
  /** Host hook: create a note for `label`, returning its id (or null). */
  getCreateNote: () =>
    ((label: string) => Promise<{ id: string } | null>) | undefined;
}

// Cap the candidate list so the popup stays compact (the action rows sit below).
const MAX_CANDIDATES = 8;

const ROLE_ICON: Record<string, LucideIcon> = {
  note: FileText,
  daily: CalendarDays,
  task: CheckSquare,
};

function roleIcon(role: string): LucideIcon {
  return ROLE_ICON[role] ?? Link2;
}

function roleHint(role: string, labels: ItemLinkSuggestionLabels): string {
  if (role === "note") return labels.roleNote;
  if (role === "daily") return labels.roleDaily;
  return role;
}

/** Insert a resolved link node + a trailing space, then notify the host. */
function insertResolved(
  editor: Editor,
  range: Range,
  target: ItemLinkTarget,
  onResolvedInserted: ((targetId: string) => void) | undefined,
): void {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent([
      {
        type: "itemLink",
        attrs: {
          targetId: target.id,
          label: target.label,
          role: target.role,
        },
      },
      { type: "text", text: " " },
    ])
    .run();
  onResolvedInserted?.(target.id);
}

/** Insert an unresolved link node (targetId null) + a trailing space. */
function insertUnresolved(editor: Editor, range: Range, label: string): void {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent([
      { type: "itemLink", attrs: { targetId: null, label, role: null } },
      { type: "text", text: " " },
    ])
    .run();
}

function buildItems(
  query: string,
  deps: ItemLinkSuggestionDeps,
): ItemLinkMenuItem[] {
  const { labels } = deps;
  const q = query.trim().toLowerCase();
  const targets = deps.getTargets();
  const onResolvedInserted = deps.getOnResolvedInserted();
  const createNote = deps.getCreateNote();

  const filtered = (
    q ? targets.filter((t) => t.label.toLowerCase().includes(q)) : targets
  ).slice(0, MAX_CANDIDATES);

  const items: ItemLinkMenuItem[] = filtered.map((target) => ({
    id: target.id,
    title: target.label,
    hint: roleHint(target.role, labels),
    kind: "candidate",
    Icon: roleIcon(target.role),
    command: ({ editor, range }) =>
      insertResolved(editor, range, target, onResolvedInserted),
  }));

  const trimmed = query.trim();
  if (trimmed) {
    const exactMatch = targets.some((t) => t.label.toLowerCase() === q);
    // Only offer the raw-text fallback when nothing matches exactly.
    if (!exactMatch) {
      items.push({
        id: "__unresolved__",
        title: labels.unresolved(trimmed),
        kind: "unresolved",
        Icon: Link2,
        command: ({ editor, range }) =>
          insertUnresolved(editor, range, trimmed),
      });
    }
    if (createNote) {
      items.push({
        id: "__create__",
        title: labels.create(trimmed),
        kind: "create",
        Icon: Plus,
        command: ({ editor, range }) => {
          // Async: strip the "[[query" first (sync), then await the create and
          // insert a resolved node — falling back to an unresolved node if the
          // host could not create the note.
          editor.chain().focus().deleteRange(range).run();
          void (async () => {
            const created = await createNote(trimmed);
            // Today's hosts resolve createNote in a microtask, but guard the
            // await boundary anyway — a chain() on a torn-down editor throws.
            if (editor.isDestroyed) return;
            if (created) {
              const target: ItemLinkTarget = {
                id: created.id,
                label: trimmed,
                role: "note",
              };
              const at = editor.state.selection.from;
              editor
                .chain()
                .focus()
                .insertContentAt(at, [
                  {
                    type: "itemLink",
                    attrs: {
                      targetId: target.id,
                      label: target.label,
                      role: target.role,
                    },
                  },
                  { type: "text", text: " " },
                ])
                .run();
              onResolvedInserted?.(target.id);
            } else {
              const at = editor.state.selection.from;
              editor
                .chain()
                .focus()
                .insertContentAt(at, [
                  {
                    type: "itemLink",
                    attrs: { targetId: null, label: trimmed, role: null },
                  },
                  { type: "text", text: " " },
                ])
                .run();
            }
          })();
        },
      });
    }
  }

  return items;
}

type ItemLinkRender = SuggestionOptions<ItemLinkMenuItem>["render"];

function itemLinkRender(emptyLabel: string): ItemLinkRender {
  return () => {
    let renderer: ReactRenderer<ItemLinkMenuHandle> | null = null;
    let popup: HTMLDivElement | null = null;

    const position = (rect: DOMRect | null | undefined) => {
      if (!popup || !rect) return;
      popup.style.left = `${rect.left + window.scrollX}px`;
      popup.style.top = `${rect.bottom + window.scrollY + 6}px`;
    };

    // Full teardown, safe to call more than once — subsequent onUpdate/onExit
    // become no-ops (both guard on the nulled refs). Used by Escape and onExit.
    const destroy = () => {
      popup?.remove();
      popup = null;
      renderer?.destroy();
      renderer = null;
    };

    return {
      onStart: (props) => {
        renderer = new ReactRenderer(ItemLinkMenu, {
          props: { ...props, emptyLabel },
          editor: props.editor,
        });
        popup = document.createElement("div");
        popup.style.position = "absolute";
        popup.style.zIndex = "60";
        popup.appendChild(renderer.element);
        document.body.appendChild(popup);
        position(props.clientRect?.());
      },
      onUpdate: (props) => {
        if (!renderer) return;
        renderer.updateProps({ ...props, emptyLabel });
        position(props.clientRect?.());
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          destroy();
          return true;
        }
        return renderer?.ref?.onKeyDown(props.event) ?? false;
      },
      onExit: destroy,
    };
  };
}

/**
 * Build the "[[" item-link suggestion extension. Host wiring (targets +
 * callbacks) is read through getters so the extension never goes stale.
 */
export function createItemLinkSuggestion(
  deps: ItemLinkSuggestionDeps,
): Extension {
  return Extension.create({
    name: "itemLinkSuggestion",
    addProseMirrorPlugins() {
      return [
        Suggestion<ItemLinkMenuItem>({
          editor: this.editor,
          char: "[[",
          allowSpaces: true,
          startOfLine: false,
          // Wiki links are typed mid-sentence — allow the trigger after any
          // character (the default only fires after whitespace / line start).
          allowedPrefixes: null,
          command: ({ editor, range, props }) => {
            props.command({ editor, range });
          },
          items: ({ query }) => buildItems(query, deps),
          render: itemLinkRender(deps.labels.empty),
        }),
      ];
    },
  });
}

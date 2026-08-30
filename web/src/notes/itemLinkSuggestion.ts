import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import { FileText, CalendarDays, CheckSquare, Link2, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { balanceByRole, isImeComposing } from "@life-editor/shared";
import {
  ItemLinkMenu,
  type ItemLinkMenuHandle,
  type ItemLinkMenuItem,
} from "./ItemLinkMenu";
import { createSuggestionPopup, type SuggestionPopup } from "./suggestionPopup";

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
 *   - loadTargets()           the candidate pool (notes / dailies / …), fetched
 *                             on demand — see the lazy note on `items` below
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
  /**
   * Soft-deleted (#1292). The pool carries these rows so a SURFACE THAT ALREADY
   * HOLDS THE ID can still name it — a stored `item_links` edge outlives its
   * target, and without the row the only thing left to draw was the id. Nothing
   * that OFFERS a target may show one: the menu below drops them on load.
   */
  isDeleted?: boolean;
}

export interface ItemLinkSuggestionLabels {
  empty: string;
  /** Formats the "insert '<query>' as an unresolved link" row title. */
  unresolved: (query: string) => string;
  /** Formats the "create note '<query>' and link" row title. */
  create: (query: string) => string;
  roleNote: string;
  roleDaily: string;
  roleTodo: string;
}

export interface ItemLinkSuggestionDeps {
  /**
   * Load the candidate pool (#430). Called only once the menu is opening, so
   * nothing is fetched while the user is merely typing prose. `allowStale`
   * is true for every call after the menu opened, so a sync bump caused by
   * typing the query itself cannot trigger a re-fetch mid-session.
   */
  loadTargets: (options: {
    allowStale: boolean;
  }) => Promise<ItemLinkTarget[]> | ItemLinkTarget[];
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
  if (role === "task") return labels.roleTodo;
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

async function buildItems(
  query: string,
  deps: ItemLinkSuggestionDeps,
  allowStale: boolean,
): Promise<ItemLinkMenuItem[]> {
  const { labels } = deps;
  const q = query.trim().toLowerCase();
  // @tiptap/suggestion awaits this before calling onStart/onUpdate, so the
  // menu appears already populated — no empty flash on the first "[[".
  // Deleted rows ride along in the pool for LinkPanel's benefit (#1292); the
  // menu wants live items only, so they come off here — once, before both the
  // candidate list and the `exactMatch` test below read `targets`.
  const targets = (await deps.loadTargets({ allowStale })).filter(
    (t) => !t.isDeleted,
  );
  const onResolvedInserted = deps.getOnResolvedInserted();
  const createNote = deps.getCreateNote();

  // balanceByRole, not slice: the pool is concatenated per role (notes →
  // dailies → todos), so a plain cut handed all 8 slots to notes and the todo
  // candidates added in #370 never reached the menu on a 8+ note vault.
  const filtered = balanceByRole(
    q ? targets.filter((t) => t.label.toLowerCase().includes(q)) : targets,
    MAX_CANDIDATES,
  );

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
            // Today's hosts resolve createNote in a microtodo, but guard the
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

// Exported for `web/tests/suggestionImeGuard.test.ts`: the Escape branch is
// one line and easy to delete by accident, and it cannot be reached through
// `createItemLinkSuggestion` without standing up a whole ProseMirror editor.
export function itemLinkRender(
  emptyLabel: string,
  session: { onOpen: () => void; onClose: () => void },
): ItemLinkRender {
  return () => {
    let renderer: ReactRenderer<ItemLinkMenuHandle> | null = null;
    let popup: SuggestionPopup | null = null;

    // Full teardown, idempotent: a second call finds both refs nulled and only
    // re-runs session.onClose(), which is already a no-op when nothing is open.
    // Called by Escape, by onExit, and by onStart before it opens a new menu.
    const destroy = () => {
      session.onClose();
      popup?.destroy();
      popup = null;
      renderer?.destroy();
      renderer = null;
    };

    return {
      onStart: (props) => {
        // @tiptap/suggestion's `view.update` awaits items() BEFORE calling
        // onStart, and the handler is async — so while the first "[[" is still
        // fetching (#430 made items() async), a second update can run to
        // completion and tear the session down. Resuming here would then mount
        // a popup with no live suggestion behind it: nothing ever exits it
        // again, so it stays pinned on screen, and `menuOpen` would be left
        // true. Bail out when the plugin says the suggestion is no longer
        // active. (A legitimate `moved && changed` restart keeps active=true.)
        const state = itemLinkPluginKey.getState(props.editor.state) as
          { active?: boolean } | undefined;
        if (state?.active !== true) return;
        // The active check above is not enough on its own: two overtaking
        // updates can BOTH be active and land two onStarts with no onExit
        // between them. Whichever popup arrived first would be overwritten and
        // orphaned on document.body — listeners, observer and a mounted React
        // tree included, with nothing left holding a reference to close it.
        destroy();
        session.onOpen();
        renderer = new ReactRenderer(ItemLinkMenu, {
          props: { ...props, emptyLabel },
          editor: props.editor,
        });
        // Placement lives in suggestionPopup: below the caret when it fits,
        // flipped above when the soft keyboard leaves no room, capped to the
        // visible area either way (#471).
        popup = createSuggestionPopup((maxHeight) =>
          renderer?.updateProps({ maxHeight }),
        );
        popup.el.appendChild(renderer.element);
        popup.position(props.clientRect);
      },
      onUpdate: (props) => {
        if (!renderer || !popup) return;
        renderer.updateProps({ ...props, emptyLabel });
        popup.position(props.clientRect);
      },
      onKeyDown: (props) => {
        // IME guard (rules/frontend.md §Gotchas): while a Japanese conversion
        // is open, Escape means "cancel the conversion", not "close the
        // suggestion". Without this, one Escape tore the popup down AND
        // swallowed the candidate the user was still choosing.
        if (props.event.key === "Escape" && !isImeComposing(props.event)) {
          destroy();
          // Tearing down the view is not enough: the plugin stays ACTIVE, so
          // every following keystroke still runs items() — with the session
          // closed, so `allowStale` is false and each one re-fetches the whole
          // pool, which is exactly what #430 removed. Close the suggestion the
          // way the library closes it.
          const { view } = props;
          view.dispatch(
            view.state.tr.setMeta(itemLinkPluginKey, { exit: true }),
          );
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
// Own PluginKey — @tiptap/suggestion falls back to one SHARED default key, and
// ProseMirror throws (RangeError: keyed plugin twice) when this and the "/"
// slash-command suggestion are both registered on the same editor.
const itemLinkPluginKey = new PluginKey("itemLinkSuggestion");

export function createItemLinkSuggestion(
  deps: ItemLinkSuggestionDeps,
): Extension {
  // One menu at a time per editor. While a menu is open every keystroke calls
  // items() again, and each of those keystrokes also bumps the sync version
  // (the query text is written into the doc) — without this flag the pool
  // would look stale on every keystroke and re-fetch under the user (#430).
  //
  // Known minor: a `moved && changed` transition (a second "[[" opened while
  // one is already active) restarts the session but runs items() before the
  // old session's onExit, so the new menu opens on the cached pool. Candidates
  // may be one open old there; the next clean open refreshes.
  let menuOpen = false;

  return Extension.create({
    name: "itemLinkSuggestion",
    addProseMirrorPlugins() {
      return [
        Suggestion<ItemLinkMenuItem>({
          pluginKey: itemLinkPluginKey,
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
          items: ({ query }) => buildItems(query, deps, menuOpen),
          render: itemLinkRender(deps.labels.empty, {
            onOpen: () => {
              menuOpen = true;
            },
            onClose: () => {
              menuOpen = false;
            },
          }),
        }),
      ];
    },
  });
}

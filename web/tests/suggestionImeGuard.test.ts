import { describe, it, expect, vi } from "vitest";
import type { EditorView } from "@tiptap/pm/view";
import type { SuggestionKeyDownProps } from "@tiptap/suggestion";
import { itemLinkRender } from "../src/notes/itemLinkSuggestion";
import { slashRender } from "../src/notes/slashCommand";

/*
 * IME guard on the two editor suggestion menus (#670 C3 PR 4).
 *
 * `rules/frontend.md §Gotchas`: a keydown handler must check `isComposing`.
 * Escape is the case that bites — while a Japanese conversion is open it means
 * "cancel the conversion", but both menus read it as "close the menu", so one
 * Escape did both and the candidate the user was still choosing vanished with
 * the popup.
 *
 * What this pins is the CODE PATH, not the IME itself: jsdom has no input
 * method, so `isComposing` is set on the event here rather than produced by a
 * real conversion. Closing the menu is observable as the `exit` meta dispatched
 * onto the view — that dispatch is what must not happen mid-composition. The
 * end-to-end behaviour still needs a real browser (see the PR body).
 *
 * The render factories are reached directly: `createItemLinkSuggestion` /
 * `createSlashCommand` bury them inside a ProseMirror plugin that cannot be
 * built without a live editor.
 */

function escapeKeydown(isComposing: boolean): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "Escape", isComposing });
}

/** A view stub that records dispatches; `tr.setMeta` returns a sentinel. */
function stubView(): { view: EditorView; dispatch: ReturnType<typeof vi.fn> } {
  const dispatch = vi.fn();
  const view = {
    state: { tr: { setMeta: () => ({ __tr: true }) } },
    dispatch,
  } as unknown as EditorView;
  return { view, dispatch };
}

function keyDownProps(
  view: EditorView,
  event: KeyboardEvent,
): SuggestionKeyDownProps {
  return { view, event, range: { from: 0, to: 0 } } as SuggestionKeyDownProps;
}

const RENDERERS = [
  {
    name: "[[ item-link suggestion",
    make: () =>
      itemLinkRender?.("empty", { onOpen: () => {}, onClose: () => {} })?.(),
  },
  {
    name: "slash-command menu",
    make: () => slashRender?.("empty")?.(),
  },
];

describe.each(RENDERERS)("$name — Escape IME guard", ({ make }) => {
  it("does NOT close while an IME composition is open", () => {
    const handlers = make();
    const { view, dispatch } = stubView();

    const handled = handlers?.onKeyDown?.(
      keyDownProps(view, escapeKeydown(true)),
    );

    // No exit meta dispatched: the menu survives, and the Escape is left to
    // the input method to consume as "cancel conversion".
    expect(dispatch).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });

  it("still closes on a plain Escape", () => {
    const handlers = make();
    const { view, dispatch } = stubView();

    const handled = handlers?.onKeyDown?.(
      keyDownProps(view, escapeKeydown(false)),
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(handled).toBe(true);
  });
});

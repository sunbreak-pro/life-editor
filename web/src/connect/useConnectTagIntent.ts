import { useEffect } from "react";
import {
  setConnectItemSelection,
  setConnectTagSelection,
} from "@life-editor/shared";

/*
 * The shell's "open this tag" arriving at ConnectScreen (#2395), as a pending
 * prop consumed once, the same shape as useScheduleShellIntents.
 *
 * On a fresh mount the store has already seeded the tag (openTagInConnect wrote
 * it before switching), so there is nothing to do but consume. On a screen
 * already up it is an ordinary selection, discard question included. The shell
 * wrote the store ahead of that question, so it goes back first: refusing has to
 * leave the screen, and what it comes back to later, exactly as they were.
 *
 * In a hook of its own for the reason that file gives: it fires once per arrival,
 * and the intent exists only as a prop, so there is no event handler to move it
 * into.
 */

export interface ConnectTagIntent {
  pendingTagId: string | null;
  onConsume?: () => void;
  selectedTagId: string | null;
  selectedItemId: string | null;
  /** The screen's own selection path, which asks about a pending draft. */
  selectTag: (tagId: string) => void;
}

export function useConnectTagIntent({
  pendingTagId,
  onConsume,
  selectedTagId,
  selectedItemId,
  selectTag,
}: ConnectTagIntent): void {
  useEffect(() => {
    if (!pendingTagId) return;
    onConsume?.();
    if (pendingTagId === selectedTagId) return;
    setConnectTagSelection(selectedTagId);
    setConnectItemSelection(selectedItemId);
    selectTag(pendingTagId);
  }, [pendingTagId, onConsume, selectedTagId, selectedItemId, selectTag]);
}

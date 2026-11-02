import { useCallback, useContext, useRef, useState } from "react";
import { WikiTagsUnifiedContext } from "@life-editor/shared";

/*
 * The event editor's staged tags (#2447).
 *
 * The tag picker used to write each pick on the spot, while every other field
 * waited for 「保存」. So 「キャンセル」 and the discard answer took back the
 * title and left the tag on the event — and its colour on the calendar. The
 * create panel's tag field (#2220) already stages, so this brings the edit
 * panel in line with it: picks are held here per write target and written as
 * one diff from the pane's save press.
 *
 * Keyed by the target id, not by the open item: a repeat can point the tags at
 * its series or at this one occurrence (#1663), and a change staged against
 * one must not land on the other when the scope flips before saving. An id is
 * unique across roles (CLAUDE.md §4), so the id alone is the key.
 *
 * Optional on the Provider. The Schedule always mounts it, but a host that
 * does not (the editor's own wiring suite) gets a draft that is never dirty
 * and a picker left to write on its own, which is what it had before.
 */
export function useEventTagDraft(onWriteFailed: () => void) {
  const wiki = useContext(WikiTagsUnifiedContext);
  const [edits, setEdits] = useState<Record<string, string[]>>({});
  // One save at a time: the edits stay staged until the writes land, so a
  // second press in between would send the same diff twice.
  const savingRef = useRef(false);

  const liveTagIds = useCallback(
    (targetId: string) =>
      wiki ? wiki.getTagsForItem(targetId).map((a) => a.tagId) : [],
    [wiki],
  );

  const dirty =
    wiki !== null &&
    Object.entries(edits).some(([targetId, staged]) => {
      const live = liveTagIds(targetId);
      return (
        staged.length !== live.length || staged.some((id) => !live.includes(id))
      );
    });

  /** What the picker for `targetId` should show and report into. */
  const stagedFor = (targetId: string) =>
    wiki
      ? {
          tagIds: edits[targetId] ?? liveTagIds(targetId),
          onChange: (tagIds: string[]) =>
            setEdits((prev) => ({ ...prev, [targetId]: tagIds })),
        }
      : undefined;

  /** Drop everything staged — the panel moved to another row. */
  const reset = useCallback(() => setEdits({}), []);

  const save = () => {
    if (!wiki || savingRef.current) return;
    savingRef.current = true;
    const pending = Object.entries(edits);
    void (async () => {
      try {
        for (const [targetId, staged] of pending) {
          const live = wiki.getTagsForItem(targetId);
          for (const a of live) {
            if (!staged.includes(a.tagId)) await wiki.unassignTagFromItem(a.id);
          }
          // In the staged order, one at a time: the earliest-assigned tag is
          // the one that colours the event until someone picks (#1580).
          for (const tagId of staged) {
            if (!live.some((a) => a.tagId === tagId))
              await wiki.assignTagToItem(targetId, tagId);
          }
        }
      } catch (err) {
        console.error("event tag save failed", err);
        onWriteFailed();
      } finally {
        savingRef.current = false;
        // Cleared after the writes, not before: the cache the picker falls
        // back to only holds the new tags once they have landed, and clearing
        // early would flash the old chips back for the length of the request.
        setEdits({});
      }
    })();
  };

  return { dirty, stagedFor, reset, save };
}

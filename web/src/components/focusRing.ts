/*
 * Shared focus-visible ring (notion tokens only — no hardcoded colors).
 * Single source for the keyboard focus ring used across the web views; was
 * previously copy-pasted into NotesView / NotePasswordDialog / WikiTags, where
 * the ring-offset had already drifted (offset-1 vs offset-2). Appended to a
 * className string: `className={\`… ${FOCUS_RING}\`}`.
 */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notion-accent focus-visible:ring-offset-2 focus-visible:ring-offset-notion-bg";

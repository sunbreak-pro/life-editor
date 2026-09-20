import { logServiceError } from "../utils/logError";

/*
 * Notes write failures (#1761).
 *
 * Every Notes mutation is optimistic: the local state changes first and the
 * request goes out behind it, so the screen is already showing the new world
 * by the time the driver rejects. Until now those rejections only reached
 * `console.warn` — a delete killed by a dropped connection looked to the user
 * like a button that did nothing, with the row quietly back in the list and
 * nothing saying why.
 *
 * The console line stays (it carries the driver's message, which user-facing
 * copy deliberately does not); the host is now told as well, so it can raise a
 * toast. Read paths are NOT here: a failed fetch leaves the screen showing
 * what it already had, and the retry is the next sync tick.
 */

/** The optimistic Notes writes whose failure the user has to be told about. */
export type NoteWriteOp =
  "create" | "update" | "delete" | "pin" | "restore" | "permanentDelete";

/**
 * Host hook for a write that was already applied locally and then refused.
 * Injected, not imported: the copy has to be translated, and shared code takes
 * its strings from the host (CLAUDE.md §6.4).
 */
export type NoteWriteErrorHandler = (
  operation: NoteWriteOp,
  error: unknown,
) => void;

/** Log as before, then hand the failure to the host (if it wants it). */
export function reportNoteWriteError(
  operation: NoteWriteOp,
  error: unknown,
  onWriteError?: NoteWriteErrorHandler,
): void {
  logServiceError("Notes", operation, error);
  onWriteError?.(operation, error);
}

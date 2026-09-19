/*
 * The gate an undo closure waits on before reversing a write (#1682).
 *
 * An undo command is pushed the moment the user acts, which is earlier than
 * the write it reverses reaches the server. Press Ctrl+Z into that gap and the
 * reversal races its own subject: the note create lands AFTER the delete that
 * was meant to cancel it, and the note comes back with the undo already spent.
 *
 * So the closure waits. Not the push — making `push` wait would leave a window
 * where the user has acted and the history does not know it yet, and Ctrl+Z in
 * that window would silently reverse the wrong thing. Waiting inside the
 * closure keeps the stack honest about what happened and only delays the part
 * that actually needs the server to have caught up.
 *
 * It resolves on a FAILED write too, on purpose: if the create never landed
 * there is nothing to race, and the reversal should go ahead (the delete finds
 * no row and says so). The write's own failure is reported by whoever owns it;
 * what the undo reports is whether ITS write landed.
 */
export function afterSettled(
  write: Promise<unknown> | undefined,
): Promise<void> {
  if (!write) return Promise.resolve();
  return write.then(
    () => {},
    () => {},
  );
}

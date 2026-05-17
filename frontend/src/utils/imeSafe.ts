/**
 * Returns true while an IME (Input Method Editor) composition is active.
 *
 * Japanese / Chinese / Korean input confirms a candidate with the Enter key.
 * That confirmation Enter must NOT trigger submit / commit / newline / API send
 * / node finalization. Call this at the very top of an `onKeyDown` handler that
 * acts on Enter (or Tab) for a text input surface and early-return when true:
 *
 * ```ts
 * const handleKeyDown = (e: React.KeyboardEvent) => {
 *   if (isImeComposing(e)) return; // skip IME confirmation Enter/Tab
 *   if (e.key === "Enter") submit();
 * };
 * ```
 *
 * Handles both React synthetic events (via `e.nativeEvent.isComposing`) and
 * raw DOM `KeyboardEvent` (via `e.isComposing`). Always returns an explicit
 * boolean.
 */
export function isImeComposing(
  e: React.KeyboardEvent | KeyboardEvent,
): boolean {
  return (
    (e as React.KeyboardEvent).nativeEvent?.isComposing ??
    (e as KeyboardEvent).isComposing ??
    false
  );
}

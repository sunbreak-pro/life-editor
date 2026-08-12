/*
 * "Is this keydown part of an IME composition?" — one answer, for every
 * keydown handler in the app (#737).
 *
 * A Japanese conversion is confirmed with Enter and cancelled with Escape, so a
 * handler that treats those as "save" or "close" fires in the middle of the
 * user still choosing a candidate: the draft commits half-typed, or the popup
 * disappears taking the conversion with it.
 *
 * TWO facts are needed to see it, and the app had been shipping one or the
 * other depending on the file:
 *
 *   isComposing    — true for the keydowns raised WHILE composing.
 *   keyCode === 229 — the platform's own "this key belongs to the IME" marker.
 *     WebKit (the project's main target — macOS + iOS, CLAUDE.md §1) reports
 *     the Enter that CONFIRMS a conversion with `isComposing: false` and this
 *     keyCode, so `isComposing` alone lets exactly the worst keypress through.
 *
 * `keyCode` is deprecated but not replaced: nothing else distinguishes that
 * confirming Enter, which is why it is still the standard IME guard.
 *
 * Takes either a React synthetic keyboard event (React does not surface
 * `isComposing`, hence the `nativeEvent` hop) or a plain DOM one, so document
 * listeners, ProseMirror suggestion handlers and JSX `onKeyDown` all ask the
 * same question.
 */

/** The two fields the answer is read from. */
type ComposingSource = Pick<KeyboardEvent, "isComposing" | "keyCode">;

/** A React synthetic keyboard event, structurally — no React import here. */
type SyntheticLike = { nativeEvent: ComposingSource };

export function isImeComposing(e: ComposingSource | SyntheticLike): boolean {
  const source = "nativeEvent" in e ? e.nativeEvent : e;
  return source.isComposing || source.keyCode === 229;
}

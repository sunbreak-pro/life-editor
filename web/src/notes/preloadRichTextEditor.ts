/*
 * Warm the TipTap chunk without rendering it (#1115).
 *
 * Briefing's evening reflection rests as plain text and swaps in the editor on
 * a press. That press is the one moment the user waits on the 118 KB gzip
 * chunk, so the preview fires this from pointer-enter and focus — a beat
 * earlier, while they are still deciding.
 *
 * The SAME specifier as the boundary in LazyRichTextEditor.tsx, so rollup
 * emits one chunk (it keys them by module id) and whichever call comes second
 * is a module-registry hit. Its own module because
 * react-refresh/only-export-components refuses a component file that also
 * exports a plain function — the rule that gave lazySections.ts its own file.
 *
 * Fire-and-forget: a failed warm-up leaves exactly the behaviour there was
 * before it existed, and there is nothing useful to say to a user about a
 * fetch they never asked for.
 */
export function preloadRichTextEditor(): void {
  void import("./RichTextEditor").catch(() => {});
}

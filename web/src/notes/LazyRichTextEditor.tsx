import { lazy, Suspense } from "react";
import type { RichTextEditorProps } from "./RichTextEditor";

/*
 * The TipTap editor, loaded on demand (#991).
 *
 * TipTap bundles ProseMirror and is the single heaviest dependency in the app
 * (356 KB minified, 111 KB gzipped). Notes has been code-split since #676 (a),
 * but three OTHER screens imported the editor directly — Briefing, Daily and
 * the todo detail — and Briefing is the default landing section
 * (useStartupSection). One static import from there is enough to put the whole
 * editor in the first download, which is why splitting Notes bought so little:
 * measured on #797, lazy() was reaching 9% of a 2,090 KB initial bundle.
 *
 * The three hosts render it inside a panel the user has already opened, so the
 * chunk is fetched while they are looking at the surrounding chrome rather
 * than at a blank screen.
 *
 * NoteBodyEditor keeps its direct import on purpose. It lives inside NotesView,
 * which is already behind lazy(), so its copy is off the first download
 * anyway — routing it through here would only add a second round trip between
 * "Notes opened" and "you can type".
 */
const RichTextEditorLazy = lazy(() =>
  import("./RichTextEditor").then((m) => ({ default: m.RichTextEditor })),
);

/**
 * Placeholder sized like the editor's own frame so the panel does not jump
 * when the chunk lands. It borrows `className` for exactly that reason — the
 * Daily card passes its own fill/scroll chrome, and a fallback with the
 * default border would be the wrong shape there.
 */
function EditorPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={
        className ?? "rounded-md border border-lumen-border bg-lumen-bg p-3"
      }
      aria-hidden
    />
  );
}

export function LazyRichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense fallback={<EditorPlaceholder className={props.className} />}>
      <RichTextEditorLazy {...props} />
    </Suspense>
  );
}

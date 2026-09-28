import { useRef, useState } from "react";
import { isImeComposing } from "@life-editor/shared";

/**
 * The sheet's title field (#2032). Commits on Enter and on blur — the sheet
 * has no save button, and closing it (the close button, the backdrop) moves
 * focus off the field first, so a typed name is not lost to a dismiss. An
 * empty or unchanged name writes nothing. Enter is IME-safe: the Enter that
 * confirms a conversion does not commit (#737).
 */
export function NoteRenameField({
  value,
  label,
  onCommit,
}: {
  value: string;
  label: string;
  onCommit: (title: string) => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState(value);
  // The last name written from here, so the blur that follows an Enter does
  // not write the same name a second time.
  const committed = useRef(value);
  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === committed.current) return;
    committed.current = trimmed;
    onCommit(trimmed);
  };
  return (
    <label className="flex flex-col gap-1 text-xs text-lumen-text-secondary">
      {label}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (isImeComposing(e)) return;
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        // bg-secondary, not bg: the #552 pairing, same as the popover's field.
        className="min-h-11 w-full rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-3 text-base text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      />
    </label>
  );
}

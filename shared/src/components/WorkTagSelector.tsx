import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Tag as TagIcon } from "lucide-react";
import { TagPill } from "./TagPill";
import { TagHeadingIcon } from "./TagHeadingIcon";
import { TAP_TARGET } from "./styleTokens";
import { cn } from "./cn";
import { isImeComposing } from "../utils/imeGuard";

/*
 * WorkTagSelector — the tag field next to the Work screen's link-target
 * selector (#1665). It picks the tags a FREE SESSION will carry: when the timer
 * runs with nothing linked, the Provider files the time as a "Free session"
 * Event once the session closes, and these tags go onto that Event.
 *
 * Why not the item-bound TagPicker (web/src/wikitag): that one writes an
 * assignment the moment a tag is chosen, against an item id that already
 * exists. Here the item does not exist yet — it is minted when the session
 * ends — so the selection is held as plain ids by the host and applied later.
 * The dropdown mirrors TagPicker's (search / existing candidates / "create")
 * so the two read as the same control.
 *
 * Pure primitive (§6.4): tags, selection and copy come from the host, and
 * creating a tag is a callback — nothing here reaches a DataService.
 *
 * `disabled` is the state when a link target IS chosen: no free session will be
 * created, so the tags would go nowhere. The field stays on screen (dimmed,
 * with the host's hint as its title) rather than vanishing, so the row does not
 * jump every time the user picks or clears a target.
 */

export interface WorkTagOption {
  id: string;
  name: string;
  color: string | null;
  icon?: string | null;
}

export interface WorkTagSelectorLabels {
  heading: string;
  add: string;
  addShort: string;
  search: string;
  create: (name: string) => string;
  remove: (name: string) => string;
  noCandidates: string;
  dialog: string;
  /** Shown as the field's description while `disabled`. */
  disabledHint: string;
}

export interface WorkTagSelectorProps {
  tags: WorkTagOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Create a tag by name and resolve with it (the host writes it). */
  onCreate: (name: string) => Promise<WorkTagOption>;
  labels: WorkTagSelectorLabels;
  disabled?: boolean;
  className?: string;
}

export function WorkTagSelector({
  tags,
  selectedIds,
  onChange,
  onCreate,
  labels,
  disabled = false,
  className,
}: WorkTagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Click-outside closes the dropdown (same self-contained listener TagPicker
  // uses — no global registry).
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // A target chosen while the dropdown is open closes it.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selected = selectedIds
    .map((id) => tagsById.get(id))
    .filter((t): t is WorkTagOption => t !== undefined);

  const trimmed = query.trim();
  const candidates = useMemo(() => {
    const q = trimmed.toLowerCase();
    return tags
      .filter((t) => !selectedSet.has(t.id))
      .filter((t) => (q ? t.name.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [tags, selectedSet, trimmed]);
  const exactMatch = trimmed
    ? (tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase()) ??
      null)
    : null;

  const add = (id: string) => {
    if (!selectedSet.has(id)) onChange([...selectedIds, id]);
    setQuery("");
  };

  const createAndAdd = async () => {
    if (!trimmed) return;
    try {
      const tag = await onCreate(trimmed);
      onChange([...selectedIds, tag.id]);
      setQuery("");
    } catch (err) {
      console.error("[WorkTagSelector] creating a tag failed", err);
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="work-tag-selector"
      aria-disabled={disabled || undefined}
      title={disabled ? labels.disabledHint : undefined}
      className={cn(
        "relative inline-flex flex-wrap items-center gap-1",
        disabled && "opacity-55",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 text-xs text-lumen-text-secondary">
        <TagIcon size={14} aria-hidden="true" />
        {labels.heading}
      </span>
      {selected.map((tag) => (
        <TagPill
          key={tag.id}
          name={tag.name}
          color={tag.color}
          icon={tag.icon ?? null}
          removeLabel={labels.remove(tag.name)}
          onRemove={
            disabled
              ? undefined
              : () => onChange(selectedIds.filter((id) => id !== tag.id))
          }
        />
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label={labels.add}
        aria-expanded={open}
        className={cn(
          TAP_TARGET,
          "gap-1 rounded-md border border-dashed border-lumen-border px-2 py-1 text-xs text-lumen-text-secondary hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent",
          disabled && "cursor-not-allowed hover:bg-transparent",
        )}
      >
        <Plus size={14} aria-hidden="true" />
        {selected.length === 0 && <span>{labels.addShort}</span>}
      </button>
      {disabled && <span className="sr-only">{labels.disabledHint}</span>}

      {open && !disabled && (
        <div
          role="dialog"
          aria-label={labels.dialog}
          className="absolute right-0 top-full z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-lumen-border bg-lumen-bg p-2 shadow-lg"
        >
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isImeComposing(e)) {
                e.preventDefault();
                if (exactMatch) add(exactMatch.id);
                else void createAndAdd();
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder={labels.search}
            className="w-full rounded-md border border-lumen-border bg-lumen-bg-secondary px-2 py-1 text-sm text-lumen-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
          />
          <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
            {candidates.length === 0 && !trimmed && (
              <li className="px-2 py-1 text-xs text-lumen-text-secondary">
                {labels.noCandidates}
              </li>
            )}
            {candidates.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  onClick={() => add(tag.id)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-lumen-text hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
                >
                  <TagHeadingIcon
                    icon={tag.icon ?? null}
                    color={tag.color}
                    size={14}
                  />
                  <span>{tag.name}</span>
                </button>
              </li>
            ))}
            {trimmed && !exactMatch && (
              <li>
                <button
                  type="button"
                  onClick={() => void createAndAdd()}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-lumen-accent hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
                >
                  <Plus size={14} aria-hidden="true" />
                  <span>{labels.create(trimmed)}</span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

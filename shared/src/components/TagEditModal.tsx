import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { ColorPicker } from "./ColorPicker";
import { cn } from "./cn";
import { resolveTagIcon, TAG_ICON_CHOICES } from "./tagIcon";

/*
 * Tag edit modal (#310 part 2). A props-injected (§6.4) manager for wiki_tags:
 * add / rename / delete a tag and change its icon + color, with the usage
 * count (active items carrying the tag) shown per row. DataService is unknown
 * here — every mutation is a callback, every string a label, colors reuse the
 * shared ColorPicker, and the icon picker resolves lucide names via the shared
 * `tagIcon` helper (also consumed by #311). lumen-* tokens only; the Modal owns
 * the opaque panel + backdrop + Esc/focus-trap (IME-guarded).
 */

export interface TagEditRow {
  id: string;
  name: string;
  color: string | null;
  /** lucide icon name, or null for the default icon. */
  icon: string | null;
  /** Active items carrying this tag (role-agnostic). */
  count: number;
}

export interface TagEditModalLabels {
  title: string;
  addPlaceholder: string;
  addButton: string;
  empty: string;
  /** aria-label for the per-row name input. */
  renameLabel: string;
  /** aria-label for the per-row delete button. */
  deleteLabel: string;
  /** Trigger + group label for the icon picker. */
  iconLabel: string;
  /** "Default / no icon" option in the icon picker. */
  clearIconLabel: string;
  /** ColorPicker labels. */
  colorLabel: string;
  colorClearLabel: string;
  colorCustomLabel: string;
}

export interface TagEditModalProps {
  open: boolean;
  onClose: () => void;
  tags: readonly TagEditRow[];
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onSetColor: (id: string, color: string | null) => void;
  onSetIcon: (id: string, icon: string | null) => void;
  /** Already-interpolated usage count text, e.g. "3 items". */
  formatCount: (count: number) => string;
  labels: TagEditModalLabels;
}

export function TagEditModal({
  open,
  onClose,
  tags,
  onCreate,
  onRename,
  onDelete,
  onSetColor,
  onSetIcon,
  formatCount,
  labels,
}: TagEditModalProps): React.JSX.Element {
  const [draft, setDraft] = useState("");

  // Reset the add-field whenever the modal (re)opens.
  useEffect(() => {
    if (open) setDraft("");
  }, [open]);

  const submitDraft = useCallback(() => {
    const name = draft.trim();
    if (!name) return;
    onCreate(name);
    setDraft("");
  }, [draft, onCreate]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={labels.title}
      className="max-w-[520px] p-0"
    >
      <div className="flex max-h-[80vh] flex-col">
        {/* Add row. */}
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-lumen-border px-5 pb-3.5 pt-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Never commit mid-IME-composition (§frontend gotcha).
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === "Enter") {
                e.preventDefault();
                submitDraft();
              }
            }}
            placeholder={labels.addPlaceholder}
            aria-label={labels.addButton}
            className={cn(
              "min-w-0 flex-1 rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 py-1.5 text-sm text-lumen-text",
              "placeholder:text-lumen-text-tertiary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          />
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Plus size={14} />}
            onClick={submitDraft}
            disabled={!draft.trim()}
          >
            {labels.addButton}
          </Button>
        </div>

        {/* Tag list. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
          {tags.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-lumen-text-tertiary">
              {labels.empty}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {tags.map((tag) => (
                <TagEditRowItem
                  key={tag.id}
                  tag={tag}
                  onRename={onRename}
                  onDelete={onDelete}
                  onSetColor={onSetColor}
                  onSetIcon={onSetIcon}
                  formatCount={formatCount}
                  labels={labels}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

interface TagEditRowItemProps {
  tag: TagEditRow;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onSetColor: (id: string, color: string | null) => void;
  onSetIcon: (id: string, icon: string | null) => void;
  formatCount: (count: number) => string;
  labels: TagEditModalLabels;
}

function TagEditRowItem({
  tag,
  onRename,
  onDelete,
  onSetColor,
  onSetIcon,
  formatCount,
  labels,
}: TagEditRowItemProps) {
  // Local editable name; commit on blur / Enter, revert to prop on Escape.
  const [name, setName] = useState(tag.name);
  useEffect(() => {
    setName(tag.name);
  }, [tag.name]);

  const commitName = useCallback(() => {
    const next = name.trim();
    if (!next || next === tag.name) {
      setName(tag.name);
      return;
    }
    onRename(tag.id, next);
  }, [name, tag.id, tag.name, onRename]);

  return (
    <li className="flex items-center gap-2 rounded-lumen-md px-1 py-1.5 hover:bg-lumen-hover">
      <TagIconPicker
        current={tag.icon}
        color={tag.color}
        onPick={(icon) => onSetIcon(tag.id, icon)}
        labels={labels}
      />

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setName(tag.name);
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label={labels.renameLabel}
        className={cn(
          "min-w-0 flex-1 rounded-lumen-sm border border-transparent bg-transparent px-1.5 py-1 text-sm text-lumen-text",
          "hover:border-lumen-border focus-visible:border-lumen-border",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
        )}
      />

      <span className="shrink-0 rounded-full bg-lumen-bg-secondary px-2 py-0.5 text-[11px] font-medium tabular-nums text-lumen-text-secondary">
        {formatCount(tag.count)}
      </span>

      <ColorPicker
        current={tag.color ?? undefined}
        label={labels.colorLabel}
        clearLabel={labels.colorClearLabel}
        customLabel={labels.colorCustomLabel}
        onPick={(color) => onSetColor(tag.id, color)}
      />

      <button
        type="button"
        onClick={() => onDelete(tag.id)}
        aria-label={labels.deleteLabel}
        title={labels.deleteLabel}
        className={cn(
          "shrink-0 rounded-lumen-sm p-1 text-lumen-text-tertiary",
          "transition-colors hover:bg-lumen-danger-subtle hover:text-lumen-danger",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
        )}
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </li>
  );
}

interface TagIconPickerProps {
  current: string | null;
  color: string | null;
  onPick: (icon: string | null) => void;
  labels: TagEditModalLabels;
}

/** Inline icon picker: a trigger showing the current (resolved) icon, opening a
 *  curated grid below itself. Mirrors ColorPicker's open/close semantics. */
function TagIconPicker({ current, color, onPick, labels }: TagIconPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const Current = resolveTagIcon(current) ?? TagIcon;
  const iconColor = color ?? undefined;

  const pick = useCallback(
    (name: string | null) => {
      onPick(name);
      setOpen(false);
    },
    [onPick],
  );

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={labels.iconLabel}
        aria-expanded={open}
        title={labels.iconLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lumen-sm border border-lumen-border bg-lumen-bg text-lumen-text-secondary",
          "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
        )}
      >
        <Current
          size={15}
          aria-hidden
          style={iconColor ? { color: iconColor } : undefined}
        />
      </button>

      {open && (
        <div
          role="group"
          aria-label={labels.iconLabel}
          className="absolute left-0 top-9 z-10 rounded-lg border border-lumen-border bg-lumen-bg p-2 shadow-lumen-md"
        >
          <div className="grid grid-cols-6 gap-1">
            {TAG_ICON_CHOICES.map((choiceName) => {
              const Choice = resolveTagIcon(choiceName) ?? TagIcon;
              const active = current === choiceName;
              return (
                <button
                  key={choiceName}
                  type="button"
                  aria-label={choiceName}
                  aria-pressed={active}
                  title={choiceName}
                  onClick={() => pick(choiceName)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md text-lumen-text-secondary",
                    "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                    active && "bg-lumen-accent-subtle text-lumen-accent",
                  )}
                >
                  <Choice size={15} aria-hidden />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => pick(null)}
            className={cn(
              "mt-1.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[0.75rem] font-medium text-lumen-text-secondary",
              "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          >
            <Check
              size={13}
              aria-hidden
              className={current ? "opacity-0" : ""}
            />
            {labels.clearIconLabel}
          </button>
        </div>
      )}
    </div>
  );
}

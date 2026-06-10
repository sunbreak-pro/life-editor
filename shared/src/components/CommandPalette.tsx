import { useState, useEffect, useRef, useCallback } from "react";
import { Search } from "lucide-react";
import type { ComponentType } from "react";

/*
 * Cross-platform command palette (W2). Ported from
 * frontend/src/components/CommandPalette/CommandPalette.tsx, with the
 * `useTranslation()` call removed: copy reaches this primitive via props
 * (CLAUDE.md §6.4 — shared primitives never call useTranslation /
 * getDataService). notion-* tokens only; the panel is opaque (bg-notion-bg
 * §5), the backdrop is an allowed overlay exception (bg-black/30).
 */
export interface Command {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
  icon: ComponentType<{ size?: number }>;
  action: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  /** Already-translated search input placeholder (props-injected i18n). */
  placeholder: string;
  /** Already-translated "no results" message. */
  noResultsLabel: string;
}

export function CommandPalette({
  isOpen,
  onClose,
  commands,
  placeholder,
  noResultsLabel,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = commands.filter((cmd) => {
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Keep selectedIndex in bounds
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelector(
      `[data-command-index="${selectedIndex}"]`,
    ) as HTMLElement | null;
    // scrollIntoView is missing in some non-browser DOM impls (jsdom) —
    // guard so the palette never crashes during keyboard navigation.
    item?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex]);

  const execute = useCallback(
    (index: number) => {
      const cmd = filtered[index];
      if (cmd) {
        onClose();
        // Delay action slightly so the palette closes before the action fires
        requestAnimationFrame(() => cmd.action());
      }
    },
    [filtered, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // IME guard (CLAUDE.md §6.6): ignore navigation keys while composing.
      if (e.nativeEvent.isComposing) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % Math.max(filtered.length, 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(
            (i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1),
          );
          break;
        case "Enter":
          e.preventDefault();
          execute(selectedIndex);
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered.length, selectedIndex, execute, onClose],
  );

  if (!isOpen) return null;

  // Group by category
  const groups: { category: string; items: typeof filtered }[] = [];
  for (const cmd of filtered) {
    const last = groups[groups.length - 1];
    if (last && last.category === cmd.category) {
      last.items.push(cmd);
    } else {
      groups.push({ category: cmd.category, items: [cmd] });
    }
  }

  let globalIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center pt-[12vh]"
      onMouseDown={onClose}
    >
      {/* Backdrop — allowed overlay exception (§5) */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Panel */}
      <div
        className="relative w-full max-w-[680px] overflow-hidden rounded-xl border border-notion-border bg-notion-bg shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-notion-border px-4 py-3">
          <Search size={16} className="shrink-0 text-notion-text-secondary" />
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 border-none bg-transparent text-sm text-notion-text outline-none"
          />
        </div>

        {/* Command list */}
        <div ref={listRef} className="max-h-[480px] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-notion-text-secondary">
              {noResultsLabel}
            </div>
          )}
          {groups.map((group) => (
            <div key={group.category}>
              <div className="px-4 py-1 text-xs font-medium uppercase tracking-wider text-notion-text-secondary">
                {group.category}
              </div>
              {group.items.map((cmd) => {
                globalIndex++;
                const idx = globalIndex;
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    data-command-index={idx}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-sm text-notion-text transition-colors ${
                      idx === selectedIndex
                        ? "bg-notion-hover"
                        : "bg-transparent"
                    }`}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      execute(idx);
                    }}
                  >
                    <Icon size={16} />
                    <span className="flex-1 text-left">{cmd.title}</span>
                    {cmd.shortcut && (
                      <kbd className="rounded border border-notion-border bg-notion-hover px-1.5 py-0.5 text-xs text-notion-text-secondary">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

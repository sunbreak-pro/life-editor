import { useState, useEffect, useRef, useCallback } from "react";
import { Search } from "lucide-react";
import type { ComponentType, CSSProperties } from "react";
import { useVisualViewport } from "../hooks/useVisualViewport";

/*
 * Cross-platform command palette (W2). Ported from
 * frontend/src/components/CommandPalette/CommandPalette.tsx, with the
 * `useTranslation()` call removed: copy reaches this primitive via props
 * (CLAUDE.md §6.4 — shared primitives never call useTranslation /
 * getDataService). lumen-* tokens only; the panel is opaque (bg-lumen-bg
 * §5), the backdrop is an allowed overlay exception (bg-black/30).
 *
 * Mobile (#473) — the palette became touch-reachable via the bottom bar's
 * "More" sheet, which put two long-standing assumptions under load:
 *
 *  - SIZING. The overlay was laid out in `vh`, which does not shrink when the
 *    soft keyboard slides up, so the results ran underneath the keyboard.
 *    `useVisualViewport` sizes the overlay to what is actually on screen; the
 *    `vh` classes stay as the fallback for platforms without the API (jsdom
 *    included). With no keyboard the two agree to the pixel, so Desktop is
 *    unchanged.
 *  - DISMISSAL. Backdrop dismissal ran on `mousedown`, which iOS Safari only
 *    synthesizes for clickable elements — a bare backdrop div is not one, so
 *    tapping outside did nothing and, with no Escape key on a phone, the
 *    palette was a one-way door. `pointerdown` fires for every input type.
 *    Row activation stays on `mousedown` (buttons DO get the synthesized
 *    event) so its focus-preserving preventDefault keeps working.
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
  const viewport = useVisualViewport(isOpen);

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

  // Pin the palette to the VISIBLE area when the platform can report it: the
  // keyboard-shrunk viewport is what the panel must fit inside. The 12% top
  // inset is the same proportion the `pt-[12vh]` fallback class applies, so an
  // unzoomed desktop window lands on the identical pixel.
  const frameStyle: CSSProperties | undefined = viewport
    ? {
        top: viewport.offsetTop,
        left: viewport.offsetLeft,
        width: viewport.width,
        height: viewport.height,
        right: "auto",
        bottom: "auto",
        paddingTop: viewport.height * 0.12,
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-[999]" onPointerDown={onClose}>
      {/* Backdrop — allowed overlay exception (§5) */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Frame: bounds the panel to the visible area (see the file header). */}
      <div
        className="absolute inset-0 flex justify-center px-3 pb-3 pt-[12vh]"
        style={frameStyle}
      >
        {/* Panel */}
        <div
          className="relative flex max-h-full w-full max-w-[680px] flex-col overflow-hidden rounded-xl border border-lumen-border bg-lumen-bg shadow-2xl"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="flex shrink-0 items-center gap-3 border-b border-lumen-border px-4 py-3">
            <Search size={16} className="shrink-0 text-lumen-text-secondary" />
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              className="flex-1 border-none bg-transparent text-sm text-lumen-text outline-none"
            />
          </div>

          {/*
           * Command list. `min-h-0` is what lets the panel's `max-h-full`
           * actually bite on a keyboard-shrunk viewport — without it a flex
           * child refuses to shrink below its content and the list keeps its
           * 480px, pushing itself back under the keyboard.
           */}
          <div
            ref={listRef}
            className="min-h-0 max-h-[480px] overflow-y-auto py-2"
          >
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-lumen-text-secondary">
                {noResultsLabel}
              </div>
            )}
            {groups.map((group) => (
              <div key={group.category}>
                <div className="px-4 py-1 text-xs font-medium uppercase tracking-wider text-lumen-text-secondary">
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
                      className={`flex w-full items-center gap-3 px-4 py-2 text-sm text-lumen-text transition-colors ${
                        idx === selectedIndex
                          ? "bg-lumen-hover"
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
                        <kbd className="rounded border border-lumen-border bg-lumen-hover px-1.5 py-0.5 text-xs text-lumen-text-secondary">
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
    </div>
  );
}

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowUpDown } from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING_TIGHT as FOCUS_RING } from "../styleTokens";
import {
  SidebarFilterField,
  type SidebarFilterConfig,
} from "./SidebarFilterField";

/*
 * Sidebar list controls (#283). The search + sort header the Materials lists
 * (Notes / Daily) mount above their items — the rightSidebar on desktop and the
 * MobileDrawer on narrow, which is why the row is width-fluid rather than fixed
 * to the ~240px sidebar.
 * Pure presentation, DataService-free (§3.1): every choice fires a
 * host-injected callback, the filter row is the shared <SidebarFilterField>
 * (split out in #368 so a filter-only surface — the tag master list — can mount
 * it without inheriting sort controls), and all copy is already-translated
 * props (§6.4 — no useTranslation here). lumen-* tokens only, opaque
 * surfaces (§5).
 *
 * #2577: ONE BUTTON + A CHIP PANEL. The mode picker and the direction toggle
 * used to sit side by side at all times, two controls' worth of the list's top
 * spent on a setting that is changed rarely. Now one button names the current
 * sort and opens a panel of chips: the modes in one row, the two orders in the
 * next. The orders are chips rather than a toggle because their copy depends
 * on the mode (newest / oldest for a date, ascending / descending for the
 * title), so the host hands both, already labelled, in the order to draw them.
 *
 * INLINE, NOT A POPOVER — the same reason as the Notes tag filter (#2059): the
 * list lives inside the MobileDrawer on narrow, and a popover there would be an
 * overlay inside an overlay. The panel opens in the flow under the button.
 *
 * The search box (Notes passes its own as `search`; Daily's is the `filter`
 * field) sits ABOVE the button on wide and LEFT of it on narrow, where the
 * button shrinks to a 2.75rem square holding only the icon. Both through
 * `max-md:` classes rather than a width prop, so the two layouts cannot
 * disagree with the breakpoint the rest of the drawer uses.
 *
 * Open / closed is local and starts closed: it answers "I am choosing a sort
 * right now". Choosing a chip keeps the panel open so the mode and the order
 * can both be set in one visit; the button or Esc closes it.
 */

export type SidebarSortDirection = "asc" | "desc";

export interface SidebarSortMode {
  /** Stable id passed back through onModeChange. */
  id: string;
  /** Already-translated label shown on the button and its chip (§6.4). */
  label: string;
}

export interface SidebarSortDirectionOption {
  id: SidebarSortDirection;
  /** Already-translated label for the ACTIVE mode, e.g. "Newest first". */
  label: string;
}

export interface SidebarListControlsProps {
  /** Sort modes; when length <= 1 the mode chips are hidden. */
  modes: SidebarSortMode[];
  /** Currently active mode id (must match one of `modes`). */
  activeModeId: string;
  onModeChange: (id: string) => void;
  /**
   * Already-translated name of the control ("Sort"): the button's accessible
   * name and the panel's heading (§6.4).
   */
  sortLabel: string;
  /** Accessible names of the two chip rows ("Sort by" / "Order"). */
  modeGroupLabel: string;
  directionGroupLabel: string;
  /** The two order chips, in the order to draw them, labelled for the mode. */
  directions: SidebarSortDirectionOption[];
  /** Current sort direction — which order chip is pressed. */
  direction: SidebarSortDirection;
  onDirectionChange: (direction: SidebarSortDirection) => void;
  /**
   * Joins the active mode and order into the button's text. Copy, so the host
   * owns it (§6.4); the default is a neutral " · ".
   */
  formatSummary?: (mode: string, order: string) => string;
  /** The list's own search box, drawn above the button (left of it on narrow). */
  search?: ReactNode;
  /** Optional filter input, drawn where `search` would be; omit for none. */
  filter?: SidebarFilterConfig;
  className?: string;
}

const defaultSummary = (mode: string, order: string): string =>
  `${mode} · ${order}`;

export function SidebarListControls({
  modes,
  activeModeId,
  onModeChange,
  sortLabel,
  modeGroupLabel,
  directionGroupLabel,
  directions,
  direction,
  onDirectionChange,
  formatSummary = defaultSummary,
  search,
  filter,
  className,
}: SidebarListControlsProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const headingId = useId();
  const summaryId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const showModeChips = modes.length > 1;
  const activeMode = modes.find((m) => m.id === activeModeId);
  const activeDirection = directions.find((d) => d.id === direction);
  const summary = formatSummary(
    activeMode?.label ?? sortLabel,
    activeDirection?.label ?? "",
  );
  // On narrow the field matches the square button's height, so the two read
  // as one line.
  const searchSlot =
    search ??
    (filter ? (
      <SidebarFilterField {...filter} className="max-md:h-11" />
    ) : null);

  // Esc from anywhere in the panel closes it and puts the focus back on the
  // button, so a keyboard user is not left on a chip that just disappeared.
  // No IME guard: the panel holds no text input.
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col gap-2 max-md:flex-row max-md:items-center">
        {searchSlot && (
          <div className="min-w-0 max-md:flex-1">{searchSlot}</div>
        )}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          // The name stays the control's ("Sort"); the summary is its value,
          // read as the description so it is not lost on narrow, where the
          // text is visually hidden.
          aria-label={sortLabel}
          aria-describedby={summaryId}
          title={summary}
          className={cn(
            "flex h-8 w-full items-center gap-1.5 rounded-lumen-md border px-2.5 text-[12.5px]",
            // #1975's 44px floor on narrow, as the square the button becomes
            // there; Desktop keeps h-8 for the mouse.
            "max-md:h-11 max-md:min-h-11 max-md:w-11 max-md:shrink-0 max-md:justify-center max-md:px-0",
            "transition-colors",
            open
              ? "border-lumen-accent bg-lumen-accent-subtle text-lumen-accent"
              : "border-lumen-border bg-lumen-surface-sunken text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
            FOCUS_RING,
          )}
        >
          <ArrowUpDown size={13} aria-hidden className="shrink-0" />
          <span
            id={summaryId}
            className="min-w-0 flex-1 truncate text-left max-md:sr-only"
          >
            {summary}
          </span>
        </button>
      </div>

      {/* Always in the tree, `hidden` while closed, so `aria-controls` points
          at something that exists in both states. The display class is only
          set while open so it cannot outrank the `hidden` attribute. Named
          only while open: closed, it would be a second "Sort" beside the
          button for anything looking controls up by name. */}
      <div
        id={panelId}
        role="group"
        aria-labelledby={open ? headingId : undefined}
        hidden={!open}
        onKeyDown={handleKeyDown}
        className={cn(
          open && "flex flex-col gap-2",
          "rounded-lumen-md border border-lumen-border bg-lumen-bg p-2",
        )}
      >
        <span
          id={headingId}
          className="text-[11px] font-semibold text-lumen-text-tertiary"
        >
          {sortLabel}
        </span>
        {showModeChips && (
          <ChipRow label={modeGroupLabel}>
            {modes.map((mode) => (
              <Chip
                key={mode.id}
                pressed={mode.id === activeModeId}
                onClick={() => onModeChange(mode.id)}
              >
                {mode.label}
              </Chip>
            ))}
          </ChipRow>
        )}
        <ChipRow label={directionGroupLabel}>
          {directions.map((option) => (
            <Chip
              key={option.id}
              pressed={option.id === direction}
              onClick={() => onDirectionChange(option.id)}
            >
              {option.label}
            </Chip>
          ))}
        </ChipRow>
      </div>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {children}
    </div>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-lumen-full border px-2.5 text-xs transition-colors max-md:min-h-11",
        // The bold weight is the second cue next to the accent border, so the
        // choice does not rest on colour alone.
        pressed
          ? "border-lumen-accent font-semibold text-lumen-accent"
          : "border-lumen-border text-lumen-text-secondary hover:bg-lumen-hover",
        FOCUS_RING,
      )}
    >
      {children}
    </button>
  );
}

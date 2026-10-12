import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { X, ChevronDown, CalendarDays, CheckSquare } from "lucide-react";
import { Card } from "./Card";
import { Input } from "./Input";
import { cn } from "./cn";
import { isImeComposing } from "../utils/imeGuard";

/*
 * Work-target attribution selector for the Work tab (target-IA import). A
 * Pomodoro session can be linked to a Todo (`task_id`) or, since #1375, to an
 * Event (`event_id`) on timer_sessions. Pure primitive: the host supplies the
 * candidates + selection state + copy (§6.4).
 *
 * ONE flat list, not two pickers. "What am I working on right now" is a single
 * question, and splitting it in two would make the user answer "which kind is
 * it" before they can answer it. The kind still has to be visible — the id
 * alone does not say which column the row is written to — so it rides along as
 * a leading icon and, once picked, as the chip's colour family (chip-task blue
 * vs chip-event purple, the same pairing the calendar already uses).
 *
 * States (design 321-324 / 1053-1059 / loading skeleton):
 *  - selected   → a chip in the kind's colours with a clear (X) button
 *  - pending    → the same chip, event-coloured, for a name that becomes an
 *                 Event when the session ends (#2229, `pendingEventName`)
 *  - unselected → a trigger button that opens the list (native <select>
 *                 retired). ChevronDown affordance.
 *  - no items   → a hint row explains why; the trigger is disabled unless the
 *                 host can create (`onCreate`), since then typing is the way in
 *  - loading    → skeleton bars (surface-sunken) while the host fetches
 *
 * The list opens with a search field on top (#2229, Claude Design 「Life
 * Editor試作完成」). It is a combobox rather than a lumen <Menu>: a menu takes
 * the focus onto its rows, and here the focus has to stay in the field so the
 * user can keep typing while ↑ / ↓ move the highlight. Typing narrows both
 * groups by a substring match. When nothing carries the typed name exactly,
 * two rows on top offer to make it a new Todo or a new Event — the user picks
 * the kind at creation. An exact match hides them, so the same name is not
 * made twice; "exact" is NFKC + trimmed and case-sensitive
 * (`normalizeWorkName`).
 */

export interface WorkTargetOption {
  id: string;
  title: string;
  /** Which column a session started against this option writes to (#1375). */
  kind: "todo" | "event";
  /**
   * Second line that tells identically named rows apart (#1519). Events fill
   * it with their day and start time: a DAILY routine puts one occurrence per
   * day of the picker's window in this list, so seven rows arrive carrying the
   * same title and nothing else to choose between. Todos leave it unset — one
   * todo is one row, so there is nothing to disambiguate.
   *
   * The host formats it (§6.4): month/day order is the user's locale, and
   * these parts never resolve copy themselves.
   */
  subtitle?: string;
}

/**
 * Leading glyph per kind — the only thing that says which list a row is in.
 * `className` wins over `size` (CSS width / height outrank the attribute), so
 * a caller on the icon steps passes `size-lumen-icon-*` there (#2036).
 */
export function workTargetIcon(
  kind: WorkTargetOption["kind"],
  size = 15,
  className?: string,
) {
  return kind === "event" ? (
    <CalendarDays size={size} aria-hidden="true" className={className} />
  ) : (
    <CheckSquare size={size} aria-hidden="true" className={className} />
  );
}

/** Chip colours per kind. Events borrow the calendar's purple family. */
export function workTargetChipClass(kind: WorkTargetOption["kind"]): string {
  return kind === "event"
    ? "bg-lumen-chip-event-bg text-lumen-chip-event-fg"
    : "bg-lumen-chip-task-bg text-lumen-chip-task-fg";
}

/*
 * The kind glyph on a neutral disc (#2054, plan A). The Mobile Work face
 * draws every work target this way — the link row, the sheet's rows, the
 * completion chip and the history rows — so the only colour on a row is the
 * glyph's, and the phase colour keeps the badge / ring / main button to
 * itself. The glyph keeps the kind colours the rest of the app already uses
 * for tasks and events (the chip-task / chip-event fg tokens) rather than the
 * plan's accent / info, so a task reads the same here as in the calendar.
 */
const GLYPH_TONE: Record<WorkTargetOption["kind"], string> = {
  todo: "text-lumen-chip-task-fg",
  event: "text-lumen-chip-event-fg",
};

export function WorkTargetGlyph({
  kind,
  size = "md",
}: {
  kind: WorkTargetOption["kind"];
  /** md = 32px disc (rows), sm = 24px disc (the completion chip). */
  size?: "md" | "sm";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "md"
          ? "h-8 w-8 border border-lumen-border bg-lumen-bg-secondary"
          : "h-6 w-6 bg-lumen-bg",
        GLYPH_TONE[kind],
      )}
    >
      {/* Both discs carry the smallest icon step: the plan's 16 / 14px glyphs
          already render at the icon floor today, so one step keeps them the
          size they were while letting them follow the font-size setting. */}
      {workTargetIcon(kind, undefined, "size-lumen-icon-sm")}
    </span>
  );
}

/**
 * The form two work names are compared in (#2229). NFKC folds full-width
 * letters, digits and spaces onto their half-width forms, and the ends are
 * trimmed. Case is kept: the prototype told "Report" from "report", and a
 * user who typed both on purpose meant two things.
 */
export function normalizeWorkName(name: string): string {
  return name.normalize("NFKC").trim();
}

/** The option titled exactly `name` by {@link normalizeWorkName}, if any. */
export function findExactWorkTarget(
  items: readonly WorkTargetOption[],
  name: string,
): WorkTargetOption | null {
  const key = normalizeWorkName(name);
  if (!key) return null;
  return items.find((t) => normalizeWorkName(t.title) === key) ?? null;
}

export interface PomodoroTodoSelectorLabels {
  heading: string;
  placeholder: string;
  clear: string;
  /** Hint shown when there are no candidates at all. */
  emptyHint: string;
  /** a11y label for the list. */
  menuLabel: string;
  /** Placeholder of the search field on top of the list (#2229). */
  searchPlaceholder?: string;
  /** Heading over the todo rows (#2229). */
  todoHeading?: string;
  /** Heading over the event rows (#2229). */
  eventHeading?: string;
  /** Row that makes the typed name a new Todo — gets the trimmed name. */
  createTodo?: (name: string) => string;
  /** Row that makes the typed name a new Event — gets the trimmed name. */
  createEvent?: (name: string) => string;
}

export interface PomodoroTodoSelectorProps {
  items: readonly WorkTargetOption[];
  selectedId: string | null;
  /** While true, show skeletons instead of the trigger (host is fetching). */
  loading?: boolean;
  labels: PomodoroTodoSelectorLabels;
  onSelect: (item: WorkTargetOption | null) => void;
  /**
   * Turns on the two "add as" rows (#2229). Receives the typed name, trimmed,
   * and the kind the user picked; what gets made, and when, is the host's.
   */
  onCreate?: (name: string, kind: WorkTargetOption["kind"]) => void;
  /**
   * A name the host will file as an Event when the session ends (#2229). With
   * nothing selected it is drawn as an event chip, and its clear button calls
   * `onSelect(null)` like the chip of a picked target.
   */
  pendingEventName?: string;
  /**
   * Host UI for the space to the RIGHT of the picker (#1665 — the free
   * session's tag field). A slot rather than a built-in: what belongs beside
   * the link target is the host's business, and the tag layer needs a
   * DataService this pure part must not have (§6.4).
   */
  trailing?: ReactNode;
}

export function PomodoroTodoSelector({
  items,
  selectedId,
  loading = false,
  labels,
  onSelect,
  onCreate,
  pendingEventName,
  trailing,
}: PomodoroTodoSelectorProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = items.find((t) => t.id === selectedId) ?? null;
  const pendingName = pendingEventName?.trim() ?? "";
  const chip: WorkTargetOption | null =
    selected ??
    (pendingName ? { id: "", title: pendingName, kind: "event" } : null);
  const hasItems = items.length > 0;
  // With nothing to pick, the list is still worth opening when it can make
  // something: the field on top is then the only way to name the work.
  const canOpen = hasItems || onCreate !== undefined;

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  return (
    <Card padding="none" className="flex flex-col gap-2 px-5 py-4">
      <div className="flex items-center gap-4">
        <span className="shrink-0 text-sm font-semibold text-lumen-text-secondary">
          {labels.heading}
        </span>

        {loading ? (
          <div className="h-[38px] w-full max-w-[360px] animate-pulse rounded-lumen-md bg-lumen-surface-sunken" />
        ) : chip ? (
          /*
           * `min-w-0` is what lets the title truncate (#1855). The chip is a
           * flex item of the row, and a flex item's min-width defaults to its
           * content, so a 100-character title held the chip at its full text
           * width: it ran through the card, pushed the tag field off screen
           * and gave the Work page a horizontal scrollbar. The inner
           * `truncate` was never the problem; it had no bound to clip to.
           */
          <span
            data-testid="work-target-chip"
            className={cn(
              "inline-flex min-w-0 max-w-full items-center gap-2 rounded-lumen-md py-1.5 pl-3 pr-2 text-sm font-medium",
              workTargetChipClass(chip.kind),
            )}
          >
            <span className="shrink-0">{workTargetIcon(chip.kind, 14)}</span>
            <span className="truncate">{chip.title}</span>
            <button
              type="button"
              aria-label={labels.clear}
              onClick={() => onSelect(null)}
              className="inline-flex shrink-0 items-center justify-center rounded p-0.5 hover:opacity-70"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ) : (
          <div className="relative w-full max-w-[360px]">
            <button
              ref={triggerRef}
              type="button"
              disabled={!canOpen}
              aria-haspopup="listbox"
              aria-expanded={open}
              onClick={() => canOpen && setOpen((v) => !v)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-3 py-[9px] text-sm text-lumen-text-secondary",
                "hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                !canOpen && "cursor-not-allowed opacity-55 hover:bg-lumen-bg",
              )}
            >
              <span className="truncate">{labels.placeholder}</span>
              <ChevronDown size={15} aria-hidden="true" className="shrink-0" />
            </button>
            {open ? (
              <WorkTargetList
                items={items}
                labels={labels}
                triggerRef={triggerRef}
                onClose={close}
                onPick={(t) => {
                  onSelect(t);
                  setOpen(false);
                }}
                onCreate={
                  onCreate &&
                  ((name, kind) => {
                    onCreate(name, kind);
                    setOpen(false);
                  })
                }
              />
            ) : null}
          </div>
        )}
        {trailing ? (
          <div className="ml-auto flex shrink-0 justify-end">{trailing}</div>
        ) : null}
      </div>

      {!loading && !hasItems && !chip ? (
        <p className="pl-[88px] text-xs text-lumen-text-tertiary">
          {labels.emptyHint}
        </p>
      ) : null}
    </Card>
  );
}

type ListRow =
  | { key: string; type: "create"; kind: WorkTargetOption["kind"] }
  | { key: string; type: "item"; item: WorkTargetOption };

const itemKey = (t: WorkTargetOption) => `${t.kind}:${t.id}`;

const GROUP_HEADING =
  "px-3 pb-1 pt-2 text-xs font-semibold text-lumen-text-tertiary";

/*
 * The open list (#2229). Its own component so the typed text and the
 * highlight start over every time the list opens: closing unmounts it.
 *
 * Focus never leaves the field. The rows are options the field points at
 * through `aria-activedescendant`, and a pointerdown on a row is kept from
 * taking the focus, so a click lands without blurring the field first.
 *
 * Esc closes the list and stops there: a press meant for this list must not
 * also reach the screen's own Esc handling (the global shortcuts listen on
 * `window`, past the React root).
 */
function WorkTargetList({
  items,
  labels,
  triggerRef,
  onClose,
  onPick,
  onCreate,
}: {
  items: readonly WorkTargetOption[];
  labels: PomodoroTodoSelectorLabels;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: (restoreFocus: boolean) => void;
  onPick: (item: WorkTargetOption) => void;
  onCreate?: (name: string, kind: WorkTargetOption["kind"]) => void;
}) {
  const [query, setQuery] = useState("");
  // The row the user moved to, by key. Null means "the default row", which is
  // re-derived from the query so it never points at a row that went away.
  const [moved, setMoved] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = useCallback(
    (key: string) => `${baseId}-opt-${key}`,
    [baseId],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (boxRef.current?.contains(target)) return;
      // The trigger toggles on its own click; closing here first would make
      // that click open the list again.
      if (triggerRef.current?.contains(target)) return;
      onClose(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  }, [onClose, triggerRef]);

  const name = query.trim();
  const exact = findExactWorkTarget(items, query);
  const { todos, events, rows } = useMemo(() => {
    const needle = normalizeWorkName(query).toLowerCase();
    const hit = (t: WorkTargetOption) =>
      needle === "" ||
      normalizeWorkName(t.title).toLowerCase().includes(needle);
    const todos = items.filter((t) => t.kind === "todo" && hit(t));
    const events = items.filter((t) => t.kind === "event" && hit(t));
    const showCreate =
      onCreate !== undefined &&
      needle !== "" &&
      findExactWorkTarget(items, query) === null;
    const rows: ListRow[] = [
      ...(showCreate
        ? (["todo", "event"] as const).map((kind): ListRow => ({
            key: `create:${kind}`,
            type: "create",
            kind,
          }))
        : []),
      ...[...todos, ...events].map((item): ListRow => ({
        key: itemKey(item),
        type: "item",
        item,
      })),
    ];
    return { todos, events, rows };
  }, [items, query, onCreate]);

  // The Todo row is the default while the create rows show; with an exact
  // match the matching row is, so Enter picks what the user already has.
  const defaultKey = exact ? itemKey(exact) : (rows[0]?.key ?? null);
  const activeKey =
    moved !== null && rows.some((r) => r.key === moved) ? moved : defaultKey;

  useEffect(() => {
    if (activeKey === null) return;
    // jsdom has no scrollIntoView, hence the optional call.
    document
      .getElementById(optionId(activeKey))
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeKey, optionId]);

  const run = (row: ListRow) => {
    if (row.type === "item") onPick(row.item);
    else if (name) onCreate?.(name, row.kind);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter confirms a Japanese conversion and Esc cancels one; neither may
    // reach the list while the IME owns the key.
    if (isImeComposing(e)) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (rows.length === 0) return;
      const at = rows.findIndex((r) => r.key === activeKey);
      const step = e.key === "ArrowDown" ? 1 : -1;
      const next =
        at < 0
          ? step > 0
            ? 0
            : rows.length - 1
          : (at + step + rows.length) % rows.length;
      setMoved(rows[next].key);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows.find((r) => r.key === activeKey);
      if (row) run(row);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
    } else if (e.key === "Tab") {
      onClose(false);
    }
  };

  const option = (row: ListRow) => {
    const active = row.key === activeKey;
    const isCreate = row.type === "create";
    const kind = isCreate ? row.kind : row.item.kind;
    const text = isCreate
      ? (row.kind === "todo" ? labels.createTodo : labels.createEvent)?.(name)
      : row.item.title;
    return (
      <div
        key={row.key}
        id={optionId(row.key)}
        role="option"
        aria-selected={active}
        onPointerDown={(e) => e.preventDefault()}
        onMouseMove={() => setMoved(row.key)}
        onClick={() => run(row)}
        className={cn(
          "flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm",
          active && "bg-lumen-hover",
          isCreate ? "font-medium text-lumen-accent" : "text-lumen-text",
        )}
      >
        <span className="shrink-0">{workTargetIcon(kind)}</span>
        <span className="min-w-0 flex-1 truncate">{text}</span>
        {!isCreate && row.item.subtitle ? (
          <span className="ml-auto shrink-0 text-xs text-lumen-text-tertiary">
            {row.item.subtitle}
          </span>
        ) : null}
        {isCreate && active ? (
          <kbd
            aria-hidden="true"
            className="ml-auto shrink-0 rounded border border-lumen-border bg-lumen-bg-secondary px-1.5 font-sans text-[11px] leading-5 text-lumen-text-tertiary"
          >
            Enter
          </kbd>
        ) : null}
      </div>
    );
  };

  const group = (
    kind: WorkTargetOption["kind"],
    heading: string | undefined,
    list: readonly WorkTargetOption[],
  ) => {
    // A group that filtered down to nothing goes, heading and all.
    if (list.length === 0) return null;
    const rowsOf = rows.filter(
      (r) => r.type === "item" && r.item.kind === kind,
    );
    if (!heading) return rowsOf.map(option);
    const headingId = `${baseId}-h-${kind}`;
    return (
      <div role="group" aria-labelledby={headingId}>
        <div id={headingId} role="presentation" className={GROUP_HEADING}>
          {heading}
        </div>
        {rowsOf.map(option)}
      </div>
    );
  };

  return (
    <div
      ref={boxRef}
      className="absolute left-0 top-full z-50 mt-1 flex w-full min-w-72 flex-col rounded-lumen-md border border-lumen-border bg-lumen-bg shadow-lumen-lg"
    >
      <div className="border-b border-lumen-border p-2">
        <Input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeKey === null ? undefined : optionId(activeKey)
          }
          aria-label={labels.searchPlaceholder ?? labels.menuLabel}
          placeholder={labels.searchPlaceholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setMoved(null);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label={labels.menuLabel}
        className="max-h-64 overflow-y-auto py-1"
      >
        {rows.filter((r) => r.type === "create").map(option)}
        {group("todo", labels.todoHeading, todos)}
        {group("event", labels.eventHeading, events)}
      </div>
    </div>
  );
}

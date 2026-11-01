import { X } from "lucide-react";

/*
 * TodoFocusCard (#2393) — the todo a link pointed at, at the top of the Schedule
 * sidebar's Todo tab.
 *
 * Claude Design's B4 shows the link's todo in the right panel, and for a todo
 * with no day the panel is the only place it appears. It reads rather than
 * edits: the editable detail stays where it is, one press away, until #2408
 * moves it into the sidebar and this card can give way to it.
 *
 * A card above the lists rather than a highlighted row, because the tab's own
 * filter (#1641) can hide the row, and a link has to show its todo regardless.
 *
 * Pure presentation (§3.1 / §6.4): the copy arrives translated and the actions
 * are callbacks. lumen-* tokens only, on an opaque face (§5).
 */

export interface TodoFocusCardTodo {
  title: string;
  /** Already-translated status word. */
  statusText: string;
  /** Already-formatted day and time, or the "no day" wording. */
  scheduleText: string;
  /** First line of the memo, when there is one. */
  excerpt?: string;
}

export interface TodoFocusCardLabels {
  /** Names the card for assistive tech. */
  heading: string;
  open: string;
  dismiss: string;
}

export interface TodoFocusCardProps {
  todo: TodoFocusCardTodo;
  onOpen: () => void;
  onDismiss: () => void;
  labels: TodoFocusCardLabels;
}

export function TodoFocusCard({
  todo,
  onOpen,
  onDismiss,
  labels,
}: TodoFocusCardProps) {
  return (
    <section
      aria-label={labels.heading}
      data-todo-focus-card
      className="flex shrink-0 flex-col gap-1.5 rounded-lumen-md border border-lumen-accent bg-lumen-bg-secondary p-3"
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 break-words text-sm font-semibold text-lumen-text">
          {todo.title}
        </h3>
        <button
          type="button"
          aria-label={labels.dismiss}
          onClick={onDismiss}
          className="flex size-6 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11 max-md:min-w-11"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      </div>
      <p className="text-xs text-lumen-text-secondary">
        {todo.statusText} · {todo.scheduleText}
      </p>
      {todo.excerpt && (
        <p className="break-words text-xs text-lumen-text">{todo.excerpt}</p>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="self-start rounded-lumen-md border border-lumen-border-strong px-2 py-1 text-xs font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11"
      >
        {labels.open}
      </button>
    </section>
  );
}

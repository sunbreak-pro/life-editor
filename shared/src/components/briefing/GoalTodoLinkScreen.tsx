import { useId, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { judgeGoals } from "../../utils/goalAchievement";
import { Button } from "../Button";
import { cn } from "../cn";
import { FIELD, FIELD_LABEL, FOCUS_RING_TIGHT } from "../styleTokens";
import {
  applyLinkDraft,
  goalProgressOf,
  linkDraftOf,
  previewGoalLinkEdit,
  lostAchievementIds,
  type GoalLinkState,
  type LinkDraft,
} from "./goalLinkPreview";
import {
  GOAL_CHIP_ACHIEVED,
  GoalAchievementLostNotice,
  GoalProgressDelta,
  goalProgressText,
  type GoalProgressLabels,
} from "./GoalProgressDelta";

/*
 * Linking Todos to a goal, from the goal's side (#2109, plan Step 10 / design
 * L1 Desktop + L2 Mobile). The other direction — a todo picking its goals —
 * is <GoalPickerField>.
 *
 * Self-contained on purpose: the entry points (the Connect 「目標と Todo」
 * tab — #2108 — and the morning / evening papers) each open it in their own
 * frame, so this owns the draft, the search, the preview and the save button,
 * and takes data and the write as props. It renders as a plain block; the
 * host decides whether that block sits in a right panel, a modal or a sheet.
 *
 * Draft, then save: nothing is written until the button, and the button sits
 * under the numbers the save will change — this goal's 2/4 → 3/4, and any
 * parent whose achievement it moves (goalLinkPreview.ts). If the save takes
 * an achievement away, the S1 / S2 chip says so here and nowhere else; it is
 * screen state, not data (plan §デザイン).
 *
 * Pure presentation (§6.4): copy arrives translated, the write is `onSave`.
 */

export interface GoalLinkTodoOption {
  id: string;
  title: string;
  done: boolean;
}

/** Todo ids to link to / unlink from the goal. */
export interface GoalLinkDiff {
  link: string[];
  unlink: string[];
}

export interface GoalTodoLinkScreenLabels extends GoalProgressLabels {
  /** 「Todo をつなぐ」 */
  heading: string;
  /** The goal's period, host-formatted (「今週 9/27 – 10/3」). */
  periodLabel: string;
  search: string;
  listLabel: string;
  /** No todos at all. */
  empty: string;
  /** The search matches nothing. */
  noMatch: string;
  /** 「完了」— said in words, not only by the strike-through. */
  done: string;
  previewHeading: string;
  achievementLost: string;
  save: string;
  saving: string;
  cancel: string;
  saveFailed: string;
}

export interface GoalTodoLinkScreenProps {
  goalId: string;
  /** Live goals, links and todos — what the progress numbers are read from. */
  state: GoalLinkState;
  /** The todos on offer (live ones; the host picks the pool). */
  todos: readonly GoalLinkTodoOption[];
  /**
   * Write the diff. Resolve once `state` carries the new links (or reject):
   * the screen drops its draft on resolve and reads the links from `state`.
   */
  onSave: (diff: GoalLinkDiff) => Promise<void>;
  onClose?: () => void;
  labels: GoalTodoLinkScreenLabels;
  /**
   * False when the host's frame already titles it with `labels.heading` (the
   * morning paper's overlay, #2106) — the kicker would say it twice. The
   * section's accessible name then becomes the goal's title, so a screen
   * reader hears which goal it is rather than the dialog's name again.
   */
  headingShown?: boolean;
}

export function GoalTodoLinkScreen({
  goalId,
  state,
  todos,
  onSave,
  onClose,
  labels,
  headingShown = true,
}: GoalTodoLinkScreenProps): React.JSX.Element | null {
  // What the user changed, re-applied to the latest saved links (LinkDraft):
  // a todo another device links meanwhile is not unlinked by this save.
  const [draft, setDraft] = useState<LinkDraft | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [lostTitles, setLostTitles] = useState<string[]>([]);
  const titleId = useId();

  const goal = state.goals.find((g) => g.id === goalId && !g.isDeleted);
  const baseline = useMemo(
    () =>
      state.links
        .filter((l) => !l.isDeleted && l.goalId === goalId)
        .map((l) => l.todoId),
    [state.links, goalId],
  );
  const selectedIds = applyLinkDraft(baseline, draft);
  const selected = new Set(selectedIds);
  const base = new Set(baseline);
  const diff: GoalLinkDiff = {
    link: selectedIds.filter((id) => !base.has(id)),
    unlink: baseline.filter((id) => !selected.has(id)),
  };
  const dirty = diff.link.length + diff.unlink.length > 0;

  const current = useMemo(() => judgeGoals(state), [state]);
  const changes = previewGoalLinkEdit(state, {
    link: diff.link.map((todoId) => ({ goalId, todoId })),
    unlink: diff.unlink.map((todoId) => ({ goalId, todoId })),
  });

  // Linked first (what the goal is made of), then open, then done.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const linked = new Set(baseline);
    const rank = (t: GoalLinkTodoOption): number =>
      linked.has(t.id) ? 0 : t.done ? 2 : 1;
    return todos
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .map((t, i) => ({ t, i }))
      .sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i)
      .map(({ t }) => t);
  }, [todos, query, baseline]);

  if (!goal) return null;
  const judged = current[goal.id];
  const progress = judged ? goalProgressOf(judged) : null;
  const titleOf = (id: string): string =>
    state.goals.find((g) => g.id === id)?.title ?? "";

  const toggle = (id: string): void => {
    setFailed(false);
    setLostTitles([]);
    setDraft(
      linkDraftOf(
        baseline,
        selected.has(id)
          ? selectedIds.filter((x) => x !== id)
          : [...selectedIds, id],
      ),
    );
  };

  const save = async (): Promise<void> => {
    if (!dirty || saving) return;
    const lost = lostAchievementIds(changes).map(titleOf);
    setSaving(true);
    setFailed(false);
    try {
      await onSave(diff);
      setDraft(null);
      setLostTitles(lost);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <section
      aria-label={headingShown ? labels.heading : undefined}
      aria-labelledby={headingShown ? undefined : titleId}
      className="flex flex-col gap-3 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary p-3"
    >
      <header className="space-y-1.5">
        {headingShown && (
          <p className="text-xs font-bold tracking-[0.2em] text-lumen-text-secondary">
            {labels.heading}
          </p>
        )}
        <p className="text-xs text-lumen-briefing-kohaku">
          {labels.periodLabel}
        </p>
        <h3 id={titleId} className="text-base font-medium text-lumen-text">
          {goal.title}
        </h3>
        {progress && (
          <div className="flex items-center gap-2">
            {progress.connected && (
              <div
                aria-hidden
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-lumen-surface-sunken"
              >
                <div
                  className="h-full rounded-full bg-lumen-accent-secondary"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            <span className="text-xs tabular-nums text-lumen-text-secondary">
              {goalProgressText(progress, labels)}
            </span>
            {progress.achieved && (
              <span className={GOAL_CHIP_ACHIEVED}>{labels.achieved}</span>
            )}
          </div>
        )}
        <GoalAchievementLostNotice
          label={labels.achievementLost}
          titles={lostTitles}
        />
      </header>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={labels.search}
        aria-label={labels.search}
        className={FIELD}
      />
      {todos.length === 0 ? (
        <p className="py-3 text-center text-xs text-lumen-text-secondary">
          {labels.empty}
        </p>
      ) : rows.length === 0 ? (
        <p className="py-3 text-center text-xs text-lumen-text-secondary">
          {labels.noMatch}
        </p>
      ) : (
        <ul
          aria-label={labels.listLabel}
          className="max-h-72 overflow-y-auto rounded-lumen-md border border-lumen-border bg-lumen-bg"
        >
          {rows.map((todo) => {
            const checked = selected.has(todo.id);
            return (
              <li
                key={todo.id}
                className="border-b border-lumen-border last:border-b-0"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  // Frozen while saving: the save drops the draft when it
                  // lands, and a pick made meanwhile would go with it.
                  disabled={saving}
                  onClick={() => toggle(todo.id)}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm transition-colors max-md:min-h-11",
                    checked
                      ? "bg-lumen-accent-subtle text-lumen-text"
                      : "text-lumen-text hover:bg-lumen-hover",
                    FOCUS_RING_TIGHT,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                      checked
                        ? "border-lumen-accent bg-lumen-accent text-lumen-on-accent"
                        : "border-lumen-border-strong",
                    )}
                  >
                    {checked && <Check className="size-3" />}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      todo.done && "text-lumen-text-secondary line-through",
                    )}
                  >
                    {todo.title}
                  </span>
                  {todo.done && (
                    <span className="shrink-0 text-xs text-lumen-text-tertiary">
                      {labels.done}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {changes.length > 0 && (
        <div className="rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 py-2">
          <p className={cn(FIELD_LABEL, "mb-1")}>{labels.previewHeading}</p>
          <ul className="space-y-1">
            {changes.map((c) => (
              <GoalProgressDelta
                key={c.goalId}
                title={titleOf(c.goalId)}
                before={c.before}
                after={c.after}
                labels={labels}
              />
            ))}
          </ul>
        </div>
      )}
      {failed && (
        <p role="alert" className="text-xs text-lumen-danger">
          {labels.saveFailed}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-lumen-border pt-3">
        {onClose && (
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="max-md:min-h-11"
          >
            {labels.cancel}
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          disabled={!dirty}
          busy={saving}
          busyLabel={labels.saving}
          onClick={() => void save()}
          className="max-md:min-h-11"
        >
          {labels.save}
        </Button>
      </div>
    </section>
  );
}

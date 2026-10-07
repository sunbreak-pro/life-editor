import { useCallback, useMemo, useRef, useState } from "react";
import {
  GOALS_PER_PERIOD_LIMIT,
  buildMorningGoals,
  carryPlan,
  generateId,
  periodEndQueue,
  useGoalLinkSnapshot,
  useToastOptional,
  useTranslation,
  type CarryPlan,
  type DataService,
  type Goal,
  type GoalLinkSnapshot,
  type GoalLinkState,
  type MorningGoals,
  type PeriodEndChoice,
  type PeriodEndItem,
  type TodoNode,
} from "@life-editor/shared";

/*
 * The morning paper's goals (#2106, plan Step 7): the snapshot the goals
 * block, the todo rows' marks and the period-end review read, and the writes
 * they make — this week's new goal and the review's answers.
 *
 * The snapshot is the linking screens' own (useGoalLinkSnapshot), handed the
 * paper's live todo tree so the tree is not read twice; only the `goals`
 * domain re-reads it. Every verdict is `judgeGoals` (morningGoals.ts), the
 * rule the MCP tools share — nothing here decides what counts as achieved.
 *
 * Nothing is judged until the paper has really read the todo tree
 * (`todosRead`): before that — or when that read failed — the tree is the
 * blank paper's `[]`, every link would point at a missing todo, and the
 * review would ask about goals MCP calls achieved. A「やめる」written then
 * would be permanent, so the whole goals face waits instead.
 *
 * The goals themselves are read only once the goals note's move into goal
 * rows has settled (`migrated`, #2105): a read taken mid-move would show an
 * empty week over goals that exist, and its count is what the add field's
 * 3-per-period check trusts.
 *
 * The review asks about one goal at a time. Each write patches the goals it
 * returns into the snapshot before the busy state clears, so the next card's
 * carry plan already counts the goal just carried. An answer that lands is
 * also remembered for this mount, so the next goal shows without waiting for
 * the re-read;「あとで聞く」is remembered the same way, for the day it was
 * pressed on, and written nowhere — the questions come back the next time
 * the paper mounts or the day turns (plan §期間末).
 *
 * Only one goal write runs at a time — the add field's or a review answer's.
 * The snapshot counts a new goal only once its create has landed, so an add
 * and a「持ち越す」sent together would both see room and make a fourth goal
 * (the DB leaves the limit to the screens — 0034). `writing` greys the other
 * control while one is out.
 */

export interface MorningReview {
  item: PeriodEndItem;
  /** Unanswered goals left, this one included. */
  remaining: number;
  carry: CarryPlan;
}

export interface MorningGoalsState {
  state: GoalLinkState | null;
  goals: MorningGoals | null;
  review: MorningReview | null;
  reviewBusy: PeriodEndChoice | null;
  /** A goal write (add or review answer) is in flight; the others wait. */
  writing: boolean;
  decide: (choice: PeriodEndChoice) => void;
  askLater: () => void;
  createWeekGoal: (title: string) => Promise<boolean>;
  writeLinks: GoalLinkSnapshot["writeLinks"];
}

export function useMorningGoals(
  ds: DataService,
  todayKey: string,
  todoNodes: readonly TodoNode[],
  todosRead: boolean,
  migrated: boolean,
): MorningGoalsState {
  const { t } = useTranslation();
  const toast = useToastOptional();
  const snapshot = useGoalLinkSnapshot(ds, {
    active: migrated,
    todos: todoNodes,
  });
  const { writeLinks, writeGoals } = snapshot;
  const state = todosRead && migrated ? snapshot.state : null;
  const [answered, setAnswered] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // The day「あとで聞く」was pressed on: a paper left open into a new week
  // asks about the week that just ended.
  const [laterOn, setLaterOn] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState<PeriodEndChoice | null>(null);
  // The lock is the ref (a second press in the same tick sees it); the state
  // only redraws the controls.
  const lockRef = useRef(false);
  const [writing, setWriting] = useState(false);

  const goals = useMemo(
    () => (state === null ? null : buildMorningGoals(state, todayKey)),
    [state, todayKey],
  );

  const review = useMemo<MorningReview | null>(() => {
    if (state === null || laterOn === todayKey) return null;
    const queue = periodEndQueue(state, todayKey).filter(
      (item) => !answered.has(item.goal.id),
    );
    const first = queue[0];
    if (first === undefined) return null;
    return {
      item: first,
      remaining: queue.length,
      carry: carryPlan(state, first.goal, todayKey),
    };
  }, [state, todayKey, laterOn, answered]);

  /**
   * Run one goal write and say so if it fails; the snapshot re-reads either
   * way. False without writing while another write is out.
   */
  const write = useCallback(
    async (
      run: (patch: (goal: Goal) => void) => Promise<void>,
    ): Promise<boolean> => {
      if (lockRef.current) return false;
      lockRef.current = true;
      setWriting(true);
      try {
        await writeGoals(run);
        return true;
      } catch (err) {
        console.error("[BriefingScreen] goal write failed", err);
        toast?.showToast("danger", t("connect.goals.writeFailed"));
        return false;
      } finally {
        lockRef.current = false;
        setWriting(false);
      }
    },
    [toast, t, writeGoals],
  );

  const createWeekGoal = useCallback(
    async (title: string): Promise<boolean> => {
      // Checked here as well as by the hidden field: a double submit must not
      // make a fourth goal (the DB leaves the limit to the screens — 0034).
      if (goals === null || goals.week.length >= GOALS_PER_PERIOD_LIMIT) {
        return false;
      }
      return write(async (patch) => {
        patch(
          await ds.createGoal({
            id: generateId("goal"),
            title,
            periodKind: "week",
            periodKey: goals.periodKeys.week,
            sortOrder: goals.week.length,
          }),
        );
      });
    },
    [ds, goals, write],
  );

  const decide = useCallback(
    (choice: PeriodEndChoice) => {
      if (review === null || lockRef.current) return;
      const { goal } = review.item;
      const { carry } = review;
      // A copy left by a「持ち越す」whose decision write failed stays put
      // whatever the next answer is. It is a live goal on this week's list by
      // then — todos may already hang off it, or MCP made it — and the
      // review only ever writes a decision; removing it is Connect's call.
      setReviewBusy(choice);
      void (async () => {
        const ok = await write(async (patch) => {
          if (choice === "carried" && carry.existingId === null) {
            if (!carry.hasRoom) throw new Error("carry: the period is full");
            // The copy first: if the decision write then fails, the next
            // answer finds this copy (carryPlan.existingId) and only writes
            // the decision, instead of making a second one.
            patch(
              await ds.createGoal({
                id: generateId("goal"),
                title: goal.title,
                periodKind: goal.periodKind,
                periodKey: carry.periodKey,
                sortOrder: carry.sortOrder,
                parentGoalId: carry.parentGoalId,
                carriedFromGoalId: goal.id,
              }),
            );
          }
          // `decided_at` is stamped by the mapper (goalUpdatesToPatches).
          patch(await ds.updateGoal(goal.id, { periodEndDecision: choice }));
        });
        setReviewBusy(null);
        if (ok) setAnswered((prev) => new Set(prev).add(goal.id));
      })();
    },
    [ds, review, write],
  );

  const askLater = useCallback(() => setLaterOn(todayKey), [todayKey]);

  return {
    state,
    goals,
    review,
    reviewBusy,
    writing,
    decide,
    askLater,
    createWeekGoal,
    writeLinks,
  };
}

import { useMemo } from "react";
import {
  goalPeriodRanges,
  useTranslation,
  WEEK_STARTS_ON,
  type GoalDetailLabels,
  type GoalPeriodKind,
  type GoalTreeLabels,
} from "@life-editor/shared";

/*
 * The goal tree's and the goal panel's copy (#2108), resolved once for both
 * hosts that show `GoalDetailPanel`: Connect's "Goals & Todos" tab and the
 * morning paper's goals panel (#2286).
 */
export function useGoalTreeLabels(todayKey: string): {
  treeLabels: GoalTreeLabels;
  detailLabels: GoalDetailLabels;
} {
  const { t, i18n } = useTranslation();

  const treeLabels = useMemo<GoalTreeLabels>(() => {
    const kinds = ["year", "month", "week"] as const;
    const map = (fn: (kind: GoalPeriodKind) => string) =>
      Object.fromEntries(kinds.map((k) => [k, fn(k)])) as Record<
        GoalPeriodKind,
        string
      >;
    const ranges = goalPeriodRanges(
      todayKey,
      WEEK_STARTS_ON,
      i18n.language.startsWith("ja") ? "ja-JP" : "en-US",
    );
    return {
      kinds: map((k) => t(`connect.goals.kinds.${k}`)),
      periods: map((k) => t(`connect.goals.periods.${k}`)),
      periodRanges: map((k) => ranges[k]),
      addHeading: t("connect.goals.addHeading"),
      addPlaceholder: t("connect.goals.addPlaceholder"),
      add: t("connect.goals.add"),
      cancel: t("connect.goals.cancel"),
      formatLimit: (period) => t("connect.goals.limit", { period }),
      treeHeading: t("connect.goals.treeHeading"),
      unconnectedHeading: t("connect.goals.unconnectedHeading"),
      looseHeading: t("connect.goals.looseHeading"),
      empty: t("connect.goals.empty"),
      emptyAction: t("connect.goals.emptyAction"),
      achieved: t("connect.goals.achieved"),
      unconnected: t("connect.goals.unconnected"),
      formatProgress: (done, total) =>
        t("connect.goals.progress", { done, total }),
      status: t("todoDetail.status"),
      statusLabels: {
        statusNotStarted: t("todoDetail.statusNotStarted"),
        statusDone: t("todoDetail.statusDone"),
      },
      formatOpenTodo: (title) => t("connect.goals.openTodo", { title }),
      formatExpand: (title) => t("connect.goals.expand", { title }),
      formatCollapse: (title) => t("connect.goals.collapse", { title }),
      filteringBy: t("connect.goals.arrange.filteringBy"),
      resetFilters: t("connect.goals.arrange.reset"),
      noMatch: t("connect.goals.arrange.noMatch"),
      addTodo: t("connect.goals.addTodo"),
      addTodoLabel: t("connect.goals.addTodoLabel"),
      addTodoPlaceholder: t("connect.goals.addTodoPlaceholder"),
      dragToMove: t("connect.goals.dragToMove"),
      formatEdit: (title) => t("connect.goals.edit", { title }),
      formatAddUnder: (title) => t("connect.goals.addUnder", { title }),
      formatDelete: (title) => t("connect.goals.delete", { title }),
      formatChildGoal: (kind) => t("connect.goals.childGoal", { kind }),
      renameField: t("connect.goals.titleLabel"),
      loading: t("connect.goals.loading"),
      loadFailed: t("connect.goals.loadFailed"),
      retry: t("connect.goals.retry"),
    };
  }, [t, i18n.language, todayKey]);

  const detailLabels = useMemo<GoalDetailLabels>(
    () => ({
      titleLabel: t("connect.goals.titleLabel"),
      parentLabel: t("connect.goals.parentLabel"),
      parentNone: t("connect.goals.parentNone"),
      todosHeading: t("connect.goals.todosHeading"),
      todosEmpty: t("connect.goals.todosEmpty"),
      childrenHeading: t("connect.goals.childrenHeading"),
      formatEarlierChildren: (count) =>
        t("connect.goals.earlierChildren", { count }),
      markAchieved: t("connect.goals.markAchieved"),
      unmarkAchieved: t("connect.goals.unmarkAchieved"),
      manualHint: t("connect.goals.manualHint"),
      deleteGoal: t("connect.goals.deleteGoal"),
      formatPeriod: (kind, key) => t("connect.goals.period", { kind, key }),
      tree: treeLabels,
    }),
    [t, treeLabels],
  );

  return { treeLabels, detailLabels };
}

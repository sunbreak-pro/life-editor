import { useMemo } from "react";
import {
  goalPeriodRanges,
  useTranslation,
  WEEK_STARTS_ON,
  type GoalDetailLabels,
  type GoalPeriodKind,
  type GoalTodoLinkScreenLabels,
  type GoalTreeLabels,
} from "@life-editor/shared";

/*
 * The goal tree's and the goal panel's copy (#2108), resolved once for both
 * hosts that show `GoalDetailPanel`: Connect's "Goals & Todos" tab and the
 * morning paper's goals panel (#2286). Both open the linking screen too, whose
 * `periodLabel` is the linked goal's own, filled in where it opens.
 */
export function useGoalTreeLabels(todayKey: string): {
  treeLabels: GoalTreeLabels;
  detailLabels: GoalDetailLabels;
  linkLabels: GoalTodoLinkScreenLabels;
} {
  const { t, i18n } = useTranslation();

  const treeLabels = useMemo<GoalTreeLabels>(() => {
    const kinds = ["year", "month", "week"] as const;
    const map = (fn: (kind: GoalPeriodKind) => string) =>
      Object.fromEntries(kinds.map((k) => [k, fn(k)])) as Record<
        GoalPeriodKind,
        string
      >;
    const locale = i18n.language.startsWith("ja") ? "ja-JP" : "en-US";
    const ranges = goalPeriodRanges(todayKey, WEEK_STARTS_ON, locale);
    // "10/28", or "2027/1/5" for a day outside this year (#2366).
    const formatDay = (dayKey: string): string => {
      const [y, m, d] = dayKey.split("-").map(Number);
      if (!y || !m || !d) return dayKey;
      return new Date(y, m - 1, d).toLocaleDateString(locale, {
        ...(dayKey.slice(0, 4) === todayKey.slice(0, 4)
          ? {}
          : { year: "numeric" }),
        month: "numeric",
        day: "numeric",
      });
    };
    return {
      kinds: map((k) => t(`connect.goals.kinds.${k}`)),
      periods: map((k) => t(`connect.goals.periods.${k}`)),
      periodRanges: map((k) => ranges[k]),
      addHeading: t("connect.goals.addHeading"),
      addPlaceholder: t("connect.goals.addPlaceholder"),
      addNoParentHint: t("connect.goals.addNoParentHint"),
      add: t("connect.goals.add"),
      cancel: t("connect.goals.cancel"),
      startDate: t("connect.goals.startDate"),
      endDate: t("connect.goals.endDate"),
      formatDateRange: (startDate, endDate) =>
        t("connect.goals.dateRange", {
          start: formatDay(startDate),
          end: formatDay(endDate),
        }),
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
      formatMarkTodoDone: (title) => t("connect.goals.markTodoDone", { title }),
      formatMarkTodoOpen: (title) => t("connect.goals.markTodoOpen", { title }),
      formatDeleteTodo: (title) => t("connect.goals.deleteTodo", { title }),
      formatExpand: (title) => t("connect.goals.expand", { title }),
      formatCollapse: (title) => t("connect.goals.collapse", { title }),
      filteringBy: t("connect.goals.arrange.filteringBy"),
      resetFilters: t("connect.goals.arrange.reset"),
      noMatch: t("connect.goals.arrange.noMatch"),
      completedHeading: t("connect.goals.completedHeading"),
      addTodo: t("connect.goals.addTodo"),
      addTodoLabel: t("connect.goals.addTodoLabel"),
      addTodoPlaceholder: t("connect.goals.addTodoPlaceholder"),
      dragToMove: t("connect.goals.dragToMove"),
      addUnderTooltip: t("connect.goals.addUnderTooltip"),
      editTooltip: t("connect.goals.editTooltip"),
      deleteTooltip: t("connect.goals.deleteTooltip"),
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
      unlinkParent: t("connect.goals.unlinkParent"),
      formatUnlinkParent: (title) =>
        t("connect.goals.unlinkParentLabel", { title }),
      todosHeading: t("connect.goals.todosHeading"),
      todosEmpty: t("connect.goals.todosEmpty"),
      linkTodos: t("goalLink.heading"),
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

  const linkLabels = useMemo<GoalTodoLinkScreenLabels>(
    () => ({
      heading: t("goalLink.heading"),
      periodLabel: "",
      search: t("goalLink.search"),
      listLabel: t("goalLink.todoList"),
      empty: t("goalLink.empty"),
      noMatch: t("goalLink.noMatch"),
      done: t("goalLink.done"),
      previewHeading: t("goalLink.previewHeading"),
      achievementLost: t("goalLink.achievementLost"),
      save: t("goalLink.save"),
      saving: t("goalLink.saving"),
      cancel: t("goalLink.cancel"),
      saveFailed: t("goalLink.saveFailed"),
      unconnected: t("goalLink.unconnected"),
      achieved: t("goalLink.achieved"),
      becomesAchieved: t("goalLink.becomesAchieved"),
      losesAchievement: t("goalLink.losesAchievement"),
    }),
    [t],
  );

  return { treeLabels, detailLabels, linkLabels };
}

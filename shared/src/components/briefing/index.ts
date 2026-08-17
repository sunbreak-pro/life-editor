/*
 * Briefing feature sub-barrel (Briefing plan Step 1). Exposes the pure
 * morning-paper view + its typed props contract, and the extractBriefing
 * convention parser (the read half of the MCP write_briefing tool).
 * The global components/index.ts re-exports this with `export *`
 * (matches Analytics/Connect).
 */
export {
  BriefingView,
  type BriefingViewProps,
  type BriefingData,
  type BriefingLabels,
  type BriefingScheduleEntry,
  type BriefingTodoEntry,
  type BriefingCarryoverEntry,
} from "./BriefingView";
export {
  BriefingVizPanel,
  type BriefingVizPanelProps,
} from "./BriefingVizPanel";
export { extractBriefing, type ExtractedBriefing } from "./extractBriefing";
export {
  GoalsBlock,
  type GoalsBlockProps,
  type GoalsBlockLabels,
  type GoalFieldLabels,
} from "./GoalsBlock";
export {
  GOALS_NOTE_ID,
  GOAL_PERIODS,
  adoptBareGoalHeadings,
  extractGoals,
  mergeGoalSection,
  normalizeGoalText,
  type ExtractedGoals,
  type GoalPeriod,
} from "./goalSections";
export {
  goalPeriodKeys,
  goalPeriodRanges,
  type GoalPeriodKeys,
  type GoalPeriodRanges,
} from "./goalPeriods";
export {
  extractIntentionSection,
  hasIntentionToReport,
  mergeIntentionSection,
  normalizeIntentionText,
  type ExtractedIntentionSection,
} from "./intentionSection";
export {
  EveningView,
  type EveningViewProps,
  type EveningLabels,
  type EveningTodoEntry,
  type EveningScheduleEntry,
} from "./EveningView";
export {
  extractEveningSection,
  mergeEveningSection,
  stripEveningSection,
  eveningBodyLines,
  eveningBodyEquals,
  isEmptyDocJson,
  moodLineText,
  defaultBriefingTab,
  EVENING_TAB_START_HOUR,
  type ExtractedEveningSection,
  type EveningPatch,
  type BriefingTab,
} from "./eveningSection";

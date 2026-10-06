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
export {
  EveningReflectionPreview,
  type EveningReflectionPreviewProps,
} from "./EveningReflectionPreview";
export {
  extractBriefing,
  // Settings' "last AI activity" line (#1210) — the newest day a briefing
  // section exists for, read off the same convention this parser defines.
  lastBriefingDate,
  type ExtractedBriefing,
} from "./extractBriefing";
export {
  FOCUS_NOTE_ID,
  extractFocus,
  mergeFocusSection,
  normalizeFocusText,
} from "./focusSections";
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
// #2109: linking goals and Todos — the goal side (GoalTodoLinkScreen), the
// todo side (GoalPickerField), the pure before/after preview, and the hook
// that loads and writes the links. The goal types ride along so web hosts can
// name them (the shared root barrel does not export types/goal).
export type { Goal, GoalPeriodKind, GoalTodoLink } from "../../types/goal";
export {
  applyGoalLinkEdit,
  applyLinkDraft,
  goalProgressOf,
  goalsForTodoPicker,
  linkDraftOf,
  linkedGoalIds,
  lostAchievementIds,
  previewGoalLinkEdit,
  toAchievementTodo,
  toGoalLinkState,
  type GoalLinkEdit,
  type GoalLinkState,
  type LinkDraft,
  type GoalProgress,
  type GoalProgressChange,
  type GoalTodoPair,
} from "./goalLinkPreview";
export {
  GoalAchievementLostNotice,
  GoalProgressDelta,
  goalProgressText,
  type GoalProgressLabels,
} from "./GoalProgressDelta";
export {
  GoalPickerField,
  goalPickerLabels,
  type GoalPickerFieldProps,
  type GoalPickerLabelKey,
  type GoalPickerLabels,
} from "./GoalPickerField";
export {
  GoalTodoLinkScreen,
  type GoalLinkDiff,
  type GoalLinkTodoOption,
  type GoalTodoLinkScreenLabels,
  type GoalTodoLinkScreenProps,
} from "./GoalTodoLinkScreen";
export {
  useGoalLinkSnapshot,
  type GoalLinkLoader,
  type GoalLinkSnapshot,
} from "./useGoalLinkSnapshot";
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

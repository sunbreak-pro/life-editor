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
  type BriefingTaskEntry,
  type BriefingCarryoverEntry,
} from "./BriefingView";
export { extractBriefing, type ExtractedBriefing } from "./extractBriefing";
export {
  extractIntentionSection,
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
  isEmptyDocJson,
  moodLineText,
  defaultBriefingTab,
  EVENING_TAB_START_HOUR,
  type ExtractedEveningSection,
  type EveningPatch,
  type BriefingTab,
} from "./eveningSection";

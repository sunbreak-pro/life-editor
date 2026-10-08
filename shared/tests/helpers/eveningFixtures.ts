import { vi } from "vitest";
import type { EveningLabels, EveningViewProps } from "../../src/components";

/*
 * One copy of the evening paper's labels and its #2107 props for the suites
 * that render <EveningView> (briefingView / briefingTapTargets / eveningPaper).
 * The labels are a typed literal, so every suite that wrote its own had to be
 * edited each time the paper grew a block.
 */
export const EVENING_LABELS: EveningLabels = {
  masthead: "EVENING",
  moodTitle: "MOOD",
  moodStars: [1, 2, 3, 4, 5].map((n) => `Mood ${n}/5`),
  reflectionTitle: "CLOSING",
  savedCaption: "Saved",
  focusTitle: "A NOTE TO TOMORROW",
  focusPlaceholder: "Tomorrow's one thing…",
  todosTitle: "REMAINING",
  noTodos: "No todos",
  todoStatus: "Status",
  statusNotStarted: "Not started",
  statusDone: "Done",
  upcomingTitle: "UPCOMING",
  noUpcoming: "Nothing upcoming",
  tomorrowTag: "Tomorrow",
  allDay: "All day",
  goalsTitle: "GOALS MOVED",
  noGoals: "No goals moved today",
  goalAchieved: "Achieved",
  goalRemaining: (n) => `${n} to go`,
  eventsTitle: "WHAT HAPPENED",
  noEvents: "Nothing recorded today yet",
  eventDone: "Done",
  eventWork: "Work",
  eventNoteButton: "Note",
  eventNoteAdd: (title) => `Add a note: ${title}`,
  eventNoteEdit: (title) => `Edit the note: ${title}`,
  eventNotePlaceholder: "A line about it…",
  tomorrowTitle: "PUT ON TOMORROW",
  noTomorrow: "No todos to put on tomorrow",
  tomorrowTimeLabel: (title) => `Time (optional): ${title}`,
  placeTomorrow: "Put on tomorrow",
  placeTomorrowLabel: (title) => `Put on tomorrow: ${title}`,
  placedTomorrow: (time) => `Tomorrow ${time}`,
  openDaily: "Open in Daily",
  openDailyLabel: "Open in Daily: 2026-07-25",
};

/** The #2107 blocks, empty — what a day with nothing in them renders. */
export function emptyEveningBlocks(): Pick<
  EveningViewProps,
  | "goalMoves"
  | "events"
  | "onSaveEventNote"
  | "tomorrowTodos"
  | "onPlaceTomorrow"
> {
  return {
    goalMoves: [],
    events: [],
    onSaveEventNote: vi.fn(),
    tomorrowTodos: [],
    onPlaceTomorrow: vi.fn(),
  };
}

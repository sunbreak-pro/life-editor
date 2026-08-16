/*
 * Provenance visuals shared by the Schedule surfaces (#893 step 3).
 *
 * Every calendar surface marks WHERE a row came from — a routine's occurrence,
 * a one-off event, or a scheduled todo — and each does it in the vocabulary of
 * its own layout: WeekTimeGrid paints a block face plus a left band, MonthGrid
 * and AgendaList paint a leading dot. The measurement asked for by #893 found
 * exactly one piece of that shared verbatim: `dotColorClasses`, which stood
 * byte-identical in both MonthGrid and AgendaList. It lives here now.
 *
 * The block/chip FACE mappings are deliberately NOT here. They look like the
 * same switch but resolve to different token families (`schedule-*-bg` for a
 * timed block, `chip-*-bg` for a month chip) because a block and a chip are
 * read at different sizes. Merging them would need a parameter that selects
 * the family, which is the same thing as two functions with extra steps.
 */

/**
 * Where a Schedule row came from. Named once so the three item types
 * (WeekTimeGridItem / MonthGridItem / AgendaItem) cannot drift apart — they
 * are the same fact seen through three layouts.
 */
export type ScheduleItemVariant = "routine" | "event" | "task";

/** Leading-dot color for a chip/row surface (MonthGrid, AgendaList). */
export function dotColorClasses(variant: ScheduleItemVariant): string {
  switch (variant) {
    case "routine":
      return "bg-lumen-chip-routine-dot";
    case "task":
      return "bg-lumen-chip-task-dot";
    default:
      return "bg-lumen-chip-event-dot";
  }
}

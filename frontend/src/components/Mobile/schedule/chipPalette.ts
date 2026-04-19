import type { DayItemKind } from "./dayItem";

export interface ChipPalette {
  bg: string;
  fg: string;
  dot: string;
}

const kindStyle: Record<DayItemKind, ChipPalette> = {
  routine: {
    bg: "var(--color-chip-routine-bg)",
    fg: "var(--color-chip-routine-fg)",
    dot: "var(--color-chip-routine-dot)",
  },
  event: {
    bg: "var(--color-chip-event-bg)",
    fg: "var(--color-chip-event-fg)",
    dot: "var(--color-chip-event-dot)",
  },
  task: {
    bg: "var(--color-chip-task-bg)",
    fg: "var(--color-chip-task-fg)",
    dot: "var(--color-chip-task-dot)",
  },
};

export function kindPalette(kind: DayItemKind): ChipPalette {
  return kindStyle[kind];
}

const completedStyle: ChipPalette = {
  bg: "var(--color-chip-completed-bg)",
  fg: "var(--color-chip-completed-fg)",
  dot: "var(--color-chip-completed-dot)",
};

export function completedPalette(): ChipPalette {
  return completedStyle;
}

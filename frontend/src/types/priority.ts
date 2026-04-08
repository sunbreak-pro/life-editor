export type Priority = 1 | 2 | 3 | 4;

export const PRIORITY_COLORS: Record<Priority, string> = {
  1: "#ef4444", // red
  2: "#f97316", // orange
  3: "#3b82f6", // blue
  4: "#9ca3af", // gray
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
  4: "P4",
};

export const PRIORITY_OPTIONS: Priority[] = [1, 2, 3, 4];

import {
  Circle,
  CircleDashed,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { TaskStatus } from "../types/taskTree";

/*
 * Shared Task-status visuals (C5 dedup): canonical order, icon map and
 * label resolver used by the Kanban surfaces (desktop) and MobileTaskList
 * (web). Band/chip color classes stay per-surface — only the copies that
 * were byte-identical live here.
 */

export const STATUS_ORDER: readonly TaskStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
];

export const STATUS_ICON: Record<TaskStatus, LucideIcon> = {
  NOT_STARTED: Circle,
  IN_PROGRESS: CircleDashed,
  DONE: CheckCircle2,
};

/** Structural subset of each surface's already-translated label object. */
export interface StatusLabelSet {
  statusNotStarted: string;
  statusInProgress: string;
  statusDone: string;
}

export function statusLabel(
  status: TaskStatus,
  labels: StatusLabelSet,
): string {
  switch (status) {
    case "NOT_STARTED":
      return labels.statusNotStarted;
    case "IN_PROGRESS":
      return labels.statusInProgress;
    case "DONE":
      return labels.statusDone;
  }
}

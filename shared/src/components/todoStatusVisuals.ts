import { Circle, CheckCircle2, type LucideIcon } from "lucide-react";
import type { TodoStatus } from "../types/todoTree";
import type { TranslationKey } from "../i18n/resources";

/*
 * Shared Todo-status visuals (C5 dedup): canonical order, icon map and
 * label resolver used by the Kanban surfaces (desktop) and MobileTodoList
 * (web). Band/chip color classes stay per-surface — only the copies that
 * were byte-identical live here.
 */

export const STATUS_ORDER: readonly TodoStatus[] = ["NOT_STARTED", "DONE"];

export const STATUS_ICON: Record<TodoStatus, LucideIcon> = {
  NOT_STARTED: Circle,
  DONE: CheckCircle2,
};

/**
 * i18n caption key per status — one definition so every surface hosting
 * TodoDetailPanel (Kanban board, schedule todo-chip detail) words a status
 * identically.
 */
export const STATUS_TEXT_KEY: Record<TodoStatus, TranslationKey> = {
  NOT_STARTED: "todoDetail.statusNotStarted",
  DONE: "todoDetail.statusDone",
};

/** Structural subset of each surface's already-translated label object. */
export interface StatusLabelSet {
  statusNotStarted: string;
  statusDone: string;
}

export function statusLabel(
  status: TodoStatus,
  labels: StatusLabelSet,
): string {
  switch (status) {
    case "NOT_STARTED":
      return labels.statusNotStarted;
    case "DONE":
      return labels.statusDone;
  }
}

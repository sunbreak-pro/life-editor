import { useCallback } from "react";
import type { ConversionRole } from "./useRoleConversion";

interface RoleNavigationCallbacks {
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToEvent?: (eventId: string) => void;
  onNavigateToNote?: (noteId: string) => void;
  onNavigateToDaily?: (date: string) => void;
}

export function useRoleNavigation(
  callbacks: RoleNavigationCallbacks,
): (role: ConversionRole, id: string) => void {
  return useCallback(
    (role: ConversionRole, id: string) => {
      switch (role) {
        case "task":
          callbacks.onNavigateToTask?.(id);
          break;
        case "event":
          callbacks.onNavigateToEvent?.(id);
          break;
        case "note":
          callbacks.onNavigateToNote?.(id);
          break;
        case "daily":
          callbacks.onNavigateToDaily?.(id);
          break;
      }
    },
    [callbacks],
  );
}

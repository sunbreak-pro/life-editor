import { useEffect, useRef, useCallback } from "react";
import { getDataService } from "../services";
import {
  useRealtimeSync,
  type ChangeEvent,
  type ConnectionState,
} from "./useRealtimeSync";
import { isApiConfigured } from "../config/api";

const POLLING_INTERVAL_MS = 5000;
const POLLING_MAX_MS = 30000;

export function useExternalDataSync(
  isTerminalOpen: boolean,
  refetchTasks: () => Promise<void>,
): ConnectionState {
  const lastSnapshotRef = useRef<string>("");
  const errorCountRef = useRef(0);
  const wsStateRef = useRef<ConnectionState>("disconnected");

  const handleChange = useCallback(
    (event: ChangeEvent) => {
      if (event.entity === "task") {
        refetchTasks();
      }
    },
    [refetchTasks],
  );

  const wsState = useRealtimeSync(handleChange);
  wsStateRef.current = wsState;

  // Polling fallback: only when terminal is open AND WS is not connected
  useEffect(() => {
    if (!isTerminalOpen) return;
    // If running in mobile (REST mode), WS handles sync
    if (isApiConfigured()) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      const delay = Math.min(
        POLLING_INTERVAL_MS * Math.pow(2, errorCountRef.current),
        POLLING_MAX_MS,
      );
      timerId = setTimeout(checkForChanges, delay);
    };

    const checkForChanges = async () => {
      // Skip polling if WS is connected
      if (wsStateRef.current === "connected") {
        scheduleNext();
        return;
      }

      try {
        const ds = getDataService();
        const tasks = await ds.fetchTaskTree();
        const snapshot = `${tasks.length}:${tasks.reduce((max, t) => {
          const ts = t.completedAt || t.createdAt || "";
          return ts > max ? ts : max;
        }, "")}`;

        if (lastSnapshotRef.current && snapshot !== lastSnapshotRef.current) {
          await refetchTasks();
        }
        lastSnapshotRef.current = snapshot;
        errorCountRef.current = 0;
      } catch (e) {
        errorCountRef.current = Math.min(errorCountRef.current + 1, 4);
        console.debug(
          `[ExternalDataSync] polling error (retry #${errorCountRef.current}):`,
          e,
        );
      }
      scheduleNext();
    };

    checkForChanges();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [isTerminalOpen, refetchTasks]);

  return wsState;
}

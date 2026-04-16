import { useEffect, useRef } from "react";
import { getDataService } from "../services";

const POLLING_INTERVAL_MS = 5000;
const POLLING_MAX_MS = 30000;

export function useExternalDataSync(
  isTerminalOpen: boolean,
  refetchTasks: () => Promise<void>,
): void {
  const lastSnapshotRef = useRef<string>("");
  const errorCountRef = useRef(0);

  useEffect(() => {
    if (!isTerminalOpen) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      const delay = Math.min(
        POLLING_INTERVAL_MS * Math.pow(2, errorCountRef.current),
        POLLING_MAX_MS,
      );
      timerId = setTimeout(checkForChanges, delay);
    };

    const checkForChanges = async () => {
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
}

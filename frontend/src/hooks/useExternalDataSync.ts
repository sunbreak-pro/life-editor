import { useEffect, useRef } from "react";
import { getDataService } from "../services";

const POLL_INTERVAL_MS = 2000;

export function useExternalDataSync(
  isTerminalOpen: boolean,
  refetchTasks: () => Promise<void>,
) {
  const lastSnapshotRef = useRef<string>("");

  useEffect(() => {
    if (!isTerminalOpen) return;

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
      } catch {
        // Ignore polling errors
      }
    };

    // Initial snapshot
    checkForChanges();

    const interval = setInterval(checkForChanges, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isTerminalOpen, refetchTasks]);
}

import { useEffect, useRef } from "react";
import type { TaskNode } from "../types/taskTree";
import { useTaskTreeContext } from "./useTaskTreeContext";

export function useAutoInProgress(tasks: TaskNode[], isToday: boolean): void {
  const { setTaskStatus } = useTaskTreeContext();
  const processedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isToday) return;

    for (const task of tasks) {
      if (task.status === "NOT_STARTED" && !processedIds.current.has(task.id)) {
        processedIds.current.add(task.id);
        setTaskStatus(task.id, "IN_PROGRESS");
      }
    }
  }, [tasks, isToday, setTaskStatus]);
}

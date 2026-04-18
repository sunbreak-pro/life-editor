import { describe, it } from "vitest";
import type { TaskNode } from "../types/taskTree";
import { computeFolderProgress } from "./folderProgress";

function buildTree(folderCount: number, tasksPerFolder: number): TaskNode[] {
  const nodes: TaskNode[] = [];
  for (let f = 0; f < folderCount; f++) {
    nodes.push({
      id: `folder-${f}`,
      type: "folder",
      title: `Folder ${f}`,
      parentId: null,
      order: f,
    } as unknown as TaskNode);
    for (let t = 0; t < tasksPerFolder; t++) {
      nodes.push({
        id: `task-${f}-${t}`,
        type: "task",
        title: `Task ${f}-${t}`,
        parentId: `folder-${f}`,
        order: t,
        status: t % 3 === 0 ? "DONE" : "NOT_STARTED",
      } as unknown as TaskNode);
    }
  }
  return nodes;
}

function measureAllFolders(
  nodes: TaskNode[],
  folderIds: string[],
  runs: number,
): { avg: number; max: number } {
  // Warm up
  for (const id of folderIds) computeFolderProgress(id, nodes);

  let total = 0;
  let max = 0;
  for (let r = 0; r < runs; r++) {
    const start = performance.now();
    for (const id of folderIds) {
      computeFolderProgress(id, nodes);
    }
    const elapsed = performance.now() - start;
    total += elapsed;
    if (elapsed > max) max = elapsed;
  }
  return { avg: total / runs, max };
}

describe("folderProgress benchmark", () => {
  it("measures full-tree recomputation at realistic sizes", () => {
    const sizes: Array<[number, number]> = [
      [50, 10],
      [100, 20],
      [200, 10],
      [100, 50],
      [50, 100],
    ];

    console.log(
      "\n=== computeFolderProgress: rendering all folders (baseline, no React Compiler) ===",
    );
    console.log("F = folders, T = tasks per folder, runs = 20");
    for (const [F, T] of sizes) {
      const nodes = buildTree(F, T);
      const folderIds = nodes
        .filter((n) => n.type === "folder")
        .map((n) => n.id);
      const { avg, max } = measureAllFolders(nodes, folderIds, 20);
      console.log(
        `  F=${String(F).padStart(3)}  T=${String(T).padStart(3)}  (total nodes=${String(
          nodes.length,
        ).padStart(5)})  avg=${avg.toFixed(2)}ms  max=${max.toFixed(2)}ms`,
      );
    }
    console.log("=== end ===\n");
  });
});

// TaskNode ID は CLAUDE.md §4.3 の `<type>-<timestamp+counter>` 形式。
// useTaskTreeAPI.ts のローカル generateId と同じ「Date.now() 起点 + 単調増加」
// 方式を共有ヘルパ化し、同一ミリ秒内の `task-${Date.now()}` 衝突を防ぐ。
let counter = Date.now();

export function generateTaskId(): string {
  return `task-${++counter}`;
}

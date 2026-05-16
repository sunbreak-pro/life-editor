// TaskNode ID は CLAUDE.md §4.3 の `<type>-<timestamp+counter>` 形式。
// useTaskTreeAPI.ts のローカル generateId と同じ「Date.now() 起点 + 単調増加」
// 方式を共有ヘルパ化し、同一ミリ秒内の `<type>-${Date.now()}` 衝突を防ぐ。
// counter は module スコープで単調増加するため type をまたいでも一意。
let counter = Date.now();

export function generateTaskId(type = "task"): string {
  return `${type}-${++counter}`;
}

export function genId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(16).slice(2, 10);
  const time = Date.now().toString(16);
  return `${prefix}-${time}-${rand}`;
}

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

export function weekdayOf(yyyymmdd: string): string {
  const d = new Date(`${yyyymmdd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return WEEKDAYS_JA[d.getDay()];
}

export const DAILY_TEMPLATE =
  "## 今日の振り返り\n\n\n## 学び・気づき\n\n\n## 明日の予定\n";

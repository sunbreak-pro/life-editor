export function toLocalISOString(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayKey(): string {
  return formatDateKey(new Date());
}

export function formatDisplayDate(dateStr: string, locale = "en"): string {
  const date = new Date(dateStr + "T00:00:00");
  if (locale.startsWith("ja")) {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const year = date.getFullYear();
    const now = new Date();
    if (year !== now.getFullYear()) {
      return `${year}年${m}月${d}日`;
    }
    return `${m}月${d}日`;
  }
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  const year = date.getFullYear();
  const now = new Date();
  if (year !== now.getFullYear()) {
    return `${month} ${day}, ${year}`;
  }
  return `${month} ${day}`;
}

export function formatDateHeading(dateStr: string, locale = "en"): string {
  const date = new Date(dateStr + "T00:00:00");
  const loc = locale.startsWith("ja") ? "ja-JP" : "en-US";
  return date.toLocaleDateString(loc, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatMonthLabel(monthKey: string, locale = "en"): string {
  if (locale.startsWith("ja")) {
    const [y, m] = monthKey.split("-");
    return `${y}年${parseInt(m)}月`;
  }
  return monthKey;
}

const JA_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const EN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDayFlowDate(date: Date, locale: string): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const dow = date.getDay();
  const weekday = locale.startsWith("ja") ? JA_WEEKDAYS[dow] : EN_WEEKDAYS[dow];
  return `${m}/${d}(${weekday})`;
}

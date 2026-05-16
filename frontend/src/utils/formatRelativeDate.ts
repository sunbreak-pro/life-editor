import i18n from "../i18n";

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const t = i18n.t.bind(i18n);

  if (diffMin < 1) return t("dateTime.justNow");
  if (diffMin < 60) return t("dateTime.minutesAgo", { count: diffMin });
  if (diffHours < 24) return t("dateTime.hoursAgo", { count: diffHours });
  if (diffDays === 1) return t("dateTime.yesterday");
  if (diffDays < 30) return t("dateTime.daysAgo", { count: diffDays });

  return date.toLocaleDateString(i18n.language === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(i18n.language === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

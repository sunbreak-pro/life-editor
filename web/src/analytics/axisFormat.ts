import type { AnalyticsLabels } from "@life-editor/shared";

/*
 * The Analytics charts' axis vocabulary, built where the language lives (#1864).
 *
 * Each chart used to hardcode its own: "0.15h" / "8m" for time and "9/8",
 * "09-08", "2026/9", "8/23~" for dates on a single tab, none of which followed
 * the language. The shared tree takes copy through props, so the host resolves
 * both here once and every chart reads the same pair.
 *
 * Kept out of AnalyticsScreen so it can be tested without mounting the screen.
 */

type AxisFormat = AnalyticsLabels["axis"];

/** The three catalog strings a duration needs; `t` is narrowed to just that. */
type DurationKey =
  "analytics.hours" | "analytics.axis.hoursOnly" | "analytics.axis.minutesOnly";

type Translate = (
  key: DurationKey | "analytics.axis.weekFrom",
  values: Record<string, string | number>,
) => string;

/** Local midnight of a `YYYY-MM-DD` key (`new Date(key)` would parse it as UTC). */
function dateOfKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function makeAxisFormat(t: Translate, language: string): AxisFormat {
  // Same two-way split the rest of the web host uses for Intl (BriefingScreen).
  const locale = language.startsWith("ja") ? "ja-JP" : "en-US";
  const dayFormat = new Intl.DateTimeFormat(locale, {
    month: "numeric",
    day: "numeric",
  });
  const monthFormat = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
  });

  return {
    duration: (minutes) => {
      // Round once, then split — the same guard formatHours has (119.7 must
      // not render as "1h 60m").
      const total = Math.round(minutes);
      const hours = Math.floor(total / 60);
      const rest = total % 60;
      // An axis tick is narrow: drop the half that is zero ("30m", "2h")
      // rather than printing "0h 30m" down the whole gutter.
      if (hours === 0)
        return t("analytics.axis.minutesOnly", { minutes: rest });
      if (rest === 0) return t("analytics.axis.hoursOnly", { hours });
      return t("analytics.hours", { hours, minutes: rest });
    },
    date: (dateKey, unit) => {
      const d = dateOfKey(dateKey);
      if (unit === "month") return monthFormat.format(d);
      const day = dayFormat.format(d);
      return unit === "week"
        ? t("analytics.axis.weekFrom", { date: day })
        : day;
    },
  };
}

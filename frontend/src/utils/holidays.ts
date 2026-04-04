import holidayJp from "@holiday-jp/holiday_jp";

export type DateType = "holiday" | "sunday" | "saturday" | "weekday";

export function isHoliday(date: Date): boolean {
  return holidayJp.isHoliday(date);
}

export function getHolidayName(
  date: Date,
  lang: "ja" | "en" = "ja",
): string | null {
  const holidays = holidayJp.between(date, date);
  if (holidays.length === 0) return null;
  return lang === "en" ? holidays[0].name_en : holidays[0].name;
}

export function getDateType(date: Date): DateType {
  if (holidayJp.isHoliday(date)) return "holiday";
  const day = date.getDay();
  if (day === 0) return "sunday";
  if (day === 6) return "saturday";
  return "weekday";
}

export function getDateBgClass(
  _dateType: DateType,
  _isCurrentMonth = true,
): string {
  return "";
}

export function getDateTextClass(
  dateType: DateType,
  isCurrentMonth = true,
): string {
  if (isCurrentMonth) {
    switch (dateType) {
      case "holiday":
        return "text-green-600 dark:text-green-400";
      case "sunday":
        return "text-red-500 dark:text-red-400";
      case "saturday":
        return "text-blue-500 dark:text-blue-400";
      default:
        return "";
    }
  }
  // Non-current month: gray-based but distinguishable
  switch (dateType) {
    case "holiday":
      return "text-green-300 dark:text-green-700";
    case "sunday":
      return "text-red-300 dark:text-red-700";
    case "saturday":
      return "text-blue-300 dark:text-blue-700";
    default:
      return "";
  }
}

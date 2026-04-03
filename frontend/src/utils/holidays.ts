import holidayJp from "@holiday-jp/holiday_jp";

export type DateType = "holiday" | "sunday" | "saturday" | "weekday";

export function isHoliday(date: Date): boolean {
  return holidayJp.isHoliday(date);
}

export function getDateType(date: Date): DateType {
  if (holidayJp.isHoliday(date)) return "holiday";
  const day = date.getDay();
  if (day === 0) return "sunday";
  if (day === 6) return "saturday";
  return "weekday";
}

export function getDateBgClass(
  dateType: DateType,
  isCurrentMonth = true,
): string {
  const opacity = isCurrentMonth ? "" : "/50";
  switch (dateType) {
    case "holiday":
      return `bg-green-50${opacity} dark:bg-green-950/30`;
    case "sunday":
      return `bg-red-50${opacity} dark:bg-red-950/30`;
    case "saturday":
      return `bg-blue-50${opacity} dark:bg-blue-950/30`;
    default:
      return "";
  }
}

export function getDateTextClass(dateType: DateType): string {
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

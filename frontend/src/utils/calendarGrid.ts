export interface CalendarGridDay {
  date: Date;
  isCurrentMonth: boolean;
}

export interface CalendarGridOptions {
  year: number;
  month: number;
  weekStartsOn: 0 | 1;
  fixedRows?: number;
}

export function buildCalendarGrid({
  year,
  month,
  weekStartsOn,
  fixedRows,
}: CalendarGridOptions): CalendarGridDay[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dow = firstDay.getDay();
  const startPad = weekStartsOn === 0 ? dow : (dow + 6) % 7;

  const days: CalendarGridDay[] = [];

  for (let i = startPad - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month, -i),
      isCurrentMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      date: new Date(year, month, d),
      isCurrentMonth: true,
    });
  }

  const targetLength = fixedRows
    ? fixedRows * 7
    : Math.ceil(days.length / 7) * 7;
  while (days.length < targetLength) {
    const tail = days[days.length - 1].date;
    const next = new Date(tail);
    next.setDate(next.getDate() + 1);
    days.push({ date: next, isCurrentMonth: false });
  }

  return days;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

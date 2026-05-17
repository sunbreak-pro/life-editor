import { formatTime } from "./timeGridUtils";

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function fmtDate(d: Date): string {
  return `${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function fmtTime(d: Date): string {
  return formatTime(d.getHours(), d.getMinutes());
}

function fmtCompactDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatScheduleRange(
  startIso: string,
  endIso?: string,
  isAllDay?: boolean,
): string {
  const s = new Date(startIso);

  if (isAllDay) {
    const startStr = fmtDate(s);
    if (!endIso) return startStr;
    const e = new Date(endIso);
    const endStr = fmtDate(e);
    return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
  }

  if (!endIso) {
    return `${fmtDate(s)} ${fmtTime(s)}`;
  }

  const e = new Date(endIso);
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) {
    return `${fmtDate(s)} ${fmtTime(s)} - ${fmtTime(e)}`;
  }
  return `${fmtDate(s)} ${fmtTime(s)} - ${fmtDate(e)} ${fmtTime(e)}`;
}

export function formatTimeRangeCompact(
  startIso: string,
  endIso?: string,
): string {
  const s = new Date(startIso);
  const sTime = fmtTime(s);
  if (!endIso) return sTime;

  const e = new Date(endIso);
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) {
    return `${sTime} - ${fmtTime(e)}`;
  }
  return `${fmtCompactDate(s)} ${sTime} - ${fmtCompactDate(e)} ${fmtTime(e)}`;
}

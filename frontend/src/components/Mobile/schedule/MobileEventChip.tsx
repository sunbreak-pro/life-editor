import type { DayItem } from "./dayItem";
import { kindPalette } from "./chipPalette";

interface MobileEventChipProps {
  item: DayItem;
  dimmed?: boolean;
}

export function MobileEventChip({ item, dimmed }: MobileEventChipProps) {
  const s = kindPalette(item.kind);
  return (
    <div
      className="flex min-h-[14px] min-w-0 max-w-full items-center gap-[3px] overflow-hidden rounded-[4px] px-[5px] py-px text-[9.5px] font-medium leading-[13px]"
      style={{
        background: s.bg,
        color: s.fg,
        opacity: dimmed ? 0.5 : 1,
      }}
    >
      <span
        className="h-1 w-1 shrink-0 rounded-[2px]"
        style={{ background: s.dot }}
      />
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
        {item.title}
      </span>
    </div>
  );
}

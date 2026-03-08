import { useCallback, useRef } from "react";

interface SplitDividerProps {
  direction: "horizontal" | "vertical";
  onSizesChange: (sizes: number[]) => void;
  index: number;
  parentRef: React.RefObject<HTMLDivElement | null>;
  sizes: number[];
}

export function SplitDivider({
  direction,
  onSizesChange,
  index,
  parentRef,
  sizes,
}: SplitDividerProps) {
  const startPos = useRef(0);
  const startSizes = useRef<number[]>([]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startPos.current = direction === "horizontal" ? e.clientX : e.clientY;
      startSizes.current = [...sizes];

      const parent = parentRef.current;
      if (!parent) return;

      const totalSize =
        direction === "horizontal" ? parent.offsetWidth : parent.offsetHeight;

      const handleMouseMove = (ev: MouseEvent) => {
        const currentPos = direction === "horizontal" ? ev.clientX : ev.clientY;
        const deltaPx = currentPos - startPos.current;
        const deltaPct = (deltaPx / totalSize) * 100;

        const newSizes = [...startSizes.current];
        const minSize = 10;

        newSizes[index] = Math.max(
          minSize,
          startSizes.current[index] + deltaPct,
        );
        newSizes[index + 1] = Math.max(
          minSize,
          startSizes.current[index + 1] - deltaPct,
        );

        if (newSizes[index] >= minSize && newSizes[index + 1] >= minSize) {
          onSizesChange(newSizes);
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor =
        direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [direction, onSizesChange, index, parentRef, sizes],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className={
        direction === "horizontal"
          ? "w-1 shrink-0 cursor-col-resize hover:bg-notion-accent/30 transition-colors bg-[#313244]"
          : "h-1 shrink-0 cursor-row-resize hover:bg-notion-accent/30 transition-colors bg-[#313244]"
      }
    />
  );
}

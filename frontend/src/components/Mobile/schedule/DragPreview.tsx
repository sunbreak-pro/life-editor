interface DragPreviewProps {
  top: number;
  height: number;
  startLabel: string;
  endLabel: string;
  gutterLeft: number;
}

export function DragPreview({
  top,
  height,
  startLabel,
  endLabel,
  gutterLeft,
}: DragPreviewProps) {
  return (
    <>
      {/* Preview block (semi-transparent) */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-lg border-2 border-dashed border-notion-accent"
        style={{
          top,
          height,
          left: gutterLeft,
          right: 6,
          background:
            "color-mix(in srgb, var(--color-notion-accent) 10%, transparent)",
          zIndex: 30,
        }}
      />
      {/* Snap start line */}
      <div
        aria-hidden
        className="pointer-events-none absolute border-t-2 border-notion-accent"
        style={{
          top,
          left: gutterLeft,
          right: 0,
          zIndex: 31,
        }}
      />
      {/* Live time pill (start) */}
      <div
        aria-hidden
        className="pointer-events-none absolute flex items-center justify-center rounded-md bg-notion-accent px-1.5 py-0.5 text-[10px] font-semibold text-white shadow"
        style={{
          top: Math.max(0, top - 8),
          left: 2,
          zIndex: 32,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {startLabel}
      </div>
      {/* Live time pill (end) */}
      <div
        aria-hidden
        className="pointer-events-none absolute flex items-center justify-center rounded-md bg-notion-bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-notion-text shadow"
        style={{
          top: top + height - 8,
          left: 2,
          zIndex: 32,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {endLabel}
      </div>
    </>
  );
}

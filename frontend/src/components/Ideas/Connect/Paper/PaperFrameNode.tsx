import { memo, useState, useCallback, useRef, useEffect } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";

export type PaperFrameData = {
  frameColor: string;
  frameLabel: string;
  onLabelChange?: (nodeId: string, label: string) => void;
  onColorChange?: (nodeId: string, color: string) => void;
};

const FRAME_COLORS = [
  "#e2e8f0",
  "#fef3c7",
  "#dbeafe",
  "#dcfce7",
  "#fce7f3",
  "#ede9fe",
  "#ffedd5",
];

function PaperFrameNodeInner({
  id,
  data,
  selected,
}: NodeProps & { data: PaperFrameData }) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [label, setLabel] = useState(data.frameLabel || "");
  const [showColors, setShowColors] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(data.frameLabel || "");
  }, [data.frameLabel]);

  useEffect(() => {
    if (editingLabel && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingLabel]);

  const handleLabelBlur = useCallback(() => {
    setEditingLabel(false);
    if (label !== data.frameLabel) {
      data.onLabelChange?.(id, label);
    }
  }, [id, label, data]);

  const handleColorSelect = useCallback(
    (color: string) => {
      data.onColorChange?.(id, color);
      setShowColors(false);
    },
    [id, data],
  );

  const bgColor = data.frameColor || "#e2e8f0";

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={!!selected}
        lineClassName="!border-notion-accent"
        handleClassName="!w-2.5 !h-2.5 !bg-notion-accent !border-notion-accent"
      />
      <div
        className="w-full h-full rounded-lg border-2 border-opacity-30"
        style={{
          backgroundColor: bgColor + "33",
          borderColor: bgColor,
        }}
      >
        {/* Label bar */}
        <div
          className="absolute -top-0.5 left-2 flex items-center gap-1 px-1"
          style={{ transform: "translateY(-100%)" }}
        >
          {editingLabel ? (
            <input
              ref={inputRef}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleLabelBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") handleLabelBlur();
              }}
              className="text-[10px] font-medium bg-transparent outline-none text-notion-text nodrag px-0.5"
              style={{ minWidth: 40 }}
            />
          ) : (
            <span
              className="text-[10px] font-medium text-notion-text-secondary cursor-pointer"
              onDoubleClick={() => setEditingLabel(true)}
            >
              {label || "Frame"}
            </span>
          )}
          {selected && (
            <div className="relative">
              <button
                onClick={() => setShowColors(!showColors)}
                className="w-3 h-3 rounded-full border border-notion-border nodrag"
                style={{ backgroundColor: bgColor }}
              />
              {showColors && (
                <div className="absolute top-full left-0 mt-1 flex gap-1 p-1 bg-notion-bg border border-notion-border rounded shadow-md z-50 nodrag">
                  {FRAME_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleColorSelect(c)}
                      className="w-4 h-4 rounded-full border border-notion-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const PaperFrameNode = memo(PaperFrameNodeInner);

import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDisplayDate } from "../../../utils/dateKey";

type MemoNodeType = {
  date: string;
  contentPreview: string;
  memoId: string;
  tagDots?: Array<{ id: string; name: string; color: string }>;
  highlighted?: boolean;
  focused?: boolean;
  dimmed?: boolean;
  splitTag?: { id: string; name: string; color: string };
};

function MemoNodeInner({ data }: NodeProps & { data: MemoNodeType }) {
  const { i18n } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const tagDots = data.tagDots || [];

  return (
    <div
      className={`relative transition-opacity ${data.dimmed ? "opacity-10" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle
        type="source"
        position={Position.Top}
        id="center-source"
        className="!opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-0 !p-0"
        style={{ left: "50%", top: "5px" }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="center-target"
        className="!opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-0 !p-0"
        style={{ left: "50%", top: "5px" }}
      />
      {/* Dot */}
      <div className="relative flex flex-col items-center w-2.5 cursor-grab active:cursor-grabbing">
        <span
          className={`w-2.5 h-2.5 rounded-full bg-blue-400 dark:bg-blue-500 ${
            data.focused
              ? "ring-2 ring-blue-400/50"
              : data.highlighted
                ? "ring-2 ring-notion-accent/50"
                : ""
          }`}
        />
        {data.splitTag && (
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 mt-3 text-[8px] px-1 rounded-full text-white whitespace-nowrap pointer-events-none"
            style={{ backgroundColor: data.splitTag.color }}
          >
            {data.splitTag.name}
          </span>
        )}
      </div>

      {/* Hover popup */}
      {hovered && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 pointer-events-none z-50">
          <div className="px-3 py-2 rounded-lg border shadow-lg bg-blue-50 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 min-w-[160px] max-w-[220px]">
            <div className="flex items-center gap-1.5">
              <BookOpen
                size={12}
                className="shrink-0 text-blue-600 dark:text-blue-400"
              />
              <span className="text-xs font-medium truncate text-blue-900 dark:text-blue-200">
                {formatDisplayDate(data.date, i18n.language)}
              </span>
            </div>
            {data.contentPreview && (
              <p className="text-[9px] mt-1 text-blue-700/70 dark:text-blue-300/50 line-clamp-2 leading-tight">
                {data.contentPreview}
              </p>
            )}
            {tagDots.length > 0 && (
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {tagDots.slice(0, 5).map((dot) => (
                  <span
                    key={dot.id}
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: dot.color }}
                  />
                ))}
                {tagDots.length > 5 && (
                  <span className="text-[8px] text-blue-700/50 dark:text-blue-300/40">
                    +{tagDots.length - 5}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const MemoNodeComponent = memo(MemoNodeInner);

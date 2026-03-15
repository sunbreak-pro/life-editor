import { useState, useCallback } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { renderIcon } from "../utils/iconRenderer";
import { IconPicker } from "../components/common/IconPicker";
import { CALLOUT_COLORS } from "./Callout";

export function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconBtnRect, setIconBtnRect] = useState<DOMRect | null>(null);

  const iconName = node.attrs.iconName || "Lightbulb";
  const emoji = node.attrs.emoji;
  const color = (node.attrs.color as string) || "default";
  const colorConfig = CALLOUT_COLORS[color] || CALLOUT_COLORS.default;

  const handleIconClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIconBtnRect(e.currentTarget.getBoundingClientRect());
      setShowIconPicker(true);
    },
    [],
  );

  const handleIconSelect = useCallback(
    (name: string) => {
      updateAttributes({ iconName: name, emoji: null });
    },
    [updateAttributes],
  );

  const handleColorChange = useCallback(
    (newColor: string) => {
      updateAttributes({ color: newColor });
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper
      className={`callout callout-color-${color}`}
      style={
        {
          "--callout-bg": colorConfig.bg,
          "--callout-border": colorConfig.border,
        } as React.CSSProperties
      }
    >
      <button
        className="callout-icon-btn"
        contentEditable={false}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={handleIconClick}
        tabIndex={-1}
        type="button"
      >
        {emoji ? (
          <span className="callout-emoji">{emoji}</span>
        ) : (
          (renderIcon(iconName, { size: 18 }) ?? (
            <span className="callout-emoji">{"\u{1F4A1}"}</span>
          ))
        )}
      </button>
      <div className="callout-body" contentEditable={false}>
        <div className="callout-color-bar">
          {Object.entries(CALLOUT_COLORS).map(([key, cfg]) => (
            <button
              key={key}
              className={`callout-color-dot${color === key ? " active" : ""}`}
              style={{ backgroundColor: cfg.border }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleColorChange(key);
              }}
              type="button"
              title={cfg.label}
            />
          ))}
        </div>
      </div>
      <NodeViewContent className="callout-content" />
      {showIconPicker && (
        <IconPicker
          value={iconName}
          onSelect={handleIconSelect}
          onClose={() => setShowIconPicker(false)}
          anchorRect={iconBtnRect}
        />
      )}
    </NodeViewWrapper>
  );
}

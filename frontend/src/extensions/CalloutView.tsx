import { useState, useCallback, useRef, useEffect } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { renderIcon } from "../utils/iconRenderer";
import { IconPicker } from "../components/common/IconPicker";
import { CALLOUT_COLORS } from "./Callout";

export function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconBtnRect, setIconBtnRect] = useState<DOMRect | null>(null);
  const iconWrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const iconName = node.attrs.iconName || "Lightbulb";
  const emoji = node.attrs.emoji;
  const color = (node.attrs.color as string) || "default";
  const showIcon = node.attrs.showIcon !== false;
  const colorConfig = CALLOUT_COLORS[color] || CALLOUT_COLORS.default;

  // Vertically center icon relative to first line of content
  useEffect(() => {
    if (!showIcon || !iconWrapperRef.current || !contentRef.current) return;

    const updateIconHeight = () => {
      const contentEl = contentRef.current;
      if (!contentEl) return;
      const firstChild = contentEl.querySelector(".callout-content")
        ?.firstElementChild as HTMLElement | null;
      if (!firstChild) return;
      const styles = getComputedStyle(firstChild);
      const lineHeight = parseFloat(styles.lineHeight);
      const height = isNaN(lineHeight)
        ? parseFloat(styles.fontSize) * 1.7
        : lineHeight;
      if (iconWrapperRef.current) {
        iconWrapperRef.current.style.height = `${height}px`;
      }
    };

    updateIconHeight();
    const observer = new MutationObserver(updateIconHeight);
    const contentEl = contentRef.current.querySelector(".callout-content");
    if (contentEl) {
      observer.observe(contentEl, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style"],
      });
    }
    return () => observer.disconnect();
  }, [showIcon]);

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

  const handleIconRemove = useCallback(() => {
    updateAttributes({ showIcon: false, iconName: null, emoji: null });
  }, [updateAttributes]);

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
      {showIcon && (
        <div
          className="callout-icon-wrapper"
          ref={iconWrapperRef}
          contentEditable={false}
        >
          <button
            className="callout-icon-btn"
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
        </div>
      )}
      <div ref={contentRef} style={{ flex: 1, minWidth: 0 }}>
        <NodeViewContent className="callout-content" />
      </div>
      {showIconPicker && (
        <IconPicker
          value={iconName}
          onSelect={handleIconSelect}
          onClose={() => setShowIconPicker(false)}
          anchorRect={iconBtnRect}
          onRemove={handleIconRemove}
        />
      )}
    </NodeViewWrapper>
  );
}

import { useRef, useCallback, Fragment } from "react";
import type { TerminalLayoutNode, SplitNode } from "../../types/terminalLayout";
import { TerminalPane } from "./TerminalPane";
import { SplitDivider } from "./SplitDivider";

interface SplitLayoutProps {
  node: TerminalLayoutNode;
  activePaneId: string;
  onPaneFocus: (paneId: string) => void;
  onSizesChange: (splitId: string, sizes: number[]) => void;
}

export function SplitLayout({
  node,
  activePaneId,
  onPaneFocus,
  onSizesChange,
}: SplitLayoutProps) {
  if (node.type === "leaf") {
    const isActive = node.id === activePaneId;
    return (
      <div
        className={`h-full w-full relative ${isActive ? "ring-1 ring-notion-accent/50 ring-inset" : ""}`}
        onClick={() => onPaneFocus(node.id)}
      >
        <TerminalPane
          sessionId={node.sessionId}
          onFocus={() => onPaneFocus(node.id)}
          isActive={isActive}
        />
      </div>
    );
  }

  return (
    <SplitContainer
      node={node}
      activePaneId={activePaneId}
      onPaneFocus={onPaneFocus}
      onSizesChange={onSizesChange}
    />
  );
}

interface SplitContainerProps {
  node: SplitNode;
  activePaneId: string;
  onPaneFocus: (paneId: string) => void;
  onSizesChange: (splitId: string, sizes: number[]) => void;
}

function SplitContainer({
  node,
  activePaneId,
  onPaneFocus,
  onSizesChange,
}: SplitContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleSizesChange = useCallback(
    (newSizes: number[]) => {
      onSizesChange(node.id, newSizes);
    },
    [node.id, onSizesChange],
  );

  const isHorizontal = node.direction === "horizontal";

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full ${isHorizontal ? "flex-row" : "flex-col"}`}
    >
      {node.children.map((child, i) => (
        <Fragment key={child.id}>
          {i > 0 && (
            <SplitDivider
              direction={node.direction}
              onSizesChange={handleSizesChange}
              index={i - 1}
              parentRef={containerRef}
              sizes={node.sizes}
            />
          )}
          <div
            className="min-h-0 min-w-0"
            style={{ flex: `0 0 ${node.sizes[i]}%` }}
          >
            <SplitLayout
              node={child}
              activePaneId={activePaneId}
              onPaneFocus={onPaneFocus}
              onSizesChange={onSizesChange}
            />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

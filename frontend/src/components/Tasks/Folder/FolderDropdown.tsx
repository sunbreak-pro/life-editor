import { useState, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";
import { flattenFolders } from "../../../utils/flattenFolders";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { FolderList } from "./FolderList";

interface FolderDropdownProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  trigger: ReactNode;
  rootLabel: string;
  panelMinWidth?: string;
  panelAlign?: string;
  maxHeightClass?: string;
  fontSizeClass?: string;
  indentPx?: (depth: number) => number;
  depthIndicator?: (depth: number) => ReactNode;
  showColor?: boolean;
}

export function FolderDropdown({
  selectedId,
  onSelect,
  trigger,
  rootLabel,
  panelMinWidth = "min-w-40",
  panelAlign = "left-0",
  maxHeightClass,
  fontSizeClass,
  indentPx,
  depthIndicator,
  showColor,
}: FolderDropdownProps) {
  const { nodes } = useTaskTreeContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const folders = flattenFolders(nodes);

  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useClickOutside(dropdownRef, closeDropdown, isOpen);

  const handleSelect = (id: string | null) => {
    onSelect(id);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`absolute ${panelAlign} top-full mt-1 z-30 bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1 ${panelMinWidth}`}
        >
          <FolderList
            folders={folders}
            selectedId={selectedId}
            onSelect={handleSelect}
            rootLabel={rootLabel}
            maxHeightClass={maxHeightClass}
            fontSizeClass={fontSizeClass}
            indentPx={indentPx}
            depthIndicator={depthIndicator}
            showColor={showColor}
          />
        </div>
      )}
    </div>
  );
}

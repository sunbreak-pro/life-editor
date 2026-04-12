import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Trash2, Copy } from "lucide-react";

interface RowContextMenuProps {
  x: number;
  y: number;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function RowContextMenu({
  x,
  y,
  onDuplicate,
  onDelete,
  onClose,
}: RowContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Adjust position to stay within viewport
  let top = y;
  let left = x;
  const menuW = 160;
  const menuH = 80;
  if (left + menuW > window.innerWidth - 8)
    left = window.innerWidth - menuW - 8;
  if (left < 8) left = 8;
  if (top + menuH > window.innerHeight - 8) top = y - menuH;
  if (top < 8) top = 8;

  return createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 99 }}
        onClick={onClose}
      />
      <div
        ref={menuRef}
        style={{ position: "fixed", top, left, zIndex: 100 }}
        className="min-w-[140px] bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1"
      >
        <button
          onClick={() => {
            onDuplicate();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-notion-text hover:bg-notion-hover text-left"
        >
          <Copy size={12} className="text-notion-text-secondary" />
          Duplicate
        </button>
        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-notion-hover text-left"
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </>,
    document.body,
  );
}

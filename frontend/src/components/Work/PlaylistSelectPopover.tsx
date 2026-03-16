import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Playlist } from "../../types/playlist";

interface PlaylistSelectPopoverProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onSelect: (id: string | null) => void;
  playlists: Playlist[];
  currentPlaylistId: string | null;
}

export function PlaylistSelectPopover({
  anchorRef,
  onClose,
  onSelect,
  playlists,
  currentPlaylistId,
}: PlaylistSelectPopoverProps) {
  const { t } = useTranslation();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose, anchorRef]);

  const anchor = anchorRef.current;
  if (!anchor) return null;

  const rect = anchor.getBoundingClientRect();
  const popupWidth = 220;
  const style: React.CSSProperties = {
    position: "fixed",
    top: rect.top,
    left: rect.left - popupWidth - 8,
    width: popupWidth,
    zIndex: 9999,
  };

  return createPortal(
    <div
      ref={popoverRef}
      style={style}
      className="bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto"
    >
      <button
        onClick={() => {
          onSelect(null);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-scaling-sm text-notion-text-secondary hover:bg-notion-hover transition-colors text-left"
      >
        <span className="w-4 flex-shrink-0">
          {currentPlaylistId === null && (
            <Check size={14} className="text-notion-accent" />
          )}
        </span>
        <span className="truncate italic">
          {t("work.sidebar.selectNone", "None")}
        </span>
      </button>
      {playlists.map((pl) => (
        <button
          key={pl.id}
          onClick={() => {
            onSelect(pl.id);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-scaling-sm text-notion-text hover:bg-notion-hover transition-colors text-left"
        >
          <span className="w-4 flex-shrink-0">
            {currentPlaylistId === pl.id && (
              <Check size={14} className="text-notion-accent" />
            )}
          </span>
          <span className="truncate">{pl.name}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

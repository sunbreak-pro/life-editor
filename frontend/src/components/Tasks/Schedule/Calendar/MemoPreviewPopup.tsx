import { useRef } from "react";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { getContentPreview } from "../../../../utils/tiptapText";

interface MemoPreviewPopupProps {
  kind: "daily" | "note";
  title: string;
  content: string;
  position: { x: number; y: number };
  onOpenDetail: () => void;
  onClose: () => void;
}

const ACCENT: Record<
  "daily" | "note",
  { bar: string; badge: string; badgeText: string }
> = {
  daily: {
    bar: "#F59E0B",
    badge: "bg-amber-100 text-amber-700",
    badgeText: "Daily",
  },
  note: {
    bar: "#3B82F6",
    badge: "bg-blue-100 text-blue-700",
    badgeText: "Note",
  },
};

export function MemoPreviewPopup({
  kind,
  title,
  content,
  position,
  onOpenDetail,
  onClose,
}: MemoPreviewPopupProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, onClose, true);

  const left = Math.min(position.x, window.innerWidth - 260 - 16);
  const top = Math.min(position.y, window.innerHeight - 200 - 16);
  const accent = ACCENT[kind];
  const preview = getContentPreview(content);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-65 bg-notion-bg border border-notion-border rounded-lg shadow-xl"
      style={{ left, top }}
    >
      <div className="p-3 space-y-2">
        <div
          className="w-full h-1 rounded-full"
          style={{ backgroundColor: accent.bar }}
        />
        <div className="font-medium text-sm text-notion-text truncate">
          {title}
        </div>
        <p className="text-xs text-notion-text-secondary line-clamp-3">
          {preview || t("calendar.memoPreviewEmpty")}
        </p>
        <span
          className={`inline-block px-1.5 py-0.5 text-[10px] rounded-full font-medium ${accent.badge}`}
        >
          {accent.badgeText}
        </span>
      </div>
      <div className="border-t border-notion-border">
        <button
          onClick={onOpenDetail}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text transition-colors"
        >
          <ExternalLink size={12} />
          {t("calendar.openDetail")}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Lock, Unlock, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useClickOutside } from "../../hooks/useClickOutside";

interface ItemOptionsMenuProps {
  hasPassword: boolean;
  onSetPassword: () => void;
  onChangePassword: () => void;
  onRemovePassword: () => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function ItemOptionsMenu({
  hasPassword,
  onSetPassword,
  onChangePassword,
  onRemovePassword,
  onClose,
  anchorRef,
}: ItemOptionsMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, onClose);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const rect = anchorRef.current?.getBoundingClientRect();
  if (!rect) return null;

  const top = rect.bottom + 4;
  const left = Math.min(rect.left, window.innerWidth - 220);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[60] min-w-[200px] bg-notion-bg border border-notion-border rounded-lg shadow-xl py-1"
      style={{ top, left }}
    >
      {!hasPassword ? (
        <MenuButton
          icon={<Lock size={14} />}
          label={t("screenLock.setPassword")}
          onClick={() => {
            onSetPassword();
            onClose();
          }}
        />
      ) : (
        <>
          <MenuButton
            icon={<KeyRound size={14} />}
            label={t("screenLock.changePassword")}
            onClick={() => {
              onChangePassword();
              onClose();
            }}
          />
          <MenuButton
            icon={<Unlock size={14} />}
            label={t("screenLock.removePassword")}
            danger
            onClick={() => {
              onRemovePassword();
              onClose();
            }}
          />
        </>
      )}
    </div>,
    document.body,
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          : "text-notion-text hover:bg-notion-hover"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

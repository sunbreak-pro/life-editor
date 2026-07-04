import type { ReactNode } from "react";

interface IconButtonProps {
  children: ReactNode;
  onClick?: () => void;
  title: string;
  active?: boolean;
  /** optional data-marker attribute (used for outside-click exclusion) */
  marker?: string;
}

export function IconButton({
  children,
  onClick,
  title,
  active,
  marker,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      data-marker={marker}
      className={
        "w-8 h-8 rounded-md flex items-center justify-center border border-lumen-border transition-colors " +
        (active
          ? "bg-lumen-hover text-lumen-text"
          : "bg-lumen-bg text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text")
      }
    >
      {children}
    </button>
  );
}

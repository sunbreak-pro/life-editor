import type { ReactNode } from "react";

interface IconButtonProps {
  children: ReactNode;
  onClick?: () => void;
  title: string;
  active?: boolean;
}

export function IconButton({
  children,
  onClick,
  title,
  active,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={
        "w-8 h-8 rounded-md flex items-center justify-center border border-notion-border transition-colors " +
        (active
          ? "bg-notion-hover text-notion-text"
          : "bg-notion-bg text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text")
      }
    >
      {children}
    </button>
  );
}

import { forwardRef } from "react";

const variantClasses = {
  ghost:
    "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover",
  danger: "text-notion-text-secondary hover:text-red-500 hover:bg-red-500/5",
} as const;

const sizeClasses = {
  sm: "p-0.5",
  md: "p-1",
} as const;

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  icon: React.ReactNode;
  label?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { variant = "ghost", size = "md", icon, label, className = "", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        aria-label={label}
        className={`inline-flex items-center justify-center rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...rest}
      >
        {icon}
      </button>
    );
  },
);

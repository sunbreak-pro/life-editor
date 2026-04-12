import { forwardRef } from "react";

const variantClasses = {
  primary: "bg-notion-accent text-white hover:opacity-90",
  secondary:
    "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text",
  danger: "text-red-500 hover:bg-red-500/5",
  info: "text-blue-500 hover:bg-blue-500/5",
} as const;

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1.5 text-sm",
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      icon,
      children,
      className = "",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-1.5 font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...rest}
      >
        {icon}
        {children}
      </button>
    );
  },
);

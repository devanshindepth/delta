import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "tab" | "tab-active";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none focus-visible:outline-1 focus-visible:outline-[var(--ink)] focus-visible:outline-offset-2";

  const variants: Record<string, string> = {
    primary:
      "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--ink-deep)] active:bg-[var(--ink-deep)] rounded-[4px]",
    secondary:
      "bg-[var(--canvas)] text-[var(--ink)] border border-[var(--hairline-strong)] hover:border-[var(--ink)] rounded-[4px]",
    ghost:
      "bg-transparent text-[var(--mute)] hover:text-[var(--ink)] rounded-[4px]",
    tab:
      "bg-transparent text-[var(--mute)] hover:text-[var(--ink)] rounded-none border-b-2 border-transparent",
    "tab-active":
      "bg-transparent text-[var(--ink)] font-medium rounded-none border-b-2 border-[var(--ash)]",
  };

  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-[14px] gap-1.5",
    md: "h-9 px-5 text-[16px] gap-2 leading-[2]",
    lg: "h-[36px] px-5 text-[16px] gap-2 leading-[2]",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

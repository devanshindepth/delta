import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "dark" | "mute" | "success" | "danger" | "warning";
}

export function Badge({ className = "", variant = "default", children, ...props }: BadgeProps) {
  const variants: Record<string, string> = {
    default:
      "bg-[var(--surface-card)] text-[var(--ink)] border border-[var(--hairline)]",
    dark:
      "bg-[var(--surface-dark)] text-[var(--on-dark)]",
    mute:
      "bg-transparent text-[var(--mute)] border border-[var(--hairline)]",
    success:
      "bg-transparent text-[#30d158] border border-[#30d158]",
    danger:
      "bg-transparent text-[#ff3b30] border border-[#ff3b30]",
    warning:
      "bg-transparent text-[#ff9f0a] border border-[#ff9f0a]",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[14px] leading-[2] rounded-[4px] font-medium ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

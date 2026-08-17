import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  dark?: boolean;
}

export function Card({ className = "", dark = false, children, ...props }: CardProps) {
  if (dark) {
    return (
      <div
        className={`bg-[var(--surface-dark)] text-[var(--on-dark)] p-6 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={`bg-[var(--canvas)] border border-[var(--hairline)] p-5 text-[var(--body)] ${className}`}
      style={{ borderRadius: "var(--radius-none)" }}
      {...props}
    >
      {children}
    </div>
  );
}

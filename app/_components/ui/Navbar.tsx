"use client";

import Link from "next/link";

export function Navbar() {
  return (
    <header
      className="flex items-center justify-between px-8"
      style={{
        height: "56px",
        borderBottom: "1px solid var(--hairline)",
        background: "var(--canvas)",
      }}
    >
      <Link
        href="/"
        className="text-[16px] font-bold tracking-widest"
        style={{ color: "var(--ink)" }}
      >
        DELTA
      </Link>
    </header>
  );
}

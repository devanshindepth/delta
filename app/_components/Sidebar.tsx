"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "learn", prefix: "[~]" },
  { href: "/understand", label: "understand", prefix: "[?]" },
  { href: "/practice", label: "practice", prefix: "[>]" },
  { href: "/history", label: "history", prefix: "[#]" },
];

const settingsLinks = [
  { href: "/settings", label: "settings", prefix: "[-]" },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-full flex-col" style={{ borderRight: "1px solid var(--hairline)" }}>
      {/* Wordmark */}
      <div
        className="px-6 flex items-center"
        style={{
          height: "56px",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <span
          className="font-bold text-[16px] tracking-widest"
          style={{ color: "var(--ink)" }}
        >
          DELTA
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {links.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 px-2 py-[8px] text-[16px] leading-[1.5] transition-colors"
              style={{
                color: active ? "var(--ink)" : "var(--mute)",
                fontWeight: active ? "500" : "400",
              }}
            >
              <span style={{ color: "var(--ash)", fontWeight: "400" }}>{link.prefix}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div
        className="px-4 pb-6 space-y-1"
        style={{ borderTop: "1px solid var(--hairline)", paddingTop: "16px" }}
      >
        {settingsLinks.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 px-2 py-[8px] text-[16px] leading-[1.5] transition-colors"
              style={{
                color: active ? "var(--ink)" : "var(--mute)",
                fontWeight: active ? "500" : "400",
              }}
            >
              <span style={{ color: "var(--ash)", fontWeight: "400" }}>{link.prefix}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

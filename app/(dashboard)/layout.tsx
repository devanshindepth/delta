'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from "@/app/_components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWorkspace = /^\/practice\/.+/.test(pathname);
  const isHome = pathname === '/';

  if (isWorkspace) {
    // Full-screen workspace — no chrome at all
    return <>{children}</>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--canvas)' }}>
      {/* Sidebar */}
      {!isHome && (
        <aside
          style={{
            width: '220px',
            flexShrink: 0,
            height: '100vh',
            position: 'sticky',
            top: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
          className="hidden lg:flex"
        >
          <Suspense fallback={<div style={{ width: '220px', height: '100vh', background: 'var(--canvas)' }} />}>
            <Sidebar />
          </Suspense>
        </aside>
      )}

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', alignItems: 'center' }}>
        <Suspense fallback={<div className="animate-pulse" style={{ height: '100vh', width: '100%', background: 'var(--canvas)' }} />}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}

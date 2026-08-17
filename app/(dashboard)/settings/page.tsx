'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/app/_components/ui/Button';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between py-[12px]"
      style={{ borderBottom: "1px solid var(--hairline)" }}
    >
      <span className="text-[16px]" style={{ color: "var(--body)" }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen max-w-[720px] mx-auto px-8 py-[96px]">
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--hairline)", paddingBottom: "32px", marginBottom: "48px" }}>
        <p className="text-[14px] leading-[2] mb-3" style={{ color: "var(--mute)" }}>
          [-] settings
        </p>
        <h1 className="text-[38px] font-bold leading-[1.5]" style={{ color: "var(--ink)" }}>
          Settings
        </h1>
      </div>

      {/* Profile section */}
      <div className="mb-12">
        <p className="text-[14px] font-bold mb-4" style={{ color: "var(--ink)" }}>[+] profile</p>
        <div className="space-y-0">
          <Row label="name">
            <span className="text-[16px]" style={{ color: "var(--stone)" }}>Delta User</span>
          </Row>
          <Row label="email">
            <span className="text-[16px]" style={{ color: "var(--stone)" }}>user@example.com</span>
          </Row>
        </div>
      </div>

      {/* Account section */}
      <div className="mb-12">
        <p className="text-[14px] font-bold mb-4" style={{ color: "var(--ink)" }}>[+] account</p>
        <div className="space-y-0">
          <Row label="sign out of your session">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/sign-in')}
            >
              sign out
            </Button>
          </Row>
        </div>
      </div>

      {/* Danger zone */}
      <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: "32px" }}>
        <p className="text-[14px] font-bold mb-4" style={{ color: "var(--danger)" }}>[-] danger zone</p>
        <div className="space-y-0">
          <Row label="permanently delete account and all data">
            <Button
              variant="ghost"
              size="sm"
              disabled
              style={{ color: "var(--danger)", opacity: 0.5 }}
            >
              delete account
            </Button>
          </Row>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCert = searchParams.get('cert');
  const [certs, setCerts] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/certifications')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setCerts(data.data);
        }
      })
      .catch(() => {});
  }, [pathname, currentCert]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--canvas)',
        borderRight: '1px solid var(--hairline)',
      }}
    >
      {/* Logo -> Home */}
      <Link
        href="/"
        style={{
          height: '60px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          borderBottom: '1px solid var(--hairline)',
          flexShrink: 0,
          textDecoration: 'none',
        }}
      >
        <Image
          src="/delta-logo.svg"
          alt="Delta"
          width={22}
          height={22}
        />
      </Link>

      {/* Generate New Action */}
      <div style={{ padding: '16px 16px 8px 16px' }}>
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: 'var(--surface-soft)',
            border: '1px solid var(--hairline)',
            borderRadius: '4px',
            textDecoration: 'none',
            color: 'var(--ink)',
            fontWeight: 500,
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>[+]</span>
          <span>generate new</span>
        </Link>
      </div>

      {/* Generated Certificates List in Sidebar */}
      <div
        style={{
          flex: 1,
          padding: '12px 16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <p
          style={{
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--ash)',
            margin: '8px 0 6px 0',
            fontWeight: 700,
          }}
        >
          [#] generated
        </p>

        {certs.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--mute)', margin: '4px 0' }}>
            [-] no certs yet
          </p>
        ) : (
          certs.map((cert) => {
            const isActive = currentCert === cert.id;
            return (
              <Link
                key={cert.id}
                href={`/prep?cert=${encodeURIComponent(cert.id)}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  background: isActive ? 'var(--surface-card)' : 'transparent',
                  border: isActive ? '1px solid var(--hairline-strong)' : '1px solid transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      color: isActive ? 'var(--ink)' : 'var(--ash)',
                      fontWeight: 700,
                    }}
                  >
                    {cert.code}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    color: isActive ? 'var(--ink)' : 'var(--mute)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.4,
                    marginTop: '2px',
                  }}
                  title={cert.title}
                >
                  {cert.title}
                </span>
              </Link>
            );
          })
        )}
      </div>

      {/* Bottom Settings */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid var(--hairline)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Link
          href="/settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: 'var(--mute)',
            fontSize: '14px',
          }}
        >
          <span style={{ color: 'var(--ash)' }}>[-]</span>
          <span>settings</span>
        </Link>
      </div>
    </div>
  );
}

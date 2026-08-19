'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CertificationsPage() {
  const router = useRouter();
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, any>>({});

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/certifications');
        const data = await res.json();
        if (data.success) {
          setCerts(data.data);
          for (const cert of data.data) {
            fetch(`/api/certifications/${cert.id}/stats`)
              .then((r) => r.json())
              .then((s) => {
                if (s.success) {
                  setStats((prev) => ({ ...prev, [cert.id]: s.data }));
                }
              })
              .catch(() => {});
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div
      style={{
        maxWidth: '720px',
        width: '100%',
        margin: '0 auto',
        padding: '96px 32px',
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: '1px solid var(--hairline)',
          paddingBottom: '32px',
          marginBottom: '48px',
        }}
      >
        <p
          style={{
            fontSize: '14px',
            color: 'var(--mute)',
            marginBottom: '12px',
            lineHeight: 2,
          }}
        >
          [*] certifications
        </p>
        <h1
          style={{
            fontSize: '38px',
            fontWeight: 700,
            color: 'var(--ink)',
            margin: '0 0 12px 0',
            lineHeight: 1.5,
          }}
        >
          certification catalog
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--body)', margin: 0, lineHeight: 1.5 }}>
          choose a certification to view its knowledge graph, objectives, and your
          current readiness score.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{ height: '64px', background: 'var(--surface-card)' }}
            />
          ))}
        </div>
      ) : certs.length === 0 ? (
        <p style={{ fontSize: '16px', color: 'var(--mute)' }}>
          [-] no certifications in the catalog
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {certs.map((cert) => {
            const s = stats[cert.id];
            const readiness = s?.readinessScore ?? 0;
            const hasProgress = s && s.attemptedCount > 0;
            const totalObjectives = s?.totalObjectives ?? 0;
            const masteredCount = s?.masteredCount ?? 0;

            return (
              <div
                key={cert.id}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: 'var(--ash)' }}>
                      {cert.icon_prefix}
                    </span>
                    <span
                      style={{
                        fontSize: '16px',
                        fontWeight: 500,
                        color: 'var(--ink)',
                      }}
                    >
                      {cert.code}: {cert.title}
                    </span>
                    {hasProgress && (
                      <span
                        style={{
                          fontSize: '13px',
                          padding: '2px 8px',
                          border: `1px solid ${readiness >= 80 ? 'var(--success)' : readiness >= 40 ? 'var(--warning)' : 'var(--hairline)'}`,
                          color:
                            readiness >= 80
                              ? 'var(--success)'
                              : readiness >= 40
                              ? 'var(--warning)'
                              : 'var(--mute)',
                          borderRadius: '4px',
                        }}
                      >
                        {readiness}% ready
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      color: 'var(--stone)',
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{cert.provider}</span>
                    <span style={{ color: 'var(--hairline-strong)' }}>·</span>
                    <span>{cert.level}</span>
                    {totalObjectives > 0 && (
                      <>
                        <span style={{ color: 'var(--hairline-strong)' }}>·</span>
                        <span>
                          {masteredCount}/{totalObjectives} mastered
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <Link
                    href={`/certifications/${cert.id}`}
                    style={{
                      padding: '4px 12px',
                      height: '32px',
                      background: 'var(--canvas)',
                      color: 'var(--ink)',
                      border: '1px solid var(--hairline-strong)',
                      borderRadius: '4px',
                      fontSize: '16px',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      lineHeight: 2,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    view →
                  </Link>
                  <button
                    onClick={() => router.push(`/loop?cert=${cert.id}`)}
                    style={{
                      padding: '4px 20px',
                      height: '36px',
                      background: 'var(--ink)',
                      color: 'var(--canvas)',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '16px',
                      fontWeight: 500,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      lineHeight: 2,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--ink-deep)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'var(--ink)')
                    }
                  >
                    {hasProgress ? 'continue →' : 'start prep →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

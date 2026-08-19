'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export default function CertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const certId = params.id as string;

  const [cert, setCert] = useState<any>(null);
  const [graph, setGraph] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [certRes, graphRes, statsRes, progressRes] = await Promise.all([
          fetch(`/api/certifications/${certId}`),
          fetch(`/api/certifications/${certId}/graph`),
          fetch(`/api/certifications/${certId}/stats`),
          fetch(`/api/certifications/${certId}/progress`),
        ]);
        const certData = await certRes.json();
        const graphData = await graphRes.json();
        const statsData = await statsRes.json();
        const progressData = await progressRes.json();

        if (certData.success) setCert(certData.data);
        if (graphData.success) {
          setGraph(graphData.data);
          // Auto-expand the first domain
          if (graphData.data.length > 0) setExpandedDomain(graphData.data[0].id);
        }
        if (statsData.success) setStats(statsData.data);
        if (progressData.success) setProgress(progressData.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [certId]);

  const progressMap: Record<string, any> = {};
  for (const p of progress) {
    progressMap[p.objective_id] = p;
  }

  const readiness = stats?.readinessScore ?? 0;

  function statusColor(status: string | undefined) {
    if (status === 'mastered') return 'var(--success)';
    if (status === 'in_progress') return 'var(--warning)';
    if (status === 'needs_review') return 'var(--danger)';
    return 'var(--ash)';
  }

  function statusLabel(status: string | undefined) {
    if (status === 'mastered') return '[+]';
    if (status === 'in_progress') return '[~]';
    if (status === 'needs_review') return '[-]';
    return '[ ]';
  }

  function freshnessColor(status: string) {
    if (status === 'confirmed_outdated') return 'var(--danger)';
    if (status === 'potentially_outdated' || status === 'needs_verification') return 'var(--warning)';
    return 'var(--success)';
  }

  const totalObjectives = graph.reduce((sum, d) => sum + (d.objectives?.length || 0), 0);

  if (loading) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '96px 32px' }}>
        <div className="animate-pulse" style={{ height: '300px', background: 'var(--surface-card)' }} />
      </div>
    );
  }

  if (!cert) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '96px 32px' }}>
        <p style={{ color: 'var(--danger)' }}>[-] certification not found</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '720px', width: '100%', margin: '0 auto', padding: '96px 32px' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '32px', marginBottom: '48px' }}>
        <p style={{ fontSize: '14px', color: 'var(--mute)', marginBottom: '12px', lineHeight: 2 }}>
          <Link href="/certifications" style={{ color: 'var(--mute)', textDecoration: 'none' }}>
            [*] certifications
          </Link>
          {' → '}
          {cert.code}
        </p>
        <h1 style={{ fontSize: '38px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
          {cert.code}: {cert.title}
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--body)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
          {cert.description}
        </p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', color: 'var(--stone)' }}>{cert.provider} · {cert.level}</span>
          {stats && (
            <>
              <span style={{ color: 'var(--hairline-strong)' }}>·</span>
              <span style={{ fontSize: '13px', padding: '2px 8px', border: `1px solid ${readiness >= 80 ? 'var(--success)' : readiness >= 40 ? 'var(--warning)' : 'var(--hairline)'}`, color: readiness >= 80 ? 'var(--success)' : readiness >= 40 ? 'var(--warning)' : 'var(--mute)', borderRadius: '4px' }}>
                {readiness}% ready
              </span>
              {totalObjectives > 0 && (
                <>
                  <span style={{ color: 'var(--hairline-strong)' }}>·</span>
                  <span style={{ fontSize: '14px', color: 'var(--stone)' }}>
                    {stats.masteredCount}/{totalObjectives} objectives mastered
                  </span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stats row */}
      {stats && totalObjectives > 0 && (
        <div style={{ display: 'flex', gap: '0', marginBottom: '48px', border: '1px solid var(--hairline)' }}>
          {[
            { label: 'readiness', value: `${readiness}%`, color: readiness >= 80 ? 'var(--success)' : readiness >= 40 ? 'var(--warning)' : 'var(--ink)' },
            { label: 'objectives', value: `${totalObjectives}`, color: 'var(--ink)' },
            { label: 'mastered', value: `${stats.masteredCount}`, color: 'var(--success)' },
            { label: 'questions', value: `${stats.totalQuestions}`, color: 'var(--ink)' },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: '16px', borderRight: i < 3 ? '1px solid var(--hairline)' : 'none', textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 700, color: s.color, margin: '0 0 4px 0', lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: '13px', color: 'var(--mute)', margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* CTAs */}
      <div style={{ marginBottom: '48px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => router.push(`/loop?cert=${certId}`)}
          style={{ padding: '4px 20px', height: '36px', background: 'var(--ink)', color: 'var(--canvas)', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', lineHeight: 2 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-deep)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ink)')}
        >
          {stats?.attemptedCount > 0 ? 'continue prep →' : 'start prep →'}
        </button>
        <button
          onClick={() => router.push(`/practice?cert=${certId}`)}
          style={{ padding: '4px 12px', height: '32px', background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--hairline-strong)', borderRadius: '4px', fontSize: '16px', fontFamily: 'inherit', cursor: 'pointer', lineHeight: 2 }}
        >
          practice only →
        </button>
        <a href={cert.official_url} target="_blank" rel="noopener noreferrer"
          style={{ padding: '4px 12px', height: '32px', background: 'var(--canvas)', color: 'var(--mute)', border: '1px solid var(--hairline)', borderRadius: '4px', fontSize: '16px', fontFamily: 'inherit', cursor: 'pointer', lineHeight: 2, textDecoration: 'none', display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
          official page →
        </a>
      </div>

      {/* Knowledge graph */}
      <div>
        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginBottom: '24px' }}>
          [#] knowledge graph
        </p>

        {graph.length === 0 ? (
          <p style={{ color: 'var(--mute)', fontSize: '16px' }}>
            [-] knowledge graph not available for this certification yet
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {graph.map((domain: any) => {
              const domainMastered = (domain.objectives || []).filter((o: any) => progressMap[o.id]?.status === 'mastered').length;
              const domainTotal = domain.objectives?.length || 0;
              const isExpanded = expandedDomain === domain.id;

              return (
                <div key={domain.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                  {/* Domain header — clickable to expand/collapse */}
                  <button
                    onClick={() => setExpandedDomain(isExpanded ? null : domain.id)}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
                      <span style={{ fontSize: '13px', color: 'var(--ash)', minWidth: '24px' }}>{isExpanded ? '[-]' : '[+]'}</span>
                      <div>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', display: 'block', lineHeight: 1.5 }}>
                          {domain.domain_code}: {domain.title}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--stone)' }}>
                          {domain.weight_percentage_min}–{domain.weight_percentage_max}% of exam · {domainTotal} objectives
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      {domainMastered > 0 && (
                        <span style={{ fontSize: '13px', color: domainMastered === domainTotal ? 'var(--success)' : 'var(--warning)' }}>
                          {domainMastered}/{domainTotal}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Objectives list — collapsible */}
                  {isExpanded && (
                    <div style={{ paddingBottom: '8px' }}>
                      {(domain.objectives || []).map((obj: any) => {
                        const p = progressMap[obj.id];
                        return (
                          <div key={obj.id} style={{ padding: '12px 0 12px 36px', borderTop: '1px solid var(--hairline)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <span style={{ fontSize: '13px', color: statusColor(p?.status), flexShrink: 0, marginTop: '2px', minWidth: '24px' }}>
                              {statusLabel(p?.status)}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)' }}>
                                  {obj.objective_code}. {obj.title}
                                </span>
                                {obj.importance === 'critical' && (
                                  <span style={{ fontSize: '12px', padding: '1px 6px', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '4px' }}>critical</span>
                                )}
                                {obj.freshness_status !== 'current' && (
                                  <span style={{ fontSize: '12px', padding: '1px 6px', border: `1px solid ${freshnessColor(obj.freshness_status)}`, color: freshnessColor(obj.freshness_status), borderRadius: '4px' }}>
                                    {obj.freshness_status.replace('_', ' ')}
                                  </span>
                                )}
                              </div>
                              <p style={{ fontSize: '13px', color: 'var(--stone)', margin: 0, lineHeight: 1.5 }}>
                                {obj.description}
                              </p>
                              {p && (
                                <div style={{ fontSize: '12px', color: 'var(--stone)', marginTop: '4px' }}>
                                  {p.attempts} attempt{p.attempts !== 1 ? 's' : ''} · {Math.round(p.mastery_score * 100)}% mastery
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => router.push(`/loop?cert=${certId}`)}
                              style={{ flexShrink: 0, padding: '4px 12px', height: '32px', background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--hairline-strong)', borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', lineHeight: 2, whiteSpace: 'nowrap' }}
                            >
                              study →
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      {graph.length > 0 && (
        <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '14px', color: 'var(--mute)', margin: '0 0 4px 0' }}>ready to start?</p>
            <p style={{ fontSize: '13px', color: 'var(--stone)', margin: 0 }}>
              {totalObjectives} objectives · learn, then test each one
            </p>
          </div>
          <button
            onClick={() => router.push(`/loop?cert=${certId}`)}
            style={{ padding: '4px 20px', height: '36px', background: 'var(--ink)', color: 'var(--canvas)', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', lineHeight: 2 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-deep)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ink)')}
          >
            {stats?.attemptedCount > 0 ? 'continue prep →' : 'start prep →'}
          </button>
        </div>
      )}
    </div>
  );
}

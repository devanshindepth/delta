'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function LearnContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const objectiveId = searchParams.get('obj');
  const certId = searchParams.get('cert') || 'cert-azure-ai103';

  const [objective, setObjective] = useState<any>(null);
  const [loading, setLoading] = useState(!!objectiveId);

  useEffect(() => {
    if (!objectiveId) {
      setLoading(false);
      return;
    }
    fetch(`/api/objectives/${objectiveId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setObjective(d.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [objectiveId]);

  if (!objectiveId) {
    // No specific objective — redirect to certifications
    return (
      <div
        style={{
          maxWidth: '720px',
          width: '100%',
          margin: '0 auto',
          padding: '96px 32px',
        }}
      >
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
            [~] learn
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
            learn from first principles
          </h1>
          <p
            style={{
              fontSize: '16px',
              color: 'var(--body)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            select a certification to start the learning loop, or go directly to
            practice.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => router.push('/')}
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
              alignSelf: 'flex-start',
            }}
          >
            select certification →
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{ maxWidth: '720px', margin: '0 auto', padding: '96px 32px' }}
      >
        <div
          className="animate-pulse"
          style={{ height: '200px', background: 'var(--surface-card)' }}
        />
      </div>
    );
  }

  if (!objective) {
    return (
      <div
        style={{ maxWidth: '720px', margin: '0 auto', padding: '96px 32px' }}
      >
        <p style={{ color: 'var(--danger)', fontSize: '16px' }}>
          [-] objective not found
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '720px',
        width: '100%',
        margin: '0 auto',
        padding: '96px 32px',
      }}
    >
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
          [~] learn · {objective.domain_code} {objective.objective_code}
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
          {objective.title}
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: 'var(--body)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {objective.description}
        </p>
      </div>

      {/* Importance / freshness */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '32px',
          flexWrap: 'wrap',
        }}
      >
        {objective.importance === 'critical' && (
          <span
            style={{
              fontSize: '13px',
              padding: '2px 8px',
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
              borderRadius: '4px',
            }}
          >
            critical exam topic
          </span>
        )}
        <span
          style={{
            fontSize: '13px',
            padding: '2px 8px',
            border: `1px solid ${objective.freshness_status === 'current' ? 'var(--success)' : 'var(--warning)'}`,
            color:
              objective.freshness_status === 'current'
                ? 'var(--success)'
                : 'var(--warning)',
            borderRadius: '4px',
          }}
        >
          {objective.freshness_status === 'current'
            ? 'content is current'
            : objective.freshness_status.replace('_', ' ')}
        </span>
      </div>

      {/* Main content block */}
      <div
        style={{
          padding: '24px',
          background: 'var(--surface-soft)',
          border: '1px solid var(--hairline)',
          marginBottom: '32px',
        }}
      >
        <p
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--ink)',
            marginBottom: '16px',
          }}
        >
          [+] what it is
        </p>
        <p
          style={{
            fontSize: '16px',
            color: 'var(--body)',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {objective.description}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            color: 'var(--mute)',
            fontFamily: 'inherit',
            padding: 0,
          }}
        >
          ← back
        </button>
        <button
          onClick={() =>
            router.push(`/loop?cert=${certId}&obj=${objectiveId}`)
          }
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
        >
          start practice →
        </button>
      </div>
    </div>
  );
}

export default function LearnPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{ maxWidth: '720px', margin: '0 auto', padding: '96px 32px' }}
        >
          <div
            className="animate-pulse"
            style={{ height: '200px', background: 'var(--surface-card)' }}
          />
        </div>
      }
    >
      <LearnContent />
    </Suspense>
  );
}

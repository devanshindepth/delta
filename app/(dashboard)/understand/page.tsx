'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/app/_components/ui/Button';
import type { UnderstandResult } from '@/lib/types';

function UnderstandContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UnderstandResult | null>(null);
  const [error, setError] = useState('');
  const [generatingChallenge, setGeneratingChallenge] = useState(false);

  useEffect(() => {
    if (query) {
      runUnderstand(query);
    }
  }, [query]);

  const runUnderstand = async (q: string) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/understand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setResult(json.data);
      } else {
        setError(json.error || 'Failed to analyze topic.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePractice = async () => {
    setGeneratingChallenge(true);
    try {
      // Create a temporary goal from the query, then generate a challenge
      const goalRes = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: query,
          description: result?.what_it_is || query,
        }),
      });
      const goalJson = await goalRes.json();

      if (goalJson.success) {
        // Fetch the first generated challenge
        const challengesRes = await fetch('/api/challenges');
        const challengesJson = await challengesRes.json();
        if (challengesJson.data && challengesJson.data.length > 0) {
          router.push(`/practice/${challengesJson.data[0].id}`);
        } else {
          router.push('/practice');
        }
      }
    } catch {
      router.push('/practice');
    } finally {
      setGeneratingChallenge(false);
    }
  };

  if (!query) {
    return (
      <div
        className="flex flex-col min-h-screen max-w-[720px] mx-auto px-8 py-[96px]"
      >
        <p style={{ color: "var(--mute)" }} className="text-[16px]">
          No topic provided. <button onClick={() => router.push('/')} className="underline" style={{ color: "var(--ink)", fontFamily: "inherit" }}>Go back</button>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-[720px] mx-auto px-8 py-[96px]">
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--hairline)", paddingBottom: "32px", marginBottom: "48px" }}>
        <p className="text-[14px] leading-[2] mb-3" style={{ color: "var(--mute)" }}>
          [?] understand
        </p>
        <h1 className="text-[38px] font-bold leading-[1.5]" style={{ color: "var(--ink)" }}>
          {query}
        </h1>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => router.push('/')}
            className="text-[14px] leading-[2] transition-colors hover:text-[var(--ink)]"
            style={{ color: "var(--mute)", fontFamily: "inherit" }}
          >
            &#8592; back
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-6">
          {['what it is', 'prerequisites', 'why it matters', 'next steps'].map((label) => (
            <div key={label}>
              <p className="text-[14px] mb-3" style={{ color: "var(--mute)" }}>[+] {label}</p>
              <div
                className="h-4 w-3/4 animate-pulse"
                style={{ background: "var(--surface-card)" }}
              />
              <div
                className="h-4 w-1/2 mt-2 animate-pulse"
                style={{ background: "var(--surface-card)" }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="p-4 text-[16px]"
          style={{
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            borderRadius: "4px",
          }}
        >
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-10">

          {/* What it is */}
          <Section label="[+] what it is">
            <p className="text-[16px] leading-[1.5]" style={{ color: "var(--body)" }}>
              {result.what_it_is}
            </p>
          </Section>

          {/* What changed */}
          {result.what_changed && (
            <Section label="[+] what changed">
              <p className="text-[16px] leading-[1.5]" style={{ color: "var(--body)" }}>
                {result.what_changed}
              </p>
            </Section>
          )}

          {/* Prerequisites */}
          {result.prerequisites?.length > 0 && (
            <Section label="[+] prerequisites">
              <ul className="space-y-2">
                {result.prerequisites.map((p, i) => (
                  <li key={i} className="text-[16px] leading-[1.5]" style={{ color: "var(--body)" }}>
                    <span style={{ color: "var(--mute)" }}>[+] </span>{p}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Why it matters */}
          {result.matters_for_goal && (
            <Section label="[+] why it matters">
              <p
                className="text-[16px] leading-[1.5] pl-4"
                style={{
                  color: "var(--body)",
                  borderLeft: "2px solid var(--hairline-strong)",
                }}
              >
                {result.matters_for_goal}
              </p>
            </Section>
          )}

          {/* What you don't know yet */}
          {result.not_known?.length > 0 && (
            <Section label="[-] gaps to fill">
              <ul className="space-y-2">
                {result.not_known.map((item, i) => (
                  <li key={i} className="text-[16px] leading-[1.5]" style={{ color: "var(--body)" }}>
                    <span style={{ color: "var(--mute)" }}>[-] </span>{item}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Next steps */}
          {result.next_steps?.length > 0 && (
            <Section label="[>] next steps">
              <ol className="space-y-3">
                {result.next_steps.map((step, i) => (
                  <li
                    key={i}
                    className="text-[16px] leading-[1.5] flex gap-3"
                    style={{ color: "var(--body)" }}
                  >
                    <span className="font-medium" style={{ color: "var(--mute)", flexShrink: 0 }}>
                      {String(i + 1).padStart(2, '0')}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {/* How to prove it */}
          {result.proof_method && (
            <Section label="[>] how to prove it">
              <div
                className="p-4 text-[16px] leading-[1.5]"
                style={{
                  background: "var(--surface-dark)",
                  color: "var(--on-dark)",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ color: "var(--ash)" }}>$ </span>
                {result.proof_method}
              </div>
            </Section>
          )}

          {/* CTA */}
          <div
            className="flex items-center justify-between pt-8"
            style={{ borderTop: "1px solid var(--hairline)" }}
          >
            <p className="text-[16px]" style={{ color: "var(--mute)" }}>
              ready to build it?
            </p>
            <Button
              variant="primary"
              onClick={handlePractice}
              disabled={generatingChallenge}
            >
              {generatingChallenge ? "building challenge..." : "start practice challenge →"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid var(--hairline)", paddingBottom: "32px" }}>
      <p className="text-[14px] leading-[2] font-bold mb-3" style={{ color: "var(--ink)" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

export default function UnderstandPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen" style={{ color: "var(--mute)" }}>
        loading...
      </div>
    }>
      <UnderstandContent />
    </Suspense>
  );
}

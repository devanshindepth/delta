'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/app/_components/ui/Button';
import { Badge } from '@/app/_components/ui/Badge';
import type { Challenge } from '@/lib/types';

const difficultyLabel: Record<string, string> = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
};

export default function PracticePage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/challenges')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setChallenges(json.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-screen max-w-[720px] mx-auto px-8 py-[96px]">
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--hairline)", paddingBottom: "32px", marginBottom: "48px" }}>
        <p className="text-[14px] leading-[2] mb-3" style={{ color: "var(--mute)" }}>
          {'[>]'} practice
        </p>
        <h1 className="text-[38px] font-bold leading-[1.5]" style={{ color: "var(--ink)" }}>
          Practice challenges
        </h1>
        <p className="mt-3 text-[16px] leading-[1.5]" style={{ color: "var(--body)" }}>
          Executable sandbox challenges generated from your learning sessions.
          Each challenge verifies your understanding through real code.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse"
              style={{ background: "var(--surface-card)", border: "1px solid var(--hairline)" }}
            />
          ))}
        </div>
      ) : challenges.length === 0 ? (
        <div
          className="py-16 text-center"
          style={{ border: "1px solid var(--hairline)" }}
        >
          <p className="text-[16px] mb-2" style={{ color: "var(--mute)" }}>
            [-] no challenges yet
          </p>
          <p className="text-[14px] mb-8" style={{ color: "var(--stone)" }}>
            Start a learning session to generate your first practice challenge.
          </p>
          <Link href="/">
            <Button variant="primary">start learning &rarr;</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-0">
          {challenges.map((challenge, idx) => (
            <div
              key={challenge.id}
              className="flex items-start justify-between gap-4 py-[12px]"
              style={{
                borderBottom: idx < challenges.length - 1 ? "1px solid var(--hairline)" : "none",
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[16px] font-medium" style={{ color: "var(--ink)" }}>
                    {challenge.title}
                  </span>
                </div>
                <p className="text-[14px] leading-[1.5] line-clamp-1" style={{ color: "var(--stone)" }}>
                  {challenge.description}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[14px]" style={{ color: "var(--mute)" }}>
                    {challenge.language}
                  </span>
                  <span style={{ color: "var(--hairline-strong)" }}>·</span>
                  <span className="text-[14px]" style={{ color: "var(--mute)" }}>
                    {challenge.estimated_minutes} min
                  </span>
                  <span style={{ color: "var(--hairline-strong)" }}>·</span>
                  <Badge variant="mute">{difficultyLabel[challenge.difficulty]}</Badge>
                </div>
              </div>
              <Link href={`/practice/${challenge.id}`} className="flex-shrink-0">
                <Button variant="secondary" size="sm">
                  open →
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

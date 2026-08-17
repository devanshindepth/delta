'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/app/_components/ui/Button';
import type { Goal, Challenge } from '@/lib/types';

interface HistoryItem {
  goal: Goal;
  challenges: Challenge[];
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const goalsRes = await fetch('/api/goals');
        const goalsJson = await goalsRes.json();

        if (!goalsJson.data || goalsJson.data.length === 0) {
          setItems([]);
          setLoading(false);
          return;
        }

        const challengesRes = await fetch('/api/challenges');
        const challengesJson = await challengesRes.json();
        const allChallenges: Challenge[] = challengesJson.data || [];

        // Group challenges by goal (via competency nodes — approximate by creation order)
        const result: HistoryItem[] = goalsJson.data.map((goal: Goal) => ({
          goal,
          challenges: allChallenges.slice(0, 3), // Show recent challenges alongside goal
        }));

        setItems(result);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="flex flex-col min-h-screen max-w-[720px] mx-auto px-8 py-[96px]">
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--hairline)", paddingBottom: "32px", marginBottom: "48px" }}>
        <p className="text-[14px] leading-[2] mb-3" style={{ color: "var(--mute)" }}>
          [#] history
        </p>
        <h1 className="text-[38px] font-bold leading-[1.5]" style={{ color: "var(--ink)" }}>
          Previous learnings
        </h1>
        <p className="mt-3 text-[16px] leading-[1.5]" style={{ color: "var(--body)" }}>
          Everything you have explored and practiced. Your knowledge record.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse"
              style={{ background: "var(--surface-card)", border: "1px solid var(--hairline)" }}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div
          className="py-16 text-center"
          style={{ border: "1px solid var(--hairline)" }}
        >
          <p className="text-[16px] mb-2" style={{ color: "var(--mute)" }}>
            [-] no learnings yet
          </p>
          <p className="text-[14px] mb-8" style={{ color: "var(--stone)" }}>
            Start with a topic and build your learning record.
          </p>
          <Link href="/">
            <Button variant="primary">start learning →</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-0">
          {items.map((item, idx) => (
            <div
              key={item.goal.id}
              className="py-8"
              style={{
                borderBottom: idx < items.length - 1 ? "1px solid var(--hairline)" : "none",
              }}
            >
              {/* Goal row */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span
                      className="text-[14px] leading-[2]"
                      style={{ color: "var(--mute)" }}
                    >
                      {item.goal.status === 'active' ? '[~]' : '[✓]'}
                    </span>
                    <h2
                      className="text-[16px] font-medium"
                      style={{ color: "var(--ink)" }}
                    >
                      {item.goal.title}
                    </h2>
                  </div>
                  {item.goal.description && (
                    <p className="text-[14px] leading-[1.5] ml-8" style={{ color: "var(--stone)" }}>
                      {item.goal.description}
                    </p>
                  )}
                  <p className="text-[14px] mt-1 ml-8" style={{ color: "var(--ash)" }}>
                    {new Date(item.goal.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <Link href={`/understand?q=${encodeURIComponent(item.goal.title)}`} className="flex-shrink-0">
                  <Button variant="secondary" size="sm">
                    revisit →
                  </Button>
                </Link>
              </div>

              {/* Challenges under this goal */}
              {item.challenges.length > 0 && (
                <div className="ml-8 space-y-0">
                  {item.challenges.map((c, ci) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-[8px]"
                      style={{
                        borderTop: ci === 0 ? "1px solid var(--hairline)" : "none",
                        borderBottom: "1px solid var(--hairline)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[14px]" style={{ color: "var(--mute)" }}>{'[>]'}</span>
                        <span className="text-[14px]" style={{ color: "var(--body)" }}>
                          {c.title}
                        </span>
                        <span className="text-[14px]" style={{ color: "var(--ash)" }}>
                          · {c.language}
                        </span>
                      </div>
                      <Link href={`/practice/${c.id}`}>
                        <button
                          className="text-[14px] transition-colors"
                          style={{ color: "var(--mute)", fontFamily: "inherit" }}
                        >
                          practice &#8594;
                        </button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

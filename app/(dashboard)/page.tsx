'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/_components/ui/Button';

const suggestions = [
  "transformer attention mechanisms",
  "React Server Components",
  "vector databases and embeddings",
  "Rust ownership model",
  "distributed systems consensus",
  "LLM fine-tuning techniques",
];

export default function LearnPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    // Encode the query and navigate to understand page
    router.push(`/understand?q=${encodeURIComponent(query.trim())}`);
  };

  const handleSuggestion = (s: string) => {
    setQuery(s);
  };

  return (
    <div
      className="flex flex-col min-h-screen max-w-[720px] mx-auto px-8 py-[96px]"
    >
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--hairline)", paddingBottom: "32px", marginBottom: "48px" }}>
        <p
          className="text-[14px] leading-[2] mb-3"
          style={{ color: "var(--mute)" }}
        >
          [~] learn
        </p>
        <h1
          className="text-[38px] font-bold leading-[1.5]"
          style={{ color: "var(--ink)" }}
        >
          What do you want to learn?
        </h1>
        <p
          className="mt-3 text-[16px] leading-[1.5]"
          style={{ color: "var(--body)" }}
        >
          Enter a concept, technology, or topic. Delta will break it down from first principles,
          then build you a hands-on practice challenge.
        </p>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="query"
            className="block text-[16px] font-medium mb-2"
            style={{ color: "var(--ink)" }}
          >
            Topic or concept
          </label>
          <textarea
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. how attention works in transformers, or paste a URL..."
            rows={4}
            className="w-full text-[16px] leading-[1.5] px-3 py-3 resize-none transition-colors focus:outline-none"
            style={{
              background: "var(--surface-soft)",
              color: "var(--ink)",
              border: "1px solid var(--hairline)",
              borderRadius: "4px",
              fontFamily: "inherit",
            }}
            onFocus={(e) => {
              e.target.style.background = "var(--canvas)";
              e.target.style.borderColor = "var(--ink)";
            }}
            onBlur={(e) => {
              e.target.style.background = "var(--surface-soft)";
              e.target.style.borderColor = "var(--hairline)";
            }}
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={loading || !query.trim()}
          >
            {loading ? "preparing..." : "explain from first principles →"}
          </Button>
        </div>
      </form>

      {/* Suggestions */}
      <div
        className="mt-12"
        style={{ borderTop: "1px solid var(--hairline)", paddingTop: "32px" }}
      >
        <p
          className="text-[14px] leading-[2] mb-4"
          style={{ color: "var(--mute)" }}
        >
          [+] suggestions
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              className="text-[14px] leading-[2] px-3 py-1 transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)] focus:outline-none focus-visible:outline-1 focus-visible:outline-[var(--ink)]"
              style={{
                background: "var(--surface-card)",
                color: "var(--body)",
                border: "1px solid var(--hairline)",
                borderRadius: "4px",
                fontFamily: "inherit",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

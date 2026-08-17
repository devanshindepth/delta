'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/app/_components/ui/Button';
import type { Challenge, ChallengeSubmission, CounterExample } from '@/lib/types';
import Editor from '@monaco-editor/react';

export default function PracticeWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<ChallengeSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'description' | 'results'>('description');

  useEffect(() => {
    fetch(`/api/challenges/${id}`)
      .then((r) => r.json())
      .then((json) => {
        // API returns { data: { challenge, submissions } }
        const ch = json.data?.challenge ?? json.data;
        if (ch) {
          setChallenge(ch);
          setCode(ch.starter_code || '// start here\n');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    if (!challenge) return;
    setSubmitting(true);
    setActiveTab('results');
    try {
      const res = await fetch(`/api/challenges/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: challenge.language }),
      });
      const json = await res.json();
      if (json.data) setSubmission(json.data);
    } catch (_e) {
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', color: 'var(--mute)', fontSize: '16px' }}>
        loading workspace...
      </div>
    );
  }

  if (!challenge) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', color: 'var(--danger)', fontSize: '16px' }}>
        challenge not found
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--canvas)', overflow: 'hidden' }}>
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '56px',
          padding: '0 24px',
          borderBottom: '1px solid var(--hairline)',
          background: 'var(--canvas)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
          <button
            onClick={() => router.push('/practice')}
            style={{ color: 'var(--mute)', fontFamily: 'inherit', fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
          >
            &#8592; practice
          </button>
          <span style={{ color: 'var(--hairline-strong)', flexShrink: 0 }}>|</span>
          <span style={{ color: 'var(--ink)', fontSize: '16px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {challenge.title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          <span style={{ color: 'var(--stone)', fontSize: '14px' }}>
            {challenge.language} · {challenge.estimated_minutes} min
          </span>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'running...' : 'submit \u2192'}
          </Button>
        </div>
      </div>

      {/* Body: editor + right pane */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Editor */}
        <div style={{ flex: 1, overflow: 'hidden', borderRight: '1px solid var(--hairline)' }}>
          <Editor
            height="100%"
            language={challenge.language || 'python'}
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: '"Geist Mono", "Fira Code", ui-monospace, monospace',
              padding: { top: 20, bottom: 20 },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              renderLineHighlight: 'line',
              overviewRulerLanes: 0,
              scrollbar: { verticalScrollbarSize: 4 },
            }}
          />
        </div>

        {/* Right pane */}
        <div style={{ width: '400px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--canvas)', overflow: 'hidden' }}>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--hairline-strong)', flexShrink: 0 }}>
            {(['description', 'results'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 24px',
                  fontSize: '16px',
                  lineHeight: '2',
                  fontFamily: 'inherit',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--ash)' : '2px solid transparent',
                  cursor: 'pointer',
                  color: activeTab === tab ? 'var(--ink)' : 'var(--mute)',
                  fontWeight: activeTab === tab ? '500' : '400',
                  marginBottom: '-1px',
                }}
              >
                {tab}
                {tab === 'results' && submission
                  ? submission.status === 'passed' ? ' [\u2713]' : ' [\u00d7]'
                  : ''}
              </button>
            ))}
          </div>

          {/* Scrollable tab content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {activeTab === 'description' && (
              <>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--ink)', marginBottom: '12px' }}>[+] description</p>
                  <p style={{ fontSize: '16px', lineHeight: '1.6', color: 'var(--body)', whiteSpace: 'pre-wrap' }}>
                    {challenge.description || '—'}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: '24px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--ink)', marginBottom: '12px' }}>[+] why it matters</p>
                  <p style={{ fontSize: '16px', lineHeight: '1.6', color: 'var(--body)', paddingLeft: '12px', borderLeft: '2px solid var(--hairline-strong)' }}>
                    {challenge.why_it_matters || '—'}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: '24px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--ink)', marginBottom: '12px' }}>[-] metadata</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[challenge.challenge_type, challenge.difficulty, challenge.language].filter(Boolean).map((tag) => (
                      <span key={tag} style={{ fontSize: '14px', padding: '2px 8px', background: 'var(--surface-card)', color: 'var(--ink)', border: '1px solid var(--hairline)', borderRadius: '4px' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'results' && (
              <>
                {submitting && <p style={{ fontSize: '16px', color: 'var(--mute)' }}>running tests...</p>}

                {!submitting && !submission && (
                  <p style={{ fontSize: '16px', color: 'var(--stone)' }}>
                    [-] no submission yet. write your solution and click submit.
                  </p>
                )}

                {submission && (
                  <>
                    {submission.status === 'passed' && (
                      <div style={{ padding: '16px', background: 'var(--surface-dark)', borderRadius: '4px' }}>
                        <p style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '16px' }}>[\u2713] challenge passed</p>
                        <p style={{ color: 'var(--on-dark-mute)', fontSize: '14px', marginTop: '4px' }}>Evidence recorded.</p>
                      </div>
                    )}

                    {submission.status === 'failed' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ padding: '8px 12px', fontSize: '14px', fontWeight: 'bold', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '4px' }}>
                          [\u00d7] failed
                        </div>
                        {submission.counterexamples?.map((ce: CounterExample, idx: number) => (
                          <div key={idx} style={{ padding: '12px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <p style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--ink)' }}>counterexample #{idx + 1}</p>
                            <CodeLine label="input" value={ce.input} />
                            <CodeLine label="expected" value={ce.expected} />
                            <CodeLine label="got" value={ce.your_result} danger />
                            {ce.invariant_violated && <p style={{ fontSize: '14px', color: 'var(--mute)', marginTop: '4px' }}>{ce.invariant_violated}</p>}
                          </div>
                        ))}
                        {submission.execution_output && (
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--ink)', marginBottom: '8px' }}>execution output</p>
                            <pre style={{ fontSize: '13px', padding: '12px', background: 'var(--surface-dark)', color: 'var(--on-dark)', fontFamily: 'inherit', overflowX: 'auto', lineHeight: '1.5' }}>
                              {submission.execution_output}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {submission.status === 'error' && (
                      <div style={{ padding: '12px', border: '1px solid var(--danger)', borderRadius: '4px' }}>
                        <p style={{ color: 'var(--danger)', fontSize: '16px', fontWeight: 'bold' }}>[!] execution error</p>
                        {submission.execution_output && (
                          <pre style={{ fontSize: '13px', marginTop: '8px', color: 'var(--mute)', fontFamily: 'inherit', lineHeight: '1.5' }}>
                            {submission.execution_output}
                          </pre>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeLine({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '12px', fontSize: '13px', padding: '6px 8px', background: 'var(--surface-dark)', fontFamily: 'inherit' }}>
      <span style={{ color: 'var(--ash)', flexShrink: 0 }}>{label}:</span>
      <span style={{ color: danger ? 'var(--danger)' : 'var(--on-dark)' }}>{value}</span>
    </div>
  );
}

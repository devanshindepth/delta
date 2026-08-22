'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type Mode = 'read' | 'interleaved' | 'practice';
type InterleavedStep = 'teach' | 'question' | 'result';

type TeachResponse = {
  success?: boolean;
  data?: unknown;
  user_message?: string;
  scrape_status?: {
    source_url?: string;
    outcome?: string;
  };
  reason?: string;
  error?: string;
};

// Module-level in-flight request dedup. Promise sharing survives React Strict
// Mode remounts while still delivering the result to the active component.
const inflightTeachRequests = new Map<string, Promise<TeachResponse>>();

function fetchTeachContent(objId: string, force: boolean): Promise<TeachResponse> {
  const requestKey = `${objId}:${force ? 'force' : 'normal'}`;
  const existing = inflightTeachRequests.get(requestKey);
  if (existing) return existing;

  const request = fetch(`/api/objectives/${objId}/teach${force ? '?force=true' : ''}`)
    .then((res) => res.json() as Promise<TeachResponse>)
    .finally(() => {
      if (inflightTeachRequests.get(requestKey) === request) {
        inflightTeachRequests.delete(requestKey);
      }
    });

  inflightTeachRequests.set(requestKey, request);
  return request;
}

function PrepContent() {
  const searchParams = useSearchParams();
  const certId = searchParams.get('cert') || '';
  const initialMode = (searchParams.get('mode') as Mode) || 'interleaved';

  const [cert, setCert] = useState<any>(null);
  const [objectives, setObjectives] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // Teach & Question states
  const [teachContent, setTeachContent] = useState<any>(null);
  const [teachError, setTeachError] = useState<{
    message: string;
    sourceUrl?: string;
    reason?: string;
    statusLabel?: string;
  } | null>(null);
  const [teachLoading, setTeachLoading] = useState(false);
  const [question, setQuestion] = useState<any>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [interleavedStep, setInterleavedStep] = useState<InterleavedStep>('teach');

  // Question interaction states
  const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [orderingState, setOrderingState] = useState<string[]>([]);
  const [matchingState, setMatchingState] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; explanation: string; officialDocUrl?: string } | null>(null);

  // Live content update state
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateLogs, setUpdateLogs] = useState<string[]>([]);

  // Load cert and objectives
  const loadData = useCallback(async () => {
    if (!certId) {
      setLoading(false);
      return;
    }
    try {
      const [certRes, objRes, statsRes] = await Promise.all([
        fetch(`/api/certifications/${encodeURIComponent(certId)}`),
        fetch(`/api/certifications/${encodeURIComponent(certId)}/objectives`),
        fetch(`/api/certifications/${encodeURIComponent(certId)}/stats`),
      ]);
      const [certData, objData, statsData] = await Promise.all([
        certRes.json(),
        objRes.json(),
        statsRes.json(),
      ]);

      if (certData.success) setCert(certData.data);
      if (objData.success && Array.isArray(objData.data)) {
        setObjectives(objData.data);
      }
      if (statsData.success) setStats(statsData.data);
    } catch (err) {
      console.error('[prep] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [certId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sequence counter for "latest wins" when switching objectives
  const teachSeqRef = useRef(0);

  // Load teach content for current objective
  const loadTeach = useCallback(async (objId: string, force: boolean = false) => {
    const seq = ++teachSeqRef.current;

    setTeachLoading(true);
    setTeachContent(null);
    setTeachError(null);
    try {
      const data = await fetchTeachContent(objId, force);
      if (teachSeqRef.current !== seq) return;
      if (data.success && data.data) {
        setTeachContent(data.data);
      } else {
        setTeachError({
          message: data.user_message || "We couldn't verify enough information from the official documentation to create a reliable lesson.",
          sourceUrl: data.scrape_status?.source_url,
          reason: data.reason || data.error,
          statusLabel: data.scrape_status?.outcome === 'failed' ? 'Extraction incomplete' : 'Documentation unavailable'
        });
      }
    } catch (err) {
      if (teachSeqRef.current !== seq) return;
      console.error('[prep] loadTeach error:', err);
      setTeachError({
        message: "We encountered a temporary network issue connecting to the learning pipeline.",
        statusLabel: "Connection error"
      });
    } finally {
      if (teachSeqRef.current === seq) {
        setTeachLoading(false);
      }
    }
  }, []);

  // Load question for current objective
  const loadQuestion = useCallback(async (objId: string) => {
    setQuestionLoading(true);
    setQuestion(null);
    setSelectedAnswer(null);
    setMultiSelected([]);
    setResult(null);
    try {
      const res = await fetch(`/api/objectives/${objId}/question`);
      const data = await res.json();
      if (data.success && data.data) {
        const q = data.data;
        setQuestion(q);
        if (q.question_type === 'ordering' && q.ordering_items?.length > 0) {
          setOrderingState([...q.ordering_items].sort(() => Math.random() - 0.5).map((i: any) => i.id));
        } else {
          setOrderingState([]);
        }
        if (q.question_type === 'matching') {
          setMatchingState({});
        }
      }
    } catch (err) {
      console.error('[prep] loadQuestion error:', err);
    } finally {
      setQuestionLoading(false);
    }
  }, []);

  // Sync content when currentIdx or mode changes
  useEffect(() => {
    if (objectives.length === 0) return;
    const currentObj = objectives[currentIdx];
    if (!currentObj) return;

    if (mode === 'read') {
      loadTeach(currentObj.id);
    } else if (mode === 'interleaved') {
      setInterleavedStep('teach');
      loadTeach(currentObj.id);
    } else if (mode === 'practice') {
      loadQuestion(currentObj.id);
    }
  }, [currentIdx, mode, objectives, loadTeach, loadQuestion]);

  const handleStartInterleavedQuestion = () => {
    const currentObj = objectives[currentIdx];
    if (currentObj) {
      setInterleavedStep('question');
      loadQuestion(currentObj.id);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!question) return;
    setSubmitting(true);

    let answerPayload: any;
    if (question.question_type === 'mcq' || question.question_type === 'case_study') {
      answerPayload = selectedAnswer;
    } else if (question.question_type === 'multi_select') {
      answerPayload = multiSelected;
    } else if (question.question_type === 'ordering') {
      answerPayload = orderingState;
    } else if (question.question_type === 'matching') {
      answerPayload = matchingState;
    } else {
      answerPayload = selectedAnswer || '';
    }

    try {
      const res = await fetch(`/api/questions/${question.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answerPayload }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        if (mode === 'interleaved') {
          setInterleavedStep('result');
        }
        // Refresh stats
        fetch(`/api/certifications/${encodeURIComponent(certId)}/stats`)
          .then(r => r.json())
          .then(s => { if (s.success) setStats(s.data); })
          .catch(() => {});
      }
    } catch (err) {
      console.error('[submit error]', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextObjective = () => {
    if (currentIdx < objectives.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setResult(null);
    } else {
      // Completed syllabus loop
      setCurrentIdx(0);
      setResult(null);
    }
  };

  const handlePrevObjective = () => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1);
      setResult(null);
    }
  };

  const handleUpdateCert = async () => {
    if (isUpdating || !certId) return;

    setIsUpdating(true);
    setUpdateLogs(['[~] starting content update…']);

    try {
      const res = await fetch(`/api/certifications/${encodeURIComponent(certId)}/update`, { method: 'POST' });
      if (!res.body) throw new Error('No stream body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.message) {
              setUpdateLogs(prev => [...prev, event.message]);
            }
            if (event.type === 'done') {
              const currentObj = objectives[currentIdx];
              if (currentObj) {
                if (mode === 'read' || mode === 'interleaved') {
                  loadTeach(currentObj.id);
                }
                if (mode === 'practice') {
                  loadQuestion(currentObj.id);
                }
              }
              // Refresh stats
              fetch(`/api/certifications/${encodeURIComponent(certId)}/stats`)
                .then(r => r.json())
                .then(s => { if (s.success) setStats(s.data); })
                .catch(() => {});
            }
          } catch {
            // skip chunk
          }
        }
      }
    } catch (err: any) {
      setUpdateLogs(prev => [...prev, `[-] error: ${err.message}`]);
    } finally {
      setTimeout(() => {
        setIsUpdating(false);
        setUpdateLogs([]);
      }, 3000);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '960px', width: '100%', margin: '0 auto', padding: '64px 32px' }}>
        <div className="animate-pulse" style={{ height: '32px', width: '240px', background: 'var(--surface-card)', marginBottom: '24px' }} />
        <div className="animate-pulse" style={{ height: '48px', width: '100%', background: 'var(--surface-card)', marginBottom: '32px' }} />
        <div className="animate-pulse" style={{ height: '300px', width: '100%', background: 'var(--surface-card)' }} />
      </div>
    );
  }

  if (!cert) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '96px 32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--danger)', fontSize: '18px', marginBottom: '16px' }}>
          [-] certification not found.
        </p>
        <Link
          href="/"
          style={{
            padding: '8px 20px',
            background: 'var(--ink)',
            color: 'var(--canvas)',
            borderRadius: '4px',
            textDecoration: 'none',
            fontSize: '14px',
          }}
        >
          ← return to home
        </Link>
      </div>
    );
  }

  const currentObj = objectives[currentIdx] || { title: 'General', objective_code: '1.0', description: cert.description };
  const readiness = stats?.readinessScore ?? 0;

  const getOptionData = (opt: any, idx: number) => {
    if (typeof opt === 'string') {
      const id = `opt-${String.fromCharCode(97 + idx)}`;
      const label = String.fromCharCode(65 + idx);
      const text = opt;
      return { id, label, text };
    }
    const id = opt?.id ? String(opt.id) : `opt-${String.fromCharCode(97 + idx)}`;
    const label = opt?.id ? String(opt.id).replace(/^opt-/, '').toUpperCase() : String.fromCharCode(65 + idx);
    const text = opt?.text || opt?.label || String(opt || '');
    return { id, label, text };
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* ─── TOP NAVIGATION BAR ─── */}
      <header
        style={{
          width: '100%',
          background: 'var(--canvas)',
          borderBottom: '1px solid var(--hairline)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '0 24px',
            height: '60px',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          {/* Left: Progress Badge & Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifySelf: 'start' }}>
            <span
              style={{
                fontSize: '12px',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid var(--hairline-strong)',
                color: 'var(--ink)',
                fontWeight: 600,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {readiness}% mastered
            </span>
            <span style={{ color: 'var(--hairline-strong)' }}>/</span>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--ink)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {cert.code}
            </span>
          </div>

          {/* Center: Mode Switcher Tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', justifySelf: 'center' }}>
            <button
              onClick={() => setMode('read')}
              style={{
                background: mode === 'read' ? 'var(--ink)' : 'transparent',
                color: mode === 'read' ? 'var(--canvas)' : 'var(--mute)',
                border: mode === 'read' ? '1px solid var(--ink)' : '1px solid transparent',
                borderRadius: '4px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              [~] 1. read material
            </button>

            <button
              onClick={() => setMode('interleaved')}
              style={{
                background: mode === 'interleaved' ? 'var(--ink)' : 'transparent',
                color: mode === 'interleaved' ? 'var(--canvas)' : 'var(--mute)',
                border: mode === 'interleaved' ? '1px solid var(--ink)' : '1px solid transparent',
                borderRadius: '4px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              [&gt;] 2. learn & solve
            </button>

            <button
              onClick={() => setMode('practice')}
              style={{
                background: mode === 'practice' ? 'var(--ink)' : 'transparent',
                color: mode === 'practice' ? 'var(--canvas)' : 'var(--mute)',
                border: mode === 'practice' ? '1px solid var(--ink)' : '1px solid transparent',
                borderRadius: '4px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              [?] 3. only questions
            </button>
          </nav>

          {/* Right: Update Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifySelf: 'end' }}>
            <button
              onClick={handleUpdateCert}
              disabled={isUpdating}
              style={{
                fontSize: '12px',
                color: isUpdating ? 'var(--ash)' : 'var(--ink)',
                background: 'var(--canvas)',
                border: '1px solid var(--hairline-strong)',
                borderRadius: '4px',
                padding: '4px 10px',
                cursor: isUpdating ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isUpdating) {
                  e.currentTarget.style.borderColor = 'var(--ink)';
                  e.currentTarget.style.background = 'var(--ink)';
                  e.currentTarget.style.color = 'var(--canvas)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isUpdating) {
                  e.currentTarget.style.borderColor = 'var(--hairline-strong)';
                  e.currentTarget.style.background = 'var(--canvas)';
                  e.currentTarget.style.color = 'var(--ink)';
                }
              }}
            >
              {isUpdating ? '[~] updating…' : '[~] update content'}
            </button>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT CONTAINER ─── */}
      <main
        style={{
          flex: 1,
          maxWidth: '900px',
          width: '100%',
          margin: '0 auto',
          padding: '40px 24px 80px 24px',
        }}
      >
        {/* Certificate Title & Objective Stepper */}
        <div
          style={{
            borderBottom: '1px solid var(--hairline)',
            paddingBottom: '24px',
            marginBottom: '32px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--mute)', letterSpacing: '0.05em' }}>
              {cert.provider} · {cert.level} · {objectives.length > 0 ? `objective ${currentIdx + 1} of ${objectives.length}` : 'overview'}
            </span>
            {objectives.length > 1 && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={handlePrevObjective}
                  disabled={currentIdx === 0}
                  style={{
                    padding: '2px 10px',
                    background: 'var(--canvas)',
                    border: '1px solid var(--hairline-strong)',
                    borderRadius: '4px',
                    color: currentIdx === 0 ? 'var(--ash)' : 'var(--ink)',
                    cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                  }}
                >
                  ← prev
                </button>
                <button
                  onClick={handleNextObjective}
                  disabled={currentIdx === objectives.length - 1}
                  style={{
                    padding: '2px 10px',
                    background: 'var(--canvas)',
                    border: '1px solid var(--hairline-strong)',
                    borderRadius: '4px',
                    color: currentIdx === objectives.length - 1 ? 'var(--ash)' : 'var(--ink)',
                    cursor: currentIdx === objectives.length - 1 ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                  }}
                >
                  next →
                </button>
              </div>
            )}
          </div>

          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px 0', lineHeight: 1.3 }}>
            {currentObj.objective_code ? `${currentObj.objective_code}. ` : ''}{currentObj.title}
          </h1>

          <p style={{ fontSize: '15px', color: 'var(--body)', margin: 0, lineHeight: 1.6 }}>
            {currentObj.description || cert.description}
          </p>
        </div>

        {/* ─── OPTION 1: READ SCRAPED LEARNING MATERIAL ─── */}
        {mode === 'read' && (
          <div>
            {teachLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="animate-pulse" style={{ height: '100px', background: 'var(--surface-card)', borderRadius: '4px' }} />
                <div className="animate-pulse" style={{ height: '80px', background: 'var(--surface-card)', borderRadius: '4px' }} />
                <div className="animate-pulse" style={{ height: '140px', background: 'var(--surface-card)', borderRadius: '4px' }} />
              </div>
            ) : teachError ? (
              <div
                style={{
                  padding: '24px',
                  background: 'var(--surface-soft)',
                  border: '1px solid var(--hairline-strong)',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'var(--surface-dark)',
                      color: 'var(--on-dark)',
                    }}
                  >
                    [!] lesson notice
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
                    We couldn&apos;t build this lesson yet.
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--body)' }}>
                  {teachError.sourceUrl && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: '80px' }}>Source:</span>
                      <a
                        href={teachError.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--ink)', textDecoration: 'underline', wordBreak: 'break-all' }}
                      >
                        {teachError.sourceUrl}
                      </a>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: '80px' }}>Status:</span>
                    <span>{teachError.statusLabel || 'Extraction incomplete'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: '80px' }}>Action:</span>
                    <span>{teachError.message || "We couldn't verify enough information from the official documentation to create a reliable lesson. You can retry or choose another objective."}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    onClick={() => {
                      const currentObj = objectives[currentIdx];
                      if (currentObj) loadTeach(currentObj.id, true);
                    }}
                    disabled={teachLoading}
                    style={{
                      padding: '6px 16px',
                      background: 'var(--ink)',
                      color: 'var(--canvas)',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: teachLoading ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {teachLoading ? '[~] retrying extraction…' : '[~] retry source extraction'}
                  </button>
                  {currentIdx < objectives.length - 1 && (
                    <button
                      onClick={handleNextObjective}
                      style={{
                        padding: '6px 16px',
                        background: 'transparent',
                        color: 'var(--ink)',
                        border: '1px solid var(--hairline-strong)',
                        borderRadius: '4px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      skip to next objective →
                    </button>
                  )}
                </div>
              </div>
            ) : teachContent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* What it is */}
                <section style={{ padding: '20px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: '4px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px 0' }}>[+] what it is</p>
                  {Array.isArray(teachContent.what_it_is) ? (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {teachContent.what_it_is.map((item: string, i: number) => (
                        <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '14px', color: 'var(--body)', lineHeight: 1.6, alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--ink)', fontWeight: 700, flexShrink: 0 }}>•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: '14px', color: 'var(--body)', lineHeight: 1.6, margin: 0 }}>
                      {teachContent.what_it_is}
                    </p>
                  )}
                </section>

                {/* Analogy / Proof */}
                {teachContent.analogy && (
                  <section style={{ padding: '16px 20px', background: 'var(--surface-dark)', color: 'var(--on-dark)', borderRadius: '4px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--ash)', margin: '0 0 6px 0' }}>$ intuition</p>
                    <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0, color: 'var(--on-dark)' }}>
                      {teachContent.analogy}
                    </p>
                  </section>
                )}

                {/* Why it exists */}
                {teachContent.why_it_exists && (
                  <section style={{ padding: '20px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: '4px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px 0' }}>[~] why it exists</p>
                    {Array.isArray(teachContent.why_it_exists) ? (
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {teachContent.why_it_exists.map((item: string, i: number) => (
                          <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '14px', color: 'var(--body)', lineHeight: 1.6, alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--ink)', fontWeight: 700, flexShrink: 0 }}>•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ fontSize: '14px', color: 'var(--body)', lineHeight: 1.6, margin: 0 }}>
                        {teachContent.why_it_exists}
                      </p>
                    )}
                  </section>
                )}

                {/* How it works */}
                {teachContent.how_it_works && (
                  <section style={{ padding: '20px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: '4px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px 0' }}>[#] how it works under the hood</p>
                    {Array.isArray(teachContent.how_it_works) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {teachContent.how_it_works.map((step: string, idx: number) => (
                          <div key={idx} style={{ display: 'flex', gap: '12px', fontSize: '14px', color: 'var(--body)', lineHeight: 1.6, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink)', padding: '1px 6px', background: 'var(--canvas)', border: '1px solid var(--hairline-strong)', borderRadius: '3px', flexShrink: 0, marginTop: '2px' }}>
                              0{idx + 1}
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '14px', color: 'var(--body)', lineHeight: 1.6, margin: 0 }}>
                        {teachContent.how_it_works}
                      </p>
                    )}
                  </section>
                )}

                {/* Key Concepts */}
                {teachContent.key_concepts?.length > 0 && (
                  <section style={{ padding: '20px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: '4px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 14px 0' }}>[*] key concepts</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {teachContent.key_concepts.map((kc: any, i: number) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '16px', alignItems: 'baseline', paddingBottom: '10px', borderBottom: i < teachContent.key_concepts.length - 1 ? '1px dashed var(--hairline)' : 'none' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', wordBreak: 'break-word' }}>
                            {kc.term}
                          </span>
                          <span style={{ fontSize: '14px', color: 'var(--body)', lineHeight: 1.5 }}>
                            {kc.definition}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Common Mistakes */}
                {teachContent.common_mistakes?.length > 0 && (
                  <section style={{ padding: '20px', border: '1px solid var(--hairline)', borderRadius: '4px', background: 'var(--canvas)' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 10px 0' }}>[-] common misconceptions</p>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(Array.isArray(teachContent.common_mistakes) ? teachContent.common_mistakes : [teachContent.common_mistakes]).map((m: string, i: number) => (
                        <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '14px', color: 'var(--body)', lineHeight: 1.5, alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--ink)', fontWeight: 700, flexShrink: 0 }}>×</span>
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Exam Tip */}
                {teachContent.exam_tip && (
                  <div style={{ padding: '16px 20px', border: '1px solid var(--hairline-strong)', borderRadius: '4px', background: 'var(--surface-card)' }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px 0' }}>[?] key exam point</p>
                    <p style={{ fontSize: '14px', color: 'var(--ink)', margin: 0, lineHeight: 1.6, fontWeight: 500 }}>{teachContent.exam_tip}</p>
                  </div>
                )}

                {/* Footer Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                  <button
                    onClick={() => setMode('interleaved')}
                    style={{
                      padding: '8px 20px',
                      background: 'var(--ink)',
                      color: 'var(--canvas)',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    solve question for this concept →
                  </button>

                  {currentIdx < objectives.length - 1 && (
                    <button
                      onClick={handleNextObjective}
                      style={{
                        padding: '8px 16px',
                        background: 'transparent',
                        color: 'var(--ink)',
                        border: '1px solid var(--hairline-strong)',
                        borderRadius: '4px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      next concept →
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--mute)' }}>[-] No teaching content available for this objective.</p>
            )}
          </div>
        )}

        {/* ─── OPTION 2: SOLVE ALONG WITH LEARNING MATERIAL (INTERLEAVED LOOP) ─── */}
        {mode === 'interleaved' && (
          <div>
            {interleavedStep === 'teach' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '12px', padding: '2px 8px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: '4px', color: 'var(--ink)', fontWeight: 700 }}>
                    step 1: master concept
                  </span>
                </div>

                {teachLoading ? (
                  <div className="animate-pulse" style={{ height: '240px', background: 'var(--surface-card)', borderRadius: '4px' }} />
                ) : teachError ? (
                  <div
                    style={{
                      padding: '24px',
                      background: 'var(--surface-soft)',
                      border: '1px solid var(--hairline-strong)',
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'var(--surface-dark)',
                          color: 'var(--on-dark)',
                        }}
                      >
                        [!] lesson notice
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
                        We couldn&apos;t build this lesson yet.
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--body)' }}>
                      {teachError.sourceUrl && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: '80px' }}>Source:</span>
                          <a
                            href={teachError.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--ink)', textDecoration: 'underline', wordBreak: 'break-all' }}
                          >
                            {teachError.sourceUrl}
                          </a>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: '80px' }}>Status:</span>
                        <span>{teachError.statusLabel || 'Extraction incomplete'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: '80px' }}>Action:</span>
                        <span>{teachError.message || "We couldn't verify enough information from the official documentation to create a reliable lesson. You can retry or choose another objective."}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <button
                        onClick={() => {
                          const currentObj = objectives[currentIdx];
                          if (currentObj) loadTeach(currentObj.id, true);
                        }}
                        disabled={teachLoading}
                        style={{
                          padding: '6px 16px',
                          background: 'var(--ink)',
                          color: 'var(--canvas)',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: teachLoading ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {teachLoading ? '[~] retrying extraction…' : '[~] retry source extraction'}
                      </button>
                      {currentIdx < objectives.length - 1 && (
                        <button
                          onClick={handleNextObjective}
                          style={{
                            padding: '6px 16px',
                            background: 'transparent',
                            color: 'var(--ink)',
                            border: '1px solid var(--hairline-strong)',
                            borderRadius: '4px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          skip to next objective →
                        </button>
                      )}
                    </div>
                  </div>
                ) : teachContent ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* What it is */}
                    <div style={{ padding: '20px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: '4px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px 0' }}>[+] what it is</p>
                      {Array.isArray(teachContent.what_it_is) ? (
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {teachContent.what_it_is.map((item: string, i: number) => (
                            <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '14px', color: 'var(--body)', lineHeight: 1.6, alignItems: 'flex-start' }}>
                              <span style={{ color: 'var(--ink)', fontWeight: 700, flexShrink: 0 }}>•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ fontSize: '14px', color: 'var(--body)', lineHeight: 1.6, margin: 0 }}>
                          {teachContent.what_it_is}
                        </p>
                      )}
                    </div>

                    {/* Analogy */}
                    {teachContent.analogy && (
                      <div style={{ padding: '16px 20px', background: 'var(--surface-dark)', color: 'var(--on-dark)', borderRadius: '4px' }}>
                        <p style={{ fontSize: '12px', color: 'var(--ash)', margin: '0 0 6px 0' }}>$ intuition</p>
                        <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0, color: 'var(--on-dark)' }}>
                          {teachContent.analogy}
                        </p>
                      </div>
                    )}

                    {/* Why it exists */}
                    {teachContent.why_it_exists && (
                      <div style={{ padding: '20px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: '4px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px 0' }}>[~] why it exists</p>
                        {Array.isArray(teachContent.why_it_exists) ? (
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {teachContent.why_it_exists.map((item: string, i: number) => (
                              <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '14px', color: 'var(--body)', lineHeight: 1.6, alignItems: 'flex-start' }}>
                                <span style={{ color: 'var(--ink)', fontWeight: 700, flexShrink: 0 }}>•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ fontSize: '14px', color: 'var(--body)', lineHeight: 1.6, margin: 0 }}>
                            {teachContent.why_it_exists}
                          </p>
                        )}
                      </div>
                    )}

                    {/* How it works */}
                    {teachContent.how_it_works && (
                      <div style={{ padding: '20px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: '4px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px 0' }}>[#] how it works</p>
                        {Array.isArray(teachContent.how_it_works) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {teachContent.how_it_works.map((step: string, idx: number) => (
                              <div key={idx} style={{ display: 'flex', gap: '12px', fontSize: '14px', color: 'var(--body)', lineHeight: 1.6, alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink)', padding: '1px 6px', background: 'var(--canvas)', border: '1px solid var(--hairline-strong)', borderRadius: '3px', flexShrink: 0, marginTop: '2px' }}>
                                  0{idx + 1}
                                </span>
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ fontSize: '14px', color: 'var(--body)', lineHeight: 1.6, margin: 0 }}>
                            {teachContent.how_it_works}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Key Concepts */}
                    {teachContent.key_concepts?.length > 0 && (
                      <div style={{ padding: '20px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: '4px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 14px 0' }}>[*] key concepts</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {teachContent.key_concepts.map((kc: any, i: number) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '16px', alignItems: 'baseline', paddingBottom: '10px', borderBottom: i < teachContent.key_concepts.length - 1 ? '1px dashed var(--hairline)' : 'none' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', wordBreak: 'break-word' }}>
                                {kc.term}
                              </span>
                              <span style={{ fontSize: '14px', color: 'var(--body)', lineHeight: 1.5 }}>
                                {kc.definition}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Common Mistakes */}
                    {teachContent.common_mistakes?.length > 0 && (
                      <div style={{ padding: '20px', border: '1px solid var(--hairline)', borderRadius: '4px', background: 'var(--canvas)' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 10px 0' }}>[-] common misconceptions</p>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {(Array.isArray(teachContent.common_mistakes) ? teachContent.common_mistakes : [teachContent.common_mistakes]).map((m: string, i: number) => (
                            <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '14px', color: 'var(--body)', lineHeight: 1.5, alignItems: 'flex-start' }}>
                              <span style={{ color: 'var(--ink)', fontWeight: 700, flexShrink: 0 }}>×</span>
                              <span>{m}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Exam Tip */}
                    {teachContent.exam_tip && (
                      <div style={{ padding: '14px 18px', border: '1px solid var(--hairline-strong)', borderRadius: '4px', background: 'var(--surface-card)' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px 0' }}>[?] key exam point</p>
                        <p style={{ fontSize: '14px', color: 'var(--ink)', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>{teachContent.exam_tip}</p>
                      </div>
                    )}

                    <button
                      onClick={handleStartInterleavedQuestion}
                      style={{
                        padding: '12px 24px',
                        background: 'var(--ink)',
                        color: 'var(--canvas)',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        width: '100%',
                        marginTop: '8px',
                      }}
                    >
                      test understanding now [practice question] →
                    </button>
                  </div>
                ) : (
                  <p style={{ color: 'var(--mute)' }}>[-] No teaching content available.</p>
                )}
              </div>
            )}

            {(interleavedStep === 'question' || interleavedStep === 'result') && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '12px', padding: '2px 8px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: '4px', color: 'var(--ink)', fontWeight: 700 }}>
                    step 2: prove knowledge
                  </span>
                  <button
                    onClick={() => setInterleavedStep('teach')}
                    style={{ background: 'none', border: 'none', color: 'var(--mute)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    (re-read concept)
                  </button>
                </div>

                {questionLoading ? (
                  <div className="animate-pulse" style={{ height: '200px', background: 'var(--surface-card)', borderRadius: '4px' }} />
                ) : question ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Stem */}
                    <div style={{ padding: '20px', background: 'var(--canvas)', border: '1px solid var(--hairline-strong)', borderRadius: '4px' }}>
                      <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5, margin: 0 }}>
                        {question.stem}
                      </p>
                    </div>

                    {/* Options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {question.options?.map((opt: any, idx: number) => {
                        const optData = getOptionData(opt, idx);
                        const isSelected = selectedAnswer === optData.id || selectedAnswer === idx || selectedAnswer === optData.text;
                        return (
                          <button
                            key={optData.id || idx}
                            disabled={interleavedStep === 'result'}
                            onClick={() => setSelectedAnswer(optData.id)}
                            style={{
                              padding: '16px 20px',
                              textAlign: 'left',
                              background: isSelected ? 'var(--surface-card)' : 'var(--surface-soft)',
                              border: isSelected ? '1px solid var(--ink)' : '1px solid var(--hairline)',
                              borderRadius: '4px',
                              fontSize: '15px',
                              fontFamily: 'inherit',
                              color: 'var(--ink)',
                              cursor: interleavedStep === 'result' ? 'default' : 'pointer',
                              lineHeight: 1.5,
                              transition: 'all 0.15s',
                            }}
                          >
                            <span style={{ fontWeight: 600, marginRight: '8px' }}>
                              [{optData.label}]
                            </span>
                            {optData.text}
                          </button>
                        );
                      })}
                    </div>

                    {/* Result and Explanation */}
                    {result && (
                      <div
                        style={{
                          padding: '20px',
                          border: `1px solid ${result.isCorrect ? 'var(--ink)' : 'var(--danger)'}`,
                          background: result.isCorrect ? 'var(--surface-soft)' : 'var(--surface-soft)',
                          borderRadius: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <span style={{ fontSize: '15px', fontWeight: 700, color: result.isCorrect ? 'var(--ink)' : 'var(--danger)' }}>
                          {result.isCorrect ? '[+] Correct! You mastered this concept.' : '[-] Incorrect.'}
                        </span>
                        <p style={{ fontSize: '14px', color: 'var(--body)', lineHeight: 1.6, margin: 0 }}>
                          {result.explanation}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                      {interleavedStep === 'question' ? (
                        <button
                          onClick={handleSubmitAnswer}
                          disabled={!selectedAnswer || submitting}
                          style={{
                            padding: '10px 24px',
                            background: selectedAnswer ? 'var(--ink)' : 'var(--surface-card)',
                            color: selectedAnswer ? 'var(--canvas)' : 'var(--ash)',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: selectedAnswer ? 'pointer' : 'not-allowed',
                            fontFamily: 'inherit',
                          }}
                        >
                          {submitting ? 'evaluating...' : 'submit answer →'}
                        </button>
                      ) : (
                        <button
                          onClick={handleNextObjective}
                          style={{
                            padding: '10px 24px',
                            background: 'var(--ink)',
                            color: 'var(--canvas)',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {currentIdx < objectives.length - 1 ? 'next concept in syllabus →' : 'complete syllabus loop →'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'var(--mute)' }}>[-] No question available.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── OPTION 3: ONLY SOLVE QUESTIONS ─── */}
        {mode === 'practice' && (
          <div>
            {questionLoading ? (
              <div className="animate-pulse" style={{ height: '240px', background: 'var(--surface-card)', borderRadius: '4px' }} />
            ) : question ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Question Stem */}
                <div style={{ padding: '20px', background: 'var(--canvas)', border: '1px solid var(--hairline-strong)', borderRadius: '4px' }}>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5, margin: 0 }}>
                    {question.stem}
                  </p>
                </div>

                {/* Question Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {question.options?.map((opt: any, idx: number) => {
                    const optData = getOptionData(opt, idx);
                    const isSelected = selectedAnswer === optData.id || selectedAnswer === idx || selectedAnswer === optData.text;
                    return (
                      <button
                        key={optData.id || idx}
                        disabled={!!result}
                        onClick={() => setSelectedAnswer(optData.id)}
                        style={{
                          padding: '16px 20px',
                          textAlign: 'left',
                          background: isSelected ? 'var(--surface-card)' : 'var(--surface-soft)',
                          border: isSelected ? '1px solid var(--ink)' : '1px solid var(--hairline)',
                          borderRadius: '4px',
                          fontSize: '15px',
                          fontFamily: 'inherit',
                          color: 'var(--ink)',
                          cursor: result ? 'default' : 'pointer',
                          lineHeight: 1.5,
                        }}
                      >
                        <span style={{ fontWeight: 600, marginRight: '8px' }}>
                          [{optData.label}]
                        </span>
                        {optData.text}
                      </button>
                    );
                  })}
                </div>

                {/* Instant Feedback */}
                {result && (
                  <div
                    style={{
                      padding: '20px',
                      border: `1px solid ${result.isCorrect ? 'var(--ink)' : 'var(--danger)'}`,
                      background: 'var(--surface-soft)',
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontSize: '15px', fontWeight: 700, color: result.isCorrect ? 'var(--ink)' : 'var(--danger)' }}>
                      {result.isCorrect ? '[+] Correct' : '[-] Incorrect'}
                    </span>
                    <p style={{ fontSize: '14px', color: 'var(--body)', lineHeight: 1.6, margin: 0 }}>
                      {result.explanation}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  {!result ? (
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={!selectedAnswer || submitting}
                      style={{
                        padding: '10px 24px',
                        background: selectedAnswer ? 'var(--ink)' : 'var(--surface-card)',
                        color: selectedAnswer ? 'var(--canvas)' : 'var(--ash)',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: selectedAnswer ? 'pointer' : 'not-allowed',
                        fontFamily: 'inherit',
                      }}
                    >
                      {submitting ? 'checking...' : 'check answer →'}
                    </button>
                  ) : (
                    <button
                      onClick={handleNextObjective}
                      style={{
                        padding: '10px 24px',
                        background: 'var(--ink)',
                        color: 'var(--canvas)',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {currentIdx < objectives.length - 1 ? 'next question →' : 'restart question bank →'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--mute)' }}>[-] No practice questions found.</p>
            )}
          </div>
        )}
      </main>

      {/* Update progress floating overlay */}
      {isUpdating && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          width: '420px',
          background: 'var(--surface-dark)',
          color: 'var(--on-dark)',
          padding: '20px 24px',
          borderRadius: '4px',
          fontFamily: 'inherit',
          fontSize: '13px',
          lineHeight: 1.6,
          zIndex: 1000,
          maxHeight: '320px',
          overflowY: 'auto',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          border: '1px solid var(--hairline-strong)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--on-dark)', fontSize: '14px' }}>
            [~] updating course content
          </div>
          {updateLogs.map((log, i) => (
            <div key={i} style={{
              marginBottom: '4px',
              color: log.startsWith('[-]') ? 'var(--danger)' : log.startsWith('[+]') ? 'var(--success)' : log.startsWith('[~]') ? 'var(--warning)' : 'var(--on-dark)',
            }}>
              {log}
            </div>
          ))}
          <div style={{ display: 'inline-block', width: '8px', animation: 'blink 1s step-end infinite', color: 'var(--on-dark)' }}>_</div>
        </div>
      )}
    </div>
  );
}

export default function PrepPage() {
  return (
    <Suspense fallback={<div className="animate-pulse" style={{ height: '100vh', width: '100%', background: 'var(--canvas)' }} />}>
      <PrepContent />
    </Suspense>
  );
}

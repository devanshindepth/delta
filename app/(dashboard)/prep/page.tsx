'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type Mode = 'read' | 'interleaved' | 'practice';
type InterleavedStep = 'teach' | 'question' | 'result';

function PrepContent() {
  const router = useRouter();
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

  // Load teach content for current objective
  const loadTeach = useCallback(async (objId: string) => {
    setTeachLoading(true);
    setTeachContent(null);
    try {
      const res = await fetch(`/api/objectives/${objId}/teach`);
      const data = await res.json();
      if (data.success && data.data) {
        setTeachContent(data.data);
      }
    } catch (err) {
      console.error('[prep] loadTeach error:', err);
    } finally {
      setTeachLoading(false);
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* Back & Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <Link
              href="/"
              style={{
                fontSize: '13px',
                color: 'var(--mute)',
                textDecoration: 'none',
                padding: '4px 8px',
                border: '1px solid var(--hairline)',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              ← home
            </Link>
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

          {/* Mode Switcher Tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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

          {/* Readiness Score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--hairline-strong)',
                color: 'var(--ink)',
                fontWeight: 500,
              }}
            >
              {readiness}% ready
            </span>
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
            ) : teachContent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* What it is */}
                <section style={{ padding: '20px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: '4px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px 0' }}>[+] what it is</p>
                  <p style={{ fontSize: '15px', color: 'var(--body)', lineHeight: 1.6, margin: 0 }}>
                    {teachContent.what_it_is}
                  </p>
                </section>

                {/* Analogy / Proof */}
                {teachContent.analogy && (
                  <section style={{ padding: '16px 20px', background: 'var(--surface-dark)', color: 'var(--on-dark)', borderRadius: '4px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--ash)', margin: '0 0 6px 0' }}>$ analogy</p>
                    <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                      {teachContent.analogy}
                    </p>
                  </section>
                )}

                {/* How it works */}
                {teachContent.how_it_works && (
                  <section style={{ padding: '20px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: '4px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px 0' }}>[#] how it works under the hood</p>
                    <p style={{ fontSize: '15px', color: 'var(--body)', lineHeight: 1.6, margin: 0 }}>
                      {teachContent.how_it_works}
                    </p>
                  </section>
                )}

                {/* Key Concepts */}
                {teachContent.key_concepts?.length > 0 && (
                  <section style={{ padding: '20px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: '4px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px 0' }}>[*] key concepts</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {teachContent.key_concepts.map((kc: any, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', minWidth: '130px', flexShrink: 0 }}>
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
                  <section style={{ padding: '20px', border: '1px solid var(--hairline)', borderRadius: '4px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 10px 0' }}>[-] common misconceptions</p>
                    <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {teachContent.common_mistakes.map((m: string, i: number) => (
                        <li key={i} style={{ fontSize: '14px', color: 'var(--body)', lineHeight: 1.5 }}>{m}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Exam Tip */}
                {teachContent.exam_tip && (
                  <div style={{ padding: '16px 20px', border: '1px solid var(--hairline-strong)', borderRadius: '4px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px 0' }}>[?] exam takeaway</p>
                    <p style={{ fontSize: '14px', color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>{teachContent.exam_tip}</p>
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
                ) : teachContent ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ padding: '20px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', borderRadius: '4px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px 0' }}>[+] what it is</p>
                      <p style={{ fontSize: '15px', color: 'var(--body)', lineHeight: 1.6, margin: 0 }}>
                        {teachContent.what_it_is}
                      </p>
                    </div>

                    {teachContent.analogy && (
                      <div style={{ padding: '16px 20px', background: 'var(--surface-dark)', color: 'var(--on-dark)', borderRadius: '4px' }}>
                        <p style={{ fontSize: '12px', color: 'var(--ash)', margin: '0 0 6px 0' }}>$ intuition</p>
                        <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                          {teachContent.analogy}
                        </p>
                      </div>
                    )}

                    {teachContent.exam_tip && (
                      <div style={{ padding: '14px 18px', border: '1px solid var(--hairline-strong)', borderRadius: '4px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px 0' }}>[?] key exam point</p>
                        <p style={{ fontSize: '14px', color: 'var(--body)', margin: 0 }}>{teachContent.exam_tip}</p>
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
                        alignSelf: 'flex-start',
                        marginTop: '12px',
                      }}
                    >
                      I got it — test my understanding →
                    </button>
                  </div>
                ) : (
                  <p style={{ color: 'var(--mute)' }}>[-] No content found.</p>
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
                      {question.options?.map((opt: any) => {
                        const isSelected = selectedAnswer === opt.id;
                        return (
                          <button
                            key={opt.id}
                            disabled={interleavedStep === 'result'}
                            onClick={() => setSelectedAnswer(opt.id)}
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
                              [{opt.id.replace('opt-', '').toUpperCase()}]
                            </span>
                            {opt.text}
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
                  {question.options?.map((opt: any) => {
                    const isSelected = selectedAnswer === opt.id;
                    return (
                      <button
                        key={opt.id}
                        disabled={!!result}
                        onClick={() => setSelectedAnswer(opt.id)}
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
                          [{opt.id.replace('opt-', '').toUpperCase()}]
                        </span>
                        {opt.text}
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

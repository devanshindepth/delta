'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function PracticeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const certId = searchParams.get('cert') || 'cert-azure-ai103';

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [orderingState, setOrderingState] = useState<string[]>([]);
  const [matchingState, setMatchingState] = useState<Record<string, string>>({});
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [cert, setCert] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    async function load() {
      try {
        const [certRes, qRes] = await Promise.all([
          fetch(`/api/certifications/${certId}`),
          fetch(`/api/certifications/${certId}/questions`),
        ]);
        const certData = await certRes.json();
        const qData = await qRes.json();
        if (certData.success) setCert(certData.data);
        if (qData.success && qData.data.length > 0) {
          const shuffled = [...qData.data].sort(() => Math.random() - 0.5);
          setQuestions(shuffled);
          initQuestion(shuffled[0]);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [certId]);

  function initQuestion(q: any) {
    setSelectedAnswer(null);
    setMultiSelected([]);
    setIsCorrect(null);
    setShowResult(false);
    if (q?.question_type === 'ordering' && q?.ordering_items) {
      const shuffled = [...q.ordering_items]
        .sort(() => Math.random() - 0.5)
        .map((item: any) => item.id);
      setOrderingState(shuffled);
    }
    if (q?.question_type === 'matching') {
      setMatchingState({});
    }
  }

  const filteredQuestions = typeFilter === 'all'
    ? questions
    : questions.filter((q) => q.question_type === typeFilter);

  const question = filteredQuestions[currentIdx] || null;

  function toggleMultiSelect(optId: string) {
    setMultiSelected((prev) =>
      prev.includes(optId) ? prev.filter((x) => x !== optId) : [...prev, optId]
    );
  }

  function moveOrderItem(idx: number, dir: -1 | 1) {
    const next = [...orderingState];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setOrderingState(next);
  }

  async function handleSubmit() {
    if (!question) return;
    setSubmitting(true);

    let answer: any;
    if (question.question_type === 'mcq' || question.question_type === 'case_study') {
      answer = selectedAnswer;
    } else if (question.question_type === 'multi_select') {
      answer = multiSelected;
    } else if (question.question_type === 'ordering') {
      answer = orderingState;
    } else if (question.question_type === 'matching') {
      answer = matchingState;
    } else {
      answer = selectedAnswer || '';
    }

    try {
      const res = await fetch(`/api/questions/${question.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      });
      const data = await res.json();
      const correct = data.data?.isCorrect ?? false;
      setIsCorrect(correct);
      setShowResult(true);
      setScore((prev) => ({
        correct: prev.correct + (correct ? 1 : 0),
        total: prev.total + 1,
      }));
    } catch {
      setIsCorrect(false);
      setShowResult(true);
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    const next = currentIdx + 1;
    if (next < filteredQuestions.length) {
      setCurrentIdx(next);
      initQuestion(filteredQuestions[next]);
    } else {
      // All done — wrap around
      setCurrentIdx(0);
      initQuestion(filteredQuestions[0]);
      setScore({ correct: 0, total: 0 });
    }
  }

  const questionTypes = ['all', ...Array.from(new Set(questions.map((q) => q.question_type)))];

  return (
    <div style={{ maxWidth: '720px', width: '100%', margin: '0 auto', padding: '96px 32px' }}>
      {/* Header */}
      <div
        style={{
          borderBottom: '1px solid var(--hairline)',
          paddingBottom: '32px',
          marginBottom: '48px',
        }}
      >
        <p style={{ fontSize: '14px', color: 'var(--mute)', marginBottom: '12px', lineHeight: 2 }}>
          [?] practice
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
          {cert ? `${cert.code} practice` : 'practice'}
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--body)', margin: 0, lineHeight: 1.5 }}>
          authentic exam-format questions. every question format the real exam uses.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse" style={{ height: '80px', background: 'var(--surface-card)' }} />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <p style={{ color: 'var(--mute)', fontSize: '16px' }}>
          [-] no practice questions available yet — ingest a source to generate questions
        </p>
      ) : (
        <div>
          {/* Score + type filter */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--hairline)',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {questionTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTypeFilter(t);
                    setCurrentIdx(0);
                    const filtered = t === 'all' ? questions : questions.filter((q) => q.question_type === t);
                    if (filtered[0]) initQuestion(filtered[0]);
                  }}
                  style={{
                    padding: '4px 12px',
                    height: '32px',
                    background: typeFilter === t ? 'var(--ink)' : 'var(--canvas)',
                    color: typeFilter === t ? 'var(--canvas)' : 'var(--mute)',
                    border: `1px solid ${typeFilter === t ? 'var(--ink)' : 'var(--hairline)'}`,
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    lineHeight: 2,
                  }}
                >
                  {t === 'all' ? 'all types' : t.replace('_', ' ')}
                </button>
              ))}
            </div>
            {score.total > 0 && (
              <span style={{ fontSize: '14px', color: 'var(--stone)', flexShrink: 0 }}>
                {score.correct}/{score.total} correct (
                {Math.round((score.correct / score.total) * 100)}%)
              </span>
            )}
          </div>

          {/* Question progress */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--stone)' }}>
              {currentIdx + 1} / {filteredQuestions.length}
            </span>
          </div>

          {question && (
            <div>
              {/* Question meta */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '13px',
                    padding: '2px 8px',
                    border: '1px solid var(--hairline)',
                    color: 'var(--mute)',
                    borderRadius: '4px',
                  }}
                >
                  {question.question_type.replace('_', ' ')}
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    padding: '2px 8px',
                    border: '1px solid var(--hairline)',
                    color: 'var(--mute)',
                    borderRadius: '4px',
                  }}
                >
                  {question.difficulty}
                </span>
                {question.service_tags?.slice(0, 2).map((tag: string) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '13px',
                      padding: '2px 8px',
                      background: 'var(--surface-card)',
                      color: 'var(--ink)',
                      border: '1px solid var(--hairline)',
                      borderRadius: '4px',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Question body */}
              <div
                style={{
                  padding: '24px',
                  background: 'var(--canvas)',
                  border: '1px solid var(--hairline-strong)',
                  marginBottom: '24px',
                }}
              >
                <p
                  style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: 'var(--ink)',
                    lineHeight: 1.6,
                    margin: '0 0 24px 0',
                  }}
                >
                  {question.stem}
                </p>

                {/* Case study context */}
                {question.question_type === 'case_study' && question.case_study && (
                  <div
                    style={{
                      padding: '16px',
                      background: 'var(--surface-dark)',
                      color: 'var(--on-dark)',
                      marginBottom: '24px',
                      fontSize: '14px',
                      lineHeight: 1.6,
                    }}
                  >
                    <p style={{ color: 'var(--ash)', marginBottom: '8px' }}>$ background</p>
                    <p style={{ margin: '0 0 12px 0' }}>{question.case_study.background}</p>
                    {question.case_study.technical_requirements && (
                      <>
                        <p style={{ color: 'var(--ash)', marginBottom: '4px' }}>$ requirements</p>
                        <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px' }}>
                          {question.case_study.technical_requirements.map((r: string, i: number) => (
                            <li key={i} style={{ marginBottom: '4px' }}>{r}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {question.case_study.constraints && (
                      <>
                        <p style={{ color: 'var(--ash)', marginBottom: '4px' }}>$ constraints</p>
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                          {question.case_study.constraints.map((c: string, i: number) => (
                            <li key={i} style={{ marginBottom: '4px' }}>{c}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}

                {/* MCQ */}
                {(question.question_type === 'mcq' || question.question_type === 'case_study') &&
                  question.options && !showResult && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {question.options.map((opt: any) => (
                        <button
                          key={opt.id}
                          onClick={() => setSelectedAnswer(opt.id)}
                          style={{
                            padding: '16px',
                            textAlign: 'left',
                            background: selectedAnswer === opt.id ? 'var(--surface-card)' : 'var(--surface-soft)',
                            border: `1px solid ${selectedAnswer === opt.id ? 'var(--ink)' : 'var(--hairline)'}`,
                            borderRadius: '4px',
                            fontSize: '16px',
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                            color: 'var(--ink)',
                            lineHeight: 1.5,
                          }}
                        >
                          {opt.text}
                        </button>
                      ))}
                    </div>
                  )}

                {/* MCQ result with color coding */}
                {(question.question_type === 'mcq' || question.question_type === 'case_study') &&
                  question.options && showResult && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {question.options.map((opt: any) => {
                        const isSelected = selectedAnswer === opt.id;
                        const isRight = Array.isArray(question.correct_answer)
                          ? question.correct_answer.includes(opt.id)
                          : question.correct_answer === opt.id;
                        let bg = 'var(--surface-soft)';
                        let border = 'var(--hairline)';
                        if (isRight) { bg = 'var(--canvas)'; border = 'var(--success)'; }
                        else if (isSelected && !isRight) { bg = 'var(--canvas)'; border = 'var(--danger)'; }
                        return (
                          <div
                            key={opt.id}
                            style={{
                              padding: '16px',
                              background: bg,
                              border: `1px solid ${border}`,
                              borderRadius: '4px',
                              fontSize: '16px',
                              color: 'var(--ink)',
                              lineHeight: 1.5,
                            }}
                          >
                            <div>{opt.text}</div>
                            {opt.explanation && (
                              <div style={{ fontSize: '13px', color: 'var(--stone)', marginTop: '8px' }}>
                                {opt.explanation}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                {/* Multi-select */}
                {question.question_type === 'multi_select' && question.options && !showResult && (
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--mute)', marginBottom: '12px' }}>
                      select all that apply
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {question.options.map((opt: any) => {
                        const selected = multiSelected.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            onClick={() => toggleMultiSelect(opt.id)}
                            style={{
                              padding: '16px',
                              textAlign: 'left',
                              background: selected ? 'var(--surface-card)' : 'var(--surface-soft)',
                              border: `1px solid ${selected ? 'var(--ink)' : 'var(--hairline)'}`,
                              borderRadius: '4px',
                              fontSize: '16px',
                              fontFamily: 'inherit',
                              cursor: 'pointer',
                              color: 'var(--ink)',
                              lineHeight: 1.5,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                            }}
                          >
                            <span
                              style={{
                                flexShrink: 0,
                                width: '16px',
                                height: '16px',
                                border: `1px solid ${selected ? 'var(--ink)' : 'var(--ash)'}`,
                                background: selected ? 'var(--ink)' : 'transparent',
                                borderRadius: '2px',
                                marginTop: '2px',
                              }}
                            />
                            {opt.text}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Ordering */}
                {question.question_type === 'ordering' && question.ordering_items && !showResult && (
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--mute)', marginBottom: '12px' }}>
                      arrange steps in the correct order
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {orderingState.map((itemId, idx) => {
                        const item = question.ordering_items.find((i: any) => i.id === itemId);
                        if (!item) return null;
                        return (
                          <div
                            key={itemId}
                            style={{
                              padding: '12px 16px',
                              background: 'var(--surface-soft)',
                              border: '1px solid var(--hairline)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                            }}
                          >
                            <span style={{ fontSize: '13px', color: 'var(--ash)', minWidth: '20px' }}>{idx + 1}.</span>
                            <span style={{ flex: 1, fontSize: '16px', color: 'var(--ink)' }}>{item.text}</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <button onClick={() => moveOrderItem(idx, -1)} disabled={idx === 0}
                                style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--ash)' : 'var(--mute)', fontFamily: 'inherit', fontSize: '12px', padding: '0 4px' }}>↑</button>
                              <button onClick={() => moveOrderItem(idx, 1)} disabled={idx === orderingState.length - 1}
                                style={{ background: 'none', border: 'none', cursor: idx === orderingState.length - 1 ? 'default' : 'pointer', color: idx === orderingState.length - 1 ? 'var(--ash)' : 'var(--mute)', fontFamily: 'inherit', fontSize: '12px', padding: '0 4px' }}>↓</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Matching */}
                {question.question_type === 'matching' && question.matching_pairs && !showResult && (
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--mute)', marginBottom: '12px' }}>
                      match each term to its description
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {question.matching_pairs.map((pair: any) => {
                        const allMatches = question.matching_pairs.map((p: any) => p.match);
                        return (
                          <div key={pair.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, padding: '12px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', fontSize: '14px', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.5 }}>
                              {pair.premise}
                            </div>
                            <select
                              value={matchingState[pair.id] || ''}
                              onChange={(e) => setMatchingState((prev) => ({ ...prev, [pair.id]: e.target.value }))}
                              style={{ flex: 2, padding: '12px', background: matchingState[pair.id] ? 'var(--canvas)' : 'var(--surface-soft)', border: `1px solid ${matchingState[pair.id] ? 'var(--ink)' : 'var(--hairline)'}`, borderRadius: '4px', fontSize: '14px', fontFamily: 'inherit', color: 'var(--ink)', cursor: 'pointer' }}
                            >
                              <option value="">-- select --</option>
                              {allMatches.map((m: string, i: number) => (
                                <option key={i} value={m}>{m.length > 80 ? m.substring(0, 80) + '...' : m}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sandbox */}
                {question.question_type === 'sandbox' && !showResult && (
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--mute)', marginBottom: '12px' }}>[&gt;] complete the code</p>
                    <div style={{ padding: '16px', background: 'var(--surface-dark)', color: 'var(--on-dark)', marginBottom: '16px', fontSize: '14px', lineHeight: 1.6, fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>
                      <span style={{ color: 'var(--ash)' }}>$ starter code{'\n'}</span>
                      {question.sandbox_starter_code}
                    </div>
                    <textarea
                      value={selectedAnswer || ''}
                      onChange={(e) => setSelectedAnswer(e.target.value)}
                      placeholder="# write your answer here..."
                      rows={5}
                      style={{ width: '100%', padding: '12px', background: 'var(--surface-soft)', color: 'var(--ink)', border: '1px solid var(--hairline)', borderRadius: '4px', fontSize: '14px', fontFamily: 'inherit', lineHeight: 1.6, resize: 'none', boxSizing: 'border-box' }}
                      onFocus={(e) => { e.target.style.background = 'var(--canvas)'; e.target.style.borderColor = 'var(--ink)'; }}
                      onBlur={(e) => { e.target.style.background = 'var(--surface-soft)'; e.target.style.borderColor = 'var(--hairline)'; }}
                    />
                  </div>
                )}
              </div>

              {/* Result */}
              {showResult && (
                <div
                  style={{
                    padding: '24px',
                    border: `1px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}`,
                    marginBottom: '24px',
                  }}
                >
                  <p style={{ fontSize: '16px', fontWeight: 700, color: isCorrect ? 'var(--success)' : 'var(--danger)', marginBottom: '12px' }}>
                    {isCorrect ? '[+] correct' : '[-] incorrect'}
                  </p>
                  <p style={{ fontSize: '16px', color: 'var(--body)', lineHeight: 1.6, margin: 0 }}>
                    {question.explanation}
                  </p>
                  {question.official_doc_url && (
                    <p style={{ fontSize: '14px', color: 'var(--mute)', marginTop: '12px', marginBottom: 0 }}>
                      [&gt;]{' '}
                      <a href={question.official_doc_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
                        official reference →
                      </a>
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                {!showResult ? (
                  <button
                    onClick={handleSubmit}
                    disabled={
                      submitting ||
                      ((question.question_type === 'mcq' || question.question_type === 'case_study') && !selectedAnswer) ||
                      (question.question_type === 'multi_select' && multiSelected.length === 0)
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
                      opacity: submitting || ((question.question_type === 'mcq' || question.question_type === 'case_study') && !selectedAnswer) ? 0.4 : 1,
                    }}
                  >
                    {submitting ? 'checking...' : 'submit →'}
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
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
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-deep)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ink)')}
                  >
                    {currentIdx + 1 < filteredQuestions.length ? 'next question →' : 'restart →'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '96px 32px' }}>
        <div className="animate-pulse" style={{ height: '200px', background: 'var(--surface-card)' }} />
      </div>
    }>
      <PracticeContent />
    </Suspense>
  );
}

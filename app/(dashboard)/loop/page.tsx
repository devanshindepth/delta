'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

type View = 'overview' | 'learn' | 'question' | 'result';

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

function fetchTeachContent(objectiveId: string, force: boolean): Promise<TeachResponse> {
  const requestKey = `${objectiveId}:${force ? 'force' : 'normal'}`;
  const existing = inflightTeachRequests.get(requestKey);
  if (existing) return existing;

  const request = fetch(`/api/objectives/${objectiveId}/teach${force ? '?force=true' : ''}`)
    .then((res) => res.json() as Promise<TeachResponse>)
    .finally(() => {
      if (inflightTeachRequests.get(requestKey) === request) {
        inflightTeachRequests.delete(requestKey);
      }
    });

  inflightTeachRequests.set(requestKey, request);
  return request;
}

function LoopContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const certId = searchParams.get('cert') || 'cert-azure-ai103';

  const [cert, setCert] = useState<any>(null);
  const [objectives, setObjectives] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [view, setView] = useState<View>('overview');
  const [question, setQuestion] = useState<any>(null);
  const [teachContent, setTeachContent] = useState<any>(null);
  const [teachLoading, setTeachLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
  const [orderingState, setOrderingState] = useState<string[]>([]);
  const [matchingState, setMatchingState] = useState<Record<string, string>>({});
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<any>(null);
  const [hasQuestion, setHasQuestion] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [certRes, objRes, alertRes, statsRes] = await Promise.all([
          fetch(`/api/certifications/${certId}`),
          fetch(`/api/certifications/${certId}/objectives`),
          fetch(`/api/alerts`),
          fetch(`/api/certifications/${certId}/stats`),
        ]);
        const [certData, objData, alertData, statsData] = await Promise.all([
          certRes.json(),
          objRes.json(),
          alertRes.json(),
          statsRes.json(),
        ]);

        if (certData.success) setCert(certData.data);
        if (objData.success && objData.data.length > 0) {
          setObjectives(objData.data);
          const firstUnmastered = objData.data.findIndex(
            (o: any) => !o.progress || o.progress.status !== 'mastered'
          );
          setCurrentIdx(firstUnmastered >= 0 ? firstUnmastered : 0);
        }
        if (alertData.success) {
          setAlerts(alertData.data.filter((a: any) => !a.is_read));
        }
        if (statsData.success) setStats(statsData.data);
      } catch (err) {
        console.error('[loop] load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [certId]);

  // Reset question/teach state when objective changes
  useEffect(() => {
    setView('learn');
    setQuestion(null);
    setTeachContent(null);
    setSelectedAnswer(null);
    setMultiSelected([]);
    setIsCorrect(null);
    setHasQuestion(null);
  }, [currentIdx]);

  const [teachError, setTeachError] = useState<{
    message: string;
    sourceUrl?: string;
    reason?: string;
    statusLabel?: string;
  } | null>(null);

  // Sequence counter for "latest wins" when switching objectives
  const teachSeqRef = useRef(0);

  // Load teaching content for the current objective
  const loadTeachContent = useCallback(async (objectiveId: string, force: boolean = false) => {
    const seq = ++teachSeqRef.current;

    setTeachLoading(true);
    setTeachError(null);
    try {
      const data = await fetchTeachContent(objectiveId, force);
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
      console.error('[loop] loadTeachContent error:', err);
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

  // Load a question for the objective
  const loadQuestion = useCallback(async (objectiveId: string) => {
    setQuestionLoading(true);
    try {
      const res = await fetch(`/api/objectives/${objectiveId}/question`);
      const data = await res.json();
      if (data.success && data.data) {
        const q = data.data;
        setQuestion(q);
        setSelectedAnswer(null);
        setMultiSelected([]);
        setIsCorrect(null);
        setHasQuestion(true);

        if (q.question_type === 'ordering' && q.ordering_items?.length > 0) {
          setOrderingState(
            [...q.ordering_items].sort(() => Math.random() - 0.5).map((i: any) => i.id)
          );
        } else {
          setOrderingState([]);
        }
        if (q.question_type === 'matching') {
          setMatchingState({});
        }
        setView('question');
      } else {
        setHasQuestion(false);
        setCurrentIdx((prev) => {
          const next = prev + 1;
          return next < objectives.length ? next : prev;
        });
      }
    } catch (err) {
      console.error('[loop] loadQuestion error:', err);
      setHasQuestion(false);
    } finally {
      setQuestionLoading(false);
    }
  }, [objectives.length]);

  useEffect(() => {
    if (!loading && hasQuestion === false && objectives.length > 0) {
      if (currentIdx >= objectives.length - 1) {
        router.push(`/certifications/${certId}`);
      }
    }
  }, [hasQuestion, currentIdx, objectives.length, loading, router, certId]);

  // When we enter the learn view for a specific objective, load teach content
  useEffect(() => {
    if (view === 'learn' && objectives[currentIdx] && !teachContent && !teachLoading) {
      loadTeachContent(objectives[currentIdx].id);
    }
  }, [view, currentIdx, objectives, teachContent, teachLoading, loadTeachContent]);

  function handleStartLoop() {
    setView('learn');
  }

  function handleContinueToQuestion() {
    const obj = objectives[currentIdx];
    if (obj) loadQuestion(obj.id);
  }

  function moveToNext() {
    setCurrentIdx((prev) => {
      const next = prev + 1;
      if (next < objectives.length) return next;
      router.push(`/certifications/${certId}`);
      return prev;
    });
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
      setIsCorrect(data.data?.isCorrect ?? false);
      setView('result');
      fetch(`/api/certifications/${certId}/stats`)
        .then((r) => r.json())
        .then((s) => { if (s.success) setStats(s.data); })
        .catch(() => {});
    } catch (err) {
      setIsCorrect(false);
      setView('result');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMultiSelect(optId: string) {
    setMultiSelected((prev) =>
      prev.includes(optId) ? prev.filter((x) => x !== optId) : [...prev, optId]
    );
  }

  function moveOrderItem(idx: number, direction: -1 | 1) {
    setOrderingState((prev) => {
      const next = [...prev];
      const swap = idx + direction;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '96px 32px' }}>
        <div style={{ marginBottom: '12px' }}>
          <div className="animate-pulse" style={{ height: '20px', width: '180px', background: 'var(--surface-card)', marginBottom: '16px' }} />
          <div className="animate-pulse" style={{ height: '48px', width: '480px', background: 'var(--surface-card)', marginBottom: '12px' }} />
          <div className="animate-pulse" style={{ height: '20px', width: '320px', background: 'var(--surface-card)' }} />
        </div>
        <div style={{ height: '1px', background: 'var(--hairline)', margin: '32px 0 48px' }} />
        <div className="animate-pulse" style={{ height: '160px', background: 'var(--surface-card)' }} />
      </div>
    );
  }

  if (objectives.length === 0) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '96px 32px' }}>
        <p style={{ fontSize: '14px', color: 'var(--mute)', marginBottom: '24px' }}>[~] {certId}</p>
        <p style={{ fontSize: '16px', color: 'var(--mute)' }}>[-] no objectives found for this certification</p>
      </div>
    );
  }

  const objective = objectives[currentIdx];
  if (!objective) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '96px 32px', textAlign: 'center' }}>
        <p style={{ fontSize: '38px', fontWeight: 700, color: 'var(--ink)', marginBottom: '16px' }}>all objectives complete</p>
        <p style={{ fontSize: '16px', color: 'var(--body)', marginBottom: '32px' }}>[+] you have cycled through every objective in this certification.</p>
        <button
          onClick={() => router.push(`/certifications/${certId}`)}
          style={{ padding: '4px 20px', height: '36px', background: 'var(--ink)', color: 'var(--canvas)', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', lineHeight: 2 }}
        >
          view progress →
        </button>
      </div>
    );
  }

  const totalObj = objectives.length;
  const masteredObj = objectives.filter((o) => o.progress?.status === 'mastered').length;
  const readiness = stats?.readinessScore ?? 0;

  // Group objectives by domain for the overview
  const domainGroups: Record<string, { title: string; code: string; objectives: any[] }> = {};
  for (const obj of objectives) {
    const key = obj.domain_code || 'General';
    if (!domainGroups[key]) {
      domainGroups[key] = { title: obj.domain_title || key, code: key, objectives: [] };
    }
    domainGroups[key].objectives.push(obj);
  }

  // ── OVERVIEW VIEW ────────────────────────────────────────────────────────
  if (view === 'overview') {
    return (
      <div style={{ maxWidth: '720px', width: '100%', margin: '0 auto', padding: '96px 32px' }}>
        {/* Header */}
        <div style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '32px', marginBottom: '48px' }}>
          <p style={{ fontSize: '14px', color: 'var(--mute)', marginBottom: '12px', lineHeight: 2 }}>
            [~] {cert?.code || certId} · course overview
          </p>
          <h1 style={{ fontSize: '38px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
            {cert?.title || certId}
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--body)', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            {cert?.description || 'Prepare for this certification with a structured learning loop.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', padding: '2px 8px', border: `1px solid ${readiness >= 80 ? 'var(--success)' : readiness >= 40 ? 'var(--warning)' : 'var(--hairline)'}`, color: readiness >= 80 ? 'var(--success)' : readiness >= 40 ? 'var(--warning)' : 'var(--mute)', borderRadius: '4px' }}>
              {readiness}% ready
            </span>
            <span style={{ fontSize: '14px', color: 'var(--stone)' }}>
              {masteredObj}/{totalObj} objectives mastered
            </span>
            <span style={{ color: 'var(--hairline-strong)' }}>·</span>
            <span style={{ fontSize: '14px', color: 'var(--stone)' }}>
              {totalObj} objectives across {Object.keys(domainGroups).length} domains
            </span>
          </div>
        </div>

        {/* Alerts */}
        {alerts.filter((a) => !dismissedAlerts.has(a.id)).slice(0, 2).map((alert) => (
          <div key={alert.id} style={{ marginBottom: '16px', padding: '12px 16px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '13px', color: alert.alert_type === 'deprecated' ? 'var(--danger)' : alert.alert_type === 'updated' ? 'var(--warning)' : 'var(--success)', marginRight: '8px' }}>
                {alert.alert_type === 'deprecated' ? '[-]' : alert.alert_type === 'updated' ? '[~]' : '[+]'}
              </span>
              <span style={{ fontSize: '14px', color: 'var(--ink)' }}>{alert.title}</span>
            </div>
            <button onClick={() => setDismissedAlerts((s) => new Set(s).add(alert.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ash)', fontSize: '14px', fontFamily: 'inherit', flexShrink: 0 }}>[×]</button>
          </div>
        ))}

        {/* Course syllabus */}
        <div style={{ marginBottom: '48px' }}>
          {Object.entries(domainGroups).map(([domainCode, domain]) => {
            const domainMastered = domain.objectives.filter((o) => o.progress?.status === 'mastered').length;
            const domainInProgress = domain.objectives.filter((o) => o.progress?.status === 'in_progress').length;
            return (
              <div key={domainCode} style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--hairline)', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>
                    {domain.code}: {domain.title}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--stone)' }}>
                    {domainMastered}/{domain.objectives.length} mastered
                    {domainInProgress > 0 && ` · ${domainInProgress} in progress`}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {domain.objectives.map((obj, idx) => {
                    const globalIdx = objectives.findIndex((o) => o.id === obj.id);
                    const status = obj.progress?.status;
                    const isCurrent = globalIdx === currentIdx;
                    const statusColor = status === 'mastered' ? 'var(--success)' : status === 'in_progress' ? 'var(--warning)' : 'var(--ash)';
                    const statusLabel = status === 'mastered' ? '[+]' : status === 'in_progress' ? '[~]' : '[ ]';
                    return (
                      <div
                        key={obj.id}
                        style={{
                          borderBottom: '1px solid var(--hairline)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          background: isCurrent ? 'var(--surface-soft)' : 'transparent',
                          margin: isCurrent ? '0 -12px' : '0',
                          padding: isCurrent ? '10px 12px' : '10px 0',
                        }}
                      >
                        <span style={{ fontSize: '13px', color: statusColor, flexShrink: 0, marginTop: '2px', minWidth: '24px' }}>
                          {statusLabel}
                        </span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '14px', color: isCurrent ? 'var(--ink)' : 'var(--body)', fontWeight: isCurrent ? 500 : 400, lineHeight: 1.5 }}>
                            {obj.objective_code}. {obj.title}
                          </span>
                          {isCurrent && (
                            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--mute)', border: '1px solid var(--hairline)', borderRadius: '4px', padding: '1px 6px' }}>
                              next up
                            </span>
                          )}
                          {obj.importance === 'critical' && (
                            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '4px', padding: '1px 6px' }}>
                              critical
                            </span>
                          )}
                        </div>
                        {obj.progress && (
                          <span style={{ fontSize: '13px', color: 'var(--stone)', flexShrink: 0 }}>
                            {Math.round((obj.progress.mastery_score || 0) * 100)}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handleStartLoop}
            style={{ padding: '4px 20px', height: '36px', background: 'var(--ink)', color: 'var(--canvas)', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', lineHeight: 2 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-deep)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ink)')}
          >
            {masteredObj > 0 ? 'continue loop →' : 'start learning →'}
          </button>
          <button
            onClick={() => router.push(`/practice?cert=${certId}`)}
            style={{ padding: '4px 12px', height: '32px', background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--hairline-strong)', borderRadius: '4px', fontSize: '16px', fontFamily: 'inherit', cursor: 'pointer', lineHeight: 2 }}
          >
            jump to practice →
          </button>
        </div>
      </div>
    );
  }

  // ── LEARN VIEW ───────────────────────────────────────────────────────────
  if (view === 'learn') {
    return (
      <div style={{ maxWidth: '720px', width: '100%', margin: '0 auto', padding: '96px 32px' }}>
        {/* Progress header */}
        <div style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '32px', marginBottom: '48px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '16px' }}>
            <p style={{ fontSize: '14px', color: 'var(--mute)', lineHeight: 2, margin: 0 }}>
              [~] {cert?.code || certId} · {objective.domain_code} · {objective.objective_code}
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '13px', padding: '2px 8px', border: `1px solid ${readiness >= 80 ? 'var(--success)' : readiness >= 40 ? 'var(--warning)' : 'var(--hairline)'}`, color: readiness >= 80 ? 'var(--success)' : readiness >= 40 ? 'var(--warning)' : 'var(--mute)', borderRadius: '4px' }}>
                {readiness}% ready
              </span>
              <span style={{ fontSize: '13px', color: 'var(--stone)' }}>{currentIdx + 1}/{totalObj}</span>
            </div>
          </div>
          <h1 style={{ fontSize: '38px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
            {objective.title}
          </h1>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {objective.importance === 'critical' && (
              <span style={{ fontSize: '13px', padding: '2px 8px', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '4px' }}>critical</span>
            )}
            <span style={{ fontSize: '13px', padding: '2px 8px', border: '1px solid var(--hairline)', color: 'var(--stone)', borderRadius: '4px' }}>
              {objective.domain_code}: {objective.domain_title}
            </span>
          </div>
        </div>

        {/* Teaching content */}
        {teachLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse" style={{ height: i === 1 ? '80px' : '60px', background: 'var(--surface-card)', borderRadius: '4px' }} />
            ))}
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
              marginBottom: '32px',
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
                <span>{teachError.message || "We couldn't verify enough information from the official documentation to create a reliable lesson."}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => loadTeachContent(objective.id, true)}
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
            </div>
          </div>
        ) : teachContent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginBottom: '32px' }}>

            {/* What it is */}
            <div style={{ padding: '24px 0', borderBottom: '1px solid var(--hairline)' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginBottom: '12px', letterSpacing: '0.05em' }}>[+] what it is</p>
              {Array.isArray(teachContent.what_it_is) ? (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {teachContent.what_it_is.map((item: string, i: number) => (
                    <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '15px', color: 'var(--body)', lineHeight: 1.6, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--ink)', fontWeight: 700, flexShrink: 0 }}>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: '16px', color: 'var(--body)', lineHeight: 1.7, margin: 0 }}>
                  {teachContent.what_it_is}
                </p>
              )}
            </div>

            {/* Analogy */}
            {teachContent.analogy && (
              <div style={{ padding: '24px 0', borderBottom: '1px solid var(--hairline)' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginBottom: '12px', letterSpacing: '0.05em' }}>[~] think of it like this</p>
                <div style={{ padding: '16px', background: 'var(--surface-dark)', color: 'var(--on-dark)', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--ash)', marginRight: '8px' }}>$</span>
                  <span style={{ fontSize: '15px', lineHeight: 1.6 }}>{teachContent.analogy}</span>
                </div>
              </div>
            )}

            {/* Why it exists */}
            {teachContent.why_it_exists && (
              <div style={{ padding: '24px 0', borderBottom: '1px solid var(--hairline)' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginBottom: '12px', letterSpacing: '0.05em' }}>[&gt;] why it exists</p>
                {Array.isArray(teachContent.why_it_exists) ? (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {teachContent.why_it_exists.map((item: string, i: number) => (
                      <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '15px', color: 'var(--body)', lineHeight: 1.6, alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--ink)', fontWeight: 700, flexShrink: 0 }}>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: '16px', color: 'var(--body)', lineHeight: 1.7, margin: 0 }}>
                    {teachContent.why_it_exists}
                  </p>
                )}
              </div>
            )}

            {/* How it works */}
            {teachContent.how_it_works && (
              <div style={{ padding: '24px 0', borderBottom: '1px solid var(--hairline)' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginBottom: '12px', letterSpacing: '0.05em' }}>[#] how it works</p>
                {Array.isArray(teachContent.how_it_works) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {teachContent.how_it_works.map((step: string, idx: number) => (
                      <div key={idx} style={{ display: 'flex', gap: '12px', fontSize: '15px', color: 'var(--body)', lineHeight: 1.6, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink)', padding: '1px 6px', background: 'var(--canvas)', border: '1px solid var(--hairline-strong)', borderRadius: '3px', flexShrink: 0, marginTop: '2px' }}>
                          0{idx + 1}
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '16px', color: 'var(--body)', lineHeight: 1.7, margin: 0 }}>
                    {teachContent.how_it_works}
                  </p>
                )}
              </div>
            )}

            {/* Key concepts */}
            {teachContent.key_concepts && teachContent.key_concepts.length > 0 && (
              <div style={{ padding: '24px 0', borderBottom: '1px solid var(--hairline)' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginBottom: '16px', letterSpacing: '0.05em' }}>[*] key concepts</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {teachContent.key_concepts.map((kc: any, i: number) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '16px', alignItems: 'baseline', paddingBottom: '10px', borderBottom: i < teachContent.key_concepts.length - 1 ? '1px dashed var(--hairline)' : 'none' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', wordBreak: 'break-word' }}>
                        {kc.term}
                      </span>
                      <span style={{ fontSize: '14px', color: 'var(--body)', lineHeight: 1.6 }}>
                        {kc.definition}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Common mistakes */}
            {teachContent.common_mistakes && teachContent.common_mistakes.length > 0 && (
              <div style={{ padding: '24px 0', borderBottom: '1px solid var(--hairline)' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginBottom: '12px', letterSpacing: '0.05em' }}>[-] common mistakes</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(Array.isArray(teachContent.common_mistakes) ? teachContent.common_mistakes : [teachContent.common_mistakes]).map((m: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--ink)', fontWeight: 700, flexShrink: 0, fontSize: '14px' }}>×</span>
                      <span style={{ fontSize: '14px', color: 'var(--body)', lineHeight: 1.6 }}>{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exam tip */}
            {teachContent.exam_tip && (
              <div style={{ padding: '24px 0' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginBottom: '12px', letterSpacing: '0.05em' }}>[?] key exam point</p>
                <div style={{ padding: '16px', border: '1px solid var(--hairline-strong)', background: 'var(--surface-soft)', borderRadius: '4px' }}>
                  <p style={{ fontSize: '15px', color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>
                    {teachContent.exam_tip}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '24px 0', borderBottom: '1px solid var(--hairline)', marginBottom: '32px' }}>
            <p style={{ fontSize: '16px', color: 'var(--body)', lineHeight: 1.7 }}>{objective.description}</p>
          </div>
        )}

        {/* Freshness warning */}
        {objective.freshness_status !== 'current' && (
          <div style={{ padding: '12px 16px', border: '1px solid var(--warning)', marginBottom: '24px' }}>
            <span style={{ fontSize: '14px', color: 'var(--warning)' }}>
              [~] {objective.freshness_status === 'confirmed_outdated' ? 'this objective covers deprecated services — review the updated approach' : 'this objective may reference services that have been updated'}
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => setView('overview')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--mute)', fontFamily: 'inherit', padding: 0 }}
          >
            ← course overview
          </button>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={handleContinueToQuestion}
              disabled={questionLoading}
              style={{ background: 'none', border: 'none', cursor: questionLoading ? 'wait' : 'pointer', fontSize: '14px', color: 'var(--mute)', fontFamily: 'inherit', padding: 0, opacity: questionLoading ? 0.5 : 1 }}
            >
              [&gt;] i know this — skip to check
            </button>
            <button
              onClick={handleContinueToQuestion}
              disabled={questionLoading}
              style={{ padding: '4px 20px', height: '36px', background: 'var(--ink)', color: 'var(--canvas)', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 500, fontFamily: 'inherit', cursor: questionLoading ? 'wait' : 'pointer', lineHeight: 2, opacity: questionLoading ? 0.6 : 1 }}
              onMouseEnter={(e) => { if (!questionLoading) e.currentTarget.style.background = 'var(--ink-deep)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ink)'; }}
            >
              {questionLoading ? 'loading...' : 'test my knowledge →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── QUESTION VIEW ────────────────────────────────────────────────────────
  if (view === 'question' && question) {
    return (
      <div style={{ maxWidth: '720px', width: '100%', margin: '0 auto', padding: '96px 32px' }}>
        {/* Progress header */}
        <div style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '14px', color: 'var(--mute)', lineHeight: 2, margin: 0 }}>
              [?] {cert?.code} · {objective.domain_code} · {objective.objective_code}
            </p>
            <span style={{ fontSize: '13px', color: 'var(--stone)' }}>{currentIdx + 1}/{totalObj}</span>
          </div>
          <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--ink)', margin: 0 }}>{objective.title}</p>
        </div>

        <div style={{ padding: '24px', background: 'var(--canvas)', border: '1px solid var(--hairline-strong)', marginBottom: '24px' }}>
          <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.6, margin: '0 0 24px 0' }}>
            {question.stem}
          </p>

          {/* Case study */}
          {question.question_type === 'case_study' && question.case_study && (
            <div style={{ padding: '16px', background: 'var(--surface-dark)', color: 'var(--on-dark)', marginBottom: '24px', fontSize: '14px', lineHeight: 1.6 }}>
              <p style={{ color: 'var(--ash)', marginBottom: '8px', margin: '0 0 8px 0' }}>$ scenario</p>
              <p style={{ margin: '0 0 12px 0' }}>{question.case_study.background}</p>
              {question.case_study.technical_requirements?.length > 0 && (
                <>
                  <p style={{ color: 'var(--ash)', margin: '0 0 4px 0' }}>$ requirements</p>
                  <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px' }}>
                    {question.case_study.technical_requirements.map((r: string, i: number) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{r}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* MCQ */}
          {(question.question_type === 'mcq' || question.question_type === 'case_study') && question.options?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {question.options.map((opt: any) => (
                <button key={opt.id} onClick={() => setSelectedAnswer(opt.id)}
                  style={{ padding: '16px', textAlign: 'left', background: selectedAnswer === opt.id ? 'var(--surface-card)' : 'var(--surface-soft)', border: `1px solid ${selectedAnswer === opt.id ? 'var(--ink)' : 'var(--hairline)'}`, borderRadius: '4px', fontSize: '16px', fontFamily: 'inherit', cursor: 'pointer', color: 'var(--ink)', lineHeight: 1.5 }}>
                  {opt.text}
                </button>
              ))}
            </div>
          )}

          {/* Multi-select */}
          {question.question_type === 'multi_select' && question.options?.length > 0 && (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--mute)', marginBottom: '12px' }}>select all that apply</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {question.options.map((opt: any) => {
                  const sel = multiSelected.includes(opt.id);
                  return (
                    <button key={opt.id} onClick={() => toggleMultiSelect(opt.id)}
                      style={{ padding: '16px', textAlign: 'left', background: sel ? 'var(--surface-card)' : 'var(--surface-soft)', border: `1px solid ${sel ? 'var(--ink)' : 'var(--hairline)'}`, borderRadius: '4px', fontSize: '16px', fontFamily: 'inherit', cursor: 'pointer', color: 'var(--ink)', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <span style={{ flexShrink: 0, width: '16px', height: '16px', border: `1px solid ${sel ? 'var(--ink)' : 'var(--ash)'}`, background: sel ? 'var(--ink)' : 'transparent', borderRadius: '2px', marginTop: '2px', display: 'inline-block' }} />
                      {opt.text}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ordering */}
          {question.question_type === 'ordering' && question.ordering_items?.length > 0 && (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--mute)', marginBottom: '12px' }}>arrange in the correct order</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {orderingState.map((itemId, idx) => {
                  const item = question.ordering_items.find((i: any) => i.id === itemId);
                  if (!item) return null;
                  return (
                    <div key={itemId} style={{ padding: '12px 16px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--ash)', minWidth: '20px' }}>{idx + 1}.</span>
                      <span style={{ flex: 1, fontSize: '14px', color: 'var(--ink)', lineHeight: 1.5 }}>{item.text}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <button onClick={() => moveOrderItem(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--ash)' : 'var(--mute)', fontFamily: 'inherit', fontSize: '12px', padding: '2px 4px' }}>↑</button>
                        <button onClick={() => moveOrderItem(idx, 1)} disabled={idx === orderingState.length - 1} style={{ background: 'none', border: 'none', cursor: idx === orderingState.length - 1 ? 'default' : 'pointer', color: idx === orderingState.length - 1 ? 'var(--ash)' : 'var(--mute)', fontFamily: 'inherit', fontSize: '12px', padding: '2px 4px' }}>↓</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matching */}
          {question.question_type === 'matching' && question.matching_pairs?.length > 0 && (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--mute)', marginBottom: '12px' }}>match each term to its description</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {question.matching_pairs.map((pair: any) => {
                  const allMatches = question.matching_pairs.map((p: any) => p.match);
                  return (
                    <div key={pair.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ flex: '0 0 160px', padding: '12px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.5 }}>{pair.premise}</div>
                      <select value={matchingState[pair.id] || ''} onChange={(e) => setMatchingState((prev) => ({ ...prev, [pair.id]: e.target.value }))}
                        style={{ flex: 1, padding: '12px', background: matchingState[pair.id] ? 'var(--canvas)' : 'var(--surface-soft)', border: `1px solid ${matchingState[pair.id] ? 'var(--ink)' : 'var(--hairline)'}`, borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', color: 'var(--ink)', cursor: 'pointer' }}>
                        <option value="">-- select --</option>
                        {allMatches.map((m: string, i: number) => <option key={i} value={m}>{m.length > 90 ? m.slice(0, 90) + '...' : m}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sandbox */}
          {question.question_type === 'sandbox' && (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--mute)', marginBottom: '12px' }}>[&gt;] complete the code</p>
              {question.sandbox_starter_code && (
                <div style={{ padding: '16px', background: 'var(--surface-dark)', color: 'var(--on-dark)', marginBottom: '16px', fontSize: '13px', lineHeight: 1.6, fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>
                  <span style={{ color: 'var(--ash)' }}>$ starter code{'\n'}</span>
                  {question.sandbox_starter_code}
                </div>
              )}
              <textarea value={selectedAnswer || ''} onChange={(e) => setSelectedAnswer(e.target.value)} placeholder="# write your answer here..." rows={5}
                style={{ width: '100%', padding: '12px', background: 'var(--surface-soft)', color: 'var(--ink)', border: '1px solid var(--hairline)', borderRadius: '4px', fontSize: '14px', fontFamily: 'inherit', lineHeight: 1.6, resize: 'none', boxSizing: 'border-box' }} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setView('learn')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--mute)', fontFamily: 'inherit', padding: 0 }}>
            ← review material
          </button>
          {(() => {
            const isMissingAnswer =
              ((question.question_type === 'mcq' || question.question_type === 'case_study') && !selectedAnswer) ||
              (question.question_type === 'multi_select' && multiSelected.length === 0) ||
              (question.question_type === 'matching' && Object.keys(matchingState).length < (question.matching_pairs?.length ?? 0));
            const isDisabled = submitting || isMissingAnswer;
            return (
              <button onClick={handleSubmit} disabled={isDisabled}
                style={{ padding: '4px 20px', height: '36px', background: 'var(--ink)', color: 'var(--canvas)', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 500, fontFamily: 'inherit', cursor: isDisabled ? 'not-allowed' : 'pointer', lineHeight: 2, opacity: isDisabled ? 0.4 : 1 }}
                onMouseEnter={(e) => { if (!isDisabled) e.currentTarget.style.background = 'var(--ink-deep)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ink)'; }}
              >
                {submitting ? 'checking...' : 'submit →'}
              </button>
            );
          })()}
        </div>
      </div>
    );
  }

  // ── RESULT VIEW ──────────────────────────────────────────────────────────
  if (view === 'result') {
    return (
      <div style={{ maxWidth: '720px', width: '100%', margin: '0 auto', padding: '96px 32px' }}>
        {/* Progress header */}
        <div style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '14px', color: 'var(--mute)', lineHeight: 2, margin: 0 }}>
              {isCorrect ? '[+]' : '[-]'} {cert?.code} · {objective.domain_code} · {objective.objective_code}
            </p>
            <span style={{ fontSize: '13px', color: 'var(--stone)' }}>{currentIdx + 1}/{totalObj}</span>
          </div>
          <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--ink)', margin: 0 }}>{objective.title}</p>
        </div>

        <div style={{ padding: '24px', border: `1px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}`, marginBottom: '24px' }}>
          <p style={{ fontSize: '16px', fontWeight: 700, color: isCorrect ? 'var(--success)' : 'var(--danger)', marginBottom: '12px' }}>
            {isCorrect ? '[+] correct' : '[-] incorrect'}
          </p>
          <p style={{ fontSize: '16px', color: 'var(--body)', lineHeight: 1.6, margin: 0 }}>
            {question?.explanation}
          </p>
        </div>

        {question?.official_doc_url && (
          <div style={{ marginBottom: '24px', padding: '12px 16px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)' }}>
            <p style={{ fontSize: '14px', color: 'var(--mute)', margin: 0 }}>
              [&gt;] official reference:{' '}
              <a href={question.official_doc_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
                {(() => { try { return new URL(question.official_doc_url).hostname; } catch { return 'docs'; } })()} →
              </a>
            </p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {!isCorrect && (
            <button onClick={() => setView('learn')} style={{ padding: '4px 12px', height: '32px', background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--hairline-strong)', borderRadius: '4px', fontSize: '16px', fontFamily: 'inherit', cursor: 'pointer', lineHeight: 2 }}>
              review material
            </button>
          )}
          <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
            <button onClick={() => setView('overview')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--mute)', fontFamily: 'inherit', padding: 0 }}>
              course overview
            </button>
            <button onClick={moveToNext}
              style={{ padding: '4px 20px', height: '36px', background: 'var(--ink)', color: 'var(--canvas)', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', lineHeight: 2 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-deep)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ink)')}
            >
              {currentIdx + 1 < totalObj ? 'next objective →' : 'view progress →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function LoopPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '96px 32px' }}>
        <div className="animate-pulse" style={{ height: '200px', background: 'var(--surface-card)' }} />
      </div>
    }>
      <LoopContent />
    </Suspense>
  );
}

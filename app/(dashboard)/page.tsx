'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─── StickyNote ────────────────────────────────────────────────────────────────
// Positions are expressed as percentages of the note-zone container so notes
// scale with viewport. Hidden below 1024 px via a <style> tag in globals.css
// (see .notes-zone media query added below the component).

interface NoteConfig {
  lines: string[];
  rotate: number;
  /** % from left edge of container */
  leftPct: number;
  /** % from top edge of container  */
  topPct: number;
}

function StickyNote({ lines, rotate: initRotate, leftPct, topPct }: NoteConfig) {
  const NOTE_W = 200;
  const zoneRef = useRef<HTMLDivElement>(null);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [rotate, setRotate] = useState(initRotate);
  const [dragging, setDragging] = useState(false);
  const [z, setZ] = useState(10);
  const drag = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  // Resolve % → px once (and on resize, only if not yet dragged)
  const dragged = useRef(false);
  useEffect(() => {
    const resolve = () => {
      if (dragged.current) return;
      const el = zoneRef.current?.closest('.notes-zone') as HTMLElement | null;
      if (!el) return;
      setPos({
        x: (leftPct / 100) * el.offsetWidth,
        y: (topPct / 100) * el.offsetHeight,
      });
    };
    resolve();
    window.addEventListener('resize', resolve);
    return () => window.removeEventListener('resize', resolve);
  }, [leftPct, topPct]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!pos) return;
    e.preventDefault();
    dragged.current = true;
    setDragging(true);
    setZ(100);
    setRotate(r => r + (Math.random() * 2 - 1));
    drag.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      if (!drag.current) return;
      setPos({ x: drag.current.px + e.clientX - drag.current.mx, y: drag.current.py + e.clientY - drag.current.my });
    };
    const up = () => { setDragging(false); setZ(10); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [dragging]);

  if (!pos) return <div ref={zoneRef} style={{ display: 'none' }} />;

  return (
    <div
      ref={zoneRef}
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        top: pos.y,
        left: pos.x,
        width: `${NOTE_W}px`,
        minHeight: '160px',
        background: '#201d1d',
        padding: '20px 18px',
        borderRadius: '2px',
        transform: `rotate(${rotate}deg)`,
        fontFamily: 'inherit',
        boxSizing: 'border-box',
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        zIndex: z,
        boxShadow: dragging ? '4px 8px 24px rgba(0,0,0,0.52)' : '2px 4px 14px rgba(0,0,0,0.32)',
        transition: dragging ? 'box-shadow 0.1s' : 'box-shadow 0.2s',
      }}
    >
      {/* tape */}
      <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', width: '48px', height: '22px', background: 'rgba(253,252,252,0.09)', borderRadius: '1px', borderBottom: '1px solid rgba(253,252,252,0.04)' }} />
      {/* pin */}
      <div style={{ position: 'absolute', top: '12px', right: '14px', width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(154,152,152,0.28)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)' }} />
      {/* ruled lines */}
      {[0,1,2,3,4].map(i => (
        <div key={i} style={{ position: 'absolute', left: '18px', right: '18px', top: `${52 + i * 26}px`, height: '1px', background: 'rgba(255, 255, 255, 0.71)' }} />
      ))}
      {/* text */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: '11px', color: '#fdfcfc', letterSpacing: '0.08em', marginBottom: '12px', borderBottom: '1px solid rgba(154,152,152,0.12)', paddingBottom: '8px' }}>
          {lines[0]}
        </div>
        {lines.slice(1).map((line, i) => (
          <div key={i} style={{ fontSize: '14px', fontWeight: line.startsWith('[') ? 500 : 400, color: '#fdfcfc', lineHeight: '26px' }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── HomePage ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateLogs, setUpdateLogs] = useState<string[]>([]);

  const fetchCerts = async () => {
    try {
      const res = await fetch('/api/certifications');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) setCerts(data.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCerts(); }, []);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setProcessing(true);
    setProcessingLogs(['[~] initializing generation...', '[~] connecting to Bright Data Scraper Studio...']);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setProcessingLogs(prev => [...prev, '[+] blueprint structured & objectives mapped', '[+] opening learning hub...']);
        await fetchCerts();
        setTimeout(() => { setProcessing(false); setQuery(''); router.push(`/prep?cert=${encodeURIComponent(data.data.id)}`); }, 1200);
      } else {
        setProcessingLogs(prev => [...prev, `[-] error: ${data.error || 'failed to generate'}`]);
        setTimeout(() => setProcessing(false), 3000);
      }
    } catch (err: any) {
      setProcessingLogs(prev => [...prev, `[-] error: ${err.message}`]);
      setTimeout(() => setProcessing(false), 3000);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (processing && processingLogs.length < 5) {
      interval = setInterval(() => {
        setProcessingLogs(prev => {
          if (prev.length === 2) return [...prev, '[$] analyzing exam requirements...'];
          if (prev.length === 3) return [...prev, '[$] scraping official blueprint live...'];
          if (prev.length === 4) return [...prev, '[$] synthesizing domains & question bank...'];
          return prev;
        });
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [processing, processingLogs.length]);

  const handleUpdate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (updatingId) return;
    setUpdatingId(id);
    setUpdateLogs(['[~] starting content update…']);
    try {
      const res = await fetch(`/api/certifications/${id}/update`, { method: 'POST' });
      if (!res.body) throw new Error('no stream body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split('\n').filter(l => l.trim())) {
          try {
            const ev = JSON.parse(line);
            if (ev.message) setUpdateLogs(prev => [...prev, ev.message]);
            if (ev.type === 'done') await fetchCerts();
          } catch { /* partial chunk */ }
        }
      }
    } catch (err: any) {
      setUpdateLogs(prev => [...prev, `[-] error: ${err.message}`]);
    } finally {
      setTimeout(() => { setUpdatingId(null); setUpdateLogs([]); }, 3000);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh' }}>

      {/* ── Note zone ─────────────────────────────────────────────────────────
          Height = 340px. Hidden on screens < 1024px via .notes-zone in globals.
          Notes are positioned as % of this container's width/height.

          Layout matches reference image:
            Top row  → left ~18%, center ~44%, right ~65%
            Mid row  → far-left ~1%,  far-right ~80%
      ──────────────────────────────────────────────────────────────────────── */}
      <div className="notes-zone" style={{ position: 'relative', width: '100%', height: '340px', overflow: 'visible' }}>

        {/* Top-left */}
        <StickyNote rotate={-6} leftPct={25} topPct={8}
          lines={['// what is delta', '[~] cert prep env', 'for engineers who', 'learn by doing']} />

        {/* Top-center */}
        <StickyNote rotate={-2} leftPct={44} topPct={40}
          lines={['// data source', '[+] bright data', 'scraper studio', 'live blueprints']} />

        {/* Top-right */}
        <StickyNote rotate={5} leftPct={65} topPct={4}
          lines={['// coverage', 'aws · azure · gcp', 'k8s · linux · sec', '+ any new cert']} />

        {/* Mid-left (partially off-screen) */}
        <StickyNote rotate={4} leftPct={10} topPct={52}
          lines={['// the loop', '[~] learn', '[?] understand', '[>] prove it']} />

        {/* Mid-right (partially off-screen) */}
        <StickyNote rotate={-4} leftPct={80} topPct={48}
          lines={['// why delta', '[+] first principles', '[+] updated syllabus', '[+] no stale guides']} />

      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '48px 32px 96px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Hero / Input */}
        <div style={{ width: '100%', maxWidth: '760px', marginBottom: '64px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '38px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px 0', lineHeight: 1.3 }}>
            What certification do you want to master?
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--body)', marginBottom: '32px', lineHeight: 1.5 }}>
            Describe your certification in plain language. Delta scrapes the official blueprint and builds your course.
          </p>

          {processing ? (
            <div style={{ textAlign: 'left', background: 'var(--surface-dark)', color: 'var(--on-dark)', padding: '24px', borderRadius: '4px', minHeight: '160px', fontFamily: 'inherit', fontSize: '14px', lineHeight: 1.6 }}>
              {processingLogs.map((log, i) => (
                <div key={i} style={{ marginBottom: '8px', color: log.startsWith('[-]') ? 'var(--danger)' : log.startsWith('[+]') ? 'var(--success)' : 'var(--on-dark)' }}>
                  {log}
                </div>
              ))}
              <div style={{ display: 'inline-block', width: '8px', animation: 'blink 1s step-end infinite' }}>_</div>
            </div>
          ) : (
            <form onSubmit={handleGenerate} style={{ position: 'relative' }}>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. AWS Solutions Architect, Azure AI Engineer, Certified Kubernetes Administrator..."
                style={{ width: '100%', fontSize: '16px', padding: '16px 110px 16px 20px', background: 'var(--surface-soft)', color: 'var(--ink)', border: '1px solid var(--hairline-strong)', borderRadius: '4px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                onFocus={e => { e.target.style.background = 'var(--canvas)'; e.target.style.borderColor = 'var(--ink)'; }}
                onBlur={e => { e.target.style.background = 'var(--surface-soft)'; e.target.style.borderColor = 'var(--hairline-strong)'; }}
              />
              <button
                type="submit"
                disabled={!query.trim()}
                style={{ position: 'absolute', right: '8px', top: '8px', bottom: '8px', padding: '0 20px', background: query.trim() ? 'var(--ink)' : 'var(--surface-card)', color: query.trim() ? 'var(--canvas)' : 'var(--ash)', border: 'none', borderRadius: '4px', fontSize: '15px', fontWeight: 500, fontFamily: 'inherit', cursor: query.trim() ? 'pointer' : 'not-allowed' }}
              >
                generate
              </button>
            </form>
          )}
        </div>

        {/* Update progress overlay */}
        {updatingId && (
          <div style={{ position: 'fixed', bottom: '32px', right: '32px', width: '420px', background: 'var(--surface-dark)', color: 'var(--on-dark)', padding: '20px 24px', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px', lineHeight: 1.6, zIndex: 1000, maxHeight: '320px', overflowY: 'auto', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
            <div style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--on-dark)', fontSize: '14px' }}>[~] updating course content</div>
            {updateLogs.map((log, i) => (
              <div key={i} style={{ marginBottom: '4px', color: log.startsWith('[-]') ? 'var(--danger)' : log.startsWith('[+]') ? 'var(--success)' : log.startsWith('[~]') ? 'var(--warning)' : 'var(--on-dark)' }}>
                {log}
              </div>
            ))}
            <div style={{ display: 'inline-block', width: '8px', animation: 'blink 1s step-end infinite', color: 'var(--on-dark)' }}>_</div>
          </div>
        )}

        {/* Cards grid */}
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--hairline)', paddingBottom: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
              [#] available & generated courses
            </h2>
            <span style={{ fontSize: '13px', color: 'var(--stone)' }}>{certs.length} certifications</span>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {[1,2,3].map(i => <div key={i} className="animate-pulse" style={{ height: '180px', background: 'var(--surface-card)', borderRadius: '4px' }} />)}
            </div>
          ) : certs.length === 0 ? (
            <p style={{ color: 'var(--mute)', fontSize: '16px' }}>[-] no certifications yet. type one above to build it.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {certs.map(cert => (
                <CertCard
                  key={cert.id}
                  cert={cert}
                  onClick={() => router.push(`/prep?cert=${encodeURIComponent(cert.id)}`)}
                  onUpdate={e => handleUpdate(e, cert.id)}
                  isUpdating={updatingId === cert.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CertCard ──────────────────────────────────────────────────────────────────

function CertCard({ cert, onClick, onUpdate, isUpdating }: {
  cert: any;
  onClick: () => void;
  onUpdate: (e: React.MouseEvent) => void;
  isUpdating: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ border: '1px solid var(--hairline)', borderRadius: '4px', padding: '24px', background: hovered ? 'var(--surface-soft)' : 'var(--canvas)', cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '180px', boxSizing: 'border-box', transition: 'background 0.15s, border-color 0.15s', borderColor: isUpdating ? 'var(--warning)' : hovered ? 'var(--ink)' : 'var(--hairline)', position: 'relative' }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {hovered && !isUpdating ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4, maxHeight: '40px' }} title={cert.title}>
              {cert.title}
            </span>
            <button
              onClick={onUpdate}
              style={{ padding: '4px 14px', background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--hairline-strong)', borderRadius: '4px', fontSize: '12px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', lineHeight: 1.5 }}
              onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.color = 'var(--canvas)'; }}
              onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.borderColor = 'var(--hairline-strong)'; e.currentTarget.style.background = 'var(--canvas)'; e.currentTarget.style.color = 'var(--ink)'; }}
            >
              [~] update content
            </button>
          </div>
        ) : isUpdating ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--warning)', fontWeight: 500 }}>[~] updating…</span>
            <span style={{ fontSize: '12px', color: 'var(--stone)' }}>scraping & enriching objectives</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.05em' }}>{cert.code}</span>
            <span style={{ fontSize: '13px', color: 'var(--mute)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cert.title}</span>
          </div>
        )}
      </div>
      <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: '10px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--stone)' }}>{cert.provider}</span>
        <span style={{ fontSize: '12px', color: 'var(--stone)' }}>{cert.level}</span>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);
  
  const fetchCerts = async () => {
    try {
      const res = await fetch('/api/certifications');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCerts(data.data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCerts();
  }, []);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    
    setProcessing(true);
    setProcessingLogs([
      "[~] initializing generation...", 
      "[~] connecting to Bright Data Scraper Studio..."
    ]);
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      const data = await res.json();
      if (data.success && data.data) {
        setProcessingLogs(prev => [
          ...prev, 
          "[+] successfully structured certification blueprint and objectives", 
          "[+] opening learning hub..."
        ]);
        
        await fetchCerts();
        setTimeout(() => {
          setProcessing(false);
          setQuery('');
          router.push(`/prep?cert=${encodeURIComponent(data.data.id)}`);
        }, 1200);
      } else {
        setProcessingLogs(prev => [...prev, `[-] error: ${data.error || 'Failed to generate'}`]);
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
          if (prev.length === 2) return [...prev, "[$] analyzing certification requirements with AI..."];
          if (prev.length === 3) return [...prev, "[$] scraping live official documentation and blueprint..."];
          if (prev.length === 4) return [...prev, "[$] synthesizing syllabus domains and exam question bank..."];
          return prev;
        });
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [processing, processingLogs.length]);

  const handleUpdate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/certifications/${id}/update`, { method: 'POST' });
      await fetchCerts();
    } catch (err) {}
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '96px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      {/* Hero / Input Section */}
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. AWS Solutions Architect, Azure AI Engineer, Certified Kubernetes Administrator..."
              style={{
                width: '100%',
                fontSize: '16px',
                padding: '16px 110px 16px 20px',
                background: 'var(--surface-soft)',
                color: 'var(--ink)',
                border: '1px solid var(--hairline-strong)',
                borderRadius: '4px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.target.style.background = 'var(--canvas)';
                e.target.style.borderColor = 'var(--ink)';
              }}
              onBlur={(e) => {
                e.target.style.background = 'var(--surface-soft)';
                e.target.style.borderColor = 'var(--hairline-strong)';
              }}
            />
            <button
              type="submit"
              disabled={!query.trim()}
              style={{
                position: 'absolute',
                right: '8px',
                top: '8px',
                bottom: '8px',
                padding: '0 20px',
                background: query.trim() ? 'var(--ink)' : 'var(--surface-card)',
                color: query.trim() ? 'var(--canvas)' : 'var(--ash)',
                border: 'none',
                borderRadius: '4px',
                fontSize: '15px',
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: query.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              generate
            </button>
          </form>
        )}
      </div>

      {/* Cards Grid Section */}
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--hairline)', paddingBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            [#] available & generated courses
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--stone)' }}>
            {certs.length} certifications
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse" style={{ height: '180px', background: 'var(--surface-card)', borderRadius: '4px' }} />
            ))}
          </div>
        ) : certs.length === 0 ? (
          <p style={{ color: 'var(--mute)', fontSize: '16px' }}>[-] no certifications generated yet. Type one above to build it.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {certs.map(cert => (
              <CertCard 
                key={cert.id} 
                cert={cert} 
                onClick={() => router.push(`/prep?cert=${encodeURIComponent(cert.id)}`)} 
                onUpdate={(e) => handleUpdate(e, cert.id)} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CertCard({ cert, onClick, onUpdate }: { cert: any, onClick: () => void, onUpdate: (e: React.MouseEvent) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: '1px solid var(--hairline)',
        borderRadius: '4px',
        padding: '24px',
        background: hovered ? 'var(--surface-soft)' : 'var(--canvas)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        height: '180px',
        boxSizing: 'border-box',
        transition: 'background 0.15s, border-color 0.15s',
        borderColor: hovered ? 'var(--ink)' : 'var(--hairline)',
        position: 'relative'
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {hovered ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
            <span 
              style={{ 
                fontSize: '14px', 
                fontWeight: 500, 
                color: 'var(--ink)', 
                display: '-webkit-box', 
                WebkitLineClamp: 2, 
                WebkitBoxOrient: 'vertical', 
                overflow: 'hidden',
                lineHeight: 1.4,
                maxHeight: '40px'
              }}
              title={cert.title}
            >
              {cert.title}
            </span>
            <button
              onClick={onUpdate}
              style={{
                padding: '4px 14px',
                background: 'var(--canvas)',
                color: 'var(--ink)',
                border: '1px solid var(--hairline-strong)',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
                lineHeight: 1.5,
              }}
              onMouseEnter={(e) => {
                e.stopPropagation();
                e.currentTarget.style.borderColor = 'var(--ink)';
                e.currentTarget.style.background = 'var(--ink)';
                e.currentTarget.style.color = 'var(--canvas)';
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                e.currentTarget.style.borderColor = 'var(--hairline-strong)';
                e.currentTarget.style.background = 'var(--canvas)';
                e.currentTarget.style.color = 'var(--ink)';
              }}
            >
              [~] update content
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.05em' }}>
              {cert.code}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--mute)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cert.title}
            </span>
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

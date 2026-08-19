'use client';

import { useEffect, useState } from 'react';

export default function AlignmentPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [scraping, setScraping] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('https://learn.microsoft.com/en-us/azure/ai-services/language-service/conversational-language-understanding/overview');
  const [scrapeResult, setScrapeResult] = useState<any>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [alertRes, sourceRes] = await Promise.all([
          fetch('/api/alerts'),
          fetch('/api/sources'),
        ]);
        const alertData = await alertRes.json();
        const sourceData = await sourceRes.json();
        if (alertData.success) setAlerts(alertData.data);
        if (sourceData.success) setSources(sourceData.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleScrape() {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    setScrapeResult(null);
    setScrapeError(null);

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setScrapeResult(data.data);
        // Reload sources
        fetch('/api/sources').then((r) => r.json()).then((d) => {
          if (d.success) setSources(d.data);
        });
      } else {
        setScrapeError(data.error || 'scrape failed');
      }
    } catch (e: any) {
      setScrapeError(e?.message || 'unexpected error');
    } finally {
      setScraping(false);
    }
  }

  async function markAlertRead(alertId: string) {
    await fetch(`/api/alerts/${alertId}/read`, { method: 'POST' });
    setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, is_read: 1 } : a));
  }

  function alertTypeColor(type: string) {
    if (type === 'deprecated') return 'var(--danger)';
    if (type === 'updated') return 'var(--warning)';
    if (type === 'new_service') return 'var(--success)';
    if (type === 'breaking_change') return 'var(--danger)';
    return 'var(--mute)';
  }

  function alertTypePrefix(type: string) {
    if (type === 'deprecated') return '[-]';
    if (type === 'updated') return '[~]';
    if (type === 'new_service') return '[+]';
    if (type === 'breaking_change') return '[!]';
    return '[?]';
  }

  const unreadAlerts = alerts.filter((a) => !a.is_read);

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
          [+] alignment
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
          content alignment
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--body)', margin: 0, lineHeight: 1.5 }}>
          scrape official documentation via bright data to verify exam content is current.
          detect deprecated services and surface freshness alerts automatically.
        </p>
      </div>

      {/* Bright Data scraper — hackathon demo feature */}
      <div style={{ marginBottom: '48px' }}>
        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginBottom: '16px' }}>
          [&gt;] scrape official docs — powered by bright data
        </p>

        <div
          style={{
            padding: '24px',
            background: 'var(--surface-dark)',
            color: 'var(--on-dark)',
            marginBottom: '16px',
          }}
        >
          <p style={{ color: 'var(--ash)', fontSize: '13px', marginBottom: '8px' }}>
            $ bright data scraping browser (CDP via playwright)
          </p>
          <p style={{ color: 'var(--on-dark-mute)', fontSize: '14px', margin: '0 0 16px 0', lineHeight: 1.6 }}>
            delta uses bright data&apos;s scraping browser to fetch microsoft learn docs,
            extract objective-level changes, and flag stale questions before they
            appear on your exam. self-healing: if native fetch fails, the pipeline
            recovers via bright data cdp automatically.
          </p>
          <p style={{ color: 'var(--ash)', fontSize: '13px', margin: 0 }}>
            env: BRIGHT_DATA_WS_ENDPOINT — cdp websocket endpoint
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            type="text"
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
            style={{
              flex: 1,
              fontSize: '14px',
              padding: '8px 12px',
              background: 'var(--surface-soft)',
              color: 'var(--ink)',
              border: '1px solid var(--hairline)',
              borderRadius: '4px',
              fontFamily: 'inherit',
              height: '40px',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.target.style.background = 'var(--canvas)'; e.target.style.borderColor = 'var(--ink)'; }}
            onBlur={(e) => { e.target.style.background = 'var(--surface-soft)'; e.target.style.borderColor = 'var(--hairline)'; }}
            placeholder="https://learn.microsoft.com/..."
          />
          <button
            onClick={handleScrape}
            disabled={scraping || !scrapeUrl.trim()}
            style={{
              padding: '4px 20px',
              height: '40px',
              background: 'var(--ink)',
              color: 'var(--canvas)',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: scraping ? 'wait' : 'pointer',
              lineHeight: 2,
              opacity: scraping || !scrapeUrl.trim() ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            {scraping ? 'scraping...' : 'scrape →'}
          </button>
        </div>

        {/* Quick doc links */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {[
            { label: 'CLU overview', url: 'https://learn.microsoft.com/en-us/azure/ai-services/language-service/conversational-language-understanding/overview' },
            { label: 'Document Intelligence', url: 'https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/overview' },
            { label: 'Azure AI Search', url: 'https://learn.microsoft.com/en-us/azure/search/vector-search-overview' },
            { label: 'Azure AI Vision 4.0', url: 'https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-image-analysis' },
          ].map((link) => (
            <button
              key={link.url}
              onClick={() => setScrapeUrl(link.url)}
              style={{
                padding: '4px 8px',
                background: 'var(--surface-card)',
                color: 'var(--ink)',
                border: '1px solid var(--hairline)',
                borderRadius: '4px',
                fontSize: '13px',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {link.label}
            </button>
          ))}
        </div>

        {scrapeError && (
          <div
            style={{
              padding: '12px 16px',
              border: '1px solid var(--danger)',
              marginBottom: '16px',
            }}
          >
            <p style={{ fontSize: '14px', color: 'var(--danger)', margin: 0 }}>
              [-] {scrapeError}
            </p>
            {scrapeError.includes('not configured') && (
              <p style={{ fontSize: '13px', color: 'var(--mute)', margin: '8px 0 0 0' }}>
                set BRIGHT_DATA_WS_ENDPOINT or BRIGHT_DATA_API_KEY in .env to enable
                bright data scraping. without it, native fetch is used as fallback.
              </p>
            )}
          </div>
        )}

        {scrapeResult && (
          <div style={{ padding: '16px', background: 'var(--surface-dark)', color: 'var(--on-dark)' }}>
            <p style={{ color: 'var(--ash)', fontSize: '13px', marginBottom: '8px' }}>
              $ scrape result
            </p>
            <p style={{ color: 'var(--on-dark)', fontSize: '14px', marginBottom: '4px', fontWeight: 500 }}>
              {scrapeResult.title}
            </p>
            <p style={{ color: 'var(--ash)', fontSize: '13px', margin: '0 0 8px 0' }}>
              {scrapeResult.url}
            </p>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--on-dark-mute)' }}>
              <span>method: {scrapeResult.scrapeMethod}</span>
              <span>chars: {scrapeResult.rawContent?.length?.toLocaleString() ?? 0}</span>
              <span>hash: {scrapeResult.contentHash?.substring(0, 16)}...</span>
            </div>
            {scrapeResult.rawContent && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: 'var(--surface-dark-elevated)',
                  fontSize: '13px',
                  color: 'var(--on-dark-mute)',
                  lineHeight: 1.6,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  fontFamily: 'inherit',
                }}
              >
                {scrapeResult.rawContent.substring(0, 800)}
                {scrapeResult.rawContent.length > 800 && '...'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Freshness alerts */}
      <div style={{ marginBottom: '48px' }}>
        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginBottom: '16px' }}>
          [~] freshness alerts
          {unreadAlerts.length > 0 && (
            <span
              style={{
                marginLeft: '8px',
                fontSize: '13px',
                padding: '2px 8px',
                background: 'var(--surface-dark)',
                color: 'var(--on-dark)',
                borderRadius: '4px',
              }}
            >
              {unreadAlerts.length} new
            </span>
          )}
        </p>

        {loading ? (
          <div className="animate-pulse" style={{ height: '80px', background: 'var(--surface-card)' }} />
        ) : alerts.length === 0 ? (
          <p style={{ fontSize: '16px', color: 'var(--mute)' }}>
            [-] no freshness alerts — scrape official docs to detect changes
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--hairline)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  opacity: alert.is_read ? 0.5 : 1,
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    color: alertTypeColor(alert.alert_type),
                    flexShrink: 0,
                    marginTop: '3px',
                    minWidth: '24px',
                  }}
                >
                  {alertTypePrefix(alert.alert_type)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--ink)', margin: '0 0 4px 0' }}>
                    {alert.title}
                  </p>
                  <p style={{ fontSize: '14px', color: 'var(--body)', margin: '0 0 4px 0', lineHeight: 1.5 }}>
                    {alert.summary}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', color: 'var(--stone)' }}>
                      {alert.objective_code}: {alert.objective_title}
                    </span>
                    <span style={{ color: 'var(--hairline-strong)' }}>·</span>
                    <span style={{ fontSize: '13px', color: 'var(--stone)' }}>
                      {new Date(alert.detected_at).toLocaleDateString()}
                    </span>
                    {alert.source_url && (
                      <>
                        <span style={{ color: 'var(--hairline-strong)' }}>·</span>
                        <a
                          href={alert.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '13px', color: 'var(--mute)', textDecoration: 'underline' }}
                        >
                          source →
                        </a>
                      </>
                    )}
                  </div>
                </div>
                {!alert.is_read && (
                  <button
                    onClick={() => markAlertRead(alert.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--ash)',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      flexShrink: 0,
                    }}
                  >
                    [×]
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scraped sources history */}
      {sources.length > 0 && (
        <div>
          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginBottom: '16px' }}>
            [#] scraped sources
          </p>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sources.slice(0, 10).map((src) => (
              <div
                key={src.id}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--hairline)',
                }}
              >
                <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--ink)', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {src.title || src.url}
                </p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: 'var(--stone)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>{src.url}</span>
                  <span style={{ color: 'var(--hairline-strong)' }}>·</span>
                  <span
                    style={{
                      fontSize: '13px',
                      padding: '2px 8px',
                      border: `1px solid ${src.scrape_method === 'brightdata-cdp' ? 'var(--success)' : 'var(--hairline)'}`,
                      color: src.scrape_method === 'brightdata-cdp' ? 'var(--success)' : 'var(--mute)',
                      borderRadius: '4px',
                    }}
                  >
                    {src.scrape_method}
                  </span>
                  <span style={{ color: 'var(--hairline-strong)' }}>·</span>
                  <span style={{ fontSize: '13px', color: 'var(--stone)' }}>
                    {new Date(src.scraped_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

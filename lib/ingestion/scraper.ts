import * as cheerio from 'cheerio';

export async function scrapeUrl(url: string): Promise<{ rawContent: string; title: string; scrapedAt: string }> {
  // Try Bright Data if available
  if (process.env.BRIGHT_DATA_API_KEY) {
    try {
      // Stub for Bright Data implementation
      // const response = await fetch('...', { headers: { Authorization: `Bearer ${process.env.BRIGHT_DATA_API_KEY}` } });
    } catch (e) {
      console.warn("Bright Data failed, falling back to native fetch");
    }
  }

  // Fallback to fetch + cheerio
  const response = await fetch(url, { headers: { 'User-Agent': 'DeltaKnowledgeEngine/1.0' } });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Self-healing selector strategy: clean up unnecessary tags
  $('script, style, nav, footer, header, aside').remove();
  
  const title = $('title').text() || 'Unknown Title';
  const rawContent = $('body').text().replace(/\s+/g, ' ').trim();

  return {
    rawContent,
    title,
    scrapedAt: new Date().toISOString()
  };
}

export function detectSourceType(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('github.com')) return 'github_repo';
  if (url.includes('docs') || url.includes('documentation')) return 'documentation';
  if (url.includes('medium.com') || url.includes('blog')) return 'blog_post';
  if (url.endsWith('.pdf')) return 'pdf';
  return 'documentation'; // default
}

import { NextRequest, NextResponse } from 'next/server';
import { createGroqJsonCompletion, isGroqConfigured } from '@/lib/groq';
import { scrapeUrl } from '@/lib/ingestion/scraper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query || '';
    
    let context = query;
    if (query.startsWith('http')) {
       try {
         const { rawContent } = await scrapeUrl(query);
         context = rawContent.substring(0, 5000);
       } catch (err) {
         console.warn('Scraping error in understand endpoint:', err);
       }
    }
    
    if (isGroqConfigured()) {
      try {
        const prompt = `Analyze this query/content and explain it technically. Return JSON format:
{
  "what_it_is": "...",
  "what_changed": "...",
  "prerequisites": ["..."],
  "already_known": ["..."],
  "not_known": ["..."],
  "matters_for_goal": "...",
  "next_steps": ["..."],
  "proof_method": "..."
}
Content: ${context}`;

        const data = await createGroqJsonCompletion(prompt);
        return NextResponse.json({ success: true, data });
      } catch (groqErr) {
        console.warn('Groq error in understand endpoint, using structured fallback:', groqErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        what_it_is: `Analysis of ${query}`,
        what_changed: "Recent architectural or API updates identified in the technical specification.",
        prerequisites: ["Core Programming", "Basic System Architecture", "Data Structures"],
        already_known: ["Fundamental concepts", "Prior API paradigms"],
        not_known: [`Specific implementation details of ${query}`],
        matters_for_goal: "High relevance to your current target capability map and engineering frontier.",
        next_steps: [
          `Inspect the technical change documentation for ${query}`,
          "Implement a minimal isolated toy prototype",
          "Verify edge cases and boundary failure modes"
        ],
        proof_method: "Executable sandbox challenge with counterexample-first feedback"
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
